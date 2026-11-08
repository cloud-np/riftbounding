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
import { activationVerdict } from "../legality/activate";
import { chooseVerdict } from "../legality/choose";
import { endTurnVerdict } from "../legality/end-turn";
import { manualDoneVerdict } from "../legality/manual";
import { moveTimingVerdict } from "../legality/move";
import { passVerdict } from "../legality/pass";
import { playCardVerdict } from "../legality/play";
import { readableRulesRoom } from "./restore";

type ExplainFn = (room: Room, playerId: string, intent: RulesIntent, host: RulesHost) => Verdict;

const EXPLAIN_VERDICTS: Record<RulesIntent["type"], ExplainFn> = {
  rules_play: (room, playerId, intent, host) =>
    intent.type === "rules_play"
      ? playCardVerdict(room, playerId, intent.cardId, host, intent.location)
      : fail("unknown_intent", "contract:§5"),
  rules_activate: (room, playerId, intent, host) =>
    intent.type === "rules_activate"
      ? activationVerdict(room, playerId, intent.objectId, intent.ability, host)
      : fail("unknown_intent", "contract:§5"),
  rules_move: (room, playerId, intent, host) =>
    intent.type === "rules_move"
      ? moveTimingVerdict(room, playerId, intent.unitIds, String(intent.to), host)
      : fail("unknown_intent", "contract:§5"),
  rules_pass: (room, playerId) => passVerdict(room, playerId),
  rules_end_turn: (room, playerId) => endTurnVerdict(room, playerId),
  rules_choose: (room, playerId, intent) =>
    intent.type === "rules_choose"
      ? chooseVerdict(room, playerId, intent.promptId, intent.answer)
      : fail("unknown_intent", "contract:§5"),
  rules_manual_done: (room, playerId) => manualDoneVerdict(room, playerId),
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
