"use client";

import { cardBackUrl } from "@/lib/assets";
import type { CardBackSlot } from "@/lib/assets";

import { sleeveForSlot, useBoardCustomization } from "../layout/customization";

export interface CardBackProps {
  slot?: CardBackSlot;
  label?: string;
  insetPx?: number;
  className?: string;
  landscape?: boolean;
  /** Which seat owns the sleeve (opponents inherit the cosmetics dim). */
  side?: "self" | "opponent";
  /** Explicit owner seat, preferred over `side` when known. */
  playerId?: string | null;
}

const SLOT_LABEL: Record<CardBackSlot, string> = {
  deck: "Main Deck",
  runeDeck: "Rune Deck",
  battlefield: "Battlefield Deck",
  landscape: "Hidden",
};

/** Card back image with the original per-slot default back. */
export function CardBack({
  slot = "deck",
  label,
  insetPx = 0,
  className,
  landscape,
  side,
  playerId,
}: CardBackProps) {
  const context = useBoardCustomization();
  const customization = playerId
    ? context.byPlayerId[playerId]
    : side === "opponent"
      ? context.opponent
      : side === "self"
        ? context.self
        : undefined;
  const resolvedSlot: CardBackSlot = landscape ? "landscape" : slot;
  const sleeve = sleeveForSlot(customization, resolvedSlot);
  const src = sleeve?.src ?? cardBackUrl(resolvedSlot);
  const backLabel = label ?? SLOT_LABEL[resolvedSlot];

  return (
    <div
      className={
        className ??
        "absolute rounded-[inherit] overflow-hidden pointer-events-none"
      }
      style={{ inset: `${insetPx}px` }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- static card back asset */}
      <img
        alt={`${backLabel} card back`}
        src={src}
        loading="lazy"
        decoding="async"
        draggable={false}
        className="h-full w-full object-cover select-none"
        data-rift-image-kind="card-back"
        data-card-back-custom={sleeve ? "true" : undefined}
        style={sleeve && customization?.sleeveFilter ? { filter: customization.sleeveFilter } : undefined}
      />
    </div>
  );
}
