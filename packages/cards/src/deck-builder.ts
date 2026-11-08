/**
 * `@rift/cards` — deck-builder helpers.
 *
 * Additive port of the original builder's deck helpers (module 57839 in
 * `.recon/pretty/decks/36q_dilgdce91.js`). The lobby/engine continue to use the
 * existing `deck-text` API; everything here only re-exports aliases and adds the
 * helpers the builder UI needs (copy limits, safety limits, Neeko/Additional
 * Legends, catalog eligibility and ban wrappers).
 */

import { cardTypeMatches, isChampionForLegend, normalizeNameAscii, resolveCard } from "./catalog";
import {
  banReasons,
  exportDeckText,
  formatDeckEntry,
  hasMultipleLegends,
  normalizeSections,
  parseDeckText,
  sectionDisplayName,
  validateDeck,
} from "./deck-text";
import type { Card, DeckSectionKey, DeckSections, ParsedDeck, ParsedDeckEntry } from "./types";

/* ------------------------------------------------------------ constants */

export const MAX_CARD_COPIES = 3;
export const MAX_BATTLEFIELD_COPIES = 1;
export const MAX_SIDEBOARD_COUNT = 10;
export const MAX_MAIN_DECK_SAFETY_COUNT = 80;
export const MAX_SIGNATURE_CARD_COUNT = 3;
export const MAX_EXPANDED_CARD_TOTAL = 250;
export const MAX_DECKLIST_RAW_LENGTH = 20000;

export const REQUIRED_LEGEND_COUNT = 1;
export const REQUIRED_CHAMPION_COUNT = 1;
export const REQUIRED_CORE_DECK_COUNT = 40;
export const REQUIRED_BATTLEFIELD_COUNT = 3;
export const REQUIRED_RUNE_COUNT = 12;
/** Derived the same way the builder count badge does (40 core − 1 champion). */
export const REQUIRED_MAIN_DECK_COUNT = REQUIRED_CORE_DECK_COUNT - REQUIRED_CHAMPION_COUNT;

export const NEEKO_CARD_NAME = "Neeko, Blending In";
export const NEEKO_LEGEND_OPTION_COUNT = 3;

export const STANDARD_CONSTRUCTED_BAN_FORMAT = "Standard Constructed";
export const CONSTRUCTED_2V2_BAN_FORMAT = "Constructed 2v2";

export const ADDITIONAL_LEGENDS_SECTION_LABEL = "Additional Legends";
export const DECK_RULE_KEYWORDS = ["Unique"] as const;

const COPY_LIMIT_EXEMPT_NAMES = new Set(["spiderling"]);

/* -------------------------------------------------------------- helpers */

function normalizedName(name: string | undefined | null): string {
  return (name ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function entryCard(entry: { name?: string; cardCode?: string } | undefined): Card | undefined {
  return entry ? resolveCard(entry.cardCode, entry.name) : undefined;
}

function entryIdentity(entry: { name: string; cardCode?: string }): string {
  const code = entry.cardCode?.trim();
  return code ? `code:${code}` : `name:${normalizedName(entry.name)}`;
}

/** `R` — total cards in a list of counted entries. */
export function totalCards(entries: readonly { count: number }[]): number {
  return entries.reduce((sum, entry) => sum + entry.count, 0);
}

/** `m` — a fresh, empty six-section deck. */
export function emptyDeckSections(): DeckSections {
  return { legend: [], champion: [], mainDeck: [], battlefields: [], runes: [], sideboard: [] };
}

/**
 * `_` — per-name copy limit: `null` for unlimited tokens (Spiderling), `1` for
 * Unique cards, otherwise `3`.
 */
export function getCardCopyLimit(entry: { name?: string; cardCode?: string }): number | null {
  const card = entryCard(entry);
  const key = normalizedName(card?.name ?? entry.name);
  if (COPY_LIMIT_EXEMPT_NAMES.has(key)) return null;
  const uniqueKeyword =
    card?.keywords?.some((keyword) => keyword.trim().toLowerCase() === "unique") === true;
  const uniqueText = /\[\s*unique\s*\]/i.test(card?.text ?? "");
  return uniqueKeyword || uniqueText ? 1 : 3;
}

/** `d` — the 80-card Main Deck safety limit (not the 39-card play requirement). */
export function getMainDeckSafetyLimitError(count: number): string | null {
  return count <= MAX_MAIN_DECK_SAFETY_COUNT
    ? null
    : `Main Deck can contain at most ${MAX_MAIN_DECK_SAFETY_COUNT} cards. Found ${count}.`;
}

/** `p` — does the deck contain Neeko in Main Deck or Sideboard? */
export function deckIncludesNeeko(sections: DeckSections): boolean {
  return hasMultipleLegends(sections);
}

/** `h` — is this entry Neeko, Blending In? */
export function isNeekoDeckEntry(entry: { name?: string; cardCode?: string }): boolean {
  const card = entryCard(entry);
  return normalizedName(card?.name ?? entry.name) === normalizedName(NEEKO_CARD_NAME);
}

/** `g` — is `legendEntry` a legal legend for a given champion entry? */
export function isLegendForChampion(
  legendEntry: { name?: string; cardCode?: string },
  championEntry: { name?: string; cardCode?: string } | undefined,
): boolean {
  const champion = championEntry ? entryCard(championEntry) : undefined;
  const legendTag = entryCard(legendEntry)?.subtypes?.[0]?.trim();
  return !!(champion && legendTag && isChampionForLegend(champion, legendTag));
}

/** `x` — place the single legend compatible with the champion first. */
export function orderStartingLegendFirst(
  legends: readonly ParsedDeckEntry[],
  champion: readonly { name?: string; cardCode?: string }[],
): ParsedDeckEntry[] {
  if (legends.length < 2 || !champion[0]) return [...legends];
  const matching = legends.filter((legend) => isLegendForChampion(legend, champion[0]));
  const chosen = matching.length === 1 ? matching[0] : undefined;
  return chosen ? [chosen, ...legends.filter((legend) => legend !== chosen)] : [...legends];
}

/** `y` — remove every entry with the same identity. */
export function removeLegendEntry(
  legends: readonly ParsedDeckEntry[],
  entry: ParsedDeckEntry,
): ParsedDeckEntry[] {
  const identity = entryIdentity(entry);
  return legends.filter((legend) => entryIdentity(legend) !== identity);
}

/** `setStartingLegend` — make `entry` the first (starting) legend. */
export function setStartingLegend(
  legends: readonly ParsedDeckEntry[],
  entry: ParsedDeckEntry,
): ParsedDeckEntry[] {
  return [entry, ...removeLegendEntry(legends, entry)];
}

/** `getNeekoLegendOptionEntries` — everything after the starting legend. */
export function getNeekoLegendOptionEntries(
  legends: readonly ParsedDeckEntry[],
): ParsedDeckEntry[] {
  return legends.slice(1);
}

/** `getMaximumLegendCount` — 1 normally, 4 with Neeko in the deck. */
export function getMaximumLegendCount(sections: DeckSections): number {
  return 1 + NEEKO_LEGEND_OPTION_COUNT * (deckIncludesNeeko(sections) ? 1 : 0);
}

/** `countStartingLegends` — starting legends count is capped at 1 with Neeko. */
export function countStartingLegends(deck: Pick<ParsedDeck, "sections" | "totals">): number {
  return deck.sections && deckIncludesNeeko(deck.sections)
    ? Math.min(deck.totals.legend, 1)
    : deck.totals.legend;
}

/**
 * `replaceEntryPrint` — swap an entry's print while keeping its count; merges
 * into an existing entry for the target identity.
 */
export function replaceEntryPrint(
  entries: readonly ParsedDeckEntry[],
  from: { name: string; cardCode?: string },
  to: { name: string; cardCode?: string },
): ParsedDeckEntry[] {
  const fromIdentity = entryIdentity(from);
  const toIdentity = entryIdentity(to);
  const fromIndex = entries.findIndex((entry) => entryIdentity(entry) === fromIdentity);
  const current = entries[fromIndex];
  if (!current || fromIdentity === toIdentity) return [...entries];
  const toIndex = entries.findIndex((entry) => entryIdentity(entry) === toIdentity);
  const count = current.count + (entries[toIndex]?.count ?? 0);
  const insertAt = toIndex === -1 ? fromIndex : Math.min(fromIndex, toIndex);
  const replacement: ParsedDeckEntry = {
    count,
    name: to.name,
    ...(to.cardCode ? { cardCode: to.cardCode } : {}),
  };
  return entries.flatMap((entry, index) =>
    index === insertAt ? [replacement] : index === fromIndex || index === toIndex ? [] : [entry],
  );
}

/** `j` — all of the card's domains must be inside the legend's identity. */
export function areCardDomainsWithinIdentity(
  cardDomains: readonly string[] | undefined,
  legendDomains: readonly string[] | undefined,
): boolean {
  const unique = (domains: readonly string[] | undefined): string[] => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of domains ?? []) {
      const trimmed = raw.trim();
      const key = trimmed.toLowerCase();
      if (!key || key === "unknown" || seen.has(key)) continue;
      seen.add(key);
      out.push(trimmed);
    }
    return out;
  };
  const card = unique(cardDomains).map((domain) => domain.toLowerCase());
  const legend = new Set(unique(legendDomains).map((domain) => domain.toLowerCase()));
  return card.length > 0 && legend.size > 0 && card.every((domain) => legend.has(domain));
}

/** `tQ` — domain identity, bypassed by Neeko. */
export function cardMatchesLegendIdentity(
  card: Card,
  legend: { name?: string; cardCode?: string } | undefined,
): boolean {
  if (isNeekoDeckEntry({ name: card.name, cardCode: card.id })) return true;
  const legendCard = entryCard(legend);
  return areCardDomainsWithinIdentity(card.domains, legendCard?.domains);
}

/** `tG` — the legend's champion tag (first subtype). */
export function legendChampionTag(
  legend: { name?: string; cardCode?: string } | undefined,
): string | null {
  return entryCard(legend)?.subtypes?.[0]?.trim() || null;
}

/**
 * The builder's narrower Champion pool filter: unit + domain identity +
 * tag subtype + **name starts with the tag** (a UI-only narrowing that is
 * stricter than the parser's `isChampionForLegend`).
 */
export function isCatalogChampionForLegend(
  card: Card,
  legend: { name?: string; cardCode?: string } | undefined,
): boolean {
  const tag = legendChampionTag(legend);
  if (!tag) return false;
  return (
    cardTypeMatches(card, "unit") &&
    cardMatchesLegendIdentity(card, legend) &&
    (card.subtypes ?? []).some((subtype) => subtype.trim() === tag) &&
    card.name.toLowerCase().startsWith(tag.toLowerCase())
  );
}

/**
 * `tW`/`tB`/`t0` — exact builder catalog eligibility for a section. Tokens are
 * filtered by the caller (the original catalog drops token rows).
 */
export function isCardEligibleForCatalogSection(
  card: Card,
  section: DeckSectionKey,
  legend: { name?: string; cardCode?: string } | undefined,
): boolean {
  const type = card.type?.trim().toLowerCase() ?? "";
  switch (section) {
    case "legend":
      return type === "legend";
    case "champion":
      return !!legend && isCatalogChampionForLegend(card, legend);
    case "battlefields":
      return type === "battlefield";
    case "runes":
      return type === "rune" && !!legend && cardMatchesLegendIdentity(card, legend);
    case "mainDeck":
    case "sideboard": {
      if (!legend) return false;
      if (
        type.includes("champion") ||
        type === "legend" ||
        type === "battlefield" ||
        type === "rune"
      )
        return false;
      if (!cardMatchesLegendIdentity(card, legend)) return false;
      const tag = legendChampionTag(legend);
      return !card.signatureType || card.signatureType === tag;
    }
    default:
      return false;
  }
}

/** Is the card banned in Standard Constructed? */
export function isBannedInStandardConstructed(card: Card | undefined): boolean {
  return card?.bannedIn?.some((ban) => ban.format === STANDARD_CONSTRUCTED_BAN_FORMAT) ?? false;
}

/* ---------------------------------------------------------------- aliases */

/** `buildDecklistText` — alias of `exportDeckText`. */
export const buildDecklistText = exportDeckText;
/** `normalizeDeckSections` — alias of `normalizeSections`. */
export const normalizeDeckSections = normalizeSections;
/** `sectionLabel` — alias of `sectionDisplayName`. */
export const sectionLabel = sectionDisplayName;
/** `formatDeckEntryLine` — alias of `formatDeckEntry`. */
export const formatDeckEntryLine = formatDeckEntry;
/** `decodePercentEncodedDecklist` — alias of `decodePercentEscapes`. */
export { decodePercentEscapes as decodePercentEncodedDecklist } from "./deck-text";
/** `expandDeckEntries` — alias of `expandCounts`. */
export { expandCounts as expandDeckEntries } from "./deck-text";

/** `w` — loose name equality (empty name matches anything). */
export function entryNameMatchesCard(name: string, catalogName: string): boolean {
  return !normalizeNameAscii(name) || normalizedName(name) === normalizedName(catalogName);
}

/** `O` — Standard Constructed ban reasons. */
export function validateStandardConstructedDeckBans(deck: ParsedDeck): string[] {
  return banReasons(deck, [STANDARD_CONSTRUCTED_BAN_FORMAT]);
}

/** `z` — Standard Constructed (+ Constructed 2v2 for 2v2 games) ban reasons. */
export function validateConstructedDeckBans(
  deck: ParsedDeck,
  options: { gameVariant?: string } = {},
): string[] {
  return banReasons(
    deck,
    options.gameVariant === "teams_2v2"
      ? [STANDARD_CONSTRUCTED_BAN_FORMAT, CONSTRUCTED_2V2_BAN_FORMAT]
      : [STANDARD_CONSTRUCTED_BAN_FORMAT],
  );
}

/**
 * `isDeckReadyForMatch` — alias of `validateDeck` with the original's default
 * Standard Constructed format. The builder always runs in standard mode.
 */
export function isDeckReadyForMatch(
  deck: ParsedDeck,
  options: {
    format?: string;
    deckRulesMode?: "standard" | "unrestricted";
    gameVariant?: string;
  } = {},
): { valid: boolean; reasons: string[] } {
  return validateDeck(deck, {
    format: options.format ?? "standard-constructed",
    ...(options.deckRulesMode ? { deckRulesMode: options.deckRulesMode } : {}),
    ...(options.gameVariant ? { gameVariant: options.gameVariant } : {}),
  });
}

/**
 * `parseDecklist` — builder alias whose catalog validation defaults to **off**,
 * exactly like the original (callers that want catalog checks pass
 * `{ validateCatalog: true }`).
 */
export function parseDecklist(
  raw: string,
  options: { validateCatalog?: boolean; deckRulesMode?: "standard" | "unrestricted" } = {},
): ParsedDeck {
  return parseDeckText(raw, { validateCatalog: false, ...options });
}
