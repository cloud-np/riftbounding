"use client";

import { useState } from "react";

import { resolveCard } from "@rift/cards";
import type { CardInstance } from "@rift/protocol";

import { cardImageUrl, placeholderUrl, tokenImageUrl } from "@/lib/assets";

import { tokenArtForName, useBoardCustomization } from "../layout/customization";

import type { CardImageProfile } from "@/lib/assets";

const SOURCE_ABBREVIATIONS: Record<string, string> = {
  mainDeck: "MD",
  champion: "CH",
  legend: "LG",
  token: "TK",
  rune: "RN",
  battlefield: "BF",
  sideboard: "SB",
  duplicate: "CP",
};

export function sourceAbbreviation(card: CardInstance): string {
  return SOURCE_ABBREVIATIONS[card.source] ?? "CD";
}

/** Card art with placeholder fallback. */
export function CardArt({
  card,
  profile = "board",
  className,
  alt,
  draggable = false,
  side,
}: {
  card: CardInstance;
  profile?: CardImageProfile;
  className?: string;
  alt?: string;
  draggable?: boolean;
  side?: "self" | "opponent";
}) {
  const [failed, setFailed] = useState(false);
  const customization = useBoardCustomization();
  const ownerCustomization =
    side === "opponent" ? customization.opponent : side === "self" ? customization.self : undefined;
  const customToken =
    card.source === "token" ? tokenArtForName(ownerCustomization, card.name) : undefined;
  const token = card.source === "token" ? (customToken ?? tokenImageUrl(card.name, false)) : null;
  // Strict chain entries for triggered abilities carry only the source card's name (their
  // snapshot is not a card item). Resolve that name through the catalog so the public card art
  // still renders; placeholders (empty name / isPlaceholder) resolve to nothing.
  const resolved =
    !token && (!card.cardCode || !card.imageUrl) && card.name.trim()
      ? resolveCard(card.cardCode, card.name)
      : undefined;
  const artCard = resolved
    ? {
        ...card,
        cardCode: card.cardCode ?? resolved.id,
        imageUrl: card.imageUrl ?? resolved.imageUrl,
      }
    : card;
  const src = token ?? cardImageUrl(artCard, profile);

  return (
    // eslint-disable-next-line @next/next/no-img-element -- card art is served from the CDN/local copy, no optimizer needed
    <img
      alt={alt ?? card.name}
      draggable={draggable}
      loading={profile === "preview" || profile === "hover" ? "eager" : "lazy"}
      decoding="async"
      className={className ?? "h-full w-full object-contain select-none"}
      src={failed ? placeholderUrl() : src}
      onError={() => setFailed(true)}
      data-rift-image-kind="card"
      data-card-art-source={src}
      data-card-art-missing={failed || undefined}
    />
  );
}

/** Text fallback matching the original `data-card-art-missing` block. */
export function CardArtFallback({ card }: { card: CardInstance }) {
  return (
    <div
      data-card-art-missing="true"
      className="relative z-2 mt-auto rounded-none border-none bg-transparent p-0 grid gap-[0.02rem]"
    >
      <small>{sourceAbbreviation(card)}</small>
      <strong>{card.name}</strong>
    </div>
  );
}
