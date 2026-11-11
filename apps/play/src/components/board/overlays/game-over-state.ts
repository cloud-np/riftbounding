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

/* ------------------------------------------------------------------ victory / defeat cinematic */

export interface GameResultView {
  /** A game result exists (any format) and the viewer sits at the table. */
  finished: boolean;
  viewerWon: boolean;
  winnerId: string | null;
  /** The player whose Legend is shown defeated (the viewer on a loss, else the first loser). */
  loserId: string | null;
  /** Situations that fit, most specific first (see legend-lines.ts). */
  situations: Array<"conquer" | "hold" | "close" | "blowout" | "concession">;
  /** Stable per-game key: used to seed the legend line and to remember a dismissal. */
  gameKey: string;
  winnerScore: number;
  loserScore: number;
}

function scoreOf(room: Room, playerId: string | null): number {
  return room.players.find((player) => player.id === playerId)?.board?.score ?? 0;
}

/** Where did the winning points come from, per the last score log entries (best effort). */
function lastScoreSource(room: Room): "conquer" | "hold" | null {
  const log = room.log ?? [];
  for (let index = log.length - 1; index >= Math.max(0, log.length - 12); index -= 1) {
    const entry = log[index];
    if (entry?.actionKind !== "score") continue;
    const text = `${entry.key ?? ""} ${entry.text ?? ""}`.toLowerCase();
    if (text.includes("conquer")) return "conquer";
    if (text.includes("hold")) return "hold";
  }
  return null;
}

/**
 * Pure projection for the full-screen victory / defeat cinematic: who won, whether the viewer won,
 * and the situation tags (concession, close game, blowout, conquer/hold) used to pick a legend line.
 * Works for every format (BO1, BO3 games, Practice vs Bot).
 */
export function gameResultView(room: Room, viewerId: string): GameResultView {
  const termination = room.matchTermination;
  const winnerIds = room.gameOutcome?.winnerPlayerIds?.length
    ? room.gameOutcome.winnerPlayerIds
    : (termination?.winnerPlayerIds ?? (termination?.winnerPlayerId ? [termination.winnerPlayerId] : []));
  const seated = room.players.some((player) => player.id === viewerId);
  const finished = seated && winnerIds.length > 0;
  const winnerId = winnerIds[0] ?? null;
  const viewerWon = winnerIds.includes(viewerId);
  const loserId =
    (viewerWon
      ? room.players.find((player) => !winnerIds.includes(player.id))?.id
      : viewerId) ?? null;
  const winnerScore = scoreOf(room, viewerWon ? viewerId : winnerId);
  const loserScore = scoreOf(room, loserId);
  const situations: GameResultView["situations"] = [];
  const conceded = room.gameOutcome?.reason === "concession" || termination?.reason === "concession";
  const disconnected = termination?.reason === "disconnect";
  if (conceded || disconnected) situations.push("concession");
  else {
    const source = lastScoreSource(room);
    if (winnerScore - loserScore <= 2) situations.push("close");
    if (viewerWon && winnerScore - loserScore >= 5) situations.push("blowout");
    if (viewerWon && source) situations.push(source);
  }
  return {
    finished,
    viewerWon,
    winnerId,
    loserId,
    situations,
    gameKey: `${room.roomCode}#${room.gameNumber ?? 1}#${room.gameOutcome?.decidedAtTurnNumber ?? termination?.endedAt ?? 0}`,
    winnerScore,
    loserScore,
  };
}
