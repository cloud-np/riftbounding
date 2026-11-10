"use client";

import type { CSSProperties } from "react";

import type { CardInstance } from "@rift/protocol";

import { CardFullFace } from "./CardFullFace";
import { CardTokenFace } from "./CardTokenFace";

export interface CardVisualProps {
  card: CardInstance;
  side: "self" | "opponent";
  /** `token` is the art-crop shield used for cards in play; `full` is the whole card. */
  variant: "token" | "full";
  className?: string;
}

const CARD_ASPECT = 1.392857;

/**
 * Pure presentational card. Needs no board interaction context, so effects (ghosts, flights)
 * can render the exact same visual the board uses. Sizes itself from `--card-width`
 * (defaults to 6rem); pass `className` to override width/position.
 *
 * Do not put `translate`/`scale` CSS properties on its ancestors if the VFX engine animates them.
 */
export function CardVisual({ card, side, variant, className }: CardVisualProps) {
  const rune = (card.source === "rune" || /rune/i.test(card.type ?? "")) && variant === "token";
  const style: CSSProperties = {
    width: "var(--card-width, 6rem)",
    aspectRatio: variant === "token" ? (rune ? "1 / 1.05" : "1 / 1.14") : `1 / ${CARD_ASPECT}`,
  };
  return (
    <div
      className={"card-visual relative" + (className ? ` ${className}` : "")}
      data-card-visual-variant={variant}
      data-card-code={card.cardCode}
      style={style}
    >
      {variant === "token" ? (
        <CardTokenFace card={card} side={side} profile="board" might={undefined} />
      ) : (
        <div className="absolute inset-0 rounded-(--card-radius-main,0.3rem) overflow-hidden">
          <CardFullFace card={card} side={side} profile="board" />
          <span className="gcf-frame" aria-hidden="true" />
        </div>
      )}
    </div>
  );
}
