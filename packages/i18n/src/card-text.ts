/**
 * @rift/i18n — localized card rules/flavor text.
 *
 * Port of the text-resolution chain in module 492925: rules text comes from
 * official errata → project-translated errata → project translation → printed
 * scan text, with the original provenance (`rulesEvidence`) strings. Card data
 * is loaded from `i18n-<locale>-cards.json` (the full zh-CN file is preferred).
 */

import frCardsFile from "../data/i18n-fr-cards.json" with { type: "json" };
import koCardsFile from "../data/i18n-ko-cards.json" with { type: "json" };
import zhCardsCompactFile from "../data/i18n-zh-CN-cards.json" with { type: "json" };
import zhCardsFullFile from "../data/i18n-zh-CN-cards-full.json" with { type: "json" };

import type { LocaleCode } from "./locales";

export interface LocalizedCardText {
  rulesText: string | null;
  sourceRulesText: string | null;
  flavorText: string | null;
  flavorEvidence: string | null;
  rulesEvidence: string;
  sourceCardId: string;
}

interface CardEntry {
  printedRulesText?: string;
  rulesText?: string;
  sourceRulesText?: string;
  flavorText?: string;
  rulesEvidence?: string;
  flavorEvidence?: string;
}

interface ErrataEntry {
  rulesText?: string;
  sourceRulesText?: string;
}

interface FlavorOverride {
  flavorText?: string;
  evidence?: string;
  sourceCardId?: string;
}

interface CardTextCatalog {
  schemaVersion?: number;
  locale?: string;
  cards: Record<string, CardEntry | string>;
  derivedFromBasePrint?: Record<string, string>;
  officialErrata?: { cards?: Record<string, ErrataEntry> };
  projectTranslatedOfficialErrata?: { cards?: Record<string, ErrataEntry> };
  projectTranslations?: { cards?: Record<string, ErrataEntry> };
  flavorOverrides?: Record<string, FlavorOverride>;
}

const catalogs: Partial<Record<LocaleCode, CardTextCatalog>> = {
  fr: frCardsFile as unknown as CardTextCatalog,
  ko: koCardsFile as unknown as CardTextCatalog,
};

const zhFull = zhCardsFullFile as unknown as CardTextCatalog;
const zhCompact = zhCardsCompactFile as unknown as CardTextCatalog;
catalogs["zh-CN"] = {
  ...zhFull,
  cards: { ...(zhCompact.cards ?? {}), ...(zhFull.cards ?? {}) },
  derivedFromBasePrint: {
    ...(zhCompact.derivedFromBasePrint ?? {}),
    ...(zhFull.derivedFromBasePrint ?? {}),
  },
  flavorOverrides: { ...(zhCompact.flavorOverrides ?? {}), ...(zhFull.flavorOverrides ?? {}) },
};

const cache = new Map<string, LocalizedCardText | null>();

function trimOrNull(value: string | undefined | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function cardEntry(catalog: CardTextCatalog, cardId: string): CardEntry | null {
  const entry = catalog.cards[cardId];
  if (!entry) return null;
  return typeof entry === "string" ? { printedRulesText: entry } : entry;
}

/**
 * Resolve localized rules/flavor text for a print. Returns null when the locale
 * has no data for the card (the caller falls back to EN text/art).
 */
export function getLocalizedCardText(
  locale: string | null | undefined,
  cardId: string | null | undefined,
): LocalizedCardText | null {
  const normalized = String(locale ?? "").toLowerCase();
  const catalog =
    normalized === "fr"
      ? catalogs.fr
      : normalized === "ko"
        ? catalogs.ko
        : normalized === "zh-cn"
          ? catalogs["zh-CN"]
          : undefined;
  if (!catalog || !cardId) return null;
  const id = cardId.trim().toUpperCase();
  const cacheKey = `${normalized}:${id}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey) ?? null;

  const derivedBase = catalog.derivedFromBasePrint?.[id];
  const resolvedId = derivedBase ?? id;
  const card = cardEntry(catalog, resolvedId);
  const official =
    catalog.officialErrata?.cards?.[id] ?? catalog.officialErrata?.cards?.[resolvedId];
  const project = catalog.projectTranslations?.cards?.[id];
  const projectErrata = catalog.projectTranslatedOfficialErrata?.cards?.[id];
  const flavorOverride = catalog.flavorOverrides?.[id];
  if (!card && !official && !project && !projectErrata && !flavorOverride) {
    cache.set(cacheKey, null);
    return null;
  }

  const printedRulesText = trimOrNull(card?.printedRulesText);
  const rulesText = trimOrNull(
    official?.rulesText ?? projectErrata?.rulesText ?? project?.rulesText ?? printedRulesText,
  );
  const sourceRulesText = trimOrNull(projectErrata?.sourceRulesText ?? project?.sourceRulesText);
  const rulesEvidence = official
    ? "verified-official-errata"
    : projectErrata
      ? "project-translated-official-errata"
      : project
        ? "project-translation"
        : derivedBase
          ? card?.rulesEvidence === "reviewed-retailer-transcription"
            ? "derived-reviewed-base-print"
            : "derived-physical-base-print"
          : (card?.rulesEvidence ?? "verified-physical-print");
  const flavorText = trimOrNull(
    flavorOverride ? flavorOverride.flavorText : derivedBase ? undefined : card?.flavorText,
  );
  const flavorEvidence = flavorOverride
    ? (flavorOverride.evidence ?? null)
    : derivedBase
      ? null
      : (card?.flavorEvidence ?? null);

  const result: LocalizedCardText = {
    rulesText,
    sourceRulesText,
    flavorText,
    flavorEvidence,
    rulesEvidence,
    sourceCardId: flavorOverride?.sourceCardId ?? resolvedId,
  };
  cache.set(cacheKey, result);
  return result;
}

/** Localized rules text only (null when unavailable). */
export function getLocalizedRulesText(
  locale: string | null | undefined,
  cardId: string | null | undefined,
): string | null {
  return getLocalizedCardText(locale, cardId)?.rulesText ?? null;
}

/** Localized flavor text only (null when unavailable). */
export function getLocalizedFlavorText(
  locale: string | null | undefined,
  cardId: string | null | undefined,
): string | null {
  return getLocalizedCardText(locale, cardId)?.flavorText ?? null;
}

/** Locales with card-text data. */
export function localizedCardTextLocales(): LocaleCode[] {
  return ["fr", "ko", "zh-CN"];
}

/** Number of localized card entries (for diagnostics/tests). */
export function localizedCardTextCount(locale: string | null | undefined): number {
  const normalized = String(locale ?? "").toLowerCase();
  const catalog =
    normalized === "fr"
      ? catalogs.fr
      : normalized === "ko"
        ? catalogs.ko
        : normalized === "zh-cn"
          ? catalogs["zh-CN"]
          : undefined;
  return catalog ? Object.keys(catalog.cards).length : 0;
}
