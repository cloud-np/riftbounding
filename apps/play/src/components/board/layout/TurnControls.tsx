"use client";

import { EndTurnButton, SwitchSeatButton, TurnStatusPlate } from "./TurnButton";

function SwitchSeatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-[1.1rem] w-[1.1rem]" aria-hidden="true">
      <path d="M4 7h12l-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 17H8l3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function TurnControls({
  canSwitchSeat = true,
  canEndTurn = true,
  onSwitchSeat,
  onEndTurn,
}: {
  canSwitchSeat?: boolean;
  canEndTurn?: boolean;
  onSwitchSeat?: () => void;
  onEndTurn?: () => void;
  compact?: boolean;
}) {
  return (
    <div
      data-board-turn-controls="true"
      className="pointer-events-none absolute right-[0.28rem] bottom-[calc(var(--battlefield-inset)-0.36rem)] z-90 flex w-[min(9.4rem,calc(var(--battlefield-side-gap)-0.56rem))] justify-center"
    >
      <div className="pointer-events-auto grid w-full gap-[0.22rem]">
        {canSwitchSeat ? (
          <SwitchSeatButton label="Switch seat" onClick={onSwitchSeat} icon={<SwitchSeatIcon />} />
        ) : null}
        <EndTurnButton label="End turn" disabled={!canEndTurn} onClick={onEndTurn} />
      </div>
    </div>
  );
}

export function PhaseIndicator({ phase }: { phase: "beginning" | "main" }) {
  return (
    <TurnStatusPlate
      side="self"
      title={phase === "beginning" ? "Beginning" : "Main"}
      subtitle="Phase"
      ariaLabel={phase === "beginning" ? "Beginning phase" : "Main phase"}
    />
  );
}

/** Opponent-side phase status (top-left): a dim "ENEMY TURN" plate. */
export function OpponentPhaseIndicator({ phase }: { phase: "beginning" | "main" }) {
  return (
    <TurnStatusPlate
      side="opponent"
      title="Enemy turn"
      subtitle={phase === "beginning" ? "Beginning" : "Main"}
      ariaLabel={phase === "beginning" ? "Beginning phase" : "Main phase"}
    />
  );
}
