import type { Room } from "@rift/protocol";
import { rewindAllowedForRoom } from "@rift/engine";

export type NextGameControlState =
  | "available"
  | "read_only"
  | "busy"
  | "new_games_disabled"
  | "match_ended"
  | "player_left"
  | "returning_to_lobby"
  | "series_complete"
  | "waiting_for_players";

export interface NextGameControlInput {
  room: Room;
  readOnly?: boolean;
  interactionBusy?: boolean;
  newGamesDisabled?: boolean;
  /** Number of seats the current variant expects (engine `VARIANT_RULES`). */
  expectedPlayers?: number | null;
}

/**
 * Original NEXT control state (`hi` in `0xawjzm3yjpr1.js:58348-58367`).
 *
 * BO1 games keep the control available so the room can start a fresh board; BO3 disables
 * it once the series is complete (the result dialog takes over). A BO1 game that ended
 * (`matchTermination.status === "completed"`) is restartable in place.
 */
export function nextGameControlState({
  room,
  readOnly = false,
  interactionBusy = false,
  newGamesDisabled = false,
  expectedPlayers = null,
}: NextGameControlInput): NextGameControlState {
  if (readOnly) return "read_only";
  if (interactionBusy) return "busy";
  if (newGamesDisabled) return "new_games_disabled";
  if (room.matchTermination) {
    // A finished BO1 can start a fresh board in the same room (`create_next_game` clears the
    // termination marker server-side). A BO3 termination is the end of the series.
    const bo1Restartable =
      room.matchFormat === "bo1" &&
      room.matchTermination.status === "completed" &&
      !room.nextRoomCode &&
      !room.returnLobbyRoomCode?.trim();
    if (!bo1Restartable) return "match_ended";
  }
  if (room.players.some((player) => typeof player.leftAt === "number")) return "player_left";
  if (room.returnLobbyRoomCode?.trim()) return "returning_to_lobby";
  if (
    room.matchFormat === "bo3" &&
    Object.values(room.winsByPlayerId ?? {}).some((wins) => wins >= 2)
  ) {
    return "series_complete";
  }
  if (room.roomMode === "single_player") return "available";
  if (typeof expectedPlayers === "number" && room.players.length !== expectedPlayers) {
    return "waiting_for_players";
  }
  return "available";
}

export function canStartNextGame(input: NextGameControlInput): boolean {
  return nextGameControlState(input) === "available";
}

/**
 * R4 gestures: during a live strict game the room-shell NEXT action (`create_next_game`) has no
 * rules meaning (server: game_result_required), and rewind/forward are sandbox-only. Hide them
 * while the strict game is in progress; keep them once the game has a result/termination.
 */
export function roomActionVisibility(
  room: Room,
  showNext = true,
): { strictInProgress: boolean; showNext: boolean; showRewind: boolean } {
  const strictInProgress =
    room.rulesMode === "strict" &&
    room.phase === "in_game" &&
    !room.gameOutcome &&
    !room.matchTermination;
  return {
    strictInProgress,
    showNext: showNext && !strictInProgress,
    showRewind: !strictInProgress || rewindAllowedForRoom(room),
  };
}

/** Repro export is a strict bot/solo debugging tool; human-vs-human strict rooms never show it. */
export function strictReproAvailable(room: Room): boolean {
  return (
    room.rulesMode === "strict" &&
    room.phase === "in_game" &&
    rewindAllowedForRoom(room)
  );
}

export type NextGameAction =
  "create_next_game" | "open_result_dialog" | "request_result_confirmation";

/**
 * Original `startNextGame` branch (`35qz5rkx7yexy.js:35005-35095`):
 * - BO1 NEXT resets the same room to a fresh board (`create_next_game`).
 * - BO3 NEXT opens the winner-confirmation dialog. It only asks the server to create the
 *   report (`request_game_result_confirmation`) when there is no pending report and the
 *   series is still live; `create_next_game` is never called before both reports exist.
 */
export function nextGameAction(room: Room): NextGameAction {
  if (room.matchFormat !== "bo3") return "create_next_game";
  const seriesComplete = Object.values(room.winsByPlayerId ?? {}).some((wins) => wins >= 2);
  if (room.pendingGameResult || seriesComplete || room.matchTermination) {
    return "open_result_dialog";
  }
  return "request_result_confirmation";
}

/** Original label selection (`ha` in `0xawjzm3yjpr1.js:58339-58346`). */
export function nextGameLabelKey(room: Room): "nextGame" | "endMatch" {
  const seriesComplete =
    room.matchFormat !== "bo3" ||
    Object.values(room.winsByPlayerId ?? {}).some((wins) => wins >= 2);
  if (seriesComplete) return "nextGame";
  return room.gameNumber === 3 ? "endMatch" : "nextGame";
}

export function nextGameDescriptionKey(room: Room): string {
  if (room.matchFormat !== "bo3") return "nextGameDescription";
  const seriesComplete = Object.values(room.winsByPlayerId ?? {}).some((wins) => wins >= 2);
  if (seriesComplete) return "nextGameDescription";
  return room.gameNumber === 3 ? "endMatchDescription" : "nextGameBo3Description";
}
