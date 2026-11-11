"use client";

import { useCallback, useState } from "react";

import { cardBackUrl } from "@/lib/assets";

import { useAnimationLevel } from "../theme/motion";
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

/** Original arcane card back (navy + gold sigil) drawn with SVG, used until/unless the sleeve loads. */
export function ProceduralCardBack({ slot }: { slot: CardBackSlot }) {
  const level = useAnimationLevel();
  const rays = Array.from({ length: 16 }, (_, index) => index * 22.5);
  return (
    <div className="pcb" data-slot={slot} data-motion={level} aria-hidden="true">
      <svg viewBox="0 0 100 139.2857" preserveAspectRatio="xMidYMid slice" className="pcb-svg">
        <defs>
          <radialGradient id={`pcb-bg-${slot}`} cx="50%" cy="46%" r="72%">
            <stop offset="0" style={{ stopColor: "var(--pcb-glow)" }} />
            <stop offset="0.55" style={{ stopColor: "var(--pcb-mid)" }} />
            <stop offset="1" style={{ stopColor: "var(--pcb-deep)" }} />
          </radialGradient>
          <linearGradient id={`pcb-gold-${slot}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" style={{ stopColor: "var(--pcb-metal-hi)" }} />
            <stop offset="0.5" style={{ stopColor: "var(--pcb-metal)" }} />
            <stop offset="1" style={{ stopColor: "var(--pcb-metal-lo)" }} />
          </linearGradient>
        </defs>
        <rect width="100" height="139.2857" fill={`url(#pcb-bg-${slot})`} />
        <rect x="4" y="4" width="92" height="131.2857" rx="5" fill="none" stroke={`url(#pcb-gold-${slot})`} strokeWidth="1.6" />
        <rect x="7.200" y="7.200" width="85.600" height="124.8857" rx="3" fill="none" strokeOpacity="0.45" strokeWidth="0.5" style={{ stroke: "var(--pcb-metal)" }} />
        <g transform="translate(50 69.64)">
          {rays.map((angle) => (
            <path
              key={angle}
              d="M0 -6 L1.200 -40 L-1.200 -40Z"
              transform={`rotate(${angle})`}
              fill={`url(#pcb-gold-${slot})`}
              fillOpacity={angle % 45 === 0 ? 0.5 : 0.22}
            />
          ))}
          <circle r="30" fill="none" stroke={`url(#pcb-gold-${slot})`} strokeWidth="1.2" />
          <circle r="25.500" fillOpacity="0.55" strokeOpacity="0.6" strokeWidth="0.5" strokeDasharray="1.600 1.400" style={{ fill: "var(--pcb-deep)", stroke: "var(--pcb-metal)" }} />
          <path d="M0 -21 L5.500 -5.500 L21 0 L5.500 5.500 L0 21 L-5.500 5.500 L-21 0 L-5.500 -5.500Z" fill={`url(#pcb-gold-${slot})`} fillOpacity="0.92" />
          <path d="M0 -13 L3.400 -3.400 L13 0 L3.400 3.400 L0 13 L-3.400 3.400 L-13 0 L-3.400 -3.400Z" style={{ fill: "var(--pcb-deep)" }} />
          <circle r="4.200" fill={`url(#pcb-gold-${slot})`} />
          <circle r="1.800" style={{ fill: "var(--pcb-glow)" }} />
        </g>
        {[
          [14, 14],
          [86, 14],
          [14, 125.2857],
          [86, 125.2857],
        ].map(([x, y], index) => (
          <path
            key={index}
            transform={`translate(${x} ${y})`}
            d="M0 -4.500 L1.400 -1.400 L4.500 0 L1.400 1.400 L0 4.500 L-1.400 1.400 L-4.500 0 L-1.400 -1.400Z"
            fill={`url(#pcb-gold-${slot})`}
          />
        ))}
      </svg>
      <div className="pcb-sheen" />
    </div>
  );
}

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
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const failed = failedSrc === src;
  const loaded = loadedSrc === src && !failed;
  const imgRef = useCallback(
    (img: HTMLImageElement | null) => {
      if (!img || !img.complete) return;
      if (img.naturalWidth > 0) setLoadedSrc(src);
      else setFailedSrc(src);
    },
    [src],
  );

  return (
    <div
      className={
        className ??
        "absolute rounded-[inherit] overflow-hidden pointer-events-none"
      }
      style={{ inset: `${insetPx}px` }}
    >
      {!loaded ? <ProceduralCardBack slot={resolvedSlot} /> : null}
      {/* eslint-disable-next-line @next/next/no-img-element -- static card back asset */}
      <img
        ref={imgRef}
        onLoad={() => setLoadedSrc(src)}
        onError={() => setFailedSrc(src)}
        alt={`${backLabel} card back`}
        src={src}
        loading="lazy"
        decoding="async"
        draggable={false}
        className={failed ? "card-art-hidden" : "h-full w-full object-cover select-none"}
        data-rift-image-kind="card-back"
        data-art-state={failed ? "failed" : loaded ? "loaded" : "loading"}
        data-card-back-custom={sleeve ? "true" : undefined}
        style={sleeve && customization?.sleeveFilter ? { filter: customization.sleeveFilter } : undefined}
      />
    </div>
  );
}
