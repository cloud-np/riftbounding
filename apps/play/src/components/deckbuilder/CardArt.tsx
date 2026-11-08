"use client";

import { useMemo, useState } from "react";

import { buildCardImageUrl, buildResponsiveSrc, type Card } from "@rift/cards";

const WIDTHS = [96, 128, 192, 256, 320, 384, 512, 640, 768, 1024, 1280, 1536] as const;

export interface CardArtProps {
  card: Pick<Card, "id" | "name" | "imageUrl">;
  sizes: string;
  className?: string;
  /** Thumbnails use small-v2 at the bottom of the bucket range. */
  slot?: "small" | "original";
  draggable?: boolean;
  alt?: string;
}

function srcSetFor(card: Pick<Card, "imageUrl">): string {
  return WIDTHS.map(
    (width) => `${buildResponsiveSrc({ src: card.imageUrl, width, quality: 75 })} ${width}w`,
  ).join(", ");
}

/** Shared card image with the original's responsive CDN srcset and a text fallback. */
export function CardArt({
  card,
  sizes,
  className = "",
  slot = "original",
  draggable = false,
  alt,
}: CardArtProps) {
  const [failed, setFailed] = useState(false);
  const srcSet = useMemo(() => srcSetFor(card), [card]);
  const src =
    slot === "small"
      ? buildResponsiveSrc({ src: card.imageUrl, width: 384, quality: 75 })
      : buildResponsiveSrc({ src: card.imageUrl, width: 1536, quality: 75 });
  if (failed) {
    return (
      <span
        data-card-art-frame="silhouette"
        className={`flex h-full w-full items-center justify-center bg-[linear-gradient(160deg,#1e293b,#0f172a)] px-2 text-center text-[0.6rem] font-semibold uppercase tracking-wide text-slate-300 ${className}`}
      >
        {card.name}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={alt ?? card.name}
      data-rift-image-kind="card"
      data-rift-image-state="image"
      data-card-art-route="primary"
      data-card-art-source={buildCardImageUrl(
        card.imageUrl,
        slot === "small" ? "small-v2" : "original",
      )}
      width={488}
      height={680}
      loading="lazy"
      decoding="async"
      draggable={draggable}
      sizes={sizes}
      srcSet={srcSet}
      src={src}
      onError={() => setFailed(true)}
      className={className}
    />
  );
}

/** Raw print image URL used by the art picker and full-art tiles. */
export function printImageUrl(card: Card, slot: "small" | "original" = "small"): string {
  return buildResponsiveSrc({
    src: card.imageUrl,
    width: slot === "small" ? 384 : 1024,
    quality: 75,
  });
}
