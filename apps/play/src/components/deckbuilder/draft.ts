import {
  MAX_BATTLEFIELD_COPIES,
  MAX_MAIN_DECK_SAFETY_COUNT,
  NEEKO_LEGEND_OPTION_COUNT,
  buildDecklistText,
  deckIncludesNeeko,
  emptyDeckSections,
  getCardCopyLimit,
  getMaximumLegendCount,
  isDeckReadyForMatch,
  isLegendForChampion,
  normalizeDeckSections,
  normalizeNameAscii,
  parseDeckText,
  totalCards,
  type Card,
  type DeckSectionKey,
  type DeckSections,
  type ParsedDeck,
  type ParsedDeckEntry,
} from "@rift/cards";

import { T } from "./strings";
import type { DeckbuilderDraftV5 } from "./types";

export const CROSS_SECTION_LIMIT_SECTIONS: readonly DeckSectionKey[] = [
  "champion",
  "mainDeck",
  "sideboard",
];

export function entryIdentity(entry: { name: string; cardCode?: string }): string {
  const code = entry.cardCode?.trim();
  return code ? `code:${code}` : `name:${normalizeNameAscii(entry.name)}`;
}

export function normalizedKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** `i4` — `"<champion> / <legend>"` (localized order), or whichever part exists. */
export function computedDeckName(sections: DeckSections, startingLegendVacant = false): string {
  const champion = sections.champion[0]?.name?.trim() ?? "";
  const legend = startingLegendVacant ? "" : (sections.legend[0]?.name?.trim() ?? "");
  if (champion && legend) return `${champion} / ${legend}`;
  return champion || legend;
}

/** Placeholder: computed name, else the original's `Saved Deck` fallback. */
export function deckNamePlaceholder(sections: DeckSections, startingLegendVacant = false): string {
  return computedDeckName(sections, startingLegendVacant) || T.savedDeck;
}

/** `tz` — signature of the saved shape (name, guide, normalized sections). */
export function draftSignature(name: string, guideHtml: string, sections: DeckSections): string {
  return JSON.stringify({
    name: name.trim(),
    guideHtml: guideHtml.trim(),
    deckSections: normalizeDeckSections(sections),
  });
}

/** Parse the editor's sections the way the original does (catalog validated, codes included). */
export function parseDeckSections(
  sections: DeckSections,
  options: { startingLegendVacant?: boolean } = {},
): ParsedDeck {
  const source = options.startingLegendVacant ? { ...sections, legend: [] } : sections;
  const raw = buildDecklistText(source, { includeCardCodes: true });
  return parseDeckText(raw, { validateCatalog: true, deckRulesMode: "standard" });
}

export function deckIsReady(parsed: ParsedDeck): boolean {
  return isDeckReadyForMatch(parsed, { format: "standard-constructed" }).valid;
}

export interface AddAvailability {
  ok: boolean;
  reason: "copy-limit" | "battlefield-limit" | "main-deck-cap" | "legend-full" | null;
  message: string | null;
}

/** `E` — copies of a name across Champion + Main Deck + Sideboard. */
export function crossSectionCount(sections: DeckSections, name: string): number {
  const key = normalizedKey(name);
  let total = 0;
  for (const section of CROSS_SECTION_LIMIT_SECTIONS) {
    for (const entry of sections[section]) {
      if (normalizedKey(entry.name) === key) total += entry.count;
    }
  }
  return total;
}

export function sectionNameCount(
  sections: DeckSections,
  section: DeckSectionKey,
  name: string,
): number {
  const key = normalizedKey(name);
  return sections[section].reduce(
    (sum, entry) => (normalizedKey(entry.name) === key ? sum + entry.count : sum),
    0,
  );
}

function availability(reason: AddAvailability["reason"], message: string): AddAvailability {
  return { ok: false, reason, message };
}

/**
 * `z` — can this card be added to the section? Tests the copy limit across
 * Champion/Main Deck/Sideboard, the per-name battlefield limit and the 80-card
 * Main Deck safety cap. Legends and champions are always replaceable.
 */
export function getAddAvailability(
  card: Card | { name: string; cardCode?: string },
  section: DeckSectionKey,
  sections: DeckSections,
): AddAvailability {
  if (section === "legend" || section === "champion")
    return { ok: true, reason: null, message: null };
  const name = "name" in card && card.name ? card.name : "";
  if (section === "battlefields") {
    const count = sectionNameCount(sections, "battlefields", name);
    return count < MAX_BATTLEFIELD_COPIES
      ? { ok: true, reason: null, message: null }
      : availability("battlefield-limit", T.onlyBattlefieldCopies(MAX_BATTLEFIELD_COPIES, name));
  }
  if (section === "mainDeck" && totalCards(sections.mainDeck) >= MAX_MAIN_DECK_SAFETY_COUNT) {
    return availability("main-deck-cap", T.mainDeckCap);
  }
  if (CROSS_SECTION_LIMIT_SECTIONS.includes(section)) {
    const cardCode = "id" in card ? card.id : card.cardCode;
    const limit = getCardCopyLimit({ name, cardCode });
    if (limit !== null && crossSectionCount(sections, name) >= limit) {
      return availability("copy-limit", T.maxCopiesReached(limit, name));
    }
  }
  return { ok: true, reason: null, message: null };
}

export interface SectionMutation {
  sections: DeckSections;
  /** The catalog section the original auto-advances to after this add. */
  nextSection?: DeckSectionKey;
  toast?: string;
  startingLegendVacant?: boolean;
}

function appendOne(entries: readonly ParsedDeckEntry[], entry: ParsedDeckEntry): ParsedDeckEntry[] {
  const identity = entryIdentity(entry);
  const index = entries.findIndex((candidate) => entryIdentity(candidate) === identity);
  if (index === -1) {
    return [
      ...entries,
      { count: 1, name: entry.name, ...(entry.cardCode ? { cardCode: entry.cardCode } : {}) },
    ];
  }
  return entries.map((candidate, candidateIndex) =>
    candidateIndex === index ? { ...candidate, count: candidate.count + 1 } : candidate,
  );
}

/**
 * Add one copy. Legends replace (and reset the champion) unless Neeko is in the
 * deck, in which case additional legends are placed up to the maximum.
 */
export function addCardToSection(
  sections: DeckSections,
  section: DeckSectionKey,
  card: Card,
  options: { startingLegendVacant?: boolean } = {},
): SectionMutation {
  const entry: ParsedDeckEntry = {
    count: 1,
    name: card.name,
    ...(card.id ? { cardCode: card.id } : {}),
  };
  const available = getAddAvailability(card, section, sections);
  if (!available.ok) return { sections, toast: available.message ?? undefined };

  if (section === "legend") {
    const identity = entryIdentity(entry);
    if (sections.legend.some((legend) => entryIdentity(legend) === identity)) {
      return { sections, nextSection: "champion", startingLegendVacant: false };
    }
    const neeko = deckIncludesNeeko(sections);
    if (!neeko || sections.legend.length === 0) {
      return {
        sections: {
          ...sections,
          legend: [entry],
          champion: [],
        },
        nextSection: "champion",
        startingLegendVacant: false,
      };
    }
    if (sections.legend.length >= getMaximumLegendCount(sections)) {
      return { sections, toast: T.neekoFull };
    }
    const champion = sections.champion[0];
    const newLegendIsForChampion = !!champion && isLegendForChampion(entry, champion);
    const existingCompatible =
      !!champion && sections.legend.some((legend) => isLegendForChampion(legend, champion));
    const legends =
      newLegendIsForChampion && !existingCompatible
        ? [entry, ...sections.legend]
        : [...sections.legend, entry];
    return { sections: { ...sections, legend: legends }, startingLegendVacant: false };
  }

  if (section === "champion") {
    if (sections.champion[0] && entryIdentity(sections.champion[0]) === entryIdentity(entry)) {
      return { sections, nextSection: "mainDeck" };
    }
    return {
      sections: { ...sections, champion: [entry] },
      nextSection: "mainDeck",
    };
  }

  return {
    sections: {
      ...sections,
      [section]: appendOne(sections[section], entry),
    },
  };
}

/** `+` on a deck row; returns a toast when the copy/80 limit blocks it. */
export function incrementEntry(
  sections: DeckSections,
  section: DeckSectionKey,
  entry: ParsedDeckEntry,
): SectionMutation {
  if (section === "legend" || section === "champion") {
    return { sections };
  }
  const available = getAddAvailability(
    { name: entry.name, ...(entry.cardCode ? { cardCode: entry.cardCode } : {}) },
    section,
    sections,
  );
  if (!available.ok) return { sections, toast: available.message ?? undefined };
  return {
    sections: { ...sections, [section]: appendOne(sections[section], entry) },
  };
}

/** `−` on a deck row; removes the row at 1. */
export function decrementEntry(
  sections: DeckSections,
  section: DeckSectionKey,
  entry: ParsedDeckEntry,
): DeckSections {
  const identity = entryIdentity(entry);
  const entries = sections[section].flatMap((candidate) => {
    if (entryIdentity(candidate) !== identity) return [candidate];
    if (candidate.count <= 1) return [];
    return [{ ...candidate, count: candidate.count - 1 }];
  });
  return { ...sections, [section]: entries };
}

/** `⇄` — move one copy between Main Deck and Sideboard. */
export function moveEntry(
  sections: DeckSections,
  from: "mainDeck" | "sideboard",
  entry: ParsedDeckEntry,
): SectionMutation {
  const to: DeckSectionKey = from === "mainDeck" ? "sideboard" : "mainDeck";
  const target: ParsedDeckEntry = {
    count: 1,
    name: entry.name,
    ...(entry.cardCode ? { cardCode: entry.cardCode } : {}),
  };
  return {
    sections: {
      ...sections,
      [from]: decrementEntry(sections, from, entry)[from],
      [to]: appendOne(sections[to], target),
    },
  };
}

/** Drag catalog → section (one copy). */
export function dropCatalogCard(
  sections: DeckSections,
  section: DeckSectionKey,
  card: Card,
  options: { startingLegendVacant?: boolean } = {},
): SectionMutation {
  if (section !== "mainDeck" && section !== "sideboard") {
    return { sections, toast: T.dragCardHere };
  }
  return addCardToSection(sections, section, card, options);
}

/** Drag a deck row → section / catalog (one copy). */
export function dropDeckEntry(
  sections: DeckSections,
  from: DeckSectionKey,
  entry: ParsedDeckEntry,
  target: { kind: "catalog" } | { kind: "section"; section: DeckSectionKey },
): SectionMutation {
  if (target.kind === "catalog") {
    return { sections: decrementEntry(sections, from, entry) };
  }
  if (target.section === from) return { sections };
  if (
    (from === "mainDeck" || from === "sideboard") &&
    (target.section === "mainDeck" || target.section === "sideboard")
  ) {
    return moveEntry(sections, from, entry);
  }
  return { sections };
}

export function replacePrint(
  sections: DeckSections,
  section: DeckSectionKey,
  from: ParsedDeckEntry,
  to: { name: string; cardCode?: string },
): DeckSections {
  const fromIdentity = entryIdentity(from);
  const toIdentity = entryIdentity({
    name: to.name,
    ...(to.cardCode ? { cardCode: to.cardCode } : {}),
  });
  const entries = sections[section];
  const current = entries.find((entry) => entryIdentity(entry) === fromIdentity);
  if (!current) return sections;
  if (fromIdentity === toIdentity) return sections;
  const existing = entries.find((entry) => entryIdentity(entry) === toIdentity);
  const count = current.count + (existing?.count ?? 0);
  const insertAt = existing
    ? Math.min(entries.indexOf(current), entries.indexOf(existing))
    : entries.indexOf(current);
  const replacement: ParsedDeckEntry = {
    count,
    name: to.name,
    ...(to.cardCode ? { cardCode: to.cardCode } : {}),
  };
  const next = entries.flatMap((entry, index) => {
    if (index === insertAt) return [replacement];
    if (entry === current || entry === existing) return [];
    return [entry];
  });
  return { ...sections, [section]: next };
}

/** Build the draft object persisted on every edit. */
export function draftFromState(input: {
  name: string;
  guideHtml: string;
  linkedSavedDeckId: string | null;
  sections: DeckSections;
  bookmarkScopeId: string;
  selectedSection: DeckSectionKey;
  lastSavedSignature: string | null;
  lastSavedStatus: "ready" | "incomplete" | null;
  lastSavedAt: number | null;
  startingLegendVacant: boolean;
}): DeckbuilderDraftV5 {
  const sections = normalizeDeckSections(input.sections);
  const signature = draftSignature(input.name, input.guideHtml, sections);
  const hasUnsavedChanges =
    input.lastSavedSignature !== null && input.lastSavedSignature !== signature;
  return {
    version: 5,
    name: input.name,
    guideHtml: input.guideHtml,
    linkedSavedDeckId: input.linkedSavedDeckId,
    deckSections: sections,
    bookmarkScopeId: input.bookmarkScopeId,
    selectedSection: input.selectedSection,
    lastSavedSignature: input.lastSavedSignature,
    lastSavedStatus: input.lastSavedStatus,
    lastSavedAt: input.lastSavedAt,
    hasUnsavedChanges,
    ...(input.startingLegendVacant ? { startingLegendVacant: true as const } : {}),
  };
}

export function sectionsFromParsedDeck(parsed: ParsedDeck): DeckSections {
  return normalizeDeckSections(parsed.sections);
}

export function emptySections(): DeckSections {
  return emptyDeckSections();
}

/** Number of additional legends currently present. */
export function additionalLegendCount(sections: DeckSections): number {
  return Math.max(0, totalCards(sections.legend) - 1);
}

/** Is the legend section allowed to show "Additional Legends"? */
export function showsAdditionalLegends(sections: DeckSections): boolean {
  return deckIncludesNeeko(sections) || sections.legend.length > 1;
}

export function maximumLegendsLabel(sections: DeckSections): string {
  return `1 + ${NEEKO_LEGEND_OPTION_COUNT} Additional Legends (${getMaximumLegendCount(sections)})`;
}
