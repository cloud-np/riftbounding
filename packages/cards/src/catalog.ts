/**
 * @rift/cards — catalog indexes and card helpers (port of module 26865).
 *
 * Everything here mirrors the original client module: the same normalized-name
 * keys, the same "best print" comparator, the same fuzzy-search scoring and
 * thresholds. The catalog data is loaded from `data/cards.json`; `setCatalog`
 * exists so tests (and future data refreshes) can swap it.
 */

import cardsFile from "../data/cards.json" with { type: "json" };

import { CARD_TYPE_WORDS, SET_SORT_ORDER } from "./types";
import type { Card, CardCatalogFile } from "./types";
import { tokenArtOf, tokenMightOf, tokenTypeOf } from "./tokens";

/* ------------------------------------------------------------- catalog state */

const FILE = cardsFile as unknown as CardCatalogFile;

let catalog: Card[] = FILE.cards;

/** All catalog rows, in catalog order (module 26865 export `l`). */
export function cards(): readonly Card[] {
  return catalog;
}

/** Replace the catalog (tests / data refresh). Rebuilds every index. */
export function setCatalog(next: readonly Card[]): void {
  catalog = [...next];
  buildIndexes();
}

/* ------------------------------------------------------------- primitives */

/**
 * `a`/`y` — split a multi-word type only when every word is a known type word.
 */
export function resolveCardTypeWords(type: string | undefined): string[] {
  const value = type?.trim();
  if (!value) return [];
  const parts = value.split(/\s+/);
  return parts.length > 1 && parts.every((part) => CARD_TYPE_WORDS.has(part.toLowerCase()))
    ? parts
    : [value];
}

/** `n` — does the card's type (split into words) contain the given word? */
export function cardTypeMatches(card: Pick<Card, "type">, word: string): boolean {
  const needle = word.trim().toLowerCase();
  return (
    needle.length > 0 && resolveCardTypeWords(card.type).some((t) => t.toLowerCase() === needle)
  );
}

/** `l` — lower-cased type words. */
function typeWordsLower(card: { type: string }): string[] {
  return resolveCardTypeWords(card.type).map((t) => t.toLowerCase());
}

/** `m` — primary (first) lower-cased type word. */
export function primaryTypeWord(type: string): string {
  return typeWordsLower({ type })[0] ?? "";
}

function trimOrEmpty(value: string | undefined): string {
  return (value ?? "").trim();
}

/** `u` — set code from an id (`OGN-001` → `OGN`). */
export function setCodeOf(id: string): string {
  return id.split("-", 1)[0] ?? "";
}

/** `p` — catalog name normalization (unicode letters/numbers, apostrophes removed). */
export function normalizeCardName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** `o` — ASCII name normalization used for loose name equality in deck lists. */
export function normalizeNameAscii(name: string): string {
  return name
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** `V` — the numeric part of a card id (`OGN-042A` → 42), or null. */
export function cardNumber(id: string): number | null {
  const match = id.match(/-(\d+)/);
  if (!match) return null;
  const parsed = Number.parseInt(match[1] ?? "", 10);
  return Number.isFinite(parsed) ? parsed : null;
}

/** `c` — does the card's rules text contain Han script? */
export function hasHanText(card: Pick<Card, "text">): boolean {
  return /\p{Script=Han}/u.test(card.text ?? "");
}

/**
 * `w` — "best print" comparator: prefer non-Chinese scans, prefer non-alt-art,
 * then set order (OGN, SFD, OGS, ARC, VEN, UNL, RAD), then overnumbered
 * (number > 221) last, then id.
 */
export function compareCards(a: Card, b: Card): boolean {
  const aHan = hasHanText(a);
  if (aHan !== hasHanText(b)) return !aHan;
  const aAlt = !!a.isAltArt;
  if (aAlt !== !!b.isAltArt) return !aAlt;
  const aSet = SET_SORT_ORDER[setCodeOf(a.id)] ?? 99;
  const bSet = SET_SORT_ORDER[setCodeOf(b.id)] ?? 99;
  if (aSet !== bSet) return aSet < bSet;
  const aNum = cardNumber(a.id);
  const bNum = cardNumber(b.id);
  const aOver = aNum !== null && aNum > 221;
  const bOver = bNum !== null && bNum > 221;
  if (aOver !== bOver) return !aOver;
  return a.id < b.id;
}

/** `w` as a sort comparator (ascending best-print order). */
export function compareCardsSort(a: Card, b: Card): number {
  return compareCards(a, b) ? -1 : compareCards(b, a) ? 1 : a.id.localeCompare(b.id);
}

/* --------------------------------------------------------------- indexes */

let byId: Map<string, Card>;
let byName: Map<string, Card>;
let byNameAll: Map<string, Card[]>;
let byNameBattlefield: Map<string, Card>;
let sortedByName: Card[];
let cardsByTypeWord: Map<string, Card[]>;
let legendSubtypeSet: Set<string>;
let championTagSet: Set<string>;

function buildIndexes(): void {
  byId = new Map();
  byName = new Map();
  byNameAll = new Map();
  byNameBattlefield = new Map();

  legendSubtypeSet = new Set(
    catalog.flatMap((card) =>
      primaryTypeWord(card.type) === "legend" ? (card.subtypes ?? []) : [],
    ),
  );
  championTagSet = new Set(
    catalog.flatMap((card) => {
      const first = card.name.split(",")[0]?.trim();
      return first &&
        card.name.includes(",") &&
        primaryTypeWord(card.type) === "unit" &&
        (card.subtypes ?? []).includes(first)
        ? [first]
        : [];
    }),
  );

  for (const card of catalog) {
    byId.set(card.id, card);
    if (card.baseCardId && !byId.has(card.baseCardId)) byId.set(card.baseCardId, card);

    const key = normalizeCardName(card.name) || `#${card.id}`;
    const current = byName.get(key);
    if (!current || compareCards(card, current)) byName.set(key, card);

    const all = byNameAll.get(key);
    if (all) all.push(card);
    else byNameAll.set(key, [card]);

    if (card.type.trim().toLowerCase() !== "battlefield") continue;
    const currentBf = byNameBattlefield.get(key);
    if (!currentBf || compareCards(card, currentBf)) byNameBattlefield.set(key, card);
  }

  sortedByName = Array.from(byName.values()).sort((a, b) => {
    const byNameCmp = a.name.localeCompare(b.name);
    return byNameCmp !== 0 ? byNameCmp : a.id.localeCompare(b.id);
  });

  cardsByTypeWord = new Map();
  for (const card of sortedByName) {
    for (const word of typeWordsLower(card)) {
      const bucket = cardsByTypeWord.get(word);
      if (bucket) bucket.push(card);
      else cardsByTypeWord.set(word, [card]);
    }
  }
}

buildIndexes();

/* -------------------------------------------------------------- lookups */

/**
 * `A` — by-id lookup, with the signed-print fallback:
 * `OGN-007AS` resolves to `OGN-007A` when the signed print is not a row.
 */
export function getCardById(id: string | undefined | null): Card | undefined {
  if (!id) return undefined;
  const trimmed = id.trim();
  if (!trimmed) return undefined;
  const direct = byId.get(trimmed);
  if (direct) return direct;
  const base = trimmed.match(/^([A-Z]{2,4}-[A-Z]*\d+[AB]?)S$/i)?.[1]?.toUpperCase();
  return base ? byId.get(base) : undefined;
}

/** Public alias for the by-id lookup used across the app. */
export const getCard = getCardById;

/** `v` — by normalized name. */
export function getCardByName(name: string | undefined | null): Card | undefined {
  if (!name) return undefined;
  const key = normalizeCardName(name);
  return key ? byName.get(key) : undefined;
}

/** `R` — resolve by card code first, then by name. */
export function resolveCard(code?: string | null, name?: string | null): Card | undefined {
  return getCardById(code) ?? getCardByName(name);
}

/** `m` — by name, but only when the resolved card's type matches `typeWord`. */
export function getCardByNameAndType(name: string, typeWord: string): Card | undefined {
  const card = getCardByName(name);
  return card && cardTypeMatches(card, typeWord) ? card : undefined;
}

/** `r` — every print of a name, sorted best-print first. */
export function getCardsByNameAll(name: string | undefined | null): Card[] {
  if (!name) return [];
  const key = normalizeCardName(name);
  if (!key) return [];
  return [...(byNameAll.get(key) ?? [])].sort((a, b) =>
    compareCards(a, b) ? -1 : compareCards(b, a) ? 1 : a.id.localeCompare(b.id),
  );
}

/** `f` — the best-print list of unique names, sorted by name then id. */
export function bestPrintCards(): Card[] {
  return sortedByName;
}

/** `x` internal — battlefield lookup by name (used by the battlefield picker). */
export function getBattlefieldByName(name: string): Card | undefined {
  const key = normalizeCardName(name);
  return key ? byNameBattlefield.get(key) : undefined;
}

/* ------------------------------------------------------- derived helpers */

/** `k` / `Q` — is `card` a legal champion unit for the given legend tag? */
export function isChampionForLegend(card: Card, legendTag: string): boolean {
  const tag = trimOrEmpty(legendTag);
  return (
    !!tag &&
    cardTypeMatches(card, "unit") &&
    !card.signatureType &&
    (card.subtypes ?? []).some((subtype) => trimOrEmpty(subtype) === tag)
  );
}

/** `N` — canonical type words of a resolved/runtime card (tokens included). */
export function resolveCardTypes(card: {
  type?: string;
  source?: string;
  name?: string;
  cardCode?: string;
}): string[] {
  if (card.source === "token") {
    const type =
      (typeof card.type === "string" && card.type.trim().length > 0 ? card.type : undefined) ??
      tokenTypeOf(card.name ?? "");
    if (type) return typeWordsLower({ type });
  }
  const resolved = getCardById(card.cardCode) ?? getCardByName(card.name);
  return Array.from(
    new Set([
      ...typeWordsLower({ type: card.type ?? "" }),
      ...typeWordsLower(resolved ?? { type: "" }),
    ]),
  );
}

/** `i` — the champion tag of a card when it is a signature/legend-tagged print. */
export function legendTagOf(
  card: Pick<Card, "type" | "subtypes" | "signatureType">,
): string | null {
  const words = typeWordsLower({ type: card.type });
  if (!words.some((word) => word === "spell" || word === "gear" || word === "unit")) return null;
  const legendSubtypes = (card.subtypes ?? []).filter((subtype) => legendSubtypeSet.has(subtype));
  if (legendSubtypes.length === 0) {
    return card.signatureType
      ? ((card.subtypes ?? []).find((subtype) => championTagSet.has(subtype))?.trim() ?? null)
      : null;
  }
  if (card.signatureType) return legendSubtypes[0]?.trim() || null;
  if (words.includes("unit") && ((card.subtypes ?? []).length !== 1 || legendSubtypes.length !== 1))
    return null;
  return legendSubtypes[0]?.trim() || null;
}

/** `j` — token row test. */
export function isTokenRow(card: Pick<Card, "id" | "type">): boolean {
  return (
    typeWordsLower({ type: card.type }).includes("token") ||
    card.type.toLowerCase().includes("token") ||
    /^[A-Z]{2,4}-T\d+[A-Z]?$/i.test(card.id)
  );
}

/** `g` — champion units with the given legend tag, name-sorted. */
export function tokenCardsOf(tag: string): Card[] {
  const value = trimOrEmpty(tag);
  if (!value) return [];
  return sortedByName
    .filter((card) => isChampionForLegend(card, value))
    .sort((a, b) => {
      const byNameCmp = a.name.localeCompare(b.name);
      return byNameCmp !== 0 ? byNameCmp : a.id.localeCompare(b.id);
    });
}

/** `G` — effective might of a runtime card (tokens resolved through the token catalog). */
export function effectiveMight(card: {
  might?: number;
  source?: string;
  name?: string;
  cardCode?: string;
}): number | undefined {
  if (typeof card.might === "number" && Number.isFinite(card.might)) return card.might;
  if (card.source === "token") return tokenMightOf(card.name ?? "");
  const resolved = resolveCard(card.cardCode, card.name);
  const might = resolved?.might;
  return typeof might === "number" && Number.isFinite(might) ? might : undefined;
}

/** `q` — keyword test (runtime keyword first, then catalog print). */
export function hasKeyword(
  card: { keywords?: string[]; cardCode?: string; name?: string },
  keyword: string,
): boolean {
  const needle = keyword.trim().toLowerCase();
  if (!needle) return false;
  return (
    !!card.keywords?.some((kw) => kw.trim().toLowerCase() === needle) ||
    (resolveCard(card.cardCode, card.name)?.keywords ?? []).some(
      (kw) => kw.trim().toLowerCase() === needle,
    )
  );
}

/** `Y` — image URL of a runtime card, resolved through the catalog. */
export function imageUrlOf(card: {
  imageUrl?: string;
  source?: string;
  name?: string;
  cardCode?: string;
}): string | undefined {
  if (typeof card.imageUrl === "string" && card.imageUrl.trim().length > 0) return card.imageUrl;
  if (card.source === "token") return tokenArtOf(card.name ?? "");
  const resolved = getCardById(card.cardCode)?.imageUrl;
  return resolved || getCardByName(card.name)?.imageUrl;
}

/* --------------------------------------------------------- fuzzy search */

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

/** `p` — name suggestions for an unknown name (max 3 by default). */
export function searchTokens(
  query: string,
  options: { maxResults?: number; type?: string } = {},
): string[] {
  if (!query) return [];
  const needle = normalizeCardName(query);
  if (!needle) return [];
  const typeWord = primaryTypeWord(options.type ?? "");
  const pool = typeWord ? (cardsByTypeWord.get(typeWord) ?? []) : sortedByName;
  return pool
    .map((card) => {
      const candidate = normalizeCardName(card.name);
      const maxLength = Math.max(needle.length, candidate.length, 1);
      let score = levenshtein(needle, candidate) / maxLength;
      if (candidate.startsWith(needle) || needle.startsWith(candidate)) score -= 0.08;
      else if (candidate.includes(needle) || needle.includes(candidate)) score -= 0.05;
      const needleWords = needle.split(" ");
      const candidateWords = new Set(candidate.split(" "));
      const overlap = needleWords.filter((word) => candidateWords.has(word)).length;
      if (overlap > 0) score -= Math.min(0.06, 0.02 * overlap);
      return { name: card.name, score };
    })
    .filter(({ name, score }) => {
      const candidate = normalizeCardName(name);
      return (
        score <= 0.26 ||
        (12 >= Math.max(needle.length, candidate.length) && score <= 0.34) ||
        (needle.length >= 10 && score <= 0.3)
      );
    })
    .sort((a, b) =>
      a.score !== b.score
        ? a.score - b.score
        : a.name.length !== b.name.length
          ? a.name.length - b.name.length
          : a.name.localeCompare(b.name),
    )
    .slice(0, options.maxResults ?? 3)
    .map((entry) => entry.name);
}

/* --------------------------------------------------- text helpers (387653) */

const FLAVOR_MARKER_RE = /^[\t ]*flavou?r text[\t \r]*$/imu;

function trimmedOrNull(text: string): string | null {
  const trimmed = text.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * `s` (module 387653) — split raw card text on the `Flavor Text` marker line.
 * When the marker is present and the rules half is exactly ".", rules are null.
 */
export function splitCardText(text: string): {
  rulesText: string | null;
  flavorText: string | null;
} {
  if (!text) return { flavorText: null, rulesText: null };
  const marker = FLAVOR_MARKER_RE.exec(text);
  if (!marker) return { flavorText: null, rulesText: trimmedOrNull(text) };
  const flavorText = trimmedOrNull(text.slice(marker.index + marker[0].length));
  const rules = trimmedOrNull(text.slice(0, marker.index));
  return { flavorText, rulesText: flavorText && rules === "." ? null : rules };
}

/** `q` — rules text only (removes the flavour paragraph). */
export function rulesTextOf(text: string | undefined): string {
  return splitCardText(text ?? "").rulesText ?? "";
}

const ERRATA_HEADER_RE = /^card errata text\b/iu;
const SENTENCE_END_RE = /[.!?)"”]$/u;

function countOccurrences(text: string, needle: string): number {
  return text.split(needle).length - 1;
}

/** `Y` — extracts the errata block after a `Card Errata Text` header line. */
export function errataTextOf(text: string): string | null {
  const rules = splitCardText(text).rulesText;
  const firstBreak = rules?.indexOf("\n") ?? -1;
  if (
    !rules ||
    firstBreak === -1 ||
    !ERRATA_HEADER_RE.test(rules.slice(0, firstBreak).normalize("NFKC"))
  ) {
    return null;
  }
  let out = "";
  let balance = 0;
  for (const rawLine of rules.slice(firstBreak + 1).split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    if (out) {
      const spaced = balance > 0 || line.startsWith("(") || !SENTENCE_END_RE.test(out);
      out += spaced ? " " : "\n";
    }
    out += line;
    balance += countOccurrences(line, "(") - countOccurrences(line, ")");
  }
  return out || null;
}
