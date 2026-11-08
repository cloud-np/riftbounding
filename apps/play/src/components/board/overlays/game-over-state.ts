import type { Room } from "@rift/protocol";

/** Pure projection of the original BO3 result dialog state (`rE`, 35qz:2902). */
export interface GameOverView {
  visible: boolean;
  bo3: boolean;
  seriesWinnerId: string | null;
  seriesWinnerName: string | null;
  gameWinnerId: string | null;
  myReportedWinnerId: string | null;
  opponentReportedWinnerId: string | null;
  opponentName: string;
  winsByPlayerId: Record<string, number>;
  completedGames: number;
  rematchRequestedPlayerIds: string[];
  opponentLeft: boolean;
  canDismiss: boolean;
  showReporting: boolean;
  terminationReason: string | null;
}

/**
 * The original `rE` result dialog is BO3-only: `showResultDialog` requires
 * `matchFormat === "bo3"` (`35qz5rkx7yexy.js:36560-36575`). A finished BO1 stays on the
 * board with the action rail's NEXT (fresh board) and LEAVE controls, and no modal.
 */
export function gameOverView(
  room: Room,
  viewerId: string,
  opponentId: string | null,
  _canReturnToLobby: boolean,
  resultDialogOpen = false,
): GameOverView {
  const bo3 = room.matchFormat === "bo3";
  const wins = room.winsByPlayerId ?? {};
  const seriesWinnerId = bo3
    ? (room.matchTermination?.winnerPlayerIds?.[0] ??
      room.matchTermination?.winnerPlayerId ??
      Object.entries(wins).find(([, count]) => count >= 2)?.[0] ??
      null)
    : null;
  const participants = room.players.filter((player) => !player.leftAt);
  const opponent = room.players.find((player) => player.id === opponentId) ?? null;
  const gameWinnerId = room.gameOutcome?.winnerPlayerIds?.[0] ?? null;
  const reports = room.pendingGameResult?.winnerByReporterPlayerId ?? {};
  const opponentLeft = !!opponent?.leftAt;
  const opponentReturned = opponent?.leftReason === "returned_to_lobby";
  const showReporting =
    bo3 && !seriesWinnerId && (!!room.gameOutcome || !!room.pendingGameResult) && !opponentLeft;
  // Original `showResultDialog` (35qz5rkx7yexy.js:36560-36582): a finished BO3 game keeps
  // the board visible until NEXT opens the confirmation (`resultDialogOpen`) or the server
  // already has a pending report. A decided series opens the result sheet directly.
  const visible = !!(
    bo3 &&
    viewerId &&
    opponent &&
    !opponentReturned &&
    (seriesWinnerId
      ? true
      : room.phase === "in_game" && (resultDialogOpen || !!room.pendingGameResult)) &&
    (seriesWinnerId || !room.returnLobbyRoomCode?.trim())
  );
  return {
    visible,
    bo3,
    seriesWinnerId,
    seriesWinnerName: room.players.find((player) => player.id === seriesWinnerId)?.name ?? null,
    gameWinnerId,
    myReportedWinnerId:
      (viewerId ? reports[viewerId] : undefined) ??
      (participants.length === 1 ? (reports[participants[0]!.id] ?? null) : null),
    opponentReportedWinnerId: opponentId ? (reports[opponentId] ?? null) : null,
    opponentName: opponent?.name ?? "Opponent",
    winsByPlayerId: wins,
    completedGames:
      room.bo3CompletedGames?.length ?? (bo3 ? Object.values(wins).reduce((a, b) => a + b, 0) : 0),
    rematchRequestedPlayerIds: room.rematchRequestedPlayerIds ?? [],
    opponentLeft,
    canDismiss: !!seriesWinnerId && (opponentLeft || !!room.returnLobbyRoomCode?.trim()),
    showReporting,
    terminationReason: room.matchTermination?.reason ?? null,
  };
}
