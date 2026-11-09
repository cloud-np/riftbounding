/**
 * Read-side strict view for clients (R2-int).
 *
 * `@rift/rules`' read API needs a `RulesHost` (board facts live in `Room`). Clients get the
 * engine host bound here so the strict board UI can enumerate `legalIntents`, show `whoMayAct`
 * and explain a rejection (`explainIllegal`) without depending on `@rift/rules` directly.
 *
 * Read only: the rules read side never mutates the room (N2) and needs no randomness, so the
 * context is fixed. Any throw (for example a redacted placeholder the layer does not expect)
 * degrades to `null` / a generic Verdict instead of breaking the board.
 */
import type { LegalIntents, Room, Verdict, WhoMayAct } from "@rift/protocol";
import { explainIllegal, legalIntents, turnState, whoMayAct, type RulesContext } from "@rift/rules";
import { createEngineRulesHost } from "./host";

function readContext(room: Room): RulesContext {
  return {
    now: room.updatedAt ?? 0,
    rng: () => 0,
    mode: room.roomMode ?? "multiplayer",
  };
}

function isStrictInGame(room: Room | null | undefined): room is Room {
  return !!room && room.rulesMode === "strict" && room.phase === "in_game" && !!room.rules;
}

/** `legalIntents` for one seat, or null outside a strict in-game room. */
export function strictLegalIntents(
  room: Room | null | undefined,
  playerId: string,
): LegalIntents | null {
  if (!isStrictInGame(room)) return null;
  try {
    return legalIntents(room, playerId, createEngineRulesHost(readContext(room)));
  } catch {
    return null;
  }
}

/** `whoMayAct`, or null outside a strict in-game room. */
export function strictWhoMayAct(room: Room | null | undefined): WhoMayAct | null {
  if (!isStrictInGame(room)) return null;
  try {
    return whoMayAct(room);
  } catch {
    return null;
  }
}

/** `turnState` (307–310), or null outside a strict in-game room. */
export function strictTurnState(
  room: Room | null | undefined,
): ReturnType<typeof turnState> | null {
  if (!isStrictInGame(room)) return null;
  try {
    return turnState(room);
  } catch {
    return null;
  }
}

/** §5: why `intent` would be rejected for `playerId` (`{ ok: true }` when it is legal). */
export function strictExplainIllegal(room: Room, playerId: string, intent: unknown): Verdict {
  try {
    return explainIllegal(room, playerId, intent, createEngineRulesHost(readContext(room)));
  } catch {
    return { ok: false, code: "illegal_action", rule: "contract:§5" };
  }
}
