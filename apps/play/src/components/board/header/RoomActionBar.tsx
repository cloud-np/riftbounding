"use client";

import { useCallback, useState } from "react";

import type { GameState } from "@rift/protocol";

import { getAuthToken } from "@/runtime/auth";
import { exportRepro } from "@/runtime/roomApi";

import { useBoardTranslator } from "../sidebar/i18n";
import type { Dispatch } from "../slot-types";
import { canForwardState, canRewindState } from "./clock";
import { roomActionVisibility, strictReproAvailable } from "./room-actions";
import { DownloadIcon, ForwardIcon, LeaveIcon, NextIcon, RewindIcon } from "./icons";

const ACTION_BUTTON =
  "relative inline-flex h-full min-h-[2.04rem] w-full items-center justify-center gap-[0.26rem] whitespace-nowrap rounded-[0.16rem] border px-[0.28rem] text-[0.6rem] font-bold uppercase tracking-[0.06em] transition-[border-color,background-color,box-shadow,color] duration-150 disabled:cursor-default disabled:opacity-[0.45] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[rgba(219,225,231,0.6)]";
const NEUTRAL_BUTTON =
  "border-[rgba(191,198,205,0.2)] bg-[linear-gradient(180deg,rgba(43,42,41,0.94),rgba(29,28,27,0.96))] text-[#e6e8ea] shadow-[inset_0_1px_0_rgba(245,246,245,0.06),0_6px_14px_rgba(9,8,7,0.2)] enabled:hover:border-[rgba(220,225,229,0.38)] enabled:hover:bg-[linear-gradient(180deg,rgba(54,53,52,0.96),rgba(36,35,34,0.98))] enabled:hover:text-white";
const NEXT_BUTTON =
  "border-[rgba(150,225,207,0.3)] bg-[linear-gradient(180deg,rgba(37,78,76,0.88),rgba(38,37,36,0.94))] text-[#c9f6eb] shadow-[inset_0_1px_0_rgba(226,255,247,0.08),0_7px_16px_rgba(13,12,11,0.24)] enabled:hover:border-[rgba(184,244,228,0.5)] enabled:hover:bg-[linear-gradient(180deg,rgba(44,94,88,0.94),rgba(46,45,44,0.98))] enabled:hover:text-[#effffb]";
const DANGER_BUTTON =
  "border-[rgba(226,171,124,0.28)] bg-[linear-gradient(180deg,rgba(66,43,29,0.9),rgba(37,25,18,0.94))] text-[#f5d6b8] shadow-[inset_0_1px_0_rgba(255,237,218,0.06),0_7px_16px_rgba(18,8,3,0.22)] enabled:hover:border-[rgba(241,196,146,0.48)] enabled:hover:bg-[linear-gradient(180deg,rgba(84,55,36,0.94),rgba(48,32,22,0.98))] enabled:hover:text-[#fff4e8]";

export interface RoomActionBarProps {
  state: GameState;
  viewerId: string;
  controlledPlayerIds: readonly string[];
  dispatch: Dispatch;
  locale?: string;
  now?: number;
  onSwitchSeat?: (playerId: string) => void;
  onNextGame?: () => void;
  onLeaveRoom?: () => void;
  onReturnToLobby?: () => void;
  canNextGame?: boolean;
  nextGameDescription?: string;
  canReturnToLobby?: boolean;
  showNext?: boolean;
  showLeave?: boolean;
}

export function RoomActionBar({
  state,
  viewerId,
  controlledPlayerIds,
  dispatch,
  locale,
  now = Date.now(),
  onSwitchSeat,
  onNextGame,
  onLeaveRoom,
  onReturnToLobby,
  canNextGame = true,
  nextGameDescription,
  canReturnToLobby = false,
  showNext = true,
  showLeave = true,
}: RoomActionBarProps) {
  const t = useBoardTranslator(locale);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [reproStatus, setReproStatus] = useState<string | null>(null);
  const [reproBusy, setReproBusy] = useState(false);
  const visibility = roomActionVisibility(state, showNext);
  const strictInProgress = visibility.strictInProgress;
  const showRewind = visibility.showRewind;
  const nextVisible = visibility.showNext;
  const showRepro = strictReproAvailable(state);
  const rewindAvailable = showRewind && canRewindState(state, viewerId);
  const forwardAvailable = showRewind && canForwardState(state, viewerId, now);
  const forwardUntil = state.forwardAvailableUntil ?? null;
  const showForward = showRewind && forwardUntil !== null && forwardUntil > now;
  const controllablePlayers = state.players.filter((player) =>
    controlledPlayerIds.includes(player.id),
  );

  const exportReproFile = useCallback(async () => {
    if (reproBusy) return;
    setReproBusy(true);
    setReproStatus(null);
    try {
      const authToken = await getAuthToken();
      if (!authToken) throw new Error(t("rules.ui.reproSignIn") ?? "Sign in to export a repro.");
      const result = await exportRepro({ roomCode: state.roomCode, authToken });
      const json = JSON.stringify(result.repro, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download =
        typeof result.filename === "string" && result.filename.trim()
          ? result.filename
          : `rift-repro-${state.roomCode}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setReproStatus(t("rules.ui.reproExported") ?? "Repro exported");
    } catch (error) {
      setReproStatus(
        `${t("rules.ui.reproExportFailed") ?? "Could not export the repro."} ${
          error instanceof Error ? error.message : ""
        }`.trim(),
      );
    } finally {
      setReproBusy(false);
    }
  }, [reproBusy, state.roomCode, t]);

  const switchSeat = useCallback(
    (playerId: string) => {
      if (onSwitchSeat) {
        onSwitchSeat(playerId);
        return;
      }
      window.dispatchEvent(new CustomEvent("riftbound:switch-seat", { detail: { playerId } }));
    },
    [onSwitchSeat],
  );

  const next = useCallback(() => {
    if (onNextGame) onNextGame();
    else window.dispatchEvent(new CustomEvent("riftbound:next-game"));
  }, [onNextGame]);

  const leave = useCallback(() => {
    if (onLeaveRoom) onLeaveRoom();
    else window.dispatchEvent(new CustomEvent("riftbound:leave-room"));
    setConfirmLeave(false);
  }, [onLeaveRoom]);

  const returnToLobby = useCallback(() => {
    if (onReturnToLobby) onReturnToLobby();
    else window.dispatchEvent(new CustomEvent("riftbound:return-to-lobby"));
    setConfirmLeave(false);
  }, [onReturnToLobby]);

  const gridColumns = [
    showRepro ? "2.44rem" : null,
    showRewind ? "2.44rem" : null,
    showForward ? "2.44rem" : null,
    nextVisible ? "minmax(2.04rem,1fr)" : null,
    showLeave ? "max-content" : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="relative z-80 grid gap-[0.14rem] overflow-visible">
      {reproStatus ? (
        <div
          role="status"
          data-testid="repro-status"
          className="absolute right-0 top-[calc(100%+0.24rem)] z-140 max-w-[16rem] rounded-[0.2rem] border border-[rgba(192,198,204,0.34)] bg-[rgba(21,20,19,0.97)] px-[0.34rem] py-[0.2rem] text-[0.58rem] text-[#e6e8ea] shadow-[0_10px_26px_rgba(9,8,7,0.4)]"
        >
          {reproStatus}
        </div>
      ) : null}
      {controllablePlayers.length > 1 ? (
        <div
          role="group"
          aria-label={t("current.playAs") ?? "Play as"}
          className="hud-glass-panel grid grid-cols-2 gap-px overflow-hidden rounded-[0.24rem] border border-[rgba(191,198,205,0.18)] bg-[rgba(20,19,18,0.82)] p-[0.08rem] shadow-[inset_0_1px_0_rgba(245,246,245,0.045),0_7px_16px_rgba(9,8,7,0.14)] backdrop-blur-sm"
        >
          {controllablePlayers.map((player) => {
            const selected = player.id === viewerId;
            return (
              <button
                key={player.id}
                type="button"
                aria-pressed={selected}
                onClick={() => switchSeat(player.id)}
                className={`relative min-w-0 rounded-[0.16rem] border px-[0.24rem] py-[0.22rem] text-[0.52rem] font-semibold uppercase leading-tight tracking-[0.07em] transition-[border-color,background-color,box-shadow,color] duration-150 focus-visible:z-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[rgba(231,236,238,0.5)] ${
                  selected
                    ? "border-[rgba(139,222,189,0.46)] bg-[linear-gradient(180deg,rgba(38,83,69,0.94),rgba(24,60,51,0.98))] text-[#d9faec] shadow-[inset_0_1px_0_rgba(226,255,244,0.09),0_4px_10px_rgba(3,18,14,0.2)] after:pointer-events-none after:absolute after:inset-x-[0.34rem] after:bottom-[0.08rem] after:h-px after:bg-[linear-gradient(90deg,rgba(181,244,218,0),rgba(181,244,218,0.72),rgba(181,244,218,0))]"
                    : "border-transparent bg-transparent text-(--text-soft) hover:border-[rgba(210,214,220,0.16)] hover:bg-[rgba(70,69,68,0.42)] hover:text-[#f7f6f5]"
                }`}
              >
                <span className="block truncate">
                  {t("current.playAs") ?? "Play as"} {player.name}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      <div
        className="hud-actions grid gap-[0.14rem]"
        style={{ gridTemplateColumns: gridColumns }}
        data-room-actions-override="desktop"
      >
        {showRepro ? (
          <div className="relative h-full min-w-0" data-help-anchor="export-repro">
            <button
              type="button"
              data-testid="export-repro"
              aria-label={t("rules.ui.exportRepro") ?? "Export repro"}
              title={t("rules.ui.exportRepro") ?? "Export repro"}
              disabled={reproBusy}
              onClick={() => void exportReproFile()}
              className={`${ACTION_BUTTON} ${NEUTRAL_BUTTON} !px-0`}
            >
              <DownloadIcon className="h-[1.04rem] w-[1.04rem]" />
            </button>
          </div>
        ) : null}

        {showRewind ? (
          <div className="relative h-full min-w-0" data-help-anchor="rewind">
            <button
              type="button"
              data-testid="rewind-last-action"
              aria-label={t("sim.rewindLastAction") ?? "Rewind the last action"}
              title={t("sim.rewindLastAction") ?? "Rewind the last action"}
              disabled={!rewindAvailable}
              onClick={() => dispatch({ type: "rewind_last_action" })}
              className={`${ACTION_BUTTON} ${NEUTRAL_BUTTON} !px-0`}
            >
              <RewindIcon className="h-[1.04rem] w-[1.04rem]" />
              <span
                aria-hidden="true"
                data-rewind-shortcut="R"
                className="absolute bottom-[0.12rem] right-[0.12rem] inline-flex h-[0.82rem] min-w-[0.96rem] items-center justify-center rounded-[0.1rem] border border-[rgba(230,231,233,0.26)] bg-[rgba(14,13,12,0.38)] px-[0.12rem] text-[0.48rem] font-black leading-none tracking-[0.06em] text-[#f5f9ff]"
              >
                R
              </span>
            </button>
          </div>
        ) : null}

        {showForward ? (
          <div className="relative h-full min-w-0" data-forward-control="true">
            <button
              type="button"
              aria-label={t("sim.actionBar.forward") ?? "Forward: undo your last Rewind"}
              title={t("sim.actionBar.forward") ?? "Forward: undo your last Rewind"}
              disabled={!forwardAvailable}
              onClick={() => dispatch({ type: "forward_last_rewind" })}
              className={`${ACTION_BUTTON} ${NEUTRAL_BUTTON} !px-0`}
            >
              <ForwardIcon className="h-[1.04rem] w-[1.04rem]" />
            </button>
          </div>
        ) : null}

        {nextVisible ? (
          <div className="relative min-w-0" data-rail-keep-label="true">
            <button
              type="button"
              data-testid="room-action-next"
              disabled={!canNextGame}
              aria-label={
                nextGameDescription ?? t("sim.nextGameDescription") ?? "Create a fresh board"
              }
              title={nextGameDescription ?? t("sim.nextGameDescription") ?? "Create a fresh board"}
              onClick={next}
              className={`${ACTION_BUTTON} ${NEXT_BUTTON}`}
            >
              <NextIcon className="h-[0.84rem] w-[0.84rem]" />
              <span className="truncate">{t("sim.nextShort") ?? "Next"}</span>
            </button>
          </div>
        ) : null}

        {showLeave ? (
          <div className="relative min-w-0" data-rail-keep-label="true">
            {confirmLeave ? (
              <div
                role="dialog"
                aria-label={t("sim.leaveRoomQuestion") ?? "Leave room?"}
                className="absolute right-0 top-[calc(100%+0.32rem)] z-140 w-[14rem] max-w-[calc(100vw-1rem)] rounded-[0.3rem] border border-[rgba(192,198,204,0.34)] bg-[linear-gradient(180deg,rgba(30,29,28,0.99),rgba(21,20,19,0.99))] p-[0.44rem] text-left shadow-[0_16px_38px_rgba(9,8,7,0.48)]"
              >
                <strong className="block text-[0.62rem] font-bold uppercase tracking-[0.08em] text-[#f5f5f4]">
                  {t("sim.leaveRoomQuestion") ?? "Leave room?"}
                </strong>
                <div className="mt-[0.36rem] grid gap-[0.18rem]">
                  {strictInProgress ? (
                    <button
                      type="button"
                      data-testid="room-action-concede"
                      onClick={() => {
                        setConfirmLeave(false);
                        dispatch({ type: "rules_concede" });
                      }}
                      className="inline-flex min-h-8 items-center justify-center rounded-[0.2rem] border border-[rgba(226,171,124,0.36)] bg-[rgba(66,43,29,0.92)] px-[0.34rem] text-[0.6rem] font-semibold text-[#f5d6b8] hover:bg-[rgba(84,55,36,0.96)]"
                    >
                      {t("rules.ui.concede") ?? "Concede"}
                    </button>
                  ) : null}
                  {canReturnToLobby ? (
                    <button
                      type="button"
                      onClick={returnToLobby}
                      className="inline-flex min-h-8 items-center justify-center rounded-[0.2rem] border border-[rgba(141,222,189,0.36)] bg-[rgba(24,64,54,0.9)] px-[0.34rem] text-[0.6rem] font-semibold text-[#d9faec] hover:bg-[rgba(32,84,70,0.94)]"
                    >
                      {t("sim.actionBar.returnToLobbyWithGroup") ??
                        "Return to lobby with this group"}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={leave}
                    className="inline-flex min-h-8 items-center justify-center rounded-[0.2rem] border border-[rgba(226,171,124,0.36)] bg-[rgba(66,43,29,0.92)] px-[0.34rem] text-[0.6rem] font-semibold text-[#f5d6b8] hover:bg-[rgba(84,55,36,0.96)]"
                  >
                    {t("sim.leave") ?? "Leave"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmLeave(false)}
                    className="inline-flex min-h-8 items-center justify-center rounded-[0.2rem] border border-[rgba(181,185,189,0.24)] bg-[rgba(40,39,38,0.9)] px-[0.34rem] text-[0.6rem] font-semibold text-[#e6e7e9] hover:bg-[rgba(54,53,52,0.94)]"
                  >
                    {t("sim.stayInRoom") ?? "Stay in the room"}
                  </button>
                </div>
              </div>
            ) : null}
            <button
              type="button"
              aria-label={t("sim.leaveRoom") ?? "Leave the room"}
              aria-haspopup="dialog"
              aria-expanded={confirmLeave}
              onClick={() => setConfirmLeave((current) => !current)}
              className={`${ACTION_BUTTON} ${DANGER_BUTTON}`}
            >
              <LeaveIcon className="h-[0.84rem] w-[0.84rem]" />
              <span className="truncate">{t("sim.leave") ?? "Leave"}</span>
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
