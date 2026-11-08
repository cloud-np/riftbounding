import {
  bestPrintCards,
  cardTypeMatches,
  getCardsByNameAll,
  getCardByName,
  isBannedInStandardConstructed,
  isCardEligibleForCatalogSection,
  staticAsset,
  type Card,
  type DeckSectionKey,
  type DeckSections,
} from "@rift/cards";

import { getAddAvailability as availabilityFor } from "./draft";
import { T } from "./strings";
import {
  EMPTY_FILTERS,
  type CatalogFilters,
  type CatalogGrouping,
  type CatalogSortKey,
  type SortDirection,
} from "./types";

export const CATALOG_PAGE_SIZE = 24;

export const DOMAIN_ORDER = ["Fury", "Calm", "Mind", "Body", "Chaos", "Order"] as const;
export const RARITY_ORDER = ["Common", "Uncommon", "Rare", "Epic", "Showcase"] as const;
export const SET_ORDER = [
  "Origins",
  "Spiritforged",
  "Unleashed",
  "Vendetta",
  "Radiance",
  "Proving Grounds",
  "Arcane Box Set",
  "Origins | Nexus Night",
  "Spiritforged | Nexus Night",
  "Vendetta | Nexus Night",
  "Secret Garden",
] as const;
export const TYPE_ORDER = [
  "Unit",
  "Unit Gear",
  "Spell",
  "Gear",
  "Legend",
  "Battlefield",
  "Rune",
  "Card",
] as const;

export const ABILITY_IDS = [
  "activated",
  "exhaust",
  "triggered",
  "passive",
  "replacement",
  "delayed",
] as const;
export type AbilityId = (typeof ABILITY_IDS)[number];

export const ABILITY_LABELS: Record<AbilityId, string> = {
  activated: "Activated",
  exhaust: "Exhaust",
  triggered: "Triggered",
  passive: "Passive",
  replacement: "Replacement",
  delayed: "Delayed",
};

const PASSIVE_KEYWORDS = new Set([
  "accelerate",
  "ambush",
  "assault",
  "backline",
  "deflect",
  "ganking",
  "hidden",
  "shield",
  "tank",
  "unique",
]);

let uniqueCatalog: Card[] | null = null;

/** The builder's catalog: one row per card name (alt prints are `printVariants`). */
export function builderCatalog(): Card[] {
  uniqueCatalog ??= bestPrintCards().filter((card) => !card._isToken);
  return uniqueCatalog;
}

/** Every print of a name, best print first (the art picker). */
export function printVariants(card: Card): Card[] {
  const prints = getCardsByNameAll(card.name);
  return prints.length > 0 ? prints : [card];
}

export function bestPrintForName(name: string): Card | undefined {
  return getCardByName(name);
}

/** `cardId` → unique catalog row (resolving alt prints to their base name row). */
export function catalogEntryForCode(cardCode: string | undefined): Card | undefined {
  if (!cardCode) return undefined;
  const direct = builderCatalog().find((card) => card.id === cardCode);
  if (direct) return direct;
  const print = getCardByName(cardCode) ?? bestPrintCards().find((card) => card.id === cardCode);
  return print ? getCardByName(print.name) : undefined;
}

/* ------------------------------------------------------------------ domain */

export function normalizedDomainOrder(domains: readonly string[] | undefined): string[] {
  const present = new Set((domains ?? []).filter((domain) => domain && domain !== "Unknown"));
  return DOMAIN_ORDER.filter((domain) => present.has(domain));
}

/** Card art fallback-friendly image URL (the component adds srcset). */
export function domainIcon(domain: string): string {
  return staticAsset(`icons/${domain.trim().toLowerCase().replace(/\s+/g, "")}.webp`);
}

/* ------------------------------------------------------------------ search */

/** NFKD lowercase, diacritics stripped, punctuation → spaces, collapsed. */
export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function searchTerms(query: string): string[] {
  const normalized = normalizeSearchText(query);
  return normalized ? normalized.split(" ") : [];
}

export function cardSearchHaystack(card: Card): string {
  return normalizeSearchText(
    [
      card.id,
      card.name,
      card.text ?? "",
      card.type,
      card.rarity,
      ...(card.domains ?? []),
      ...(card.keywords ?? []),
      ...(card.subtypes ?? []),
      card.set,
    ].join(" "),
  );
}

export function matchesSearch(card: Card, query: string): boolean {
  const terms = searchTerms(query);
  if (terms.length === 0) return true;
  const haystack = cardSearchHaystack(card);
  return terms.every((term) => haystack.includes(term));
}

/* ------------------------------------------------------------------ facets */

export type FilterFacetId =
  | "domain"
  | "type"
  | "rarity"
  | "energy"
  | "power"
  | "might"
  | "set"
  | "keywords"
  | "tags"
  | "abilities";

export type StatusFacetId = "legal-only" | "available-to-add" | "bookmarked-only";

export interface FacetOption {
  id: string;
  label: string;
  count: number;
  active: boolean;
  disabled: boolean;
  iconSrc?: string;
}

export interface FacetGroup {
  id: FilterFacetId | StatusFacetId;
  label: string;
  panelSection: "primary" | "properties" | "advanced" | "status";
  control: "chips" | "searchable" | "toggle";
  presentation: "icons" | "segmented" | "chips";
  options: FacetOption[];
}

export interface CatalogContext {
  section: DeckSectionKey;
  legend: { name?: string; cardCode?: string } | undefined;
  sections: DeckSections;
  bookmarks: ReadonlySet<string>;
}

export interface FilterEvaluation {
  filters: CatalogFilters;
  context: CatalogContext;
  /** Ignore one facet (used for its own counts). */
  ignore?: FilterFacetId | StatusFacetId;
}

export function getCardTypeWords(card: Card): string[] {
  return (card.type ?? "")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);
}

export function energyBucket(card: Card): string {
  const energy = Number(card.energyCost) || 0;
  return energy > 6 ? "7+" : String(Math.max(0, Math.trunc(energy)));
}

export function powerBucket(card: Card): string {
  const power = Number(card.powerCost) || 0;
  return power > 2 ? "3+" : String(Math.max(0, Math.trunc(power)));
}

export function mightBucket(card: Card): string {
  const might = Number(card.might) || 0;
  return might > 6 ? "7+" : String(Math.max(0, Math.trunc(might)));
}

function hasAny(values: readonly string[], selected: readonly string[]): boolean {
  if (selected.length === 0) return true;
  return values.some((value) => selected.includes(value));
}

/** The six ability ids, detected from card text like the original module 75753. */
export function getCardAbilityIds(card: Card): AbilityId[] {
  const out = new Set<AbilityId>();
  const type = (card.type ?? "").toLowerCase();
  const isSpell = type.includes("spell") || card.signatureType === "Spell";
  const keywords = (card.keywords ?? []).map((keyword) => keyword.trim().toLowerCase());
  const text = (card.text ?? "").normalize("NFKC");
  const lines = text
    .split(/\n+/u)
    .map((line) => line.replace(/\([^()]*\)/gu, " ").trim())
    .filter(Boolean);
  let anyAbility = false;
  for (const line of lines) {
    const activated = /^[^.:]{1,90}?\s?:\s*\S/u.test(line) || /^\[(?:tap|exhaust)\]/iu.test(line);
    if (activated) {
      anyAbility = true;
      out.add("activated");
      if (/\[(?:tap|exhaust)\]/iu.test(line)) out.add("exhaust");
    }
    if (
      /\b(?:when|whenever)\b|\bat the (?:start|end|beginning)\b|\bthe (?:first|second|third|fourth|fifth) time\b/iu.test(
        line,
      )
    ) {
      anyAbility = true;
      out.add("triggered");
    }
    if (/\bwould\b|\binstead\b/iu.test(line)) {
      anyAbility = true;
      out.add("replacement");
    }
    if (/\bthe next time\b/iu.test(line)) out.add("delayed");
  }
  if (keywords.some((keyword) => PASSIVE_KEYWORDS.has(keyword)) || isSpell) out.add("passive");
  if (anyAbility && out.size === 0) out.add("passive");
  return [...out];
}

function matchesFacet(
  card: Card,
  filters: CatalogFilters,
  context: CatalogContext,
  facet: FilterFacetId,
): boolean {
  switch (facet) {
    case "domain":
      return hasAny(
        (card.domains ?? []).filter((domain) => domain !== "Unknown"),
        filters.domain,
      );
    case "type":
      return hasAny(getCardTypeWords(card), filters.type);
    case "rarity":
      return hasAny([card.rarity], filters.rarity);
    case "energy":
      return hasAny([energyBucket(card)], filters.energy);
    case "power":
      return hasAny([powerBucket(card)], filters.power);
    case "might":
      if (!cardTypeMatches(card, "unit")) return filters.might.length === 0;
      return hasAny([mightBucket(card)], filters.might);
    case "set":
      return hasAny([card.set], filters.set);
    case "keywords":
      return hasAny(card.keywords ?? [], filters.keywords);
    case "tags":
      return hasAny(card.subtypes ?? [], filters.tags);
    case "abilities":
      return hasAny(getCardAbilityIds(card), filters.abilities);
    default:
      return true;
  }
}

export function matchesStatus(
  card: Card,
  filters: CatalogFilters,
  context: CatalogContext,
  status: StatusFacetId,
): boolean {
  switch (status) {
    case "legal-only":
      return !filters.legalOnly || !isBannedInStandardConstructed(card);
    case "available-to-add":
      return (
        !filters.availableToAdd ||
        availabilityFor({ name: card.name, cardCode: card.id }, context.section, context.sections)
          .ok
      );
    case "bookmarked-only":
      return !filters.bookmarkedOnly || context.bookmarks.has(card.id);
    default:
      return true;
  }
}

/** Full filter evaluation (search is applied by the caller before facets). */
export function passesFilters(card: Card, evaluation: FilterEvaluation): boolean {
  const { filters, context, ignore } = evaluation;
  for (const facet of [
    "domain",
    "type",
    "rarity",
    "energy",
    "power",
    "might",
    "set",
    "keywords",
    "tags",
    "abilities",
  ] as FilterFacetId[]) {
    if (ignore === facet) continue;
    if (!matchesFacet(card, filters, context, facet)) return false;
  }
  for (const status of ["legal-only", "available-to-add", "bookmarked-only"] as StatusFacetId[]) {
    if (ignore === status) continue;
    if (!matchesStatus(card, filters, context, status)) return false;
  }
  return true;
}

export function applyCatalogFilters(
  cards: readonly Card[],
  filters: CatalogFilters,
  context: CatalogContext,
): Card[] {
  return cards.filter((card) => passesFilters(card, { filters, context }));
}

export function hasActiveFilters(filters: CatalogFilters): boolean {
  return (
    filters.domain.length > 0 ||
    filters.type.length > 0 ||
    filters.rarity.length > 0 ||
    filters.energy.length > 0 ||
    filters.power.length > 0 ||
    filters.might.length > 0 ||
    filters.set.length > 0 ||
    filters.keywords.length > 0 ||
    filters.tags.length > 0 ||
    filters.abilities.length > 0 ||
    filters.legalOnly ||
    filters.availableToAdd ||
    filters.bookmarkedOnly
  );
}

export function activeFilterCount(filters: CatalogFilters): number {
  return (
    filters.domain.length +
    filters.type.length +
    filters.rarity.length +
    filters.energy.length +
    filters.power.length +
    filters.might.length +
    filters.set.length +
    filters.keywords.length +
    filters.tags.length +
    filters.abilities.length +
    (filters.legalOnly ? 1 : 0) +
    (filters.availableToAdd ? 1 : 0) +
    (filters.bookmarkedOnly ? 1 : 0)
  );
}

export function clearFilters(filters: CatalogFilters): CatalogFilters {
  return {
    ...EMPTY_FILTERS,
    // The status booleans are reset too; the caller keeps search.
  };
}

const FILTER_LIST_KEYS = [
  "domain",
  "type",
  "rarity",
  "energy",
  "power",
  "might",
  "set",
  "keywords",
  "tags",
  "abilities",
] as const;

export type CatalogFilterListKey = (typeof FILTER_LIST_KEYS)[number];

export function toggleFilterValue(
  filters: CatalogFilters,
  facet: CatalogFilterListKey,
  value: string,
): CatalogFilters {
  const current = filters[facet];
  const next = current.includes(value)
    ? current.filter((entry) => entry !== value)
    : [...current, value];
  return { ...filters, [facet]: next };
}

function facetOptionsFor(
  cards: readonly Card[],
  filters: CatalogFilters,
  context: CatalogContext,
  facet: FilterFacetId,
): FacetOption[] {
  const base = cards.filter((card) => passesFilters(card, { filters, context, ignore: facet }));
  const selected = filters[facet];
  const makeChip = (id: string, label: string, iconSrc?: string): FacetOption => {
    const count = base.filter((card) =>
      matchesFacet(card, { ...filters, [facet]: [id] }, context, facet),
    ).length;
    const active = selected.includes(id);
    return {
      id,
      label,
      count,
      active,
      disabled: count === 0 && !active,
      ...(iconSrc ? { iconSrc } : {}),
    };
  };
  switch (facet) {
    case "domain":
      return DOMAIN_ORDER.map((domain) => makeChip(domain, domain, domainIcon(domain)));
    case "type": {
      const present = new Set(cards.flatMap((card) => getCardTypeWords(card)));
      return TYPE_ORDER.filter((type) => present.has(type)).map((type) => makeChip(type, type));
    }
    case "rarity": {
      const present = new Set(cards.map((card) => card.rarity));
      return RARITY_ORDER.filter((rarity) => present.has(rarity)).map((rarity) =>
        makeChip(rarity, rarity),
      );
    }
    case "energy":
      return ["0", "1", "2", "3", "4", "5", "6", "7+"].map((value) => makeChip(value, value));
    case "power":
      return ["0", "1", "2", "3+"].map((value) => makeChip(value, value));
    case "might":
      return ["0", "1", "2", "3", "4", "5", "6", "7+"].map((value) => makeChip(value, value));
    case "set": {
      const present = new Set(cards.map((card) => card.set));
      return SET_ORDER.filter((set) => present.has(set)).map((set) => makeChip(set, set));
    }
    case "keywords": {
      const present = new Set(cards.flatMap((card) => card.keywords ?? []));
      return [...present]
        .sort((a, b) => a.localeCompare(b))
        .map((keyword) => makeChip(keyword, keyword));
    }
    case "tags": {
      const present = new Set(cards.flatMap((card) => card.subtypes ?? []));
      return [...present].sort((a, b) => a.localeCompare(b)).map((tag) => makeChip(tag, tag));
    }
    case "abilities":
      return ABILITY_IDS.map((id) => makeChip(id, ABILITY_LABELS[id]));
    default:
      return [];
  }
}

function statusOptionsFor(
  cards: readonly Card[],
  filters: CatalogFilters,
  context: CatalogContext,
  status: StatusFacetId,
): FacetOption[] {
  const base = cards.filter((card) => passesFilters(card, { filters, context, ignore: status }));
  const count = base.filter((card) => {
    switch (status) {
      case "legal-only":
        return !isBannedInStandardConstructed(card);
      case "available-to-add":
        return availabilityFor(
          { name: card.name, cardCode: card.id },
          context.section,
          context.sections,
        ).ok;
      case "bookmarked-only":
        return context.bookmarks.has(card.id);
      default:
        return true;
    }
  }).length;
  const active =
    status === "legal-only"
      ? filters.legalOnly
      : status === "available-to-add"
        ? filters.availableToAdd
        : filters.bookmarkedOnly;
  const label =
    status === "legal-only"
      ? T.legalOnly
      : status === "available-to-add"
        ? T.availableToAdd
        : T.bookmarkedOnly;
  return [{ id: status, label, count, active, disabled: count === 0 && !active }];
}

/** Build every visible filter group + counts for the current search/pool. */
export function buildFacets(
  pool: readonly Card[],
  searched: readonly Card[],
  filters: CatalogFilters,
  context: CatalogContext,
): FacetGroup[] {
  const section = context.section;
  const showProperties =
    section === "champion" || section === "mainDeck" || section === "sideboard";
  const showType = showProperties;
  const showRarity = section !== "legend" && section !== "battlefields";
  const showDomain = section !== "battlefields" || pool.some((card) => card.domains.length > 0);

  const groups: FacetGroup[] = [];
  const pushChips = (
    id: FilterFacetId,
    label: string,
    panelSection: FacetGroup["panelSection"],
    presentation: FacetGroup["presentation"] = "segmented",
  ) => {
    groups.push({
      id,
      label,
      panelSection,
      control: id === "keywords" || id === "tags" || id === "abilities" ? "searchable" : "chips",
      presentation,
      options: facetOptionsFor(searched, filters, context, id),
    });
  };

  if (showDomain) pushChips("domain", T.domain, "primary", "icons");
  if (showType) pushChips("type", T.type, "primary");
  if (showRarity) pushChips("rarity", T.rarity, "primary");
  if (showProperties) {
    pushChips("energy", T.energy, "properties");
    pushChips("power", T.power, "properties");
    pushChips("might", T.might, "properties");
  }
  pushChips("set", T.set, "advanced", "chips");
  pushChips("keywords", T.keywords, "advanced");
  pushChips("tags", T.tags, "advanced");
  pushChips("abilities", T.abilities, "advanced");

  groups.push({
    id: "legal-only",
    label: T.legality,
    panelSection: "status",
    control: "toggle",
    presentation: "chips",
    options: statusOptionsFor(searched, filters, context, "legal-only"),
  });
  groups.push({
    id: "available-to-add",
    label: T.availability,
    panelSection: "status",
    control: "toggle",
    presentation: "chips",
    options: statusOptionsFor(searched, filters, context, "available-to-add"),
  });
  groups.push({
    id: "bookmarked-only",
    label: T.bookmarks,
    panelSection: "status",
    control: "toggle",
    presentation: "chips",
    options: statusOptionsFor(searched, filters, context, "bookmarked-only"),
  });
  return groups.filter((group) => group.options.length > 0);
}

/* -------------------------------------------------------------------- sort */

function orderIndex(order: readonly string[], value: string, fallback = 999): number {
  const index = order.indexOf(value);
  return index === -1 ? fallback : index;
}

function primaryType(card: { type: string }): string {
  return card.type.trim();
}

function compareNullableNumber(a: number | undefined, b: number | undefined): number {
  return (a ?? 0) - (b ?? 0);
}

export function compareCatalogCards(
  a: Card,
  b: Card,
  key: CatalogSortKey,
  direction: SortDirection,
): number {
  let result = 0;
  switch (key) {
    case "energy":
      result = compareNullableNumber(a.energyCost, b.energyCost);
      break;
    case "power":
      result = compareNullableNumber(a.powerCost, b.powerCost);
      break;
    case "might":
      result = compareNullableNumber(a.might, b.might);
      break;
    case "type":
      result = orderIndex(TYPE_ORDER, primaryType(a)) - orderIndex(TYPE_ORDER, primaryType(b));
      break;
    case "domain":
      result =
        orderIndex(DOMAIN_ORDER, normalizedDomainOrder(a.domains)[0] ?? "Unknown") -
        orderIndex(DOMAIN_ORDER, normalizedDomainOrder(b.domains)[0] ?? "Unknown");
      break;
    case "rarity":
      result = orderIndex(RARITY_ORDER, a.rarity) - orderIndex(RARITY_ORDER, b.rarity);
      break;
    case "set":
      result = orderIndex(SET_ORDER, a.set) - orderIndex(SET_ORDER, b.set);
      break;
    case "name":
    default:
      result = 0;
      break;
  }
  if (result === 0) result = a.name.localeCompare(b.name);
  if (result === 0) result = a.id.localeCompare(b.id);
  return direction === "desc" ? -result : result;
}

export function sortCatalogCards(
  cards: readonly Card[],
  key: CatalogSortKey,
  direction: SortDirection,
): Card[] {
  return [...cards].sort((a, b) => compareCatalogCards(a, b, key, direction));
}

export interface CatalogGroup {
  key: string;
  label: string | null;
  cards: Card[];
}

export function groupCatalogCards(
  cards: readonly Card[],
  grouping: CatalogGrouping,
): CatalogGroup[] {
  if (grouping === "none") return [{ key: "all", label: null, cards: [...cards] }];
  const buckets = new Map<string, Card[]>();
  for (const card of cards) {
    const key =
      grouping === "domain"
        ? (normalizedDomainOrder(card.domains)[0] ?? T.noDomain)
        : (getCardTypeWords(card)[0] ?? T.unknown);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(card);
    else buckets.set(key, [card]);
  }
  const ordered =
    grouping === "domain"
      ? [...buckets.keys()].sort((a, b) => {
          if (a === T.noDomain) return 1;
          if (b === T.noDomain) return -1;
          return orderIndex(DOMAIN_ORDER, a) - orderIndex(DOMAIN_ORDER, b);
        })
      : [...buckets.keys()].sort((a, b) => orderIndex(TYPE_ORDER, a) - orderIndex(TYPE_ORDER, b));
  return ordered.map((key) => ({ key, label: key, cards: buckets.get(key) ?? [] }));
}

/* ----------------------------------------------------- deck-list grouping */

export interface DeckListGroup {
  key: string;
  label: string;
  entries: DeckSections[DeckSectionKey];
}

export function groupDeckEntries(
  entries: DeckSections[DeckSectionKey],
  groupKey: "section" | "type" | "energy" | "power" | "domain",
  sortKey: "name" | "type" | "energy" | "power" | "domain" | "copies",
  direction: SortDirection,
): DeckListGroup[] {
  const enriched = entries.map((entry) => {
    const card = catalogEntryForCode(entry.cardCode);
    return { entry, card };
  });
  const compare = (a: (typeof enriched)[number], b: (typeof enriched)[number]): number => {
    let result = 0;
    switch (sortKey) {
      case "energy":
        result = (a.card?.energyCost ?? 0) - (b.card?.energyCost ?? 0);
        break;
      case "power":
        result = (a.card?.powerCost ?? 0) - (b.card?.powerCost ?? 0);
        break;
      case "domain":
        result =
          orderIndex(DOMAIN_ORDER, normalizedDomainOrder(a.card?.domains)[0] ?? "Unknown") -
          orderIndex(DOMAIN_ORDER, normalizedDomainOrder(b.card?.domains)[0] ?? "Unknown");
        break;
      case "type":
        result =
          orderIndex(TYPE_ORDER, primaryType({ type: a.card?.type ?? "" })) -
          orderIndex(TYPE_ORDER, primaryType({ type: b.card?.type ?? "" }));
        break;
      case "copies":
        result = a.entry.count - b.entry.count;
        break;
      case "name":
      default:
        result = 0;
        break;
    }
    if (result === 0) result = a.entry.name.localeCompare(b.entry.name);
    return direction === "desc" ? -result : result;
  };
  const sorted = [...enriched].sort(compare);
  if (groupKey === "section") {
    return [{ key: "all", label: "", entries: sorted.map((item) => item.entry) }];
  }
  const buckets = new Map<string, DeckSections[DeckSectionKey]>();
  for (const item of sorted) {
    const label =
      groupKey === "type"
        ? item.card
          ? (getCardTypeWords(item.card)[0] ?? T.unknown)
          : T.unknown
        : groupKey === "energy"
          ? T.energyGroupLabel(String(item.card?.energyCost ?? 0))
          : groupKey === "power"
            ? T.powerGroupLabel(String(item.card?.powerCost ?? 0))
            : (normalizedDomainOrder(item.card?.domains)[0] ?? T.noDomain);
    const bucket = buckets.get(label);
    if (bucket) bucket.push(item.entry);
    else buckets.set(label, [item.entry]);
  }
  const order = [...buckets.keys()].sort((a, b) => {
    if (groupKey === "type") return orderIndex(TYPE_ORDER, a) - orderIndex(TYPE_ORDER, b);
    if (groupKey === "domain") {
      if (a === T.noDomain) return 1;
      if (b === T.noDomain) return -1;
      return orderIndex(DOMAIN_ORDER, a) - orderIndex(DOMAIN_ORDER, b);
    }
    return Number.parseInt(a, 10) - Number.parseInt(b, 10);
  });
  return order.map((label) => ({ key: label, label, entries: buckets.get(label) ?? [] }));
}

/* ------------------------------------------------------------- eligibility */

export function poolForSection(
  section: DeckSectionKey,
  legend: { name?: string; cardCode?: string } | undefined,
): Card[] {
  return builderCatalog().filter((card) => {
    if (card._isToken) return false;
    return isCardEligibleForCatalogSection(card, section, legend);
  });
}

export function canAddNow(card: Card, section: DeckSectionKey, sections: DeckSections): boolean {
  const result = availabilityFor({ name: card.name, cardCode: card.id }, section, sections);
  return result.ok;
}
