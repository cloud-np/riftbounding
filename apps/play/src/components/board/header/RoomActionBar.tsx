"use client";

import { useCallback, useState } from "react";

import type { GameState } from "@rift/protocol";

import { useBoardTranslator } from "../sidebar/i18n";
import type { Dispatch } from "../slot-types";
import { canForwardState, canRewindState } from "./clock";
import { ForwardIcon, LeaveIcon, NextIcon, RewindIcon } from "./icons";

const ACTION_BUTTON =
  "relative inline-flex h-full min-h-[2.04rem] w-full items-center justify-center gap-[0.26rem] whitespace-nowrap rounded-[0.16rem] border px-[0.28rem] text-[0.6rem] font-bold uppercase tracking-[0.06em] transition-[border-color,background-color,box-shadow,color] duration-150 disabled:cursor-default disabled:opacity-[0.45] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[rgba(201,226,255,0.6)]";
const NEUTRAL_BUTTON =
  "border-[rgba(172,199,230,0.2)] bg-[linear-gradient(180deg,rgba(31,51,77,0.94),rgba(18,33,54,0.96))] text-[#dbe8f8] shadow-[inset_0_1px_0_rgba(235,246,255,0.06),0_6px_14px_rgba(3,8,18,0.2)] enabled:hover:border-[rgba(204,226,249,0.38)] enabled:hover:bg-[linear-gradient(180deg,rgba(40,64,95,0.96),rgba(24,42,67,0.98))] enabled:hover:text-white";
const NEXT_BUTTON =
  "border-[rgba(150,225,207,0.3)] bg-[linear-gradient(180deg,rgba(37,78,76,0.88),rgba(21,48,57,0.94))] text-[#c9f6eb] shadow-[inset_0_1px_0_rgba(226,255,247,0.08),0_7px_16px_rgba(3,15,20,0.24)] enabled:hover:border-[rgba(184,244,228,0.5)] enabled:hover:bg-[linear-gradient(180deg,rgba(44,94,88,0.94),rgba(24,59,65,0.98))] enabled:hover:text-[#effffb]";
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
  const rewindAvailable = canRewindState(state, viewerId);
  const forwardAvailable = canForwardState(state, viewerId, now);
  const forwardUntil = state.forwardAvailableUntil ?? null;
  const showForward = forwardUntil !== null && forwardUntil > now;
  const controllablePlayers = state.players.filter((player) =>
    controlledPlayerIds.includes(player.id),
  );

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
    "2.44rem",
    showForward ? "2.44rem" : null,
    "minmax(2.04rem,1fr)",
    showLeave ? "max-content" : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="relative z-80 grid gap-[0.14rem] overflow-visible">
      {controllablePlayers.length > 1 ? (
        <div
          role="group"
          aria-label={t("current.playAs") ?? "Play as"}
          className="grid grid-cols-2 gap-px overflow-hidden rounded-[0.24rem] border border-[rgba(172,199,230,0.18)] bg-[rgba(12,23,38,0.82)] p-[0.08rem] shadow-[inset_0_1px_0_rgba(235,246,255,0.045),0_7px_16px_rgba(3,8,18,0.14)] backdrop-blur-sm"
        >
          {controllablePlayers.map((player) => {
            const selected = player.id === viewerId;
            return (
              <button
                key={player.id}
                type="button"
                aria-pressed={selected}
                onClick={() => switchSeat(player.id)}
                className={`relative min-w-0 rounded-[0.16rem] border px-[0.24rem] py-[0.22rem] text-[0.52rem] font-semibold uppercase leading-tight tracking-[0.07em] transition-[border-color,background-color,box-shadow,color] duration-150 focus-visible:z-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[rgba(215,237,255,0.5)] ${
                  selected
                    ? "border-[rgba(139,222,189,0.46)] bg-[linear-gradient(180deg,rgba(38,83,69,0.94),rgba(24,60,51,0.98))] text-[#d9faec] shadow-[inset_0_1px_0_rgba(226,255,244,0.09),0_4px_10px_rgba(3,18,14,0.2)] after:pointer-events-none after:absolute after:inset-x-[0.34rem] after:bottom-[0.08rem] after:h-px after:bg-[linear-gradient(90deg,rgba(181,244,218,0),rgba(181,244,218,0.72),rgba(181,244,218,0))]"
                    : "border-transparent bg-transparent text-(--text-soft) hover:border-[rgba(194,215,242,0.16)] hover:bg-[rgba(62,83,111,0.42)] hover:text-[#eef6ff]"
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
        className="grid gap-[0.14rem]"
        style={{ gridTemplateColumns: gridColumns }}
        data-room-actions-override="desktop"
      >
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
              className="absolute bottom-[0.12rem] right-[0.12rem] inline-flex h-[0.82rem] min-w-[0.96rem] items-center justify-center rounded-[0.1rem] border border-[rgba(219,231,249,0.26)] bg-[rgba(8,15,28,0.38)] px-[0.12rem] text-[0.48rem] font-black leading-none tracking-[0.06em] text-[#f5f9ff]"
            >
              R
            </span>
          </button>
        </div>

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

        {showNext ? (
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
                className="absolute right-0 top-[calc(100%+0.32rem)] z-140 w-[14rem] max-w-[calc(100vw-1rem)] rounded-[0.3rem] border border-[rgba(174,199,227,0.34)] bg-[linear-gradient(180deg,rgba(20,34,59,0.99),rgba(12,23,43,0.99))] p-[0.44rem] text-left shadow-[0_16px_38px_rgba(3,8,20,0.48)]"
              >
                <strong className="block text-[0.62rem] font-bold uppercase tracking-[0.08em] text-[#edf4ff]">
                  {t("sim.leaveRoomQuestion") ?? "Leave room?"}
                </strong>
                <div className="mt-[0.36rem] grid gap-[0.18rem]">
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
                    className="inline-flex min-h-8 items-center justify-center rounded-[0.2rem] border border-[rgba(166,185,209,0.24)] bg-[rgba(31,47,69,0.9)] px-[0.34rem] text-[0.6rem] font-semibold text-[#dbe7f8] hover:bg-[rgba(43,63,90,0.94)]"
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
