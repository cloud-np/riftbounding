"use client";

import type { GameState } from "@rift/protocol";

import { useBoardTranslator } from "../sidebar/i18n";
import type { Dispatch } from "../slot-types";
import { turnAdvanceIntent } from "./clock";
import { EndTurnButton, SwitchSeatButton, TurnStatusPlate } from "../layout/TurnButton";
import { ArrowRightIcon, SpacebarIcon, SwapSeatIcon } from "./icons";

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
      <TurnStatusPlate
        side="self"
        title={beginning ? (t("sim.beginning") ?? "Beginning") : (t("sim.mainPhase") ?? "Main")}
        subtitle={t("sim.phase") ?? "Phase"}
        ariaLabel={beginning ? "Beginning phase" : "Main phase"}
        className={compact ? "max-sm:hidden" : ""}
      />
    );
  }

  const endLabel = beginning
    ? (t("sim.endBeginning") ?? "End Beginning")
    : (t("sim.endTurn") ?? "End turn");

  return (
    <div
      data-board-turn-controls="true"
      className="pointer-events-none absolute right-[0.28rem] bottom-[calc(var(--battlefield-inset)-0.36rem)] z-90 flex w-[min(9.4rem,calc(var(--battlefield-side-gap)-0.56rem))] justify-center"
    >
      <div className="pointer-events-auto grid w-full gap-[0.22rem]">
        {canSwitchSeat ? (
          <SwitchSeatButton
            label={t("sim.switchSeat") ?? "Switch seat"}
            onClick={onSwitchSeat}
            icon={<SwapSeatIcon className="h-[1.1rem] w-[1.1rem]" />}
          />
        ) : null}
        <EndTurnButton
          label={endLabel}
          ariaLabel={endLabel}
          title={
            beginning
              ? (t("sim.endBeginningPhaseDescription") ?? "End beginning phase and continue turn")
              : (t("sim.passTurnDescription") ?? "Pass the turn")
          }
          beginning={beginning}
          disabled={!canEndTurn}
          shortcutIcons={
            <>
              <span className="turn-btn-key turn-btn-key-go">
                <ArrowRightIcon className="h-[0.8rem] w-[0.8rem]" />
              </span>
              <span className="turn-btn-key">
                <SpacebarIcon className="h-[0.84rem] w-[0.84rem]" />
              </span>
            </>
          }
          onClick={() => {
            if (onEndTurn) {
              onEndTurn();
              return;
            }
            dispatch(turnAdvanceIntent(state));
          }}
        />
      </div>
    </div>
  );
}
