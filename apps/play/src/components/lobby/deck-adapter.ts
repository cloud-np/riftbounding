/**
 * Deck adapter — the single seam between the lobby UI and `@rift/cards`.
 *
 * `@rift/cards` (built by the cards task) now provides the faithful parser, deck
 * validation, deck codes and catalog lookups; this module only maps its result into
 * the shapes the lobby components consume and enriches entries with card metadata
 * for the List/Stats tabs.
 */
import {
  buildCardImageUrl,
  cards,
  decodeDeckCodeToDecklist,
  encodeDecklistToDeckCode,
  getCardByName,
  normalizeCardName,
  parseDeckText as parseWithCards,
  resolveCard,
  validateDeck,
} from "@rift/cards";
import type {
  Card,
  DeckSectionKey as CardsDeckSectionKey,
  ParsedDeck as CardsParsedDeck,
} from "@rift/cards";

import type {
  DeckEntry,
  DeckRulesMode,
  DeckSections,
  DeckStats,
  DeckTotals,
  ParsedDeck,
} from "./types";

export interface ParseDeckOptions {
  deckRulesMode?: DeckRulesMode;
  /** Defaults to true: validate entries against the card catalog. */
  validateCatalog?: boolean;
}

function enrichEntry(entry: { count: number; name: string; cardCode?: string }): DeckEntry {
  const card: Card | undefined = resolveCard(entry.cardCode, entry.name);
  return {
    ...entry,
    ...(card
      ? {
          imageUrl:
            buildCardImageUrl(card.imageUrl, "small-v2") ||
            card.imageUrl ||
            buildCardImageUrl(card.id, "small-v2"),
          energyCost: card.energyCost ?? null,
          might: card.might ?? null,
          powerCost: card.powerCost ?? null,
          domains: card.domains ?? [],
          types: card.type ? card.type.split(/\s+/) : [],
          keywords: card.keywords ?? [],
        }
      : {}),
  };
}

function toUiDeck(source: CardsParsedDeck, deckRulesMode: DeckRulesMode): ParsedDeck {
  const sections = {} as DeckSections;
  for (const key of Object.keys(source.sections) as CardsDeckSectionKey[]) {
    sections[key] = source.sections[key].map(enrichEntry);
  }
  const totals = { ...source.totals } as DeckTotals;
  const validation = validateDeck(source, {
    format: "standard-constructed",
    deckRulesMode,
  });
  const errors = [
    ...source.errors,
    ...validation.reasons.filter((reason) => !source.errors.includes(reason)),
  ];
  return {
    raw: source.raw,
    sections,
    totals,
    warnings: source.warnings,
    errors,
    valid: errors.length === 0,
    deckRulesMode,
  };
}

/**
 * Parse a Riftbound deck export. Mirrors the original grammar:
 *   `Legend:`, `Champion:`, `Main Deck:` (or `MainDeck:`), `Battlefields:`,
 *   `Runes:`, `Sideboard:` headers (colon required) and `N Card Name [ABC-123]`
 *   lines (the `Nx` prefix is not accepted).
 */
export function parseDeckText(raw: string, options: ParseDeckOptions = {}): ParsedDeck {
  const deckRulesMode = options.deckRulesMode ?? "standard";
  const parsed = parseWithCards(raw, {
    validateCatalog: options.validateCatalog ?? true,
    deckRulesMode,
  });
  return toUiDeck(parsed, deckRulesMode);
}

export function exportDeckText(deck: Pick<ParsedDeck, "sections">): string {
  const sections = {} as Record<
    CardsDeckSectionKey,
    { count: number; name: string; cardCode?: string }[]
  >;
  for (const key of Object.keys(deck.sections) as CardsDeckSectionKey[]) {
    sections[key] = deck.sections[key].map((entry) => ({
      count: entry.count,
      name: entry.name,
      ...(entry.cardCode ? { cardCode: entry.cardCode } : {}),
    }));
  }
  return exportTextFromSections(sections);
}

/** Plain text export (canonical headers + `N Name [CODE]` lines). */
function exportTextFromSections(
  sections: Record<CardsDeckSectionKey, { count: number; name: string; cardCode?: string }[]>,
): string {
  const heading: Record<CardsDeckSectionKey, string> = {
    legend: "Legend:",
    champion: "Champion:",
    mainDeck: "Main Deck:",
    battlefields: "Battlefields:",
    runes: "Runes:",
    sideboard: "Sideboard:",
  };
  const blocks: string[] = [];
  for (const key of Object.keys(heading) as CardsDeckSectionKey[]) {
    const entries = sections[key];
    if (!entries.length) continue;
    blocks.push(
      [
        heading[key],
        ...entries.map(
          (entry) => `${entry.count} ${entry.name}${entry.cardCode ? ` [${entry.cardCode}]` : ""}`,
        ),
      ].join("\n"),
    );
  }
  return blocks.join("\n\n");
}

export function formatDeckLine(entry: DeckEntry): string {
  return `${entry.count} ${entry.name}${entry.cardCode ? ` [${entry.cardCode}]` : ""}`;
}

/** Encode the deck as the original shareable deck code. */
export function encodeDeckCode(deck: Pick<ParsedDeck, "sections">): string | null {
  try {
    const sections = {} as Record<
      CardsDeckSectionKey,
      { count: number; name: string; cardCode?: string }[]
    >;
    for (const key of Object.keys(deck.sections) as CardsDeckSectionKey[]) {
      sections[key] = deck.sections[key].map((entry) => ({
        count: entry.count,
        name: entry.name,
        ...(entry.cardCode ? { cardCode: entry.cardCode } : {}),
      }));
    }
    return encodeDecklistToDeckCode({ sections });
  } catch {
    return null;
  }
}

/** Decode a deck code; returns an error string when the code is not recognized. */
export function decodeDeckCode(
  code: string,
  options: ParseDeckOptions = {},
): ParsedDeck | { error: string } {
  const trimmed = code.trim();
  if (!trimmed) return { error: "Paste a deck code first." };
  try {
    const decoded = decodeDeckCodeToDecklist(trimmed);
    return parseDeckText(decoded.decklistRaw, options);
  } catch {
    return { error: "Could not decode that deck code." };
  }
}

export interface CardSearchResult {
  id: string;
  name: string;
  imageUrl?: string;
}

/** Catalog search used by the Ctrl/⌘+K palette. */
export function searchCards(query: string, limit = 7): CardSearchResult[] {
  const needle = normalizeCardName(query);
  if (needle.length < 2) return [];
  const compact = needle.replaceAll(" ", "");
  const scored: { card: Card; score: number }[] = [];
  for (const card of cards()) {
    if (card._isToken) continue;
    const name = normalizeCardName(card.name);
    const compactName = name.replaceAll(" ", "");
    let score = -1;
    if (name === needle || compactName === compact) score = 0;
    else if (name.startsWith(needle) || compactName.startsWith(compact)) score = 1;
    else if (name.includes(needle) || compactName.includes(compact)) score = 2;
    else if (card.id.toLowerCase().includes(query.trim().toLowerCase())) score = 3;
    if (score >= 0) scored.push({ card, score });
  }
  scored.sort(
    (a, b) =>
      a.score - b.score ||
      a.card.name.length - b.card.name.length ||
      a.card.name.localeCompare(b.card.name),
  );
  return scored.slice(0, limit).map(({ card }) => ({
    id: card.id,
    name: card.name,
    imageUrl:
      buildCardImageUrl(card.imageUrl, "small-v2") ||
      card.imageUrl ||
      buildCardImageUrl(card.id, "small-v2"),
  }));
}

export function cardImageUrl(cardCode: string | undefined, slot = "small-v2"): string | null {
  if (!cardCode) return null;
  return buildCardImageUrl(cardCode, slot) || null;
}

export function cardByCode(cardCode: string | undefined): Card | undefined {
  return cardCode ? resolveCard(cardCode) : undefined;
}

export function cardByName(name: string): Card | undefined {
  return getCardByName(name);
}

/** Deck statistics used by the Stats tab. */
export function getDeckStats(deck: ParsedDeck): DeckStats {
  const main = deck.sections.mainDeck;
  const hasCardMetadata = main.some((entry) => typeof entry.energyCost === "number");
  let energyTotal = 0;
  let energyKnown = 0;
  let mightTotal = 0;
  let mightCount = 0;
  let powerCards = 0;
  const energy = new Map<number, number>();
  const power = new Map<string, { cards: number; power: number }>();
  const types = new Map<string, number>();
  const domains = new Map<string, number>();
  const runes = new Map<string, number>();
  let runeTotal = 0;
  let totalMain = 0;

  for (const entry of main) {
    totalMain += entry.count;
    if (typeof entry.energyCost === "number") {
      energyTotal += entry.energyCost * entry.count;
      energyKnown += entry.count;
      energy.set(entry.energyCost, (energy.get(entry.energyCost) ?? 0) + entry.count);
    }
    if (typeof entry.might === "number" && entry.might > 0) {
      mightTotal += entry.might * entry.count;
      mightCount += entry.count;
    }
    const powerCost = entry.powerCost ?? 0;
    if (powerCost > 0) {
      powerCards += entry.count;
      const key = (entry.domains ?? []).join("/") || "Unknown";
      const bucket = power.get(key) ?? { cards: 0, power: 0 };
      bucket.cards += entry.count;
      bucket.power += powerCost * entry.count;
      power.set(key, bucket);
    }
    for (const type of entry.types ?? []) {
      types.set(type, (types.get(type) ?? 0) + entry.count);
    }
    for (const domain of entry.domains ?? []) {
      domains.set(domain, (domains.get(domain) ?? 0) + entry.count);
    }
  }
  for (const entry of deck.sections.runes) {
    runeTotal += entry.count;
    const domain = entry.domains?.[0] ?? "Unknown";
    runes.set(domain, (runes.get(domain) ?? 0) + entry.count);
  }

  return {
    totalMainDeckCards: totalMain,
    averageEnergy: energyKnown > 0 ? energyTotal / energyKnown : null,
    averageMight: mightCount > 0 ? mightTotal / mightCount : null,
    powerCardCount: powerCards,
    energyCurve: [...energy.entries()]
      .sort(([a], [b]) => a - b)
      .map(([cost, count]) => ({ cost, count })),
    powerDemand: [...power.entries()]
      .map(([domainKey, value]) => ({
        domains: domainKey.split("/"),
        cards: value.cards,
        power: value.power,
      }))
      .sort((a, b) => b.power - a.power),
    runeDistribution: [...runes.entries()].map(([domain, count]) => ({
      domain,
      count,
      ratio: runeTotal > 0 ? count / runeTotal : 0,
    })),
    typeDistribution: [...types.entries()].map(([type, count]) => ({
      type,
      count,
      ratio: totalMain > 0 ? count / totalMain : 0,
    })),
    domainDistribution: [...domains.entries()].map(([domain, count]) => ({
      domain,
      count,
      ratio: totalMain > 0 ? count / totalMain : 0,
    })),
    hasCardMetadata,
  };
}
