"use client";

/**
 * Shared turn-control chrome (previously duplicated in header/BoardTurnControls and
 * layout/TurnControls). Visual states live in board-theme.css and key off `data-turn-state`.
 */
import type { ReactNode } from "react";

import { useAnimationLevel } from "../theme/motion";

export type TurnButtonState = "ready" | "beginning" | "waiting" | "enemy";

export interface EndTurnButtonProps {
  label: string;
  ariaLabel?: string;
  title?: string;
  beginning?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  shortcutIcons?: ReactNode;
  shortcutLabel?: string;
}

export function EndTurnButton({
  label,
  ariaLabel,
  title,
  beginning = false,
  disabled = false,
  onClick,
  shortcutIcons,
  shortcutLabel,
}: EndTurnButtonProps) {
  const motion = useAnimationLevel();
  const state: TurnButtonState = disabled ? "waiting" : beginning ? "beginning" : "ready";
  return (
    <button
      type="button"
      aria-label={ariaLabel ?? label}
      aria-keyshortcuts="Space"
      title={title}
      disabled={disabled}
      data-turn-button="end"
      data-turn-state={state}
      data-turn-motion={motion}
      className="turn-btn group/action"
      onClick={onClick}
    >
      <span aria-hidden="true" className="turn-btn-sheen" />
      <span className="turn-btn-label">{label}</span>
      <span aria-hidden="true" className="turn-btn-keys">
        {shortcutIcons ?? (
          <span className="turn-btn-key">{shortcutLabel ?? "Space"}</span>
        )}
      </span>
    </button>
  );
}

export function SwitchSeatButton({
  label,
  onClick,
  icon,
}: {
  label: string;
  onClick?: () => void;
  icon: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      data-turn-button="switch"
      className="turn-switch"
      onClick={onClick}
    >
      <span className="inline-flex items-center justify-center">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

/** Passive phase plate (own-side "Main Phase" / opponent's "ENEMY TURN"). */
export function TurnStatusPlate({
  side,
  title,
  subtitle,
  ariaLabel,
  className,
}: {
  side: "self" | "opponent";
  title: string;
  subtitle: string;
  ariaLabel: string;
  className?: string;
}) {
  const motion = useAnimationLevel();
  return (
    <div
      role="status"
      data-board-phase-status={side}
      data-turn-motion={motion}
      aria-label={ariaLabel}
      className={
        "turn-status pointer-events-none absolute z-16 flex w-[min(9.4rem,calc(var(--battlefield-side-gap)-0.56rem))] justify-center " +
        (side === "self"
          ? "right-[0.28rem] bottom-[calc(var(--battlefield-inset)-0.36rem)] "
          : "left-[0.28rem] top-[calc(var(--battlefield-inset)-0.36rem)] ") +
        (className ?? "")
      }
    >
      <div className="turn-status-plate" data-turn-state={side === "opponent" ? "enemy" : "waiting"}>
        <span className="turn-status-title">{title}</span>
        <span className="turn-status-sub">{subtitle}</span>
      </div>
    </div>
  );
}
