"use client";

import type { CardInstance } from "@rift/protocol";

import type { CardImageProfile } from "@/lib/assets";

import { CardArt, CardArtFallback } from "./CardArt";
import { CardBack } from "./CardBack";
import type { CardBackSlot } from "@/lib/assets";

import { CardLabelStack } from "./CardLabelStack";

export interface GameCardFaceProps {
  card: CardInstance;
  profile?: CardImageProfile;
  faceDown?: boolean;
  backSlot?: CardBackSlot;
  portrait?: boolean;
  labels?: string[];
  insetPx?: number;
  showArt?: boolean;
  showGradient?: boolean;
  mirrored?: boolean;
  alt?: string;
  side?: "self" | "opponent";
}

/**
 * Game card face (module 298551 `eu`): clipped art + bottom gradient + label
 * stack. Landscape ("portrait" art rotated 90° on a landscape card) is used by
 * battlefield markers.
 */
export function GameCardFace({
  card,
  profile = "board",
  faceDown = false,
  backSlot = "deck",
  portrait = false,
  labels,
  insetPx = 1,
  showArt = true,
  showGradient = true,
  mirrored = false,
  alt,
  side,
}: GameCardFaceProps) {
  const hasArt = showArt && !faceDown && !card.isPlaceholder && !!card.name.trim();
  const artFrameClass = portrait ? "absolute left-1/2 top-1/2" : "absolute inset-0";
  const artFrameStyle = portrait
    ? {
        width: "144.6153846154%",
        height: "69.1489361702%",
        transform: "translate(-50%, -50%) rotate(90deg)",
      }
    : undefined;

  return (
    <div
      className="absolute rounded-[inherit] overflow-hidden pointer-events-none"
      style={{ inset: `${insetPx}px` }}
    >
      <div
        data-battlefield-art-orientation={portrait ? "portrait" : undefined}
        className={artFrameClass}
        style={{
          ...artFrameStyle,
          transform: `${artFrameStyle?.transform ?? ""}${mirrored ? " rotate(180deg)" : ""}`.trim(),
        }}
      >
        {faceDown ? <CardBack slot={backSlot} insetPx={0} side={side ?? (mirrored ? "opponent" : "self")} /> : null}
        {hasArt ? (
          <CardArt
            card={card}
            profile={profile}
            alt={alt}
            side={side ?? (mirrored ? "opponent" : "self")}
            className="h-full w-full select-none object-contain"
          />
        ) : null}
        {!hasArt && !faceDown ? <CardArtFallback card={card} /> : null}
      </div>
      {showGradient && !faceDown ? (
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,10,24,0)_0%,rgba(4,10,24,0)_58%,rgba(4,10,24,0.12)_78%,rgba(5,10,24,0.44)_100%)]" />
      ) : null}
      {labels && labels.length > 0 ? (
        <CardLabelStack labels={labels} insetPx={insetPx} className="z-3" />
      ) : null}
    </div>
  );
}
