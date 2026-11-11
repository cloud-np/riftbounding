import { isChampionUnit, resolveCard } from "@rift/cards";
import type { CardInstance } from "@rift/protocol";

/**
 * Presentation tier for "special" cards (owner request: legendary and epic cards get their own,
 * more impactful effects). The catalog's rarities are Common / Uncommon / Rare / Epic / Showcase,
 * so "legendary" is a presentation tier, not a printed rarity:
 *
 * - `legendary`: champion units, Legends, signature cards and Showcase prints;
 * - `epic`: every other Epic print;
 * - `null`: everything else (no special treatment).
 *
 * Shared contract: the card lane sets `data-rarity-tier` on hand cards / full faces, the hover lane
 * on the preview, and the FX lane scales play effects by it. Styling lives in `styles/rarity.css`.
 */
export type RarityTier = "legendary" | "epic";

type CardLike = Pick<CardInstance, "cardCode" | "name"> & Partial<Pick<CardInstance, "type" | "source">>;

const cache = new Map<string, RarityTier | null>();

export function rarityTier(card: CardLike | null | undefined): RarityTier | null {
  if (!card?.name && !card?.cardCode) return null;
  const key = `${card.cardCode ?? ""}|${card.name ?? ""}|${card.type ?? ""}|${card.source ?? ""}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  const printed = resolveCard(card.cardCode, card.name);
  const type = (card.type ?? printed?.type ?? "").toLowerCase();
  let tier: RarityTier | null = null;
  if (
    card.source === "legend" ||
    card.source === "champion" ||
    type.includes("legend") ||
    type.includes("champion") ||
    (printed && (isChampionUnit(printed) || printed.signatureType || printed.rarity === "Showcase"))
  ) {
    tier = "legendary";
  } else if (printed?.rarity === "Epic") {
    tier = "epic";
  }
  cache.set(key, tier);
  return tier;
}
