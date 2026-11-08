/**
 * Match-advance navigation helpers (B22).
 *
 * The original client follows a linked room as soon as the room shell carries a
 * different `nextRoomCode` (`35qz5rkx7yexy.js:38659-38690`): it swaps the active
 * session's `roomCode`, clears the old `lastKnownPhase` and sets
 * `sideboarding` for an ongoing BO3 series or `battlefield_pick` otherwise.
 * `returnLobbyRoomCode` is the fresh shared lobby room allocated by
 * `return_to_lobby` (`MatchRoomCore.httpReturnToLobby`).
 */

import type { RoomSessionDoc } from "@rift/protocol";

import type { GameSession } from "@/components/lobby/integration/session";

export type LinkedRoomPhase = "battlefield_pick" | "sideboarding";

/** `35qz5rkx7yexy.js:38659` — phase to resume when the room chain advances. */
export function linkedRoomLastKnownPhase(
  doc:
    Pick<RoomSessionDoc, "matchFormat" | "matchTermination" | "winsByPlayerId"> | null | undefined,
): LinkedRoomPhase {
  if (!doc) return "battlefield_pick";
  const seriesOver =
    !!doc.matchTermination || Object.values(doc.winsByPlayerId ?? {}).some((wins) => wins >= 2);
  return doc.matchFormat === "bo3" && !seriesOver ? "sideboarding" : "battlefield_pick";
}

/** Persisted session for a linked room (player/seat identity is kept). */
export function linkedRoomSession(
  session: GameSession,
  roomCode: string,
  lastKnownPhase: LinkedRoomPhase,
): GameSession {
  const code = roomCode.trim().toUpperCase();
  return {
    ...session,
    roomCode: code,
    gameInstanceId: code,
    lastKnownPhase,
    savedAt: Date.now(),
  };
}

/** Lobby deep link used by `returnLobbyRoomCode`; the lobby auto-joins `?room=`. */
export function lobbyHref(roomCode?: string | null): string {
  const code = roomCode?.trim().toUpperCase();
  return code ? `/?room=${encodeURIComponent(code)}` : "/";
}
