/**
 * Card-catalog adapter for @rift/engine.
 *
 * The catalog and its lookup/normalization helpers now live in `@rift/cards`
 * (a port of original module 26865), so this file is a thin compatibility layer using the
 * same helper names the engine was ported with. The engine-specific keyword/text helpers
 * (original module 558217) also live here.
 */
import type { CardInstance } from "@rift/protocol";
import type { Card } from "@rift/cards";
import {
  bestPrintCards,
  effectiveMight,
  getBattlefieldByName,
  getCardById,
  getCardByName as cardsGetCardByName,
  getCardsByNameAll,
  hasKeyword as cardsHasKeyword,
  imageUrlOf,
  isGoldToken as isGoldTokenNameFromCatalog,
  isSpawnableToken,
  normalizeCardName as normalizeCardNameFromCards,
  resolveCard,
  resolveCardTypeWords,
  resolveCardTypes,
  tokenArtOf,
  tokenMightOf,
  tokenTypeOf,
} from "@rift/cards";

export type CatalogCardRecord = Card;

/* ------------------------------------------------------------------ type/name primitives */

export function typeWords(type: string | undefined): string[] {
  return resolveCardTypeWords(type);
}

export function typeIncludes(type: string | undefined, word: string): boolean {
  const needle = word.trim().toLowerCase();
  return needle.length > 0 && typeWords(type).some((part) => part.toLowerCase() === needle);
}

export function normalizeCardName(name: string): string {
  return normalizeCardNameFromCards(name);
}

/* ------------------------------------------------------------------ lookups */

/** 26865 `A`: lookup by id / card code, tolerating an alt-art `S` suffix. */
export function getCardByCode(code: string | undefined | null): Card | undefined {
  return getCardById(code);
}

/** 26865 `v`: lookup by display name. */
export function getCardByName(name: string | undefined | null): Card | undefined {
  return cardsGetCardByName(name);
}

/** 26865 `R`: code first, then name. */
export function getCard(code: string | undefined | null, name: string | undefined | null): Card | undefined {
  return resolveCard(code, name);
}

export function getCardsByName(name: string): Card[] {
  return getCardsByNameAll(name ?? "");
}

export function getBattlefieldCard(name: string | undefined | null): Card | undefined {
  return getBattlefieldByName(name ?? "");
}

export const ALL_CARDS: readonly Card[] = bestPrintCards();

/** The card record backing an instance (tokens resolve through their card code only). */
export function cardForInstance(card: CardInstance): Card | undefined {
  if (card.source === "token") return undefined;
  return getCard(card.cardCode, card.name);
}

/* ------------------------------------------------------------------ runtime card helpers */

/** 26865 `N` / `t.n`: lowercase type words of an instance (instance + catalog). */
export function instanceTypes(card: CardInstance): string[] {
  return resolveCardTypes(card);
}

/** 26865 `t.R`: first lowercase type word. */
export function firstInstanceType(card: CardInstance): string {
  return instanceTypes(card)[0] ?? "";
}

export function isUnitCardType(card: CardInstance): boolean {
  return instanceTypes(card).includes("unit");
}

export function isGearCardType(card: CardInstance): boolean {
  return instanceTypes(card).includes("gear");
}

export function isSpellCardType(card: CardInstance): boolean {
  return instanceTypes(card).includes("spell");
}

/** 26865 `q` / `t.q`: keyword lookup (instance list first, then catalog). */
export function hasKeyword(card: CardInstance, keyword: string): boolean {
  return cardsHasKeyword(card, keyword);
}

/** 26865 `G` / `t.G`: printed or token might. */
export function cardMight(card: CardInstance): number | undefined {
  return effectiveMight(card);
}

/** 26865 `Y` / `t.Y`: image URL resolution (instance → token art → catalog). */
export function cardImageUrl(card: CardInstance): string | undefined {
  return imageUrlOf({ ...card, imageUrl: card.imageUrl ?? undefined });
}

function cardText(card: CardInstance): string {
  return card.text ?? getCard(card.cardCode, card.name)?.text ?? "";
}

/** 558217 `n`: "when you play me/this" text. */
export function hasWhenYouPlayMeText(text: string | undefined): boolean {
  return /\bwhen\s+you\s+play\s+(?:me|this)\b/i.test(text ?? "");
}

/** 558217 `r`: Hidden keyword. */
export function hasHidden(card: CardInstance): boolean {
  return hasKeyword(card, "hidden");
}

/** 558217 `$`: Flow keyword. */
export function hasFlow(card: CardInstance): boolean {
  return hasKeyword(card, "flow");
}

/** 558217 `h`: Repeat keyword. */
export function hasRepeat(card: CardInstance): boolean {
  return hasKeyword(card, "repeat");
}

/** 558217 `y`: Quick-Draw keyword. */
export function hasQuickDraw(card: CardInstance): boolean {
  return hasKeyword(card, "quick-draw");
}

/** 558217 `x`: Equip keyword. */
export function hasEquip(card: CardInstance): boolean {
  return hasKeyword(card, "equip");
}

/** 558217 `J`: Deploy gear. */
export function isDeployGear(card: CardInstance): boolean {
  return isGearCardType(card) && hasKeyword(card, "deploy");
}

const EMPOWER_NAMES = new Set([
  "Ambessa, Matriarch of War",
  "Kennen, Heart of the Tempest",
  "Mel, Soul's Reflection",
  "Mournful Witness",
  "Renekton, Brute",
  "Zed, Master of Shadows",
]);
const EMPOWER_INLINE = /\[empower\s+\d+\]/i;
const EMPOWER_ACTION = /\[empower\]\s*(?:\[[^\]]+\]|[-—]\s*(?:\[[^\]]+\]|\p{L}))/iu;

/** 558217 `L` / `t.L`: Empower keyword (name list, keyword list or text). */
export function hasEmpower(card: CardInstance): boolean {
  const record = getCard(card.cardCode, card.name);
  const name = record?.name ?? card.name?.trim() ?? "";
  if (EMPOWER_NAMES.has(name)) return true;
  if (!hasKeyword(card, "empower")) return false;
  const text = card.text?.trim() || record?.text || "";
  return EMPOWER_INLINE.test(text) || EMPOWER_ACTION.test(text);
}

/** 558217 `M`: Time Warp (OGN-122 spell). */
export function isTimeWarp(card: CardInstance): boolean {
  const record = getCard(card.cardCode, card.name);
  return isSpellCardType(card) && (record?.id === "OGN-122" || record?.baseCardId === "OGN-122");
}

/** 558217 `W`: "until your/my next ending phase" (Akali). */
export function hasUntilNextEndingPhase(card: CardInstance): boolean {
  const text = cardText(card);
  return (
    /until (?:your|my) next ending phase/i.test(text) ||
    card.name?.trim().toLowerCase() === "akali, brash"
  );
}

/** 558217 `c`: "banish the top card of your main deck". */
export function hasBanishTopCardText(card: CardInstance): boolean {
  const text = cardText(card);
  return (
    /banish the top card of (?:your|my) main deck/i.test(text) ||
    card.name?.trim().toLowerCase() === "akali, brash"
  );
}

/** 558217 `K`: "banish the top card … you may play it, ignoring its energy cost". */
export function hasDocksideText(card: CardInstance): boolean {
  return /banish the top card[^.]*\.\s*you may play it, ignoring its energy cost/i.test(cardText(card));
}

/* ------------------------------------------------------------------ tokens (143307) */

/** 143307 `m`: is a gold token. */
export function isGoldTokenName(name: string): boolean {
  return isGoldTokenNameFromCatalog(name);
}

/** 143307 `h`: default exhaustion for created tokens. */
export function tokenDefaultsExhausted(name: string): boolean {
  // 143307 `h`: true (enter exhausted) except bomb / sprite / reflection tokens.
  return isSpawnableToken(name);
}

/** 143307 `r`: token card type. */
export function tokenType(name: string): string | undefined {
  return tokenTypeOf(name);
}

/** 143307 `W`: token art. */
export function tokenImage(name: string): string | undefined {
  return tokenArtOf(name);
}

/** 143307 `E`: token might. */
export function tokenMightByName(name: string): number | undefined {
  return tokenMightOf(name);
}
