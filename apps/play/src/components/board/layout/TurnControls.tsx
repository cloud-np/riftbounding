"use client";

const TURN_BUTTON_CLASS =
  "relative flex min-h-[3.38rem] w-full flex-col items-center justify-center overflow-visible rounded-[0.2rem] border border-[rgba(174,199,227,0.26)] bg-[rgba(14,27,47,0.88)] px-[0.42rem] py-[0.38rem] text-[#edf6ff] shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_12px_24px_rgba(3,8,18,0.24)] backdrop-blur-md transition-[border-color,background-color,box-shadow,color] duration-150 before:content-[''] before:pointer-events-none before:absolute before:inset-[0.09rem] before:rounded-[0.14rem] before:border before:border-[rgba(228,239,255,0.08)] before:bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0))] after:content-[''] after:pointer-events-none after:absolute after:left-[0.42rem] after:right-[0.42rem] after:top-[0.22rem] after:h-px after:bg-[linear-gradient(90deg,rgba(167,222,249,0),rgba(167,222,249,0.52),rgba(167,222,249,0))] enabled:hover:border-[rgba(204,226,249,0.42)] enabled:hover:bg-[rgba(23,40,63,0.92)] enabled:hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.09),0_14px_26px_rgba(3,8,18,0.28)] disabled:border-[rgba(160,186,204,0.16)] disabled:bg-[rgba(16,29,48,0.72)] disabled:text-[rgba(231,240,247,0.54)]";

const SWITCH_BUTTON_CLASS =
  "min-h-[2.46rem] justify-center rounded-[0.2rem] px-[0.32rem] py-[0.22rem] text-[0.62rem] tracking-[0.075em] shadow-[inset_0_1px_0_rgba(235,246,255,0.07),0_8px_18px_rgba(3,8,18,0.2)] enabled:hover:translate-y-0 [&>span:first-child>span]:h-[1.24rem] [&>span:first-child>span]:w-[1.24rem] [&>span:last-child]:w-[2.8rem] [&>span:last-child]:shrink-0 [&>span:last-child]:overflow-visible [&>span:last-child]:text-left [&>span:last-child]:text-clip [&>span:last-child]:leading-[1.08] [&>span:last-child]:whitespace-normal";

function SwitchSeatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-[1.24rem] w-[1.24rem]" aria-hidden="true">
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
  compact = false,
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
      className={
        compact
          ? "pointer-events-none absolute right-[0.28rem] bottom-[calc(var(--battlefield-inset)-0.36rem)] z-90 flex w-[min(9.4rem,calc(var(--battlefield-side-gap)-0.56rem))] justify-center"
          : "pointer-events-none absolute right-[0.28rem] bottom-[calc(var(--battlefield-inset)-0.36rem)] z-90 flex w-[min(9.4rem,calc(var(--battlefield-side-gap)-0.56rem))] justify-center"
      }
    >
      <div className="pointer-events-auto grid w-full gap-[0.14rem]">
        {canSwitchSeat ? (
          <button
            type="button"
            aria-label="Switch seat"
            className={`${TURN_BUTTON_CLASS} ${SWITCH_BUTTON_CLASS}`}
            onClick={onSwitchSeat}
          >
            <span className="relative z-1 flex items-center justify-center gap-[0.22rem]">
              <span className="inline-flex items-center justify-center">
                <SwitchSeatIcon />
              </span>
              <span className="uppercase">Switch seat</span>
            </span>
          </button>
        ) : null}
        <button
          type="button"
          aria-label="End turn"
          aria-keyshortcuts="Space"
          disabled={!canEndTurn}
          className={TURN_BUTTON_CLASS + " group/action"}
          onClick={onEndTurn}
        >
          <span className="relative z-1 block text-center text-[0.78rem] font-bold uppercase leading-none tracking-[0.08em] text-shadow-[0_1px_2px_rgba(0,0,0,0.62)]">
            End turn
          </span>
          <span className="relative z-1 mt-[0.18rem] flex items-center justify-center gap-[0.24rem] text-[0.6rem] font-semibold uppercase tracking-[0.04em] text-[#bfd5e9]">
            <span aria-hidden="true">↳</span>
            <span className="rounded-[0.1rem] border border-[rgba(190,214,235,0.34)] px-[0.16rem] py-[0.02rem] text-[0.52rem]">
              Space
            </span>
          </span>
        </button>
      </div>
    </div>
  );
}

export function PhaseIndicator({ phase }: { phase: "beginning" | "main" }) {
  return (
    <div
      role="status"
      data-board-phase-status="self"
      className="pointer-events-none absolute z-16 flex w-[min(9.4rem,calc(var(--battlefield-side-gap)-0.56rem))] justify-center right-[0.28rem] bottom-[calc(var(--battlefield-inset)-0.36rem)]"
      aria-label={phase === "beginning" ? "Beginning phase" : "Main phase"}
    >
      <div className="w-full">
        <div className="relative flex min-h-[3.38rem] w-full flex-col items-center justify-center overflow-visible rounded-[0.2rem] border border-[rgba(174,199,227,0.26)] bg-[rgba(14,27,47,0.88)] px-[0.42rem] py-[0.38rem] text-[#edf6ff] shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_10px_20px_rgba(3,8,18,0.2)] backdrop-blur-md before:content-[''] before:pointer-events-none before:absolute before:inset-[0.09rem] before:rounded-[0.14rem] before:border before:border-[rgba(228,239,255,0.08)] before:bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0))] after:content-[''] after:pointer-events-none after:absolute after:left-[0.42rem] after:right-[0.42rem] after:top-[0.22rem] after:h-px after:bg-[linear-gradient(90deg,rgba(167,222,249,0),rgba(167,222,249,0.52),rgba(167,222,249,0))]">
          <span className="relative z-1 block text-center text-[0.72rem] font-bold uppercase leading-[1.04] tracking-[0.045em] text-shadow-[0_1px_2px_rgba(0,0,0,0.62)]">
            {phase === "beginning" ? "Beginning" : "Main"}
          </span>
          <span className="relative z-1 mt-[0.1rem] block text-center text-[0.72rem] font-bold uppercase leading-[1.04] tracking-[0.045em] text-shadow-[0_1px_2px_rgba(0,0,0,0.62)]">
            Phase
          </span>
        </div>
      </div>
    </div>
  );
}

/** Opponent-side phase status (top-left). */
export function OpponentPhaseIndicator({ phase }: { phase: "beginning" | "main" }) {
  return (
    <div
      role="status"
      data-board-phase-status="opponent"
      className="pointer-events-none absolute z-16 flex w-[min(9.4rem,calc(var(--battlefield-side-gap)-0.56rem))] justify-center left-[0.28rem] top-[calc(var(--battlefield-inset)-0.36rem)]"
      aria-label={phase === "beginning" ? "Beginning phase" : "Main phase"}
    >
      <div className="w-full">
        <div className="relative flex min-h-[3.38rem] w-full flex-col items-center justify-center overflow-visible rounded-[0.2rem] border border-[rgba(174,199,227,0.26)] bg-[rgba(14,27,47,0.88)] px-[0.42rem] py-[0.38rem] text-[#edf6ff] shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_10px_20px_rgba(3,8,18,0.2)] backdrop-blur-md">
          <span className="relative z-1 block text-center text-[0.72rem] font-bold uppercase leading-[1.04] tracking-[0.045em] text-shadow-[0_1px_2px_rgba(0,0,0,0.62)]">
            {phase === "beginning" ? "Beginning" : "Main"}
          </span>
          <span className="relative z-1 mt-[0.1rem] block text-center text-[0.72rem] font-bold uppercase leading-[1.04] tracking-[0.045em] text-shadow-[0_1px_2px_rgba(0,0,0,0.62)]">
            Phase
          </span>
        </div>
      </div>
    </div>
  );
}
