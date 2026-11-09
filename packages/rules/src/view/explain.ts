/**
 * Rejection explanations (§5) — the same verdict functions the write path uses (F5–F7).
 *
 * Dispatch is a plain `Record` keyed by intent type: wave R2 agents add/change only the
 * per-intent verdict implementation in `legality/`, never this dispatcher.
 */
import type { Room, RulesIntent, Verdict } from "@rift/protocol";
import type { RulesHost } from "../host";
import { fail } from "../types";
import { validateRulesIntent } from "../legality/intent";
import { activateIntentVerdict } from "../legality/activate";
import { chooseVerdict } from "../legality/choose";
import { concedeVerdict } from "../legality/concede";
import { endTurnVerdict } from "../legality/end-turn";
import { manualDoneVerdict } from "../legality/manual";
import { moveTimingVerdict } from "../legality/move";
import { passVerdict } from "../legality/pass";
import { playIntentVerdict } from "../legality/play";
import { readableRulesRoom } from "./restore";

type ExplainFn = (room: Room, playerId: string, intent: RulesIntent, host: RulesHost) => Verdict;

/** Verdicts carry their plan internally; explanations only expose `{ ok: true }` or the failure. */
function stripPlan(verdict: Verdict): Verdict {
  return verdict.ok ? { ok: true } : verdict;
}

const EXPLAIN_VERDICTS: Record<RulesIntent["type"], ExplainFn> = {
  rules_play: (room, playerId, intent, host) =>
    intent.type === "rules_play"
      ? stripPlan(playIntentVerdict(room, playerId, intent, host))
      : fail("unknown_intent", "contract:§5"),
  rules_activate: (room, playerId, intent, host) =>
    intent.type === "rules_activate"
      ? stripPlan(activateIntentVerdict(room, playerId, intent, host))
      : fail("unknown_intent", "contract:§5"),
  rules_move: (room, playerId, intent, host) =>
    intent.type === "rules_move"
      ? moveTimingVerdict(room, playerId, intent.unitIds, String(intent.to), host)
      : fail("unknown_intent", "contract:§5"),
  rules_pass: (room, playerId) => passVerdict(room, playerId),
  rules_end_turn: (room, playerId) => endTurnVerdict(room, playerId),
  rules_choose: (room, playerId, intent, host) =>
    intent.type === "rules_choose"
      ? chooseVerdict(room, playerId, intent.promptId, intent.answer, host)
      : fail("unknown_intent", "contract:§5"),
  rules_manual_done: (room, playerId) => manualDoneVerdict(room, playerId),
  rules_concede: (room, playerId, _intent, host) => concedeVerdict(room, playerId, host),
  // Preferences are not a game action: legal for any player still in the game (like 650).
  rules_set_auto_pass: (room, playerId, _intent, host) => concedeVerdict(room, playerId, host),
};

/** §5: why an intent would be rejected, for tooltips/toasts. Mirrors the write path. */
export function explainIllegal(
  room: Room,
  playerId: string,
  intent: unknown,
  host: RulesHost,
): Verdict {
  // Same wire-shape verdict as the write path, before any state-dependent check.
  const shape = validateRulesIntent(intent);
  if (!shape.ok) return shape;
  // NEW-7: same restore path as `applyRulesIntent`, on a clone (never mutating the input).
  const readable = readableRulesRoom(room, host);
  if (!readable.ok) return readable;
  return EXPLAIN_VERDICTS[shape.intent.type](readable.room, playerId, shape.intent, host);
}
