/**
 * Phase tasks — rules 315–317, 333/334.
 *
 * The Start-of-Turn / Ending-Phase order is fixed here; each handler advances the phase when
 * complete. The 317.2 Expiration Step and its 317.2.f repeat live in this file because they are
 * phase machinery (the combat/effects domains use the hook points instead).
 */
import type { Room, Task } from "@rift/protocol";
import type { RulesStepContext } from "../../types";
import { pushEvent } from "../../types";
import { clearPasses, grantFocus, grantPriority, setPhase } from "../../state";
import { runCleanup, type CleanupInsertStep } from "../../cleanup/cleanup";
import { holdBattlefields } from "../../scoring/score";
import { channelRunes, drawCards, emptyPools, readyAll } from "../../actions/primitives";
import { getTaskHandler, registerTaskHandler } from "./registry";

/**
 * 317.2.a–d / 324.1: the Expiration Step is an Ending Special Cleanup: the normal 323 order
 * with 3c (heal), 3d (this-turn effects expire) and 3e (pools empty) inserted after 3a.
 */
export const EXPIRATION_INSERTS: CleanupInsertStep[] = [
  "heal-all-units",
  "expire-this-turn",
  "empty-pools",
];

/** 317.2.f / errata: how many times the Expiration Step may restart before the guard fires. */
export const MAX_EXPIRATION_PASSES = 12;

/** Events that show an item underwent (or was queued for) the FEPR process (333–340). */
const FEPR_EVENTS: ReadonlySet<string> = new Set([
  "finalize",
  "chain_append",
  "spell_resolved",
  "unit_played",
  "gear_played",
  "manual_window",
  "manual_done",
]);

/* ---------------------------------------------------------------- phase handlers */

registerTaskHandler("ready-all", ({ room, step, playerId }) => {
  // 315.1: the Turn Player readies all Game Objects they control.
  readyAll(room, playerId, step);
  setPhase(room.rules!, "beginning", "beginning");
  return "continue";
});

registerTaskHandler("hold", ({ room, step, playerId }) => {
  // 315.2: Hold all battlefields they control.
  const points = holdBattlefields(room, playerId, step);
  pushEvent(step.events, { type: "hold_scoring", playerId, amount: points });
  setPhase(room.rules!, "channel");
  runCleanup(room, step);
  return "continue";
});

registerTaskHandler("channel", ({ room, step, playerId }) => {
  // 315.3.b.1: channel 2, or as many as possible. 487.7 / 489.7 / 490.7 / 491.7 add the
  // mode's first-turn extra Rune for the player going second/last.
  channelRunes(room, playerId, firstTurnChannelCount(room, playerId, step), step);
  setPhase(room.rules!, "draw");
  return "continue";
});

registerTaskHandler("draw", ({ room, step, playerId, task }) => {
  const rules = room.rules!;
  // 315.4.b: draw 1; an empty deck causes a Burn Out first (432).
  // 489.7 / 490.7 / 491.7: in 3+ player modes the player going first skips their first draw.
  // A resumed draw after a Burn Out prompt carries `data.resumeDraws` (432.2.d) and must not
  // run the first-draw skip again or requeue a fresh `draw 1`.
  const resumeDraws =
    typeof task.data?.resumeDraws === "number" ? Math.max(0, Math.trunc(task.data.resumeDraws)) : null;
  if (resumeDraws === null && skipsFirstDraw(room, playerId, step)) {
    setPhase(rules, "main");
    queueTask(room, { kind: "empty-pools", playerId }, step);
    return "continue";
  }
  const result = drawCards(room, playerId, resumeDraws ?? 1, step, { resumeViaTask: true });
  if (result.awaitingPrompt) {
    // The Burn Out prompt handler queues the continuation draw after the answer (432.2.d).
    return "await";
  }
  setPhase(rules, "main");
  queueTask(room, { kind: "empty-pools", playerId }, step);
  return "continue";
});

registerTaskHandler("empty-pools", ({ room, step }) => {
  const rules = room.rules!;
  // 316.3 / 167: each player's Rune Pool empties at the start of Main.
  emptyPools(room, step);
  runCleanup(room, step);
  if (rules.showdown) {
    if (!rules.focus) grantFocus(rules, rules.contested[rules.showdown.battlefield] ?? rules.turn.player);
  } else {
    grantPriority(rules, rules.turn.player);
  }
  return "continue";
});

registerTaskHandler("cleanup", ({ room, step, task }) => {
  // CleanupOptions.maxPasses is a test/extension bound; a queued cleanup task may carry it so
  // the 322 loop guard is reachable through `applyRulesIntent` (N6).
  const maxPasses = typeof task.data?.maxPasses === "number" ? task.data.maxPasses : undefined;
  runCleanup(room, step, maxPasses === undefined ? {} : { maxPasses });
  return "continue";
});

registerTaskHandler("ending", ({ room, step }) => {
  // 317.1: ending-step game effects take place.
  setPhase(room.rules!, "ending", "expiration");
  pushEvent(step.events, { type: "ending_step", playerId: room.rules!.turn.player });
  queueTask(room, { kind: "expiration", playerId: room.rules!.turn.player }, step);
  return "continue";
});

registerTaskHandler("expiration", ({ room, step }) => {
  // 317.2: Ending Special Cleanup. 317.2.f repeats the whole step when an item underwent
  // the FEPR process during it (errata: "Loopy Expiration Step").
  runExpirationStep(room, step);
  return "continue";
});

registerTaskHandler("start-turn", ({ room, step, playerId }) => {
  setPhase(room.rules!, "awaken");
  queueTask(room, { kind: "ready-all", playerId }, step);
  return "continue";
});

/* ---------------------------------------------------------------- task queue */

export function queueTask(
  room: Room,
  task: Omit<Task, "id">,
  step: RulesStepContext,
): Task | null {
  const rules = room.rules;
  if (!rules) return null;
  const entry: Task = { ...task, id: step.host.nextId("task") };
  rules.tasks.push(entry);
  return entry;
}

export function processNextTask(room: Room, step: RulesStepContext): "continue" | "await" {
  const rules = room.rules;
  if (!rules) return "continue";
  const task = rules.tasks[0];
  if (!task) return "continue";
  rules.tasks.shift();
  const playerId = task.playerId ?? rules.turn.player;
  const handler = getTaskHandler(task.kind);
  if (!handler) return "continue";
  return handler({ room, task, step, playerId });
}

/**
 * 317.2: one pass of the Expiration Step.
 *
 * 317.2.a invokes an Ending Special Cleanup; 317.2.b–d insert 3c/3d/3e after 3a (so lethal damage
 * kills first). 317.2.f + the Unleashed errata ("NEW RULE: If any items underwent the FEPR
 * process during the Expiration Step, return to the start of the Expiration Step") repeats the
 * step.
 *
 * FEPR detection is persisted in `RulesState.turn.expirationFepr` (`timing/fepr.ts` increments it
 * whenever an item enters FEPR while ending/expiration), so a trigger that gains priority during
 * the step and resolves in a later intent still forces the restart. `turn.expirationPasses`
 * bounds the repeat (F4/N6): hitting it sets `step.loopGuard` so `applyRulesIntent` returns a
 * `loop_guard` Verdict.
 *
 * Returns whether the step restarted, and how many FEPR items were observed in this pass.
 */
export function runExpirationStep(
  room: Room,
  step: RulesStepContext,
  options: { extraInserts?: CleanupInsertStep[] } = {},
): { feprItems: number; repeated: boolean } {
  const rules = room.rules;
  if (!rules) return { feprItems: 0, repeated: false };
  if (room.gameOutcome) return { feprItems: 0, repeated: false };

  const pass = (rules.turn.expirationPasses ?? 0) + 1;
  rules.turn.expirationPasses = pass;
  pushEvent(step.events, { type: "expiration_pass", data: { pass } });

  const pendingBefore = rules.turn.expirationFepr ?? 0;
  const chainBefore = rules.chain.length;
  const triggersBefore = rules.triggers.length;
  const eventStart = step.events.length;

  runCleanup(room, step, {
    insert: {
      after: "3a",
      steps: [...EXPIRATION_INSERTS, ...(options.extraInserts ?? [])],
    },
  });

  // "Any items underwent the FEPR process": pending/finalized chain items, queued triggers, or
  // an item that was finalized/resolved entirely within the cleanup (visible through events).
  // `expirationFepr` is the durable detector; the local scan is a fallback for direct helper
  // calls and synthetic cleanup steps, guarding against double counting the durable increments.
  const feprEvents = step.events
    .slice(eventStart)
    .filter((event) => FEPR_EVENTS.has(event.type)).length;
  const localFepr =
    feprEvents +
    (rules.chain.length > chainBefore ? 1 : 0) +
    (rules.triggers.length > triggersBefore ? 1 : 0);
  if (localFepr > 0 && (rules.turn.expirationFepr ?? 0) === pendingBefore) {
    rules.turn.expirationFepr = pendingBefore + localFepr;
  }
  const pendingFepr = rules.turn.expirationFepr ?? 0;

  if (room.gameOutcome) return { feprItems: localFepr, repeated: false };

  // 321/324.2/334: finishing the Expiration Step now would wipe a window that still has to be
  // resolved (a prompt/manual window, an open showdown/combat, chain/trigger work or tasks).
  const blocking =
    !!rules.prompt ||
    !!rules.manual ||
    !!rules.showdown ||
    !!rules.combat ||
    rules.chain.length > 0 ||
    rules.triggers.length > 0 ||
    rules.tasks.length > 0;

  if (pendingFepr === 0 && !blocking) {
    // 317.3: no FEPR work → the next queued player becomes the Turn Player.
    startNextTurn(room, step);
    return { feprItems: 0, repeated: false };
  }

  if (pass >= MAX_EXPIRATION_PASSES) {
    // N6: fail loudly instead of silently ending a still-changing Expiration Step.
    step.loopGuard ??= { rule: "317.2.f" };
    pushEvent(step.events, {
      type: "loop_guard",
      data: { rule: "317.2.f", passes: MAX_EXPIRATION_PASSES },
    });
    startNextTurn(room, step);
    return { feprItems: localFepr, repeated: false };
  }

  // 317.2.f: return to the start of the Expiration Step. When nothing blocks, this pass performs
  // the restart itself, so the recorded FEPR work is acknowledged now. While a chain/trigger/
  // prompt is still pending, acknowledgement waits for the pass after it resolves.
  if (!blocking) rules.turn.expirationFepr = 0;
  setPhase(rules, "ending", "expiration");
  if (pendingFepr > 0) {
    // 317.2.f (NEW-9): only items that actually underwent FEPR justify a repeat.
    pushEvent(step.events, {
      type: "expiration_repeat",
      data: { pass, feprItems: pendingFepr, blocking },
    });
  } else {
    // Blocking without FEPR work is not a 317.2.f repeat; pause and resume after the window.
    pushEvent(step.events, {
      type: "expiration_paused",
      data: { pass, feprItems: 0, blocking },
    });
  }
  return { feprItems: localFepr, repeated: pendingFepr > 0 };
}

/** 315.3.b.1 + mode first-turn adjustments (487.7 / 489.7 / 490.7 / 491.7). */
export function firstTurnChannelCount(room: Room, playerId: string, step: RulesStepContext): number {
  const active = step.host.activePlayerIds(room);
  const firstTurn = (room.playerTurnCounts?.[playerId] ?? 1) <= 1;
  if (!firstTurn || active.length === 0) return 2;
  if (active.length === 2) {
    // Duel: the player going second channels an extra Rune on their first Channel Phase.
    return room.firstPlayerId && playerId !== room.firstPlayerId ? 3 : 2;
  }
  // 3+ player modes: the player going last channels an extra Rune.
  const order = step.host.turnOrder(room);
  const last = order[order.length - 1];
  return last && playerId === last ? 3 : 2;
}

/** 489.7 / 490.7 / 491.7: in 3+ player modes the player going first does not draw first turn. */
export function skipsFirstDraw(room: Room, playerId: string, step: RulesStepContext): boolean {
  const active = step.host.activePlayerIds(room);
  const firstTurn = (room.playerTurnCounts?.[playerId] ?? 1) <= 1;
  if (!firstTurn || active.length <= 2) return false;
  return !!room.firstPlayerId && playerId === room.firstPlayerId;
}

/** 317.3 / 306 / 734–738: hand the turn to the next queued player and begin Start of Turn. */
export function startNextTurn(room: Room, step: RulesStepContext): void {
  const rules = room.rules;
  if (!rules) return;
  pushEvent(step.events, { type: "turn_end", playerId: rules.turn.player, data: { number: rules.turn.number } });
  const current = rules.turn.player;
  const next = step.host.nextTurnPlayerId(room, current) ?? current;

  rules.turn = { player: next, number: rules.turn.number + 1, phase: "awaken" };
  clearPasses(rules);
  rules.priority = null;
  rules.focus = null;
  rules.chain = [];
  rules.showdown = null;
  rules.combat = null;
  rules.staged = { showdowns: [], combats: [] };
  rules.contested = {};
  rules.tasks = [];
  rules.prompt = null;
  rules.manual = null;
  rules.triggers = [];
  // 472: clear the previous turn's Scoring record first, then initialise this turn's per-player
  // empty arrays. (The old order let `clearScored` wipe the fresh arrays to `{}`.)
  step.host.clearScored(room);
  rules.scoredThisTurn = Object.fromEntries(step.host.playerIds(room).map((id) => [id, []]));
  rules.history = {
    cardsPlayedThisTurn: Object.fromEntries(step.host.playerIds(room).map((id) => [id, 0])),
    unitsPlayedThisTurn: {},
  };
  for (const object of Object.values(rules.objects)) {
    delete object.enteredThisTurn;
    delete object.movedThisTurn;
    delete object.attackedThisTurn;
    delete object.damagedThisTurn;
  }
  const counts = { ...(room.playerTurnCounts ?? {}) };
  counts[next] = (counts[next] ?? 0) + 1;
  room.playerTurnCounts = counts;
  setPhase(rules, "awaken");
  queueTask(room, { kind: "ready-all", playerId: next }, step);
  pushEvent(step.events, { type: "turn_start", playerId: next, data: { number: rules.turn.number } });
}
