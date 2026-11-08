/**
 * @rift/cards — deck-list text parse / export / validation.
 *
 * Exact port of module 957839 (`2nqp-vipvdxlj.js`): section headers + aliases,
 * `<count> <name> [CODE]` entries, Levenshtein header repair (≤0.34), catalog
 * validation with did-you-mean suggestions, and every validation message.
 */

import {
  getCardById,
  getCardByName,
  getCardByNameAndType,
  isChampionForLegend,
  isTokenRow,
  legendTagOf,
  normalizeNameAscii,
  resolveCard,
  searchTokens,
} from "./catalog";
import type {
  Card,
  DeckRulesOptions,
  DeckSectionKey,
  DeckSections,
  DeckTotals,
  ParsedDeck,
  ParsedDeckEntry,
} from "./types";

/* ------------------------------------------------------------- constants */

const MULTI_LEGEND_CARD_NAME = "Neeko, Blending In";
const EXEMPT_COPY_LIMIT_NAMES = new Set(["spiderling"]);

const SECTION_ALIASES: Readonly<Record<string, DeckSectionKey>> = {
  legend: "legend",
  additionallegends: "legend",
  additionallegend: "legend",
  champion: "champion",
  champions: "champion",
  maindeck: "mainDeck",
  mainboard: "mainDeck",
  main: "mainDeck",
  battlefields: "battlefields",
  battlefield: "battlefields",
  runes: "runes",
  rune: "runes",
  runepool: "runes",
  sideboard: "sideboard",
  side: "sideboard",
};

const REQUIRED_SECTIONS: readonly DeckSectionKey[] = [
  "legend",
  "champion",
  "mainDeck",
  "battlefields",
  "runes",
];

const ADDITIONAL_LEGENDS_LABEL = "Additional Legends";
const ADDITIONAL_LEGENDS_HEADER = `${ADDITIONAL_LEGENDS_LABEL}:`;

const SECTION_LABELS: Readonly<Record<DeckSectionKey, string>> = {
  legend: "Legend:",
  champion: "Champion:",
  mainDeck: "MainDeck:",
  battlefields: "Battlefields:",
  runes: "Runes:",
  sideboard: "Sideboard:",
};

const STANDARD_CONSTRUCTED = "Standard Constructed";

const SECTION_ORDER: readonly DeckSectionKey[] = [
  "legend",
  "champion",
  "mainDeck",
  "battlefields",
  "runes",
  "sideboard",
];

/* ------------------------------------------------------------- helpers */

function emptySections(): DeckSections {
  return { legend: [], champion: [], mainDeck: [], battlefields: [], runes: [], sideboard: [] };
}

function entryCard(entry: { name?: string; cardCode?: string } | undefined): Card | undefined {
  return entry ? resolveCard(entry.cardCode, entry.name) : undefined;
}

/** `f`/`D` — does the deck use the multi-legend card (Neeko)? */
export function hasMultipleLegends(sections: DeckSections): boolean {
  return [...sections.mainDeck, ...sections.sideboard].some(
    (entry) =>
      entry.count > 0 &&
      normalizeNameAscii(entryCard(entry)?.name ?? entry.name) ===
        normalizeNameAscii(MULTI_LEGEND_CARD_NAME),
  );
}

/** `m` — is `entry` a legal champion for the legend `legendEntry`? */
export function championMatchesLegend(
  entry: { name?: string; cardCode?: string },
  legendEntry: { name?: string; cardCode?: string } | undefined,
): boolean {
  const card = entryCard(entry);
  const tag = legendEntry ? entryCard(legendEntry)?.subtypes?.[0]?.trim() : undefined;
  return !!(card && tag && isChampionForLegend(card, tag));
}

/** `h`/`p` — tail helper. */
export function tail<T>(entries: readonly T[]): T[] {
  return entries.slice(1);
}

/** `p` — normalize a header for alias lookup. */
function normalizeHeaderKey(header: string): string {
  const trimmed = header.trim().replace(/:$/, "").trim();
  const decorated = /^~~\s*(.*?)\s*~~$/.exec(trimmed);
  return (decorated?.[1] ?? trimmed).toLowerCase().replace(/\s+/g, "");
}

/** `g` — fuzzy header key (non-alphanumerics → space). */
function fuzzyHeaderKey(header: string): string {
  return header
    .trim()
    .replace(/:$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** `$` — collapse whitespace + lowercase. */
function normalizeNameSpaces(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** `b`/`f` — loose name equality (ASCII-normalized; empty names match anything). */
export function nameMatches(name: string, catalogName: string): boolean {
  return (
    !normalizeNameAscii(name) || normalizeNameSpaces(name) === normalizeNameSpaces(catalogName)
  );
}

function lowerTrim(value: string): string {
  return value.trim().toLowerCase();
}

/** `k` — unique, non-empty, non-"unknown" domains preserving original casing. */
function uniqueDomains(domains: readonly string[] | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of domains ?? []) {
    const trimmed = raw.trim();
    const key = lowerTrim(trimmed);
    if (!key || key === "unknown" || seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let previous: number[] = Array.from({ length: b.length + 1 }, (_, i) => i);
  const current = Array(b.length + 1);
  for (let i = 0; i < a.length; i += 1) {
    current[0] = i + 1;
    for (let j = 0; j < b.length; j += 1) {
      const cost = a[i] === b[j] ? 0 : 1;
      current[j + 1] = Math.min(
        (current[j] ?? 0) + 1,
        (previous[j + 1] ?? 0) + 1,
        (previous[j] ?? 0) + cost,
      );
    }
    previous = current.slice();
  }
  return previous[b.length] ?? 0;
}

/** `w` — fuzzy section-header repair (distance/max(len) ≤ 0.34). */
export function repairSectionHeader(header: string): string | null {
  const key = fuzzyHeaderKey(header);
  if (!key) return null;
  let best: { section: DeckSectionKey; score: number } | null = null;
  for (const [alias, section] of Object.entries(SECTION_ALIASES)) {
    const candidate = fuzzyHeaderKey(alias);
    if (!candidate) continue;
    const maxLength = Math.max(key.length, candidate.length, 1);
    const score = levenshtein(key, candidate) / maxLength;
    if (best === null || score < best.score) best = { section, score };
  }
  return !best || best.score > 0.34 ? null : SECTION_LABELS[best.section];
}

/** `A` — expected catalog type word for a section, when the section is typed. */
function expectedTypeWord(section: DeckSectionKey): string | null {
  switch (section) {
    case "legend":
      return "legend";
    case "battlefields":
      return "battlefield";
    case "runes":
      return "rune";
    default:
      return null;
  }
}

/** `A` — section a card type belongs under, or null. */
function sectionForTypeWord(typeWord: string): DeckSectionKey | null {
  switch (typeWord) {
    case "legend":
      return "legend";
    case "battlefield":
      return "battlefields";
    case "rune":
      return "runes";
    default:
      return null;
  }
}

/** `v` — normalized-name → summed count for a section. */
function nameTotals(entries: readonly ParsedDeckEntry[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const entry of entries) {
    const key = normalizeNameSpaces(entry.name);
    if (!key) continue;
    totals.set(key, (totals.get(key) ?? 0) + entry.count);
  }
  return totals;
}

/** `y` — per-name copy limit: null for exempt tokens, 1 for Unique, else 3. */
function copyLimit(entry: ParsedDeckEntry): number | null {
  const card = entryCard(entry);
  const key = normalizeNameSpaces(card?.name ?? entry.name);
  if (EXEMPT_COPY_LIMIT_NAMES.has(key)) return null;
  const uniqueKeyword =
    card?.keywords?.some((keyword) => keyword.trim().toLowerCase() === "unique") === true;
  const uniqueText = /\[\s*unique\s*\]/i.test(card?.text ?? "");
  return uniqueKeyword || uniqueText ? 1 : 3;
}

/** `M` — the legend's champion tag (first subtype). */
function legendTag(entry: ParsedDeckEntry | undefined): string | null {
  const card = entry ? entryCard(entry) : undefined;
  return card?.subtypes?.[0]?.trim() || null;
}

/** `D`/`T` — total cards in a section. */
export function sectionTotal(entries: readonly ParsedDeckEntry[]): number {
  return entries.reduce((sum, entry) => sum + entry.count, 0);
}

/** `P` — format one deck-list entry. */
export function formatDeckEntry(entry: ParsedDeckEntry, includeCardCodes: boolean): string {
  return entry.cardCode && (includeCardCodes || !normalizeNameAscii(entry.name))
    ? `${entry.count} ${entry.name} [${entry.cardCode}]`
    : `${entry.count} ${entry.name}`;
}

/** `V`/`B` — display name of a section. */
export function sectionDisplayName(section: DeckSectionKey): string {
  switch (section) {
    case "legend":
      return "Legend";
    case "champion":
      return "Champion";
    case "mainDeck":
      return "Main Deck";
    case "battlefields":
      return "Battlefields";
    case "runes":
      return "Runes";
    case "sideboard":
      return "Sideboard";
    default:
      return section;
  }
}

/** `E` — ban reasons for the given formats. */
export function banReasons(deck: ParsedDeck, formats: readonly string[]): string[] {
  const reasons: string[] = [];
  const seen = new Set<string>();
  for (const format of formats) {
    for (const section of SECTION_ORDER) {
      for (const entry of deck.sections[section]) {
        const card = entryCard(entry);
        if (!card?.bannedIn?.some((ban) => ban.format === format)) continue;
        const key = normalizeNameSpaces(card.name);
        if (seen.has(key)) continue;
        seen.add(key);
        reasons.push(`"${card.name}" is banned in ${format}.`);
      }
    }
  }
  return reasons;
}

/* --------------------------------------------------------------- export */

/** `y` — serialize a deck's sections back to deck-list text. */
export function exportDeckText(
  sections: DeckSections,
  options: { includeCardCodes?: boolean } = {},
): string {
  const includeCardCodes = options.includeCardCodes ?? false;
  const multiLegend = hasMultipleLegends(sections);
  return SECTION_ORDER.flatMap((section) => {
    const entries = (
      section === "legend" && multiLegend ? sections.legend.slice(0, 1) : sections[section]
    ).map((entry) => formatDeckEntry(entry, includeCardCodes));
    const block = `${SECTION_LABELS[section]}\n${entries.join("\n")}`.trimEnd();
    const additional = section === "legend" && multiLegend ? tail(sections.legend) : [];
    return additional.length > 0
      ? [
          block,
          `${ADDITIONAL_LEGENDS_HEADER}\n${additional.map((entry) => formatDeckEntry(entry, includeCardCodes)).join("\n")}`,
        ]
      : [block];
  }).join("\n\n");
}

/** `M` — legend count as used for totals (capped at 1 with multi-legend cards). */
export function legendCountForTotals(deck: Pick<ParsedDeck, "sections" | "totals">): number {
  return deck.sections && hasMultipleLegends(deck.sections)
    ? Math.min(deck.totals.legend, 1)
    : deck.totals.legend;
}

/** `E` — decode `%0A`/`%0D`/`%20` escaped deck lists (only when they contain no spaces). */
export function decodePercentEscapes(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed || /\s/u.test(trimmed) || !/%(?:0A|0D|20)/iu.test(trimmed)) return raw;
  try {
    return decodeURIComponent(trimmed);
  } catch {
    return raw;
  }
}

/** `t` — expand counted entries into one entry per copy. */
export function expandCounts(entries: readonly ParsedDeckEntry[]): ParsedDeckEntry[] {
  const out: ParsedDeckEntry[] = [];
  for (const entry of entries) {
    for (let i = 0; i < entry.count; i += 1) {
      out.push({
        count: 1,
        name: entry.name,
        ...(entry.cardCode ? { cardCode: entry.cardCode } : {}),
      });
    }
  }
  return out;
}

/** `u` — normalize sections: merge duplicates, sort (legend keeps order). */
export function normalizeSections(sections: DeckSections): DeckSections {
  const out = emptySections();
  for (const section of SECTION_ORDER) {
    const merged = new Map<string, ParsedDeckEntry>();
    for (const entry of sections[section]) {
      const count = Math.max(0, Math.trunc(entry.count));
      const name = entry.name.trim();
      const key = entry.cardCode?.trim()
        ? `code:${entry.cardCode.trim()}`
        : `name:${normalizeNameSpaces(entry.name)}`;
      if (!count || !name || !key) continue;
      const existing = merged.get(key);
      if (existing) {
        existing.count += count;
        continue;
      }
      merged.set(key, {
        count,
        name,
        ...(entry.cardCode?.trim() ? { cardCode: entry.cardCode.trim() } : {}),
      });
    }
    out[section] =
      section === "legend"
        ? [...merged.values()]
        : [...merged.values()].sort((a, b) => {
            const byName = a.name.localeCompare(b.name);
            return byName !== 0 ? byName : (a.cardCode ?? "").localeCompare(b.cardCode ?? "");
          });
  }
  return out;
}

/* ---------------------------------------------------------------- parse */

function suggestionsSuffix(suggestions: readonly string[]): string {
  if (suggestions.length === 0) return "";
  if (suggestions.length === 1) return ` Did you mean "${suggestions[0]}"?`;
  if (suggestions.length === 2) return ` Did you mean "${suggestions[0]}" or "${suggestions[1]}"?`;
  const quoted = suggestions
    .slice(0, -1)
    .map((name) => `"${name}"`)
    .join(", ");
  return ` Did you mean ${quoted}, or "${suggestions[suggestions.length - 1]}"?`;
}

function parseEntryLine(line: string): ParsedDeckEntry | null {
  const match = line.match(/^(\d+)\s+(.+?)(?:\s+\[([A-Za-z0-9-]+)\])?$/);
  if (!match) return null;
  const count = Number.parseInt(match[1] ?? "", 10);
  const name = (match[2] ?? "").trim().replace(/\\([’'])/g, "$1");
  if (!Number.isFinite(count) || count <= 0 || name.length === 0) return null;
  const code = match[3]?.trim();
  return { count, name, ...(code ? { cardCode: code } : {}) };
}

function validateEntry(
  section: DeckSectionKey,
  entry: ParsedDeckEntry,
  lineNumber: number,
  errorList: string[],
  warningList: string[],
): ParsedDeckEntry {
  const expected = expectedTypeWord(section);
  if (entry.cardCode) {
    const card = getCardById(entry.cardCode);
    if (!card) {
      errorList.push(
        `Line ${lineNumber}: Unknown card code "${entry.cardCode}" in ${sectionDisplayName(section)}.`,
      );
      return entry;
    }
    if (!nameMatches(entry.name, card.name)) {
      errorList.push(
        `Line ${lineNumber}: "${entry.name}" does not match card code "${card.id}" (${card.name}).`,
      );
    }
    if (isTokenRow(card)) {
      warningList.push(
        `Line ${lineNumber}: "${card.name}" is a token and cannot be included in deck lists.`,
      );
    }
    const actual = sectionForTypeWord(lowerTrim(card.type));
    if (expected === null && actual !== null && actual !== section) {
      warningList.push(
        `Line ${lineNumber}: "${card.name}" belongs under ${sectionDisplayName(actual)}, not ${sectionDisplayName(section)}.`,
      );
    } else if (expected !== null && lowerTrim(card.type) !== expected) {
      warningList.push(
        `Line ${lineNumber}: "${card.name}" is not a valid ${sectionDisplayName(section)} card.`,
      );
    }
    return { ...entry, name: card.name, cardCode: card.id };
  }
  const byName = getCardByName(entry.name);
  if (byName) {
    if (isTokenRow(byName)) {
      warningList.push(
        `Line ${lineNumber}: "${byName.name}" is a token and cannot be included in deck lists.`,
      );
    }
    const actual = sectionForTypeWord(lowerTrim(byName.type));
    if (expected === null && actual !== null && actual !== section) {
      warningList.push(
        `Line ${lineNumber}: "${byName.name}" belongs under ${sectionDisplayName(actual)}, not ${sectionDisplayName(section)}.`,
      );
    } else if (expected !== null && getCardByNameAndType(entry.name, expected) === undefined) {
      warningList.push(
        `Line ${lineNumber}: "${byName.name}" is not a valid ${sectionDisplayName(section)} card.`,
      );
    }
    return { ...entry, name: byName.name, cardCode: byName.id };
  }
  const typed = searchTokens(entry.name, { maxResults: 3, type: expected ?? undefined });
  const suggestions =
    typed.length > 0 || expected ? typed : searchTokens(entry.name, { maxResults: 3 });
  errorList.push(
    `Line ${lineNumber}: Unknown card "${entry.name}" in ${sectionDisplayName(section)}.${suggestionsSuffix(suggestions)}`,
  );
  return entry;
}

/**
 * `v` — parse deck-list text into sections + totals + warnings/errors.
 * `options.validateCatalog` enables catalog checks (default true), and
 * `deckRulesMode: "unrestricted"` switches which bucket messages land in.
 */
export function parseDeckText(
  raw: string,
  options: { validateCatalog?: boolean; deckRulesMode?: "standard" | "unrestricted" } = {},
): ParsedDeck {
  const sections = emptySections();
  const errorBucket: string[] = [];
  const warningBucket: string[] = [];
  const mode = options.deckRulesMode === "unrestricted" ? "unrestricted" : "standard";
  const catalogIssues = mode === "unrestricted" ? errorBucket : warningBucket;

  if (raw.length > 20000) {
    warningBucket.push(
      `Deck list cannot exceed ${(20000).toLocaleString("en-US")} characters. Found ${raw.length.toLocaleString("en-US")}.`,
    );
  }

  const lines = raw.split(/\r?\n/);
  let currentSection: DeckSectionKey | null = null;
  let inAdditionalLegends = false;
  const additionalLegends: ParsedDeckEntry[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = (lines[index] ?? "").trim();
    if (!line) continue;

    const isHeader = line.endsWith(":") || /^~~.+~~$/.test(line);
    if (isHeader) {
      const alias = SECTION_ALIASES[normalizeHeaderKey(line)] ?? null;
      if (alias) {
        currentSection = alias;
        const key = normalizeHeaderKey(line);
        inAdditionalLegends = key === "additionallegends" || key === "additionallegend";
        continue;
      }
      const repaired = repairSectionHeader(line);
      warningBucket.push(
        repaired
          ? `Line ${index + 1}: Unknown section header "${line}". Did you mean "${repaired}"? This section was ignored.`
          : `Line ${index + 1}: Unknown section header "${line}". This section was ignored.`,
      );
      currentSection = null;
      continue;
    }

    const entry = parseEntryLine(line);
    if (!entry) {
      const repaired = currentSection === null ? repairSectionHeader(line) : null;
      errorBucket.push(
        repaired
          ? `Line ${index + 1}: Unknown section header "${line}". Did you mean "${repaired}"?`
          : `Line ${index + 1}: Could not parse "${line}". Expected format like "3 Card Name" or "3 Card Name [ABC-123]".`,
      );
      continue;
    }
    if (!currentSection) {
      errorBucket.push(
        `Line ${index + 1}: Card entry "${line}" appeared before a known section header and was ignored.`,
      );
      continue;
    }

    const validated = options.validateCatalog
      ? validateEntry(currentSection, entry, index + 1, warningBucket, catalogIssues)
      : entry;
    if (inAdditionalLegends) additionalLegends.push(validated);
    else sections[currentSection].push(validated);
  }

  sections.legend =
    sections.legend.length > 0 && additionalLegends.length > 0
      ? [...sections.legend, ...additionalLegends]
      : (() => {
          const legends = [...sections.legend, ...additionalLegends];
          if (legends.length < 2 || !sections.champion[0]) return legends;
          const matching = legends.filter((entry) =>
            championMatchesLegend(entry, sections.champion[0]),
          );
          const chosen = matching.length === 1 ? matching[0] : undefined;
          return chosen ? [chosen, ...legends.filter((entry) => entry !== chosen)] : legends;
        })();

  const totals: DeckTotals = {
    legend: sectionTotal(sections.legend),
    champion: sectionTotal(sections.champion),
    mainDeck: sectionTotal(sections.mainDeck),
    battlefields: sectionTotal(sections.battlefields),
    runes: sectionTotal(sections.runes),
    sideboard: sectionTotal(sections.sideboard),
  };

  // The original lobby parses signed-out paste imports with `deckRulesMode: "unrestricted"`;
  // in that mode only a missing Main Deck is a blocking error and every other gap is a
  // warning (25-import-variants.json / 16-import-feedback.json). Signed-in lobbies use
  // `standard`, where the same messages block. Keep both buckets faithful to the bundle.
  for (const section of REQUIRED_SECTIONS) {
    if (totals[section] !== 0) continue;
    if (mode === "unrestricted" && section === "battlefields") continue;
    (mode === "unrestricted" && section !== "mainDeck" ? errorBucket : warningBucket).push(
      `Missing required section: ${sectionDisplayName(section)}.`,
    );
  }

  if (options.validateCatalog) {
    // 1. other legends' signature cards
    const tag = legendTag(sections.legend[0]);
    if (tag) {
      for (const section of ["mainDeck", "sideboard"] as const) {
        const seen = new Set<string>();
        for (const entry of sections[section]) {
          const card = entryCard(entry);
          if (!card) continue;
          const cardTag = legendTagOf(card);
          if (!cardTag || cardTag === tag) continue;
          const key = entry.cardCode?.trim() || normalizeNameSpaces(entry.name);
          if (seen.has(key)) continue;
          seen.add(key);
          catalogIssues.push(
            `${sectionDisplayName(section)} contains "${card.name}", a signature ${card.signatureType?.toLowerCase() ?? card.type.toLowerCase()} for ${cardTag}. No signatures of other Legend types are allowed when your legend is ${tag}.`,
          );
        }
      }
    }
    // 2. champion legality
    const championTag = legendTag(sections.legend[0]);
    const champion = sections.champion[0];
    if (championTag && champion) {
      const card = entryCard(champion);
      if (card && !isChampionForLegend(card, championTag)) {
        catalogIssues.push(
          `Champion contains "${card.name}", which is not a legal champion unit for ${championTag}. Choose a non-signature unit with the ${championTag} tag.`,
        );
      }
    }
    // 3. domain identity
    const legend = sections.legend[0];
    const legendCard = legend ? entryCard(legend) : undefined;
    const legendDomains = uniqueDomains(legendCard?.domains);
    if (legendDomains.length > 0) {
      const allowed = new Set(legendDomains.map(lowerTrim));
      const joined = legendDomains.join("/");
      for (const section of [
        "champion",
        "mainDeck",
        "battlefields",
        "runes",
        "sideboard",
      ] as const) {
        const seen = new Set<string>();
        for (const entry of sections[section]) {
          const card = entryCard(entry);
          if (!card) continue;
          const domains = uniqueDomains(card.domains);
          if (domains.length === 0 || domains.every((domain) => allowed.has(lowerTrim(domain))))
            continue;
          const key = entry.cardCode?.trim() || normalizeNameSpaces(entry.name);
          if (seen.has(key)) continue;
          seen.add(key);
          const outside = domains.filter((domain) => !allowed.has(lowerTrim(domain)));
          catalogIssues.push(
            `${sectionDisplayName(section)} contains "${card.name}", whose ${outside.join("/")} ${outside.length === 1 ? "domain is" : "domains are"} outside this deck's ${joined} domain identity.`,
          );
        }
      }
    }
    // 4. signature count
    const signatureCount = sections.mainDeck.reduce((sum, entry) => {
      const card = entryCard(entry);
      return card?.signatureType ? sum + entry.count : sum;
    }, 0);
    if (signatureCount > 3) {
      catalogIssues.push(
        `Main Deck contains ${signatureCount} Signature cards. Maximum allowed is 3 total.`,
      );
    }
  }

  const additionalLegendLimit = 3 * (hasMultipleLegends(sections) ? 1 : 0);
  const additionalLegendCount = Math.max(0, totals.legend - 1);
  if (additionalLegendLimit === 0 ? totals.legend !== 1 : totals.legend < 1) {
    catalogIssues.push(`Legend must contain exactly 1 card(s). Found ${totals.legend}.`);
  } else if (additionalLegendLimit > 0 && additionalLegendCount > additionalLegendLimit) {
    catalogIssues.push(
      `Additional Legends must contain at most ${additionalLegendLimit} card(s). Found ${additionalLegendCount}.`,
    );
  } else if (additionalLegendLimit > 0) {
    const byName = new Map<string, { name: string; count: number }>();
    for (const entry of sections.legend) {
      const name = entryCard(entry)?.name ?? entry.name;
      const key = normalizeNameSpaces(name);
      const bucket = byName.get(key) ?? { name, count: 0 };
      bucket.count += entry.count;
      byName.set(key, bucket);
    }
    for (const { name, count } of byName.values()) {
      if (count > 1) {
        catalogIssues.push(
          `Additional Legends contains ${count} copies of "${name}". Maximum allowed is 1.`,
        );
      }
    }
  }

  if (totals.champion !== 1) {
    catalogIssues.push(`Champion must contain exactly 1 card(s). Found ${totals.champion}.`);
  }

  const mainPlusChampion = totals.mainDeck + totals.champion;
  if (totals.mainDeck > 0 && mainPlusChampion !== 40) {
    catalogIssues.push(
      `Main deck + champion must contain exactly 40 card(s). Found ${mainPlusChampion}.`,
    );
  }

  if (totals.mainDeck > 80) {
    warningBucket.push(`Main Deck can contain at most 80 cards. Found ${totals.mainDeck}.`);
  }
  if (totals.battlefields > 0 && totals.battlefields !== 3) {
    catalogIssues.push(
      `Battlefields must contain exactly 3 card(s). Found ${totals.battlefields}.`,
    );
  }
  const battlefieldTotals = nameTotals(sections.battlefields);
  for (const entry of sections.battlefields) {
    const key = normalizeNameSpaces(entry.name);
    const count = battlefieldTotals.get(key) ?? 0;
    if (count > 1) {
      catalogIssues.push(
        `Battlefields contains ${count} copies of "${entry.name}". Maximum allowed is 1.`,
      );
      battlefieldTotals.delete(key);
    }
  }
  if (totals.runes > 0 && totals.runes !== 12) {
    catalogIssues.push(`Runes must contain exactly 12 card(s). Found ${totals.runes}.`);
  }
  if (totals.sideboard > 10) {
    catalogIssues.push(`Sideboard can contain at most 10 card(s). Found ${totals.sideboard}.`);
  }

  const mainDeckTotals = nameTotals(sections.mainDeck);
  for (const entry of sections.mainDeck) {
    const key = normalizeNameSpaces(entry.name);
    const count = mainDeckTotals.get(key) ?? 0;
    const limit = copyLimit(entry);
    if (limit !== null && count > limit) {
      catalogIssues.push(
        `MainDeck contains ${count} copies of "${entry.name}". Maximum allowed is ${limit}.`,
      );
      mainDeckTotals.delete(key);
    }
  }
  const sideboardTotals = nameTotals(sections.sideboard);
  for (const entry of sections.sideboard) {
    const key = normalizeNameSpaces(entry.name);
    const count = sideboardTotals.get(key) ?? 0;
    const limit = copyLimit(entry);
    if (limit !== null && count > limit) {
      catalogIssues.push(
        `Sideboard contains ${count} copies of "${entry.name}". Maximum allowed is ${limit}.`,
      );
      sideboardTotals.delete(key);
    }
  }

  const crossSection = new Map<
    string,
    { total: number; bySection: Partial<Record<DeckSectionKey, number>> }
  >();
  for (const section of ["champion", "mainDeck", "sideboard"] as const) {
    for (const entry of sections[section]) {
      const key = normalizeNameSpaces(entry.name);
      if (!key) continue;
      const bucket = crossSection.get(key) ?? { total: 0, bySection: {} };
      bucket.total += entry.count;
      bucket.bySection[section] = (bucket.bySection[section] ?? 0) + entry.count;
      crossSection.set(key, bucket);
    }
  }
  for (const entry of [...sections.champion, ...sections.mainDeck, ...sections.sideboard]) {
    const key = normalizeNameSpaces(entry.name);
    const bucket = crossSection.get(key);
    const sectionCount = bucket ? Object.keys(bucket.bySection).length : 0;
    const limit = copyLimit(entry);
    if (!bucket || limit === null || bucket.total <= limit || sectionCount <= 1) continue;
    const split = (["champion", "mainDeck", "sideboard"] as const)
      .map((section) => {
        const count = bucket.bySection[section];
        return count ? `${count} ${sectionDisplayName(section)}` : null;
      })
      .filter((value): value is string => value !== null)
      .join(", ");
    catalogIssues.push(
      `"${entry.name}" appears ${bucket.total} times across Champion, Main Deck, and Sideboard. Maximum allowed is ${limit}.${bucket.total > 0 ? ` Current split: ${split}.` : ""}`,
    );
    crossSection.delete(key);
  }

  const totalCards = Object.values(totals).reduce((sum, value) => sum + value, 0);
  if (totalCards > 250) {
    warningBucket.push(`Deck list can contain at most 250 total cards. Found ${totalCards}.`);
  }

  const result: ParsedDeck = {
    raw,
    sections,
    totals,
    warnings: errorBucket,
    errors: warningBucket,
  };
  if (mode === "unrestricted") {
    result.warnings.push(...banReasons(result, [STANDARD_CONSTRUCTED]));
  }
  return result;
}

/**
 * `d` — short validation used before matchmaking. Errors short-circuit; then
 * format-level checks add battlefield/main-deck presence + ban reasons.
 */
export function validateDeck(
  deck: ParsedDeck,
  options: DeckRulesOptions = {},
): { valid: boolean; reasons: string[] } {
  if (deck.errors.length > 0) return { valid: false, reasons: deck.errors };
  const reasons: string[] = [];
  const mode = options.deckRulesMode === "unrestricted" ? "unrestricted" : "standard";
  if (
    options.format === "standard-constructed" &&
    mode === "standard" &&
    deck.sections.battlefields.length === 0
  ) {
    reasons.push("No battlefields were found in the deck list.");
  }
  if (deck.sections.mainDeck.length === 0) {
    reasons.push("No main deck cards were found.");
  }
  if (options.format === "standard-constructed" && mode === "standard") {
    reasons.push(
      ...banReasons(
        deck,
        options.gameVariant === "teams_2v2"
          ? [STANDARD_CONSTRUCTED, "Constructed 2v2"]
          : [STANDARD_CONSTRUCTED],
      ),
    );
  }
  return { valid: reasons.length === 0, reasons };
}

/* ------------------------------------------------------------ re-exports */

export { SECTION_ALIASES, SECTION_LABELS, REQUIRED_SECTIONS, normalizeHeaderKey };
