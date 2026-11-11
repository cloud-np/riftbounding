"use client";

import type { CSSProperties } from "react";

import type { CardInstance } from "@rift/protocol";

import type { CardImageProfile } from "@/lib/assets";

import { CardArt } from "./CardArt";
import { cardMeta } from "./card-meta";
import { rarityTier } from "./rarity";
import { domainStyleVars } from "./ProceduralCardFace";

/**
 * A whole card: the real illustration over the procedural frame (which shows while loading or
 * when the art is missing). Fills its positioned parent.
 */
export function CardFullFace({
  card,
  profile = "board",
  side,
  src,
  className,
  imgClassName,
  style,
}: {
  card: CardInstance;
  profile?: CardImageProfile;
  side?: "self" | "opponent";
  src?: string;
  className?: string;
  imgClassName?: string;
  style?: CSSProperties;
}) {
  const meta = cardMeta(card);
  return (
    <div className={"absolute inset-0 overflow-hidden rounded-[inherit]" + (className ? ` ${className}` : "")} data-rarity-tier={rarityTier(card) ?? undefined} style={{ ...domainStyleVars(meta), ...style }}>
      <CardArt card={card} profile={profile} side={side} src={src} className={imgClassName ?? "h-full w-full select-none object-cover"} />
    </div>
  );
}
