/**
 * Cleanups — rules 318–324.
 *
 * The step order follows 323 exactly. Combat-specific steps delegate to `combat/` (323.2,
 * 323.8, 323.13) and are replaced by R2. Cleanups repeat until nothing changed (322) but the
 * recursion is bounded so a bug can never freeze the server; hitting the bound emits a
 * `loop_guard` event instead of silently stopping (322/324.2).
 *
 * 324.1 Special Cleanups insert their own steps into the normal 323 order. The Expiration Step
 * (317.2.a–d) inserts 3c/3d/3e after 3a; the Combat Cleanup (468.1.a) inserts 3c/3d the same
 * way. Inserted steps run before step 4 and any follow-up cleanup is a NORMAL cleanup (324.2).
 */
import type { BattlefieldZone, Room } from "@rift/protocol";
import type { RulesStepContext } from "../types";
import { effectiveMight, pushEvent } from "../types";
import {
  stageCombat,
  stageShowdown,
  turnState,
  unstageCombat,
  unstageShowdown,
} from "../turn-state";
import { checkVictory } from "../scoring/score";
import { beginCombat, designateCombatants } from "../combat";
import { beginShowdown } from "../timing/showdown";
import { gatherUnits } from "../actions/board";
import { emptyPools, heal, kill, recall } from "../actions/primitives";
import { PROMPT_REASONS } from "../prompts/reasons";
import { runCleanupHooks } from "../timing/hooks";
import { turnOrderStartingAt } from "../state/turn";

/** 322: how many times a cleanup may repeat before the guard fires. */
export const MAX_CLEANUP_PASSES = 12;

/** 317.2.b–d / 468.1.a: the named steps a Special Cleanup may insert after step 3a. */
export type CleanupInsertStepId =
  | "heal-all-units"
  | "expire-this-turn"
  | "empty-pools"
  | "recall-attackers";

/** Extension point for R2 trigger/replacement work inside a Special Cleanup. */
export interface CleanupCustomInsertStep {
  kind: "custom";
  id: string;
  apply: (room: Room, step: RulesStepContext) => void;
}

export type CleanupInsertStep = CleanupInsertStepId | CleanupCustomInsertStep;

/** 324.1: inserted steps run after an existing 323 step and before the next one. */
export interface CleanupInsert {
  after: "3a";
  steps: CleanupInsertStep[];
}

export interface CleanupOptions {
  insert?: CleanupInsert;
  /** Internal 322 recursion depth. */
  depth?: number;
  /** Test/extension override for the 322 bound (defaults to MAX_CLEANUP_PASSES). */
  maxPasses?: number;
}

/**
 * 318/323: run one cleanup to a fixed point. Returns true when the game state changed.
 * `depth` guards against pathological recursion (322).
 */
export function runCleanup(
  room: Room,
  step: RulesStepContext,
  optionsOrDepth: CleanupOptions | number = {},
): boolean {
  const options: CleanupOptions =
    typeof optionsOrDepth === "number" ? { depth: optionsOrDepth } : optionsOrDepth;
  const rules = room.rules;
  if (!rules) return false;
  if (room.gameOutcome) return false;
  // NEW-10 / 321: while a Chain Item is Resolving (manual or prompt window open), a Cleanup
  // cannot occur; it becomes an Outstanding Task (321.1) exactly like `runCleanupOrQueue`.
  // `advance` uses the guarded path too, so no call site can run a cleanup mid-resolution.
  if (rules.manual || rules.prompt) {
    if (!rules.tasks.some((task) => task.kind === "cleanup")) {
      rules.tasks.push({ id: step.host.nextId("task"), kind: "cleanup" });
    }
    return false;
  }
  const before = step.events.length;
  const startTurn = rules.turn.number;
  const depth = Math.max(0, options.depth ?? 0);
  const maxPasses = Math.max(1, options.maxPasses ?? MAX_CLEANUP_PASSES);

  // 1. Victory (323.1 / 474).
  if (checkVictory(room, step).length > 0) return true;

  // 2. Attacker/Defender designations (323.2 / 323.2.c).
  designateCombatants(room, step);

  // 3. Lethal damage kills (323.3–323.4). This MUST run before the 3c heal of a Special
  // Cleanup: a Unit with lethal damage marked at end of turn dies instead of being healed.
  // 323.4/429: the kill routes the card to its OWNER's Trash and only clears the rules object
  // after the move succeeds.
  for (const [cardId, object] of Object.entries(rules.objects)) {
    if (!object.damage) continue;
    const located = step.host.findCard(room, cardId);
    if (!located) continue;
    const info = step.host.cardInfo(room, cardId);
    if (!info?.type.toLowerCase().includes("unit")) continue;
    if (object.damage >= effectiveMight(room, cardId, step.host)) {
      kill(room, cardId, step);
    }
  }

  // 324.1: Special Cleanup inserts (Expiration 3c/3d/3e, Combat 3c/3d) go after 3a and before
  // step 4. Follow-up cleanups deliberately run without inserts (324.2).
  if (options.insert?.after === "3a") {
    for (const inserted of options.insert.steps) runInsertedStep(room, step, inserted);
  }
  // R2-effects extension point (324.1): run after the inserted 3c/3d/3e steps, before step 4.
  runCleanupHooks("afterStep3a", room, step);

  // 4. Control loss (323.5) is derived from unit presence (190.4); nothing to store.

  // 5. Recall unattached gear/rune at battlefields; purge foreign hidden cards (323.6).
  for (const player of room.players) {
    if (!player.board) continue;
    for (const zone of step.host.battlefieldZones(room)) {
      for (const card of step.host.zoneCards(room, player.id, zone)) {
        const info = step.host.cardInfo(room, card.id);
        const type = (info?.type ?? "").toLowerCase();
        if (type.includes("rune")) {
          step.host.moveCard(room, player.id, zone, "base", card.id);
          pushEvent(step.events, { type: "recall", cardId: card.id, playerId: player.id, zone });
          continue;
        }
        if (type.includes("gear") && !type.includes("unit") && !card.attachedToCardId) {
          step.host.moveCard(room, player.id, zone, "base", card.id);
          pushEvent(step.events, { type: "recall", cardId: card.id, playerId: player.id, zone });
          continue;
        }
        if (card.hidden) {
          const owners = step.host
            .activePlayerIds(room)
            .filter((id) => step.host.hasUnitAt(room, id, zone));
          if (owners.length !== 1 || owners[0] !== card.ownerPlayerId) {
            step.host.moveCard(room, player.id, zone, "trash", card.id);
            pushEvent(step.events, { type: "hidden_card_to_trash", cardId: card.id, playerId: player.id, zone });
          }
        }
      }
    }
  }

  // 6/7. Stage showdowns and combats (323.7–323.9).
  for (const zone of step.host.battlefieldZones(room)) {
    const contestants = step.host.activePlayerIds(room).filter((id) => step.host.hasUnitAt(room, id, zone));
    const contestedBy = rules.contested[zone];
    const showdownHere = rules.showdown?.battlefield === zone;
    if (contestedBy && !rules.combat && contestants.length >= 2) {
      // 323.8 + 323.11: Combat includes its own Showdown, so do not stage a standalone one.
      unstageShowdown(rules, zone);
      stageCombat(rules, zone);
    } else if (contestedBy && !rules.combat && contestants.length === 1 && contestants[0] === contestedBy) {
      if (!showdownHere) stageShowdown(rules, zone);
      unstageCombat(rules, zone);
    } else if (contestedBy && !rules.combat && contestants.length === 0) {
      unstageShowdown(rules, zone);
      unstageCombat(rules, zone);
    }
  }
  // 323.9: a staged combat whose opposing units left ceases to be staged.
  for (const zone of [...rules.staged.combats]) {
    const contestants = step.host.activePlayerIds(room).filter((id) => step.host.hasUnitAt(room, id, zone));
    if (contestants.length < 2 || rules.combat) unstageCombat(rules, zone);
  }

  // 8. Remove Contested when the applier has no units and nothing is ongoing (323.10), then
  // re-apply Contested per 323.10.a when removal leaves units at an uncontested battlefield.
  for (const zone of step.host.battlefieldZones(room)) {
    const contestedBy = rules.contested[zone];
    if (!contestedBy) {
      // 303.2.a / 323.8: simultaneous contestants are ordered from the Turn Player.
      const contestants = turnOrderStartingAt(room, rules.turn.player, step.host).filter((id) =>
        step.host.hasUnitAt(room, id, zone),
      );
      if (contestants.length >= 2) {
        // NEW-8: applying Contested is an observable game action — emit it and let the changed
        // state drive the 322 repeat so the next pass stages the Showdown/Combat (323.7/323.8).
        rules.contested[zone] = contestants[0]!;
        pushEvent(step.events, {
          type: "contested",
          playerId: contestants[0],
          zone,
          data: { rule: "323.8" },
        });
      }
      continue;
    }
    const ongoing =
      (rules.showdown?.battlefield === zone) || (rules.combat?.battlefield === zone);
    if (!ongoing && !step.host.hasUnitAt(room, contestedBy, zone)) {
      delete rules.contested[zone];
      unstageShowdown(rules, zone);
      unstageCombat(rules, zone);
      // 323.10.a: the removal leaves an uncontested battlefield where another player's Units
      // are present; that controller applies Contested status to the Battlefield.
      const remaining = step.host
        .activePlayerIds(room)
        .filter((id) => step.host.hasUnitAt(room, id, zone));
      if (remaining.length > 0) {
        rules.contested[zone] = remaining[0]!;
        pushEvent(step.events, {
          type: "contested_reapplied",
          playerId: remaining[0],
          zone,
          data: { rule: "323.10.a" },
        });
      }
    }
  }

  // 411.2 / 312.1.b.1: while a Limited Action prompt is pending the cleanup must not open any
  // new showdown/combat window.
  if (rules.prompt) {
    const changedWhilePrompt = step.events.length > before;
    return changedWhilePrompt;
  }

  // 9. Neutral Open: the Turn Player chooses a staged showdown without a Combat staged (323.11).
  const stagedShowdowns = rules.staged.showdowns.filter((zone) => !rules.staged.combats.includes(zone));
  if (turnState(room) === "neutral_open" && stagedShowdowns.length > 1) {
    rules.prompt = {
      id: step.host.nextId("prompt"),
      kind: "choose-battlefield",
      playerId: rules.turn.player,
      promptKey: "rules.prompt.chooseShowdownBattlefield",
      rule: "323.11",
      options: stagedShowdowns.map((zone) => ({ id: zone, zone })),
      min: 1,
      max: 1,
      data: { reason: PROMPT_REASONS.stageShowdown },
    };
    pushEvent(step.events, { type: "prompt", playerId: rules.turn.player, data: { kind: "choose-battlefield" } });
    return true;
  }
  if (turnState(room) === "neutral_open" && stagedShowdowns.length === 1) {
    const zone = stagedShowdowns[0]!;
    const contestedBy = rules.contested[zone] ?? rules.turn.player;
    beginShowdown(room, zone, "non_combat", contestedBy, step);
    // `beginShowdown` unstages the zone.
  }

  // 10. Neutral Open: the Turn Player chooses a staged Combat (323.12). A single staged combat
  // still begins automatically; several become a Limited-Action prompt.
  if (turnState(room) === "neutral_open" && rules.staged.combats.length > 0) {
    if (rules.staged.combats.length === 1) {
      beginCombat(room, rules.staged.combats[0]!, step);
    } else {
      rules.prompt = {
        id: step.host.nextId("prompt"),
        kind: "choose-battlefield",
        playerId: rules.turn.player,
        promptKey: "rules.prompt.chooseCombatBattlefield",
        rule: "323.12",
        options: rules.staged.combats.map((zone) => ({ id: zone, zone })),
        min: 1,
        max: 1,
        data: { reason: PROMPT_REASONS.stageCombat },
      };
      pushEvent(step.events, { type: "prompt", playerId: rules.turn.player, data: { kind: "choose-battlefield" } });
      return true;
    }
  }

  // 11. Showdown Open + staged Combat at the same battlefield → Combat Showdown (323.13).
  // 466.2.c.1.b: the player who already has Focus keeps it, so `beginCombat` must see the
  // ongoing non-combat showdown instead of having it cleared here first.
  if (
    turnState(room) === "showdown_open" &&
    rules.showdown?.kind === "non_combat" &&
    rules.staged.combats.includes(rules.showdown.battlefield)
  ) {
    const zone = rules.showdown.battlefield;
    beginCombat(room, zone, step, { preserveFocus: true });
  }

  const changed = step.events.length > before || rules.turn.number !== startTurn;
  // R2-effects extension point: layer/continuous-effect refresh after any state change.
  runCleanupHooks("afterStateChange", room, step);
  if (changed && !room.gameOutcome) {
    if (depth + 1 < maxPasses) {
      // 322/NEW-4: the configured bound (and the insert-less 324.2 follow-up) is preserved.
      return runCleanup(room, step, { depth: depth + 1, maxPasses }) || changed;
    }
    // 322: the state still changes after the bound. Fail loudly instead of silently stopping:
    // `applyRulesIntent`/`advance` turn `step.loopGuard` into a Verdict (§5, N6).
    step.loopGuard ??= { rule: "322" };
    pushEvent(step.events, {
      type: "loop_guard",
      data: { rule: "322", passes: maxPasses },
    });
  }
  return changed;
}

/** Execute one 324.1 inserted step. */
function runInsertedStep(room: Room, step: RulesStepContext, inserted: CleanupInsertStep): void {
  const rules = room.rules;
  if (!rules) return;
  if (typeof inserted !== "string") {
    inserted.apply(room, step);
    return;
  }
  switch (inserted) {
    case "heal-all-units": {
      // 317.2.b / 468.1.a.1: "3c. Heal all Units."
      for (const card of gatherUnits(room, step)) heal(room, card.id, 999, step);
      return;
    }
    case "expire-this-turn": {
      // 317.2.c: "3d. All 'this turn' effects expire simultaneously." Also clears transient
      // per-turn object state (424.1.a.2 stun, 323.2.c lingering designations).
      rules.effects = rules.effects.filter(
        (effect) => effect.duration !== "this-turn" && effect.duration !== "until-next-ending",
      );
      for (const [objectId, object] of Object.entries(rules.objects)) {
        delete object.stunned;
        delete object.designation;
        delete object.temporaryMight;
        if (
          !object.buffs &&
          !object.baseMight &&
          !object.counters &&
          !object.grantedKeywords?.length &&
          !object.grantedAbilities?.length
        ) {
          delete rules.objects[objectId];
        }
      }
      return;
    }
    case "empty-pools": {
      // 317.2.d / 167: "3e. Each player's Rune Pool empties. Any unspent Energy and Power are lost."
      emptyPools(room, step);
      return;
    }
    case "recall-attackers": {
      // 468.1.a.2: recall Attackers present at the Battlefield if Defenders are still present.
      const combat = rules.combat;
      if (!combat) return;
      if (!step.host.hasUnitAt(room, combat.defender, combat.battlefield)) return;
      for (const card of step.host.unitsAt(room, combat.battlefield, combat.attacker)) {
        recall(room, card.id, step);
      }
      return;
    }
  }
}
