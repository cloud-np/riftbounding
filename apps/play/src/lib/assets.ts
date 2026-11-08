/**
 * Static asset + card image URL helpers.
 *
 * Static UI assets (playmat, card backs, icons, tokens, sounds, rive, effects…)
 * are served from the local copy under `public/riftbound/static` and keep the
 * original CDN-relative paths. Card art keeps loading from the Rift Atlas CDN by
 * default (configurable through `NEXT_PUBLIC_CARD_ASSET_BASE`), exactly like the
 * original app.
 */

import {
  buildCardImageUrl,
  configureAssetBases,
  slotToSize,
} from "@rift/cards";
import type { ImageSlot } from "@rift/cards";

const DEFAULT_STATIC_BASE = "/riftbound/static";
const DEFAULT_CARD_BASE = "https://assets.riftatlas-workers.com/riftbound/cards";

function trimBase(value: string): string {
  const trimmed = value.trim();
  if (trimmed === "/") return trimmed;
  return trimmed.replace(/\/+$/u, "");
}

/** Base for local static UI assets. */
export const STATIC_ASSET_BASE = trimBase(
  process.env.NEXT_PUBLIC_STATIC_ASSET_BASE ?? DEFAULT_STATIC_BASE,
);

/** Base for card art (CDN by default). */
export const CARD_ASSET_BASE = trimBase(
  process.env.NEXT_PUBLIC_CARD_ASSET_BASE ?? DEFAULT_CARD_BASE,
);

// Make @rift/cards image helpers use the same hosts as this app.
configureAssetBases({ cardsBase: CARD_ASSET_BASE, staticBase: STATIC_ASSET_BASE });

/** Build a URL for a local static UI asset, e.g. `staticAsset("board.webp")`. */
export function staticAsset(path: string): string {
  const clean = path.replace(/^\/+/u, "");
  if (!clean) return STATIC_ASSET_BASE;
  return `${STATIC_ASSET_BASE}/${clean}`;
}

/** Same-origin second asset tree (cosmetics, board lines, points rail, badges…). */
export function cosmeticAsset(path: string): string {
  return staticAsset(path);
}

/** Logical card image profiles → original CDN size buckets. */
export type CardImageProfile = ImageSlot;

/**
 * Card art URL. `imageUrl` may be the catalog path (`/cards/OGN-039.webp`) or a
 * pre-resolved URL; when absent the card code is used.
 */
export function cardImageUrl(
  input: { cardCode?: string | null; imageUrl?: string | null },
  profile: CardImageProfile = "board",
): string {
  const code = input.cardCode?.trim();
  const src = input.imageUrl?.trim() || (code ? `/cards/${code}.webp` : "");
  if (!src) return placeholderUrl();
  const slot = slotToSize(profile);
  return buildCardImageUrl(src, slot) || src;
}

/** Responsive `srcset` for card art (kept for wave-2 hover previews). */
export type CardBackSlot = "deck" | "runeDeck" | "battlefield" | "landscape";

/** Default card back per pile slot (original: blue deck, white rune, black battlefield). */
export function cardBackUrl(slot: CardBackSlot = "deck"): string {
  switch (slot) {
    case "runeDeck":
      return staticAsset("cardback-white.png");
    case "battlefield":
      return staticAsset("cardback-black.png");
    case "landscape":
      return staticAsset("cardback-black-landscape.png");
    case "deck":
    default:
      return staticAsset("cardback-blue.png");
  }
}

/** Token art (`tokens/<Name>.webp` or the thumb variant). */
export function tokenImageUrl(name: string, thumb = false): string {
  const file = name.trim().replace(/[^A-Za-z0-9]+/gu, "");
  return thumb ? staticAsset(`tokens/thumbs/${file}.webp`) : staticAsset(`tokens/${file}.webp`);
}

/** Manifest icon path (`icons/<name>.svg|webp`). */
export function iconAsset(name: string, extension: "svg" | "webp" = "webp"): string {
  return staticAsset(`icons/${name}.${extension}`);
}

/** Domain pip art (`icons/<domain>.webp`). */
export function domainAsset(domain: string): string {
  return staticAsset(`icons/${domain.toLowerCase()}.webp`);
}

/** Playmat texture. */
export function boardPlaymatUrl(): string {
  return staticAsset("board.webp");
}

/** Missing-art placeholder. */
export function placeholderUrl(): string {
  return staticAsset("placeholder.svg");
}

/** Sound file (`sounds/20260716/<file>.webm`). */
export function soundAsset(file: string): string {
  return staticAsset(`sounds/20260716/${file}`);
}

/** Rive animation file from the second (same-origin) asset tree. */
export function riveAsset(path: string): string {
  return cosmeticAsset(path);
}
