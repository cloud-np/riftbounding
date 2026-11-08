/**
 * Minimal deck-list parser used by the realtime server until @rift/cards exposes the full parser.
 *
 * Mirrors the original section format (`Legend:`, `Champion:`, `MainDeck:`, `Battlefields:`,
 * `Runes:`, `Sideboard:`, `Additional Legends:`) and `N Name [CODE]` entries. The full validation
 * (copy limits, domains, bannings) lives in @rift/cards; this parser only needs enough structure to
 * seed the board for development and smoke tests.
 */

import type { DeckSections, DecklistEntry, ParsedDeck } from "@rift/protocol";

const SECTION_ALIASES: Record<string, keyof DeckSections> = {
  legend: "legend",
  legends: "legend",
  champion: "champion",
  champions: "champion",
  maindeck: "mainDeck",
  main: "mainDeck",
  deck: "mainDeck",
  battlefields: "battlefields",
  battlefield: "battlefields",
  runes: "runes",
  rune: "runes",
  sideboard: "sideboard",
  additionlegends: "legend",
  additionalllegends: "legend",
  additionallegends: "legend",
};

function emptySections(): DeckSections {
  return { legend: [], champion: [], mainDeck: [], battlefields: [], runes: [], sideboard: [] };
}

function normalizeHeader(line: string): string {
  return line.toLowerCase().replace(/[^a-z]/g, "");
}

/** Parse `N Name [CODE]` / `Nx Name` lines. */
export function parseDeckEntry(line: string): DecklistEntry | null {
  const match = line.match(/^(\d+)\s*(?:[xX]\s*)?(.+?)\s*(?:\[([A-Za-z0-9-]+)\])?\s*$/u);
  if (!match) return null;
  const count = Number(match[1]);
  const name = match[2]?.trim() ?? "";
  if (!Number.isInteger(count) || count <= 0 || name.length === 0) return null;
  const entry: DecklistEntry = { name, count };
  if (match[3]) entry.cardCode = match[3];
  return entry;
}

/** Parse a raw deck list into sections. Unknown/empty lines are ignored. */
export function parseDecklist(raw: string): ParsedDeck {
  const sections = emptySections();
  const warnings: string[] = [];
  const errors: string[] = [];
  let current: keyof DeckSections | null = null;

  for (const original of raw.split(/\r?\n/u)) {
    const line = original.trim();
    if (line.length === 0 || line.startsWith("#") || line.startsWith("//")) continue;
    if (line.endsWith(":") || /^[A-Za-z ]+:$/u.test(line)) {
      const header = SECTION_ALIASES[normalizeHeader(line)];
      if (header) {
        current = header;
        continue;
      }
      warnings.push(`Unknown deck section "${line}".`);
      current = null;
      continue;
    }
    if (!current) {
      warnings.push(`Card entry "${line}" appears before a known section header.`);
      continue;
    }
    const entry = parseDeckEntry(line);
    if (!entry) {
      errors.push(`Could not parse "${line}".`);
      continue;
    }
    sections[current].push(entry);
  }

  const totals = {
    legend: sections.legend.reduce((sum, entry) => sum + entry.count, 0),
    champion: sections.champion.reduce((sum, entry) => sum + entry.count, 0),
    mainDeck: sections.mainDeck.reduce((sum, entry) => sum + entry.count, 0),
    battlefields: sections.battlefields.reduce((sum, entry) => sum + entry.count, 0),
    runes: sections.runes.reduce((sum, entry) => sum + entry.count, 0),
    sideboard: sections.sideboard.reduce((sum, entry) => sum + entry.count, 0),
  };

  return { raw, sections, totals, warnings, errors };
}

export function emptyParsedDeck(raw = ""): ParsedDeck {
  const sections = emptySections();
  return {
    raw,
    sections,
    totals: { legend: 0, champion: 0, mainDeck: 0, battlefields: 0, runes: 0, sideboard: 0 },
    warnings: [],
    errors: [],
  };
}
