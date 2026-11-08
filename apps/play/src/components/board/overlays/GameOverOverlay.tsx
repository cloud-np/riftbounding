"use client";

/**
 * Game-over / series-result dialog — verbatim port of `rE`
 * (`35qz5rkx7yexy.js:2902-3300`).
 *
 * BO3 shows the per-game winner confirmation until both players report; once a
 * player reaches two wins it becomes the match-complete dialog with the series
 * score, return-to-lobby / leave and rematch controls. This surface is BO3-only:
 * the original never mounts `rE` for BO1 (`showResultDialog` requires bo3), so a
 * finished BO1 stays on the board with the rail's NEXT / LEAVE controls.
 */
import { useEffect, useState } from "react";

import { createTranslator } from "@rift/i18n";
import type { Room } from "@rift/protocol";

import { getAuthToken, roomSeriesAction } from "@/runtime";

import type { GameActionIntent } from "../slot-types";
import { gameOverView } from "./game-over-state";

const t = createTranslator("en");

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path
        d="M6 6l12 12M18 6 6 18"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function GameOverOverlay({
  room,
  viewerId,
  controlledPlayerIds,
  resultDialogOpen = false,
  onDismiss,
  canReturnToLobby = false,
  onReturnToLobby,
  onLeaveRoom,
  dispatch,
}: {
  room: Room;
  viewerId: string;
  controlledPlayerIds: string[];
  resultDialogOpen?: boolean;
  onDismiss?: () => void;
  canReturnToLobby?: boolean;
  onReturnToLobby?: () => void;
  onLeaveRoom?: () => void;
  dispatch: (intent: GameActionIntent) => void;
}) {
  const [dismissedRoomCode, setDismissedRoomCode] = useState<string | null>(null);
  const opponent =
    room.players.find(
      (player) => player.id !== viewerId && controlledPlayerIds.includes(player.id),
    ) ?? room.players.find((player) => player.id !== viewerId);
  const view = gameOverView(
    room,
    viewerId,
    opponent?.id ?? null,
    canReturnToLobby,
    resultDialogOpen,
  );
  // The original `dismissedResultRoomCode` only suppresses the per-game confirmation;
  // an explicit NEXT reopen (`resultDialogOpen`) always shows it again.
  const dismissed = !resultDialogOpen && dismissedRoomCode === room.roomCode;

  useEffect(() => {
    setDismissedRoomCode(null);
  }, [room.gameNumber, room.roomCode]);

  useEffect(() => {
    if (!view.visible || !view.canDismiss) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setDismissedRoomCode(room.roomCode);
      onDismiss?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onDismiss, room.roomCode, view.canDismiss, view.visible]);

  if (!view.visible || dismissed) return null;

  const me = room.players.find((player) => player.id === viewerId) ?? null;
  const opponentLeft = view.opponentLeft;
  const requestedByMe = view.rematchRequestedPlayerIds.includes(viewerId);
  const requestedByOpponent = !!opponent && view.rematchRequestedPlayerIds.includes(opponent.id);
  const rematchStarting = !!room.nextRoomCode;
  const rematchBlocked = rematchStarting || opponentLeft || !!room.returnLobbyRoomCode;
  const title = view.seriesWinnerId
    ? (t("sim.matchComplete") ?? "Match Complete")
    : (t("sim.confirmGameWinner", { gameNumber: room.gameNumber ?? 1 }) ??
      `Confirm Game ${room.gameNumber ?? 1} Winner`);
  const ariaLabel = title;
  const scoreLine = room.players
    .map((player) => `${player.name} ${view.winsByPlayerId[player.id] ?? 0}`)
    .join(" · ");
  const myReportedWinnerId = view.myReportedWinnerId;
  const opponentReportedWinnerId = view.opponentReportedWinnerId;
  const reportsMatch =
    !!myReportedWinnerId &&
    !!opponentReportedWinnerId &&
    myReportedWinnerId === opponentReportedWinnerId;
  const reportedWinnerName =
    room.players.find((player) => player.id === myReportedWinnerId)?.name ?? null;
  const opponentChoiceName =
    room.players.find((player) => player.id === opponentReportedWinnerId)?.name ?? null;

  const sendSeriesAction = async (action: Record<string, unknown>) => {
    try {
      const authToken = await getAuthToken();
      if (!authToken) throw new Error("missing_token");
      await roomSeriesAction({ roomCode: room.roomCode, authToken, ...action });
      return true;
    } catch {
      dispatch(action as unknown as GameActionIntent);
      return false;
    }
  };

  const reportWinner = (winnerPlayerId: string) => {
    void sendSeriesAction({ type: "report_game_result", winnerPlayerId }).then((ok) => {
      if (ok) onDismiss?.();
    });
  };

  const keepPlaying = () => {
    void sendSeriesAction({ type: "cancel_game_result_confirmation" }).then(() => onDismiss?.());
    setDismissedRoomCode(room.roomCode);
  };

  const requestRematch = () => {
    void sendSeriesAction({ type: "request_bo3_rematch" });
  };

  return (
    <div
      className="pointer-events-none absolute inset-0 z-170"
      data-game-outcome={room.gameOutcome?.reason ?? undefined}
      data-game-outcome-win={
        view.seriesWinnerId && controlledPlayerIds.includes(view.seriesWinnerId) ? "true" : "false"
      }
      data-testid="game-over-overlay"
    >
      <div className="absolute inset-0 bg-[rgba(4,8,14,0.68)]" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        tabIndex={-1}
        className="pointer-events-auto absolute left-1/2 top-1/2 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 border border-[rgba(132,150,184,0.28)] bg-[linear-gradient(180deg,rgba(11,19,32,0.97),rgba(8,13,24,0.98))] p-5 text-(--text-main) shadow-[0_24px_64px_rgba(0,0,0,0.44)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-[#9fdff2]">
              {t("sim.bestOf3") ?? "Best of 3"}
            </p>
            <h3 className="mt-1 text-[1.1rem] font-semibold text-[#edf4ff]">{title}</h3>
          </div>
          {view.canDismiss ? (
            <button
              type="button"
              aria-label={t("sim.close") ?? "Close"}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center border border-[rgba(132,150,184,0.28)] text-(--text-dim) hover:text-(--text-main) focus-visible:outline-2 focus-visible:outline-[#a8d9ed]"
              onClick={() => {
                setDismissedRoomCode(room.roomCode);
                onDismiss?.();
              }}
              data-testid="game-over-close"
            >
              <CloseIcon />
            </button>
          ) : null}
        </div>

        <p className="mt-2 text-[0.84rem] leading-[1.45] text-[#bfd0e6]">{scoreLine}</p>

        {view.seriesWinnerId ? (
          <div className="mt-4 grid gap-2">
            <p className="border border-[rgba(120,221,183,0.24)] bg-[rgba(17,41,37,0.42)] px-3 py-2 text-[0.84rem] text-[#d4ffea]">
              {t("sim.seriesWinnerMessage", { playerName: view.seriesWinnerName ?? "" }) ??
                `${view.seriesWinnerName} has won the Best of 3 match.`}
            </p>
            {view.terminationReason === "concession" ? (
              <p className="text-sm text-(--text-dim)">
                {t("sim.lifecycle.seriesConceded") ?? "The series was conceded."}
              </p>
            ) : view.terminationReason === "disconnect" ? (
              <p className="text-sm text-(--text-dim)">
                {t("sim.lifecycle.seriesDisconnected") ?? "The series ended by disconnect."}
              </p>
            ) : null}
            {rematchStarting ? (
              <p className="border border-[rgba(116,239,255,0.22)] bg-[rgba(13,29,46,0.68)] px-3 py-2 text-[0.82rem] text-[#d7eaff]">
                {t("sim.rematchStartingInRoom", { roomCode: room.nextRoomCode ?? "" }) ??
                  `Rematch starting in room ${room.nextRoomCode}.`}
              </p>
            ) : opponentLeft ? (
              <p className="border border-[rgba(242,138,138,0.45)] bg-[rgba(91,22,22,0.55)] px-3 py-2 text-[0.82rem] text-[#ffd5d5]">
                {t("sim.playerLeftRematchUnavailable", {
                  playerName: view.opponentName,
                }) ?? `${view.opponentName} left the room. Rematch is unavailable.`}
              </p>
            ) : requestedByMe ? (
              <p className="border border-[rgba(116,239,255,0.22)] bg-[rgba(13,29,46,0.68)] px-3 py-2 text-[0.82rem] text-[#d7eaff]">
                {t("sim.rematchRequestedWaiting", { playerName: view.opponentName }) ??
                  `Rematch requested. Waiting for ${view.opponentName}.`}
              </p>
            ) : requestedByOpponent ? (
              <p className="border border-[rgba(116,239,255,0.22)] bg-[rgba(13,29,46,0.68)] px-3 py-2 text-[0.82rem] text-[#d7eaff]">
                {t("sim.opponentRequestedRematch", { playerName: view.opponentName }) ??
                  `${view.opponentName} requested a rematch.`}
              </p>
            ) : null}
            <div
              className={
                canReturnToLobby ? "mt-4 grid grid-cols-3 gap-2" : "mt-4 grid grid-cols-2 gap-2"
              }
            >
              {canReturnToLobby ? (
                <button
                  type="button"
                  className="inline-flex min-h-11 items-center justify-center border border-[rgba(116,239,255,0.36)] bg-[rgba(17,35,56,0.92)] px-3 text-[0.8rem] font-semibold text-[#edf4ff] transition-[border-color,background-color,transform] hover:-translate-y-px hover:border-[rgba(159,223,242,0.52)] hover:bg-[rgba(24,49,76,0.96)] disabled:cursor-default disabled:opacity-60"
                  onClick={() => onReturnToLobby?.()}
                  data-testid="game-over-return-lobby"
                >
                  {t("sim.playerLeft.toLobby") ?? "To Lobby"}
                </button>
              ) : null}
              <button
                type="button"
                className="inline-flex min-h-11 items-center justify-center border border-[rgba(242,138,138,0.3)] bg-[rgba(61,24,31,0.68)] px-3 text-[0.8rem] font-semibold text-[#ffe5e8] transition-[border-color,background-color,transform] hover:-translate-y-px hover:border-[rgba(255,174,174,0.44)] hover:bg-[rgba(78,29,38,0.82)] disabled:cursor-default disabled:opacity-60"
                onClick={() => onLeaveRoom?.()}
                data-testid="game-over-leave"
              >
                {canReturnToLobby
                  ? (t("sim.leaveGame") ?? "Leave Game")
                  : (t("sim.backToLobby") ?? "Back to Lobby")}
              </button>
              <button
                type="button"
                className={`inline-flex min-h-11 items-center justify-center border px-4 text-[0.8rem] font-semibold text-[#edf4ff] transition-[border-color,background-color,transform] disabled:cursor-default disabled:opacity-60 ${
                  rematchBlocked || requestedByMe
                    ? "border-[rgba(132,150,184,0.2)] bg-[rgba(10,18,31,0.58)]"
                    : "border-[rgba(120,221,183,0.3)] bg-[rgba(17,41,37,0.64)] hover:-translate-y-px hover:border-[rgba(147,236,201,0.42)] hover:bg-[rgba(23,55,48,0.82)]"
                }`}
                disabled={rematchBlocked || requestedByMe}
                onClick={requestRematch}
                data-testid="game-over-rematch"
              >
                {rematchStarting
                  ? (t("sim.startingRematch") ?? "Starting Rematch...")
                  : opponentLeft
                    ? (t("sim.rematchUnavailable") ?? "Rematch Unavailable")
                    : requestedByMe
                      ? (t("sim.rematchRequested") ?? "Rematch Requested")
                      : requestedByOpponent
                        ? (t("sim.acceptRematch") ?? "Accept Rematch")
                        : (t("sim.rematch") ?? "Rematch")}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 grid gap-2">
            <div
              aria-atomic="true"
              aria-live="polite"
              className="flex min-h-20 items-center"
              data-bo3-result-status="true"
            >
              {myReportedWinnerId &&
              opponentReportedWinnerId &&
              myReportedWinnerId !== opponentReportedWinnerId ? (
                <p className="w-full border border-[rgba(242,138,138,0.45)] bg-[rgba(91,22,22,0.55)] px-3 py-2 text-[0.84rem] text-[#ffd5d5]">
                  {t("sim.reportsDoNotMatch") ??
                    "Reports do not match yet. Either player can change their choice."}
                </p>
              ) : reportsMatch ? (
                <p className="w-full border border-[rgba(120,221,183,0.24)] bg-[rgba(17,41,37,0.42)] px-3 py-2 text-[0.84rem] text-[#d4ffea]">
                  {t("sim.bothPlayersReported", { playerName: reportedWinnerName ?? "" }) ??
                    `Both players reported ${reportedWinnerName}. Advancing automatically.`}
                </p>
              ) : opponentChoiceName ? (
                <p className="w-full border border-[rgba(116,239,255,0.22)] bg-[rgba(13,29,46,0.68)] px-3 py-2 text-[0.84rem] text-[#d7eaff]">
                  {t("sim.opponentReportedPickWinner", {
                    opponentName: view.opponentName,
                    winnerName: opponentChoiceName,
                  }) ?? `${view.opponentName} reported ${opponentChoiceName}.`}
                </p>
              ) : (
                <p className="w-full text-[0.84rem] text-[#dce7f6]">
                  {t("sim.whoWonThisGame") ?? "Who won this game?"}
                </p>
              )}
            </div>
            {[me, opponent]
              .filter((player): player is NonNullable<typeof me> => !!player)
              .map((player) => (
                <button
                  key={player.id}
                  type="button"
                  className={`inline-flex min-h-11 items-center justify-center border px-4 text-[0.8rem] font-semibold text-[#edf4ff] transition-[border-color,background-color,transform] hover:-translate-y-px disabled:cursor-default disabled:opacity-60 ${
                    player.id === myReportedWinnerId
                      ? "border-[rgba(116,239,255,0.5)] bg-[rgba(17,35,56,0.92)] shadow-[inset_0_0_0_1px_rgba(159,223,242,0.22)]"
                      : "border-[rgba(132,150,184,0.28)] bg-[rgba(10,18,31,0.82)] hover:border-[rgba(116,239,255,0.34)] hover:bg-[rgba(17,35,56,0.9)]"
                  }`}
                  onClick={() => reportWinner(player.id)}
                  data-testid={`game-over-report-${player.id}`}
                >
                  {player.id === myReportedWinnerId
                    ? (t("sim.playerWonYourChoice", { playerName: player.name }) ??
                      `${player.name} won (your choice)`)
                    : (t("sim.playerWon", { playerName: player.name }) ?? `${player.name} won`)}
                </button>
              ))}
            <div className="grid gap-1 text-[0.76rem] text-(--text-dim)">
              <p>
                {t("sim.opponentCurrentChoice", {
                  playerName: view.opponentName,
                  choice:
                    opponentChoiceName ?? t("sim.waitingForResponse") ?? "Waiting for response",
                }) ?? `Current choice for ${view.opponentName}.`}
              </p>
            </div>
            <button
              type="button"
              className="inline-flex min-h-10 items-center justify-center border border-[rgba(132,150,184,0.22)] px-4 text-[0.78rem] font-semibold text-[#c9d6e8] transition-[border-color,background-color,color] hover:border-[rgba(159,223,242,0.4)] hover:bg-[rgba(17,35,56,0.6)] hover:text-[#edf4ff] disabled:cursor-default disabled:opacity-60"
              onClick={keepPlaying}
              data-testid="game-over-keep-playing"
            >
              {t("sim.keepPlaying") ?? "Keep playing"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
