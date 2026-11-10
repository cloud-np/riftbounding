"use client";

import { useCallback, useState } from "react";

import type { CardInstance } from "@rift/protocol";

import { cardArtUrl } from "@/lib/assets";

import { tokenArtForName, useBoardCustomization } from "../layout/customization";

import type { CardImageProfile } from "@/lib/assets";

import { ProceduralCardFace } from "./ProceduralCardFace";

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

/**
 * Card art. While the image loads, and whenever it fails or the card has no art, the original
 * procedural face is shown instead; the `<img>` stays in the DOM (visually hidden on failure) so
 * the card name remains addressable through `img[alt]`.
 *
 * `crop` frames the illustration region only (board tokens). `fallback="none"` skips the
 * procedural layer for callers that draw their own underlay.
 */
export function CardArt({
  card,
  profile = "board",
  className,
  alt,
  draggable = false,
  side,
  src: srcOverride,
  crop = false,
  fallback = "face",
}: {
  card: CardInstance;
  profile?: CardImageProfile;
  className?: string;
  alt?: string;
  draggable?: boolean;
  side?: "self" | "opponent";
  /** Pre-resolved art URL (hover preview resolves token art itself). */
  src?: string;
  crop?: boolean;
  fallback?: "face" | "none";
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const customization = useBoardCustomization();
  const ownerCustomization =
    side === "opponent" ? customization.opponent : side === "self" ? customization.self : undefined;
  const customToken =
    card.source === "token" ? tokenArtForName(ownerCustomization, card.name) : undefined;
  // Strict chain entries for triggered abilities carry only the source card's name (their
  // snapshot is not a card item): the shared resolver resolves that name through the catalog.
  // Token cards use the catalog token art exactly like the hover preview and pile viewer.
  const src = srcOverride ?? cardArtUrl(card, profile, { tokenArt: customToken });
  const failed = failedSrc === src;
  const loaded = loadedSrc === src && !failed;

  // The image may finish (or fail) before React hydrates, in which case no event reaches us.
  const imgRef = useCallback(
    (img: HTMLImageElement | null) => {
      if (!img || !img.complete) return;
      if (img.naturalWidth > 0) setLoadedSrc(src);
      else setFailedSrc(src);
    },
    [src],
  );

  const imgClass = failed
    ? "card-art-hidden"
    : crop
      ? "card-art-img card-art-crop select-none"
      : (className ?? "h-full w-full object-contain select-none");

  return (
    <>
      {fallback === "face" && !loaded ? (
        <ProceduralCardFace card={card} mode={crop ? "crop" : "full"} />
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element -- card art is served from the CDN/local copy, no optimizer needed */}
      <img
        ref={imgRef}
        alt={alt ?? card.name}
        draggable={draggable}
        loading={profile === "preview" || profile === "hover" ? "eager" : "lazy"}
        decoding="async"
        className={imgClass}
        src={src}
        onLoad={() => setLoadedSrc(src)}
        onError={() => setFailedSrc(src)}
        data-rift-image-kind="card"
        data-art-state={failed ? "failed" : loaded ? "loaded" : "loading"}
        data-card-art-source={src}
        data-card-art-missing={failed || undefined}
      />
    </>
  );
}

/** Text fallback matching the original `data-card-art-missing` block (visually hidden: the procedural face is the visible fallback). */
export function CardArtFallback({ card }: { card: CardInstance }) {
  return (
    <div data-card-art-missing="true" className="card-art-hidden">
      <small>{sourceAbbreviation(card)}</small>
      <strong>{card.name}</strong>
    </div>
  );
}
