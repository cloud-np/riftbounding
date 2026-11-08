/**
 * Decklist parsing — delegated to `@rift/cards` (port of original module 957839.v).
 *
 * The engine only needs the parsed sections to seed boards and store
 * `submit_deck` / `submit_sideboard`; validation stays with @rift/cards / the server.
 */
import type { DeckSections, DecklistEntry } from "@rift/protocol";
import { parseDeckText } from "@rift/cards";
import { getCardByCode, getCardByName } from "../catalog";
import type { DeckData } from "../types";

export function emptyDeckSections(): DeckSections {
  return {
    legend: [],
    champion: [],
    mainDeck: [],
    battlefields: [],
    runes: [],
    sideboard: [],
  };
}

export function normalizeDeckEntry(entry: DecklistEntry): DecklistEntry {
  return {
    name: entry.name.trim(),
    count: Math.max(0, Math.trunc(entry.count)),
    ...(entry.cardCode?.trim() ? { cardCode: entry.cardCode.trim() } : {}),
  };
}

/** Parse a decklist into sections (duplicate names with the same code are merged). */
export function parseDecklist(raw: string): DeckData {
  const parsed = parseDeckText(raw);
  return {
    raw: parsed.raw,
    sections: parsed.sections,
    totals: parsed.totals,
    warnings: parsed.warnings,
    errors: parsed.errors,
  };
}

/** Resolve a deck entry to a catalog card (code first, then name). */
export function entryCard(entry: DecklistEntry) {
  return getCardByCode(entry.cardCode) ?? getCardByName(entry.name);
}

/** Expand counts into `count` copies of each entry. */
export function expandEntries(entries: readonly DecklistEntry[]): DecklistEntry[] {
  return entries.flatMap((entry) =>
    entry.name.trim() && entry.count > 0
      ? Array.from({ length: Math.max(0, Math.trunc(entry.count)) }, () => entry)
      : [],
  );
}
