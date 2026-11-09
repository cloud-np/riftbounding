/**
 * Strict-rules intent entry point — §3.
 *
 * `applyRulesIntent(room, actorId, intent, ctx, host)` is the only write API. The wire shape is
 * validated first (malformed payloads become Verdicts, never thrown TypeErrors), then every
 * accepted intent advances HOT FEPR until a player decision is required (334). Rejections are
 * Verdicts carrying a rule number (§5).
 *
 * Dispatch is a static `Record` keyed by intent type. Each handler lives in its own file, so
 * wave R2 agents extend only their own intent and never this prologue.
 */
import type { AutoPassPrefs, GameEvent, Room, RulesIntent } from "@rift/protocol";
import type { RulesContext, RulesHost } from "../host";
import type { RulesFailure, RulesStepContext } from "../types";
import { fail } from "../types";
import { validateRulesIntent } from "../legality/intent";
import { advanceWithAuto } from "../auto/run";
import { noteDiscretionaryAction } from "../auto/prefs";
import { createRulesState, projectRules, restoreRulesState, setPhase, turnPlayerForRoom } from "../state";
import type { IntentContext, IntentHandler } from "./context";
import { handlePlay } from "./play";
import { handleActivate } from "./activate";
import { handleMove } from "./move";
import { handlePass } from "./pass";
import { handleEndTurn } from "./end-turn";
import { handleChoose } from "./choose";
import { handleManualDone } from "./manual-done";
import { handleConcede } from "./concede";
import { handleSetAutoPass } from "./set-auto-pass";

export type { IntentContext, IntentHandler, IntentResult } from "./context";

const CONTRACT_1 = "contract:§1";
const CONTRACT_2 = "contract:§2";

export interface RulesIntentSuccess {
  ok: true;
  room: Room;
  events: GameEvent[];
}

export type RulesIntentResult = RulesIntentSuccess | RulesFailure;

/** Static dispatch table — one entry per wire intent (§3). */
export const INTENT_HANDLERS: Record<RulesIntent["type"], IntentHandler> = {
  rules_play: handlePlay,
  rules_activate: handleActivate,
  rules_move: handleMove,
  rules_pass: handlePass,
  rules_end_turn: handleEndTurn,
  rules_choose: handleChoose,
  rules_manual_done: handleManualDone,
  rules_concede: handleConcede,
  rules_set_auto_pass: handleSetAutoPass,
};

/* ---------------------------------------------------------------- helpers */

function stepContext(ctx: RulesContext, host: RulesHost): RulesStepContext {
  return { ctx, host, events: [] };
}

/**
 * NEW-6 restore contract: a strict in-game room with no `rules` is reconstructed at Main from
 * its own turn fields (never by replaying Start of Turn). Returns whether state was created.
 */
function ensureRulesState(room: Room, host: RulesHost): boolean {
  if (room.rules) return false;
  room.rules = restoreRulesState(room, host);
  return true;
}

export interface StrictInitOptions {
  /**
   * Auto-pass preferences seeded for every seat when the `RulesState` is created
   * (`docs/rules/auto-pass.md`). Omitted: no seat gets automatic actions (R1–R4 behaviour).
   */
  autoPass?: AutoPassPrefs;
}

/** 302/315: first strict init when a strict room enters `in_game`. */
export function initializeStrictRules(
  room: Room,
  ctx: RulesContext,
  host: RulesHost,
  options: StrictInitOptions = {},
): Room {
  const draft = host.cloneRoom(room);
  if (draft.rulesMode !== "strict" || draft.phase !== "in_game") return draft;
  if (!draft.rules) {
    // 315: a real turn start, so this is the one path that DOES run Awaken/Channel/Draw.
    draft.rules = createRulesState(draft, host);
    draft.rules.turn.player = turnPlayerForRoom(draft, host);
    draft.rules.turn.number = Math.max(1, draft.turnNumber ?? 1);
    setPhase(draft.rules, "awaken");
    if (options.autoPass) {
      // Turn-scoped entries (passUntil / standing answers) never carry over into a new game.
      const { ownItems, responses, forcedPrompts, endTurn, hold } = options.autoPass;
      draft.rules.autoPass = Object.fromEntries(
        host.playerIds(draft).map((playerId) => [playerId, { ownItems, responses, forcedPrompts, endTurn, hold }]),
      );
    }
  }
  const step = stepContext(ctx, host);
  advanceWithAuto(draft, step);
  projectRules(draft, host);
  return draft;
}

/* ---------------------------------------------------------------- entry point */

export function applyRulesIntent(
  room: Room,
  actorId: string,
  intent: RulesIntent,
  ctx: RulesContext,
  host: RulesHost,
): RulesIntentResult {
  // F10: validate the wire shape before anything can throw or mutate.
  const shape = validateRulesIntent(intent);
  if (!shape.ok) return shape;
  const wire = shape.intent;

  if (room.rulesMode !== "strict") return fail("rules_require_strict", CONTRACT_1);
  if (room.phase !== "in_game") return fail("not_in_game", CONTRACT_2);
  if (room.gameOutcome) return fail("game_over", "474");
  if (!room.players.some((player) => player.id === actorId)) {
    return fail("illegal_action", "410", "unknown actor");
  }

  const draft = host.cloneRoom(room);
  const step = stepContext(ctx, host);
  // NEW-6/NEW-7: reconstruct a lost RulesState at Main from the Room's own turn fields and
  // emit `rules_restored`; never replay Start of Turn (no extra ready/channel/draw).
  if (ensureRulesState(draft, host)) {
    step.events.push({
      type: "rules_restored",
      playerId: draft.rules?.turn.player,
      data: { phase: draft.rules?.turn.phase, roomStep: room.activeTurnStep ?? null },
    });
  }
  const rules = draft.rules;
  if (!rules) return fail("rules_require_strict", CONTRACT_1);

  const context: IntentContext = { room: draft, rules, actorId, intent: wire, ctx, host, step };
  const handler = INTENT_HANDLERS[wire.type];
  if (!handler) return fail("unknown_intent", "contract:§5", wire.type);
  const handled = handler(context);
  if (!handled.ok) return handled;
  // Auto-pass: an opponent's Discretionary Action ends "pass until the opponent acts".
  noteDiscretionaryAction(draft, actorId, wire);

  const advanced = advanceWithAuto(draft, step, { actorId, intent: wire });
  if (advanced === "loop_guard") return fail("loop_guard", step.loopGuard?.rule ?? "334");
  projectRules(draft, host);
  draft.updatedAt = ctx.now;
  return { ok: true, room: draft, events: step.events };
}

export type { RulesState } from "@rift/protocol";
export type { RulesContext } from "../host";
