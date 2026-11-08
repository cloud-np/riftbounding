"use client";

import type { GameState } from "@rift/protocol";

import { useBoardTranslator } from "../sidebar/i18n";
import type { Dispatch } from "../slot-types";
import { turnAdvanceIntent } from "./clock";
import { ArrowRightIcon, SpacebarIcon, SwapSeatIcon } from "./icons";

const TURN_BUTTON_CLASS =
  "relative flex min-h-[3.38rem] w-full flex-col items-center justify-center overflow-visible rounded-[0.2rem] border border-[rgba(174,199,227,0.26)] bg-[rgba(14,27,47,0.88)] px-[0.42rem] py-[0.38rem] text-[#edf6ff] shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_12px_24px_rgba(3,8,18,0.24)] backdrop-blur-md transition-[border-color,background-color,box-shadow,color] duration-150 before:content-[''] before:pointer-events-none before:absolute before:inset-[0.09rem] before:rounded-[0.14rem] before:border before:border-[rgba(228,239,255,0.08)] before:bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0))] after:content-[''] after:pointer-events-none after:absolute after:left-[0.42rem] after:right-[0.42rem] after:top-[0.22rem] after:h-px after:bg-[linear-gradient(90deg,rgba(167,222,249,0),rgba(167,222,249,0.52),rgba(167,222,249,0))] enabled:hover:border-[rgba(204,226,249,0.42)] enabled:hover:bg-[rgba(23,40,63,0.92)] disabled:border-[rgba(160,186,204,0.16)] disabled:bg-[rgba(16,29,48,0.72)] disabled:text-[rgba(231,240,247,0.54)]";

/**
 * Switch-seat button — verbatim `rE.h` chrome (`min-h-[2.46rem]`, icon 1.24rem,
 * two-line 2.8rem label column). The base `fU` class is intentionally not reused:
 * its taller `min-h-[3.38rem]` would win the utility cascade.
 */
const SWITCH_BUTTON_CLASS =
  "relative flex min-h-[2.46rem] w-full items-center justify-center overflow-visible rounded-[0.2rem] border border-[rgba(174,199,227,0.26)] bg-[rgba(14,27,47,0.88)] px-[0.32rem] py-[0.22rem] text-[0.62rem] font-semibold uppercase tracking-[0.075em] text-[#edf6ff] shadow-[inset_0_1px_0_rgba(235,246,255,0.07),0_8px_18px_rgba(3,8,18,0.2)] backdrop-blur-md transition-[border-color,background-color,color] duration-150 enabled:hover:border-[rgba(204,226,249,0.42)] enabled:hover:bg-[rgba(23,40,63,0.92)] disabled:border-[rgba(160,186,204,0.16)] disabled:text-[rgba(231,240,247,0.54)] [&>span:first-child>span]:h-[1.24rem] [&>span:first-child>span]:w-[1.24rem] [&>span:last-child]:w-[2.8rem] [&>span:last-child]:shrink-0 [&>span:last-child]:overflow-visible [&>span:last-child]:text-left [&>span:last-child]:text-clip [&>span:last-child]:leading-[1.08] [&>span:last-child]:whitespace-normal";

export interface BoardTurnControlsProps {
  state: GameState;
  viewerId: string;
  dispatch: Dispatch;
  locale?: string;
  canSwitchSeat?: boolean;
  canEndTurn?: boolean;
  onSwitchSeat?: () => void;
  onEndTurn?: () => void;
  active?: boolean;
  compact?: boolean;
}

/**
 * Standalone wired twin of `board/layout/TurnControls.tsx`.
 *
 * The layout owns the visual slot; integration replaces the existing
 * `<TurnControls ... />` render with this component (or forwards these callbacks into it).
 */
export function BoardTurnControls({
  state,
  viewerId,
  dispatch,
  locale,
  canSwitchSeat = true,
  canEndTurn = true,
  onSwitchSeat,
  onEndTurn,
  active = true,
  compact = false,
}: BoardTurnControlsProps) {
  const t = useBoardTranslator(locale);
  const beginning = state.activeTurnStep === "beginning";
  const viewer = state.players.find((player) => player.id === viewerId);
  const activePlayer = state.players.find((player) => player.id === state.activeTurnPlayerId);
  const isSelfTurn = !!viewer && !!activePlayer && viewer.id === activePlayer.id;

  if (!active || !isSelfTurn) {
    return (
      <div
        role="status"
        data-board-phase-status="self"
        className={`pointer-events-none absolute z-16 flex w-[min(9.4rem,calc(var(--battlefield-side-gap)-0.56rem))] justify-center right-[0.28rem] bottom-[calc(var(--battlefield-inset)-0.36rem)] ${
          compact ? "max-sm:hidden" : ""
        }`}
        aria-label={beginning ? "Beginning phase" : "Main phase"}
      >
        <div className="w-full">
          <div className="relative flex min-h-[3.38rem] w-full flex-col items-center justify-center overflow-visible rounded-[0.2rem] border border-[rgba(174,199,227,0.26)] bg-[rgba(14,27,47,0.88)] px-[0.42rem] py-[0.38rem] text-[#edf6ff] shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_10px_20px_rgba(3,8,18,0.2)] backdrop-blur-md">
            <span className="relative z-1 block text-center text-[0.72rem] font-bold uppercase leading-[1.04] tracking-[0.045em] text-shadow-[0_1px_2px_rgba(0,0,0,0.62)]">
              {beginning ? (t("sim.beginning") ?? "Beginning") : (t("sim.mainPhase") ?? "Main")}
            </span>
            <span className="relative z-1 mt-[0.1rem] block text-center text-[0.72rem] font-bold uppercase leading-[1.04] tracking-[0.045em] text-shadow-[0_1px_2px_rgba(0,0,0,0.62)]">
              {t("sim.phase") ?? "Phase"}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      data-board-turn-controls="true"
      className="pointer-events-none absolute right-[0.28rem] bottom-[calc(var(--battlefield-inset)-0.36rem)] z-90 flex w-[min(9.4rem,calc(var(--battlefield-side-gap)-0.56rem))] justify-center"
    >
      <div className="pointer-events-auto grid w-full gap-[0.14rem]">
        {canSwitchSeat ? (
          <button
            type="button"
            aria-label={t("sim.switchSeat") ?? "Switch seat"}
            className={SWITCH_BUTTON_CLASS}
            onClick={onSwitchSeat}
          >
            <span className="inline-flex items-center justify-center">
              <SwapSeatIcon className="h-[1.24rem] w-[1.24rem]" />
            </span>
            <span>{t("sim.switchSeat") ?? "Switch seat"}</span>
          </button>
        ) : null}
        <button
          type="button"
          aria-label={
            beginning
              ? (t("sim.endBeginning") ?? "End Beginning")
              : (t("sim.endTurn") ?? "End turn")
          }
          aria-keyshortcuts="Space"
          title={
            beginning
              ? (t("sim.endBeginningPhaseDescription") ?? "End beginning phase and continue turn")
              : (t("sim.passTurnDescription") ?? "Pass the turn")
          }
          disabled={!canEndTurn}
          className={`${TURN_BUTTON_CLASS} gb-turn-glass group/action`}
          onClick={() => {
            if (onEndTurn) {
              onEndTurn();
              return;
            }
            dispatch(turnAdvanceIntent(state));
          }}
        >
          <span className="relative z-1 block text-center text-[0.78rem] font-bold uppercase leading-none tracking-[0.08em] text-shadow-[0_1px_2px_rgba(0,0,0,0.62)]">
            {beginning
              ? (t("sim.endBeginning") ?? "End Beginning")
              : (t("sim.endTurn") ?? "End turn")}
          </span>
          <span
            aria-hidden="true"
            className="relative z-1 mt-[0.18rem] inline-flex items-center justify-center gap-[0.24rem]"
          >
            <span className="grid h-[1.22rem] w-[1.36rem] place-items-center rounded-[0.12rem] border border-[rgba(124,222,183,0.45)] bg-[rgba(27,62,54,0.55)] text-[#c7f7e8] shadow-[inset_0_1px_0_rgba(226,255,247,0.08)]">
              <ArrowRightIcon className="h-[0.82rem] w-[0.82rem]" />
            </span>
            <span className="grid h-[1.22rem] w-[1.36rem] place-items-center rounded-[0.12rem] border border-[rgba(174,199,227,0.3)] bg-[rgba(15,27,44,0.7)] text-[#c7d5e7] shadow-[inset_0_1px_0_rgba(235,246,255,0.05)]">
              <SpacebarIcon className="h-[0.86rem] w-[0.86rem]" />
            </span>
          </span>
        </button>
      </div>
    </div>
  );
}
