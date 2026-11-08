/**
 * @rift/cards — sealed formats, starter kits, booster collation and the
 * deterministic pool generator (port of the site bundle module 65770,
 * chunk `02h7l-jglwkxb.js`).
 *
 * The generator is deterministic: given the same seed (and catalog) it produces
 * the same pool. `generateSealedPool` also accepts an injected `rng` so callers
 * can share a single RNG stream with the rest of the engine.
 */

import presetDecksFile from "../data/preset-decks.json" with { type: "json" };
import sealedConfigsFile from "../data/sealed-configs.json" with { type: "json" };

import { cards as catalogCards, isTokenRow } from "./catalog";
import { DOMAIN_ORDER } from "./types";
import type { Card, DeckSectionKey } from "./types";

/* ------------------------------------------------------------------ data */

interface RawTreatments {
  baseNumberStart: number;
  baseNumberEnd: number;
  overnumberedStart: number;
  overnumberedEnd?: number;
  alternateArtSuffixes: string[];
  runeCodes?: string[];
  alternateRuneCodes?: string[];
  signedOvernumberSuffix: string;
  signedOvernumberedCodes?: string[];
  signedOvernumberedCardTypes?: string[];
  specialArtCodes: string[];
  ultimateRareCodes?: string[];
  runeCodePrefix?: string;
  tokenCodePrefix?: string;
  tokenCodes?: string[];
}

interface RawOdds {
  epicPerPack: number;
  alternateArtPerBox: number;
  alternateRunePerBox: number;
  overnumberedPerBox: number;
  signedOvernumberedShare: number;
  ultimateRarePerPack?: number;
  specialArtShare?: number;
  isEstimate?: boolean;
}

interface RawBooster {
  packsPerPool: number;
  packsPerBox: number;
  commonSlots: number;
  guaranteedDomainCommons: boolean;
  uncommonSlots: number;
  rareOrEpicSlots: number;
  foilSlots: number;
  tokenOrRuneSlots: number;
  chaseSlot?: boolean;
}

interface RawStarterKitCard {
  cardCode: string;
  count: number;
  role: "legend" | "champion" | "mainDeck" | "battlefield";
}

interface RawStarterKit {
  id: string;
  name: string;
  status: string;
  legendCardCode: string;
  cards: RawStarterKitCard[];
}

interface RawSealedFormat {
  id: string;
  label: string;
  setCode: string;
  poolKind: string;
  status: string;
  publicPlay: boolean;
  matchmakingPool: string;
  expectedStarterKitCount?: number;
  starterKitSize?: number;
  starterChampionRarity?: string;
  booster: RawBooster;
  odds: RawOdds;
  excludedCardCodes: string[];
  starterKits?: RawStarterKit[];
}

interface SealedConfigsFile {
  domains: string[];
  setOrder: string[];
  mixPrefix: string;
  seedLayoutPrefixes: string[];
  setConfigs: Record<
    string,
    {
      setCode: string;
      setName: string;
      canonicalRunes: Record<string, string>;
      treatments: RawTreatments;
      odds: RawOdds;
      excludedCardCodes: string[];
    }
  >;
}

const SEALED_DATA = sealedConfigsFile as unknown as SealedConfigsFile;
const PRESET_DECKS = presetDecksFile as unknown as {
  sealedFormats: RawSealedFormat[];
  sealedFormatIds: Record<string, string>;
};

export const SEALED_DOMAINS: readonly string[] = SEALED_DATA.domains;
export const SEALED_SET_ORDER: readonly string[] = SEALED_DATA.setOrder;
export const MIX_SEALED_PREFIX = SEALED_DATA.mixPrefix;
export const SEED_LAYOUT_PREFIXES: readonly string[] = SEALED_DATA.seedLayoutPrefixes;
export const MAX_SEALED_PACKS = 12;

const UNLEASHED_PRERIFT_ID = "unleashed-prerift-v1";

/* ----------------------------------------------------------- public types */

export interface SealedBoosterConfig extends RawBooster {}
export interface SealedOdds extends RawOdds {}
export interface SealedTreatments extends RawTreatments {}

export interface SealedMixPack {
  setCode: string;
  count: number;
}

export interface SealedFormatConfig {
  id: string;
  generatorVersion: number;
  poolKind: "pre-rift" | "booster-only" | "mix";
  label: string;
  shortLabel: string;
  setName: string;
  setCode: string;
  status: string;
  publicPlay: boolean;
  matchmakingPool: string;
  expectedStarterKitCount?: number;
  starterKitSize?: number;
  starterChampionRarity?: string;
  canonicalRunes: Record<string, string>;
  booster: SealedBoosterConfig;
  treatments: SealedTreatments;
  odds: SealedOdds;
  excludedCardCodes: string[];
  starterKits?: RawStarterKit[];
  packs?: SealedMixPack[];
}

export interface SealedPoolCardInstance {
  instanceId: string;
  cardCode: string;
  source: "starter-kit" | "booster";
  slot: string;
  pack?: number;
  isFoil: boolean;
}

export interface GeneratedSealedPool {
  formatId: string;
  generatorVersion: number;
  seed: string;
  starterKitId?: string;
  preconDomains?: [string, string];
  cards: SealedPoolCardInstance[];
}

export interface SealedConfigIssue {
  code: string;
  path: string;
  message: string;
}

/* ----------------------------------------------------- format resolution */

function rawFormat(id: string): RawSealedFormat | undefined {
  return PRESET_DECKS.sealedFormats.find((format) => format.id === id);
}

function setConfigFor(setCode: string) {
  const config = SEALED_DATA.setConfigs[setCode];
  if (!config) throw new Error(`Unsupported sealed mix set "${setCode}".`);
  return config;
}

/** `_` — parse a `mix-<set><n>[-...]` format id (null when invalid). */
export function parseSealedMix(formatId: string): SealedMixPack[] | null {
  if (typeof formatId !== "string" || !formatId.startsWith(MIX_SEALED_PREFIX)) return null;
  const packs: SealedMixPack[] = [];
  let previousIndex = -1;
  let total = 0;
  for (const part of formatId.slice(MIX_SEALED_PREFIX.length).split("-")) {
    const match = /^([a-z]+)([1-9]\d?)$/.exec(part);
    if (!match) return null;
    const index = SEALED_SET_ORDER.findIndex((setCode) => setCode.toLowerCase() === match[1]);
    const setCode = SEALED_SET_ORDER[index];
    if (setCode === undefined || index <= previousIndex) return null;
    const count = Number.parseInt(match[2] ?? "", 10);
    total += count;
    if (total > MAX_SEALED_PACKS) return null;
    packs.push({ setCode, count });
    previousIndex = index;
  }
  return packs.length > 0 ? packs : null;
}

/** `B`/`$` — is the id a syntactically valid mix format? */
export function isSealedMixFormat(formatId: string): boolean {
  return parseSealedMix(formatId) !== null;
}

/** `w` — parse or throw. */
export function assertSealedMix(formatId: string): SealedMixPack[] {
  const packs = parseSealedMix(formatId);
  if (!packs) throw new Error(`Unsupported sealed format "${formatId}".`);
  return packs;
}

function mixPrimarySet(packs: readonly SealedMixPack[]): string {
  let primary: SealedMixPack | undefined;
  for (const pack of packs) {
    if (!primary || pack.count >= primary.count) primary = pack;
  }
  if (!primary) throw new Error("A sealed mix must open at least one pack.");
  return primary.setCode;
}

/** The shared booster recipe (module 65770 `p`). */
const BASE_BOOSTER: RawBooster = {
  packsPerPool: 5,
  packsPerBox: 24,
  commonSlots: 7,
  guaranteedDomainCommons: true,
  uncommonSlots: 3,
  rareOrEpicSlots: 2,
  foilSlots: 1,
  tokenOrRuneSlots: 1,
};

/** `F` — build the derived mix config. */
function makeMixConfig(
  formatId: string,
  packs: readonly SealedMixPack[],
  primarySet: string,
): SealedFormatConfig {
  const setConfig = setConfigFor(primarySet);
  return {
    id: formatId,
    generatorVersion: 1,
    poolKind: "mix",
    label: "Custom · Sealed",
    shortLabel: "Custom",
    setName: setConfig.setName,
    setCode: setConfig.setCode,
    status: "active",
    publicPlay: false,
    matchmakingPool: "upcoming",
    canonicalRunes: setConfig.canonicalRunes,
    booster: { ...BASE_BOOSTER, packsPerPool: packs.reduce((sum, pack) => sum + pack.count, 0) },
    treatments: setConfig.treatments,
    odds: setConfig.odds,
    excludedCardCodes: setConfig.excludedCardCodes,
    packs: [...packs],
  };
}

const mixCache = new Map<string, SealedFormatConfig>();

/** `M` — is this a built-in sealed format id? */
export function isBuiltInSealedFormat(formatId: string): boolean {
  return PRESET_DECKS.sealedFormats.some((format) => format.id === formatId);
}

/** `I` — is this a known sealed format id (built-in or mix)? */
export function isSealedFormatId(formatId: string): boolean {
  return isBuiltInSealedFormat(formatId) || isSealedMixFormat(formatId);
}

/** `G` — resolve a sealed format config (built-in or mix). */
export function getSealedFormat(formatId: string): SealedFormatConfig {
  const raw = rawFormat(formatId);
  if (raw) return buildFormatConfig(raw);
  const cached = mixCache.get(formatId);
  if (cached) return cached;
  const packs = assertSealedMix(formatId);
  const config = makeMixConfig(formatId, packs, mixPrimarySet(packs));
  mixCache.set(formatId, config);
  return config;
}

function buildFormatConfig(raw: RawSealedFormat): SealedFormatConfig {
  const setConfig = SEALED_DATA.setConfigs[raw.setCode];
  const treatments = setConfig?.treatments;
  const odds = raw.odds;
  return {
    id: raw.id,
    generatorVersion: 1,
    poolKind: raw.poolKind as SealedFormatConfig["poolKind"],
    label: raw.label,
    shortLabel: raw.label.split(" · ")[0] ?? raw.label,
    setName: setConfig?.setName ?? raw.setCode,
    setCode: raw.setCode,
    status: raw.status,
    publicPlay: raw.publicPlay,
    matchmakingPool: raw.matchmakingPool,
    ...(raw.expectedStarterKitCount !== undefined
      ? { expectedStarterKitCount: raw.expectedStarterKitCount }
      : {}),
    ...(raw.starterKitSize !== undefined ? { starterKitSize: raw.starterKitSize } : {}),
    ...(raw.starterChampionRarity !== undefined
      ? { starterChampionRarity: raw.starterChampionRarity }
      : {}),
    canonicalRunes: setConfig?.canonicalRunes ?? {},
    booster: raw.booster,
    treatments: treatments ?? {
      baseNumberStart: 1,
      baseNumberEnd: 1,
      overnumberedStart: 2,
      alternateArtSuffixes: ["A"],
      signedOvernumberSuffix: "S",
      specialArtCodes: [],
    },
    odds,
    excludedCardCodes: raw.excludedCardCodes,
    ...(raw.starterKits ? { starterKits: raw.starterKits } : {}),
  };
}

/** Every built-in sealed format config. */
export function sealedFormats(): SealedFormatConfig[] {
  return PRESET_DECKS.sealedFormats.map(buildFormatConfig);
}

/** `e` — canonical runes of a sealed format. */
export function sealedCanonicalRunes(formatId: string): Record<string, string> {
  return getSealedFormat(formatId).canonicalRunes;
}

/** `d` — set config (treatments/odds/canonical runes) for a mix set. */
export function sealedSetConfig(setCode: string): SealedFormatConfig["treatments"] {
  return setConfigFor(setCode).treatments;
}

/* ----------------------------------------------------------- seed + rng */

/** `z` — normalize a seed. */
export function normalizeSealedSeed(seed: string): string {
  const trimmed = String(seed).trim();
  if (trimmed.length === 0) throw new Error("A sealed pool seed must be non-empty.");
  return trimmed;
}

/** `j` — seed layout: 0 none, 1 distinct packs (`p.`), 2 printed layout (`s.`). */
export function seedLayout(seed: string): number {
  const normalized = normalizeSealedSeed(seed);
  return SEED_LAYOUT_PREFIXES.findIndex((prefix) => normalized.startsWith(prefix)) + 1;
}

/** `W` — derived layout flags. */
export function seedLayoutFlags(seed: string): { distinctPacks: boolean; printedLayout: boolean } {
  const layout = seedLayout(seed);
  return { distinctPacks: layout >= 1, printedLayout: layout >= 2 };
}

/** `ei` — the original seeded RNG (hash → mulberry32). */
export function seededRng(seed: string): () => number {
  const nextHash = (() => {
    let hash = 0x6a09e667 ^ seed.length;
    for (let index = 0; index < seed.length; index += 1) {
      hash = (Math.imul(hash ^ seed.charCodeAt(index), 0xcc9e2d51) << 13) | (hash >>> 19);
    }
    return () => {
      hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b);
      hash ^= hash >>> 13;
      hash = Math.imul(hash, 0xc2b2ae35);
      hash ^= hash >>> 16;
      return hash >>> 0;
    };
  })();
  let state = nextHash();
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), 1 | value);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 0x100000000;
  };
}

/* --------------------------------------------------------- treatment */

export type SealedTreatment =
  | "rune"
  | "alternate-rune"
  | "token"
  | "special-art"
  | "signed-overnumbered"
  | "overnumbered"
  | "alternate-art"
  | "base"
  | "excluded"
  | "outside-format"
  | null;

function startsWithUpper(value: string, prefix: string): boolean {
  return value.toUpperCase().startsWith(prefix.toUpperCase());
}

function cardNumberFromId(id: string): number | null {
  const match = id.match(/^[A-Z]{2,4}-(\d+)/i);
  if (!match) return null;
  const parsed = Number.parseInt(match[1] ?? "", 10);
  return Number.isFinite(parsed) ? parsed : null;
}

/** `J` — classify a catalog print inside a sealed format. */
export function classifySealedTreatment(format: SealedFormatConfig, card: Card): SealedTreatment {
  const id = card.id.toUpperCase();
  if (!id.startsWith(`${format.setCode}-`)) return "outside-format";
  if (format.excludedCardCodes.includes(id)) return "excluded";
  const { runeCodePrefix, runeCodes, tokenCodePrefix, tokenCodes } = format.treatments;
  if (runeCodes?.includes(id)) return "rune";
  const baseId = card.baseCardId?.toUpperCase();
  if (
    (runeCodePrefix !== undefined && startsWithUpper(id, runeCodePrefix)) ||
    (baseId !== undefined && runeCodes?.includes(baseId) === true)
  ) {
    if (format.treatments.alternateRuneCodes !== undefined) {
      if (format.treatments.alternateRuneCodes.includes(id)) return "alternate-rune";
      return card.isAltArt || card.baseCardId ? "outside-format" : "rune";
    }
    return card.isAltArt || card.baseCardId ? "alternate-rune" : "rune";
  }
  if (
    (tokenCodePrefix !== undefined && startsWithUpper(id, tokenCodePrefix)) ||
    tokenCodes?.includes(id) === true
  )
    return "token";
  if (format.treatments.specialArtCodes.includes(id)) return "special-art";
  const number = cardNumberFromId(id);
  const overnumbered =
    number !== null &&
    number >= format.treatments.overnumberedStart &&
    (format.treatments.overnumberedEnd === undefined ||
      number <= format.treatments.overnumberedEnd);
  if (overnumbered && id.endsWith(format.treatments.signedOvernumberSuffix.toUpperCase()))
    return "signed-overnumbered";
  if (overnumbered) return "overnumbered";
  if (
    card.isAltArt ||
    format.treatments.alternateArtSuffixes.some((suffix) => id.endsWith(suffix.toUpperCase()))
  ) {
    return "alternate-art";
  }
  if (
    number !== null &&
    number >= format.treatments.baseNumberStart &&
    number <= format.treatments.baseNumberEnd
  )
    return "base";
  return "outside-format";
}

/** `Q` — is the print a champion unit? */
export function isChampionUnit(card: Card): boolean {
  if ((card.type as string) === "Champion Unit") return true;
  if (card.type !== "Unit") return false;
  const first = card.name.split(",")[0]?.trim() ?? "";
  return first.length > 0 && card.subtypes?.includes(first) === true;
}

function issue(code: string, path: string, message: string): SealedConfigIssue {
  return { code, path, message };
}

function isProbability(value: number | undefined): boolean {
  return Number.isFinite(value) && (value as number) >= 0 && (value as number) <= 1;
}

function perBox(value: number, packsPerBox: number): number {
  return packsPerBox > 0 ? value / packsPerBox : Infinity;
}

/** `ee` — per-pack alternate-art/overnumbered rates. */
function treatmentRates(format: SealedFormatConfig): number[] {
  return [
    perBox(format.odds.alternateArtPerBox, format.booster.packsPerBox),
    perBox(format.odds.overnumberedPerBox, format.booster.packsPerBox),
  ];
}

/** `et` — P(at least one rare-slot replacement) for the given per-slot rates. */
function replacementChance(packRate: number, slots: number, rates: readonly number[]): number {
  let complement = 0;
  const combinations = 2 ** rates.length;
  for (let mask = 0; mask < combinations; mask += 1) {
    let probability = 1;
    let hits = 0;
    for (const [index, rate] of rates.entries()) {
      const hit = (mask & (1 << index)) !== 0;
      probability *= hit ? rate : 1 - rate;
      if (hit) hits += 1;
    }
    const misses = Math.max(0, slots - hits);
    complement += probability * (1 - packRate) ** misses;
  }
  return 1 - complement;
}

/** `er` — P(any rare-slot replacement) with the format's rates. */
export function rareSlotReplacementChance(format: SealedFormatConfig): number {
  return replacementChance(1, format.booster.rareOrEpicSlots, treatmentRates(format));
}

/** `ec` — total chase rate per pack. */
export function chaseRatePerPack(format: SealedFormatConfig): number {
  return (
    (format.odds.ultimateRarePerPack ?? 0) +
    perBox(format.odds.overnumberedPerBox, format.booster.packsPerBox) +
    perBox(format.odds.alternateArtPerBox, format.booster.packsPerBox)
  );
}

/* ------------------------------------------------------ collation pools */

export interface SealedCollationPools {
  overnumbered: Card[];
  signedOvernumbered: Card[];
  alternateArts: Card[];
  specialArts: Card[];
  ultimateRares: Card[];
  alternateRunes: Card[];
  championUnits: Card[];
  commons: Card[];
  uncommons: Card[];
  rares: Card[];
  epics: Card[];
  foilAny: Card[];
  tokens: Card[];
  runes: Card[];
}

/** `eu` — a card's concrete domains. */
export function cardDomains(card: Card): string[] {
  return card.domains.filter((domain) => domain.trim().length > 0 && domain !== "Unknown");
}

function buildPoolIndex(cards: readonly Card[]): Map<string, Card> {
  const byId = new Map<string, Card>();
  for (const card of cards) {
    byId.set(card.id, card);
    if (card.baseCardId && !byId.has(card.baseCardId)) byId.set(card.baseCardId, card);
  }
  return byId;
}

/** The active collation pools for a format (module `ea`'s `s`). */
export function buildCollationPools(
  format: SealedFormatConfig,
  cards: readonly Card[] = catalogCards(),
): SealedCollationPools {
  const byId = buildPoolIndex(cards);
  const setCards = cards.filter((card) =>
    format.id === UNLEASHED_PRERIFT_ID
      ? card.set === format.setName
      : card.id.toUpperCase().startsWith(`${format.setCode.toUpperCase()}-`),
  );
  const sorted =
    format.id === UNLEASHED_PRERIFT_ID
      ? setCards
      : [...setCards].sort((a, b) => (a.id === b.id ? 0 : a.id < b.id ? -1 : 1));

  if (format.id === UNLEASHED_PRERIFT_ID) {
    const overnumbered = sorted.filter((card) => {
      const number = cardNumberFromId(card.id);
      return number !== null && number >= format.treatments.overnumberedStart;
    });
    const alternateArts = sorted.filter((card) => card.isAltArt);
    const overnumberedIds = new Set(overnumbered.map((card) => card.id));
    const alternateIds = new Set(alternateArts.map((card) => card.id));
    const base = sorted.filter(
      (card) => !overnumberedIds.has(card.id) && !alternateIds.has(card.id),
    );
    return {
      overnumbered,
      signedOvernumbered: [],
      alternateArts,
      specialArts: [],
      ultimateRares: [],
      alternateRunes: [],
      championUnits: base.filter(isChampionUnit),
      commons: base.filter((card) => card.rarity === "Common"),
      uncommons: base.filter((card) => card.rarity === "Uncommon"),
      rares: base.filter((card) => card.rarity === "Rare" || card.rarity === "Showcase"),
      epics: base.filter((card) => card.rarity === "Epic"),
      foilAny: base.filter((card) => card.type !== "Battlefield"),
      tokens: sorted.filter((card) => isTokenRow(card) && !card.isAltArt && !card.baseCardId),
      runes: sorted.filter((card) => /-R\d+$/.test(card.id) && !card.isAltArt && !card.baseCardId),
    };
  }

  const byTreatment = new Map<SealedTreatment, Card[]>();
  for (const card of sorted) {
    const treatment = classifySealedTreatment(format, card);
    const bucket = byTreatment.get(treatment);
    if (bucket) bucket.push(card);
    else byTreatment.set(treatment, [card]);
  }
  const base = byTreatment.get("base") ?? [];
  const signedCodes = format.treatments.signedOvernumberedCodes
    ? new Set(format.treatments.signedOvernumberedCodes)
    : null;
  const overnumbered = byTreatment.get("overnumbered") ?? [];
  const ultimateCodes = new Set(format.treatments.ultimateRareCodes ?? []);
  return {
    overnumbered,
    signedOvernumbered: (byTreatment.get("signed-overnumbered") ?? []).filter(
      (card) => !signedCodes || signedCodes.has(card.id),
    ),
    alternateArts: [
      ...(byTreatment.get("alternate-art") ?? []),
      ...(byTreatment.get("special-art") ?? []),
    ],
    specialArts: byTreatment.get("special-art") ?? [],
    ultimateRares: overnumbered.filter((card) => ultimateCodes.has(card.id)),
    alternateRunes: byTreatment.get("alternate-rune") ?? [],
    championUnits: base.filter(isChampionUnit),
    commons: base.filter((card) => card.rarity === "Common"),
    uncommons: base.filter((card) => card.rarity === "Uncommon"),
    rares: base.filter((card) => card.rarity === "Rare" || card.rarity === "Showcase"),
    epics: base.filter((card) => card.rarity === "Epic"),
    foilAny: base,
    tokens: byTreatment.get("token") ?? [],
    runes: byTreatment.get("rune") ?? [],
  };
}

/* ------------------------------------------------------ config validation */

/** `ea` — validate a sealed config and build its pools. */
export function validateSealedFormat(
  format: SealedFormatConfig,
  cards: readonly Card[] = catalogCards(),
): { issues: SealedConfigIssue[]; catalog: Map<string, Card>; pools: SealedCollationPools | null } {
  const issues: SealedConfigIssue[] = [];
  const catalog = buildPoolIndex(cards);
  const cardsPerPack =
    format.booster.commonSlots +
    format.booster.uncommonSlots +
    format.booster.rareOrEpicSlots +
    format.booster.foilSlots +
    format.booster.tokenOrRuneSlots;

  if (
    format.booster.packsPerPool <= 0 ||
    format.booster.packsPerBox <= 0 ||
    cardsPerPack <= 0 ||
    Object.values(format.booster).some(
      (value) => typeof value === "number" && (!Number.isInteger(value) || value < 0),
    )
  ) {
    issues.push(
      issue(
        "invalid_booster_recipe",
        "booster",
        `${format.label} must define positive integer pack counts and non-negative integer slot counts.`,
      ),
    );
  }
  if (
    !Number.isFinite(format.odds.epicPerPack) ||
    format.odds.epicPerPack < 0 ||
    format.odds.epicPerPack > 1 ||
    !Number.isFinite(format.odds.alternateArtPerBox) ||
    format.odds.alternateArtPerBox < 0 ||
    format.odds.alternateArtPerBox > format.booster.packsPerBox ||
    !Number.isFinite(format.odds.alternateRunePerBox) ||
    format.odds.alternateRunePerBox < 0 ||
    format.odds.alternateRunePerBox > format.booster.packsPerBox ||
    !Number.isFinite(format.odds.overnumberedPerBox) ||
    format.odds.overnumberedPerBox < 0 ||
    format.odds.overnumberedPerBox > format.booster.packsPerBox ||
    !Number.isFinite(format.odds.signedOvernumberedShare) ||
    format.odds.signedOvernumberedShare < 0 ||
    format.odds.signedOvernumberedShare > 1 ||
    !isProbability(format.odds.ultimateRarePerPack ?? 0) ||
    !isProbability(format.odds.specialArtShare ?? 0) ||
    (format.booster.chaseSlot === true && chaseRatePerPack(format) > 1) ||
    (format.odds.epicPerPack > 0 && format.booster.rareOrEpicSlots === 0) ||
    (Number.isFinite(rareSlotReplacementChance(format)) &&
      format.odds.epicPerPack > rareSlotReplacementChance(format) + Number.EPSILON)
  ) {
    issues.push(
      issue(
        "invalid_treatment_odds",
        "odds",
        `${format.label} treatment odds must be finite, non-negative, achievable after treatment replacements, and no greater than one hit per pack where applicable.`,
      ),
    );
  }
  if (
    format.treatments.baseNumberStart <= 0 ||
    format.treatments.baseNumberEnd < format.treatments.baseNumberStart ||
    format.treatments.overnumberedStart <= format.treatments.baseNumberEnd ||
    (format.treatments.overnumberedEnd !== undefined &&
      format.treatments.overnumberedEnd < format.treatments.overnumberedStart) ||
    (format.treatments.alternateRuneCodes !== undefined &&
      new Set(format.treatments.alternateRuneCodes).size !==
        format.treatments.alternateRuneCodes.length) ||
    (format.treatments.signedOvernumberedCodes !== undefined &&
      new Set(format.treatments.signedOvernumberedCodes).size !==
        format.treatments.signedOvernumberedCodes.length) ||
    new Set(format.treatments.specialArtCodes).size !== format.treatments.specialArtCodes.length ||
    new Set(format.excludedCardCodes).size !== format.excludedCardCodes.length
  ) {
    issues.push(
      issue(
        "invalid_card_treatments",
        "treatments",
        `${format.label} has overlapping, reversed, or duplicated card-treatment rules.`,
      ),
    );
  }

  for (
    let number = format.treatments.baseNumberStart;
    number <= format.treatments.baseNumberEnd;
    number += 1
  ) {
    const code = `${format.setCode.toUpperCase()}-${String(number).padStart(3, "0")}`;
    if (format.treatments.runeCodes?.includes(code)) continue;
    const card = catalog.get(code);
    if (
      card?.id !== code ||
      card.set !== format.setName ||
      classifySealedTreatment(format, card) !== "base"
    ) {
      issues.push(
        issue(
          "missing_base_card",
          `treatments.base.${code}`,
          `${format.label} is missing base card ${code}.`,
        ),
      );
    }
  }
  if (format.treatments.overnumberedEnd !== undefined) {
    for (
      let number = format.treatments.overnumberedStart;
      number <= format.treatments.overnumberedEnd;
      number += 1
    ) {
      const code = `${format.setCode.toUpperCase()}-${String(number).padStart(3, "0")}`;
      const card = catalog.get(code);
      if (
        card?.id !== code ||
        card.set !== format.setName ||
        classifySealedTreatment(format, card) !== "overnumbered"
      ) {
        issues.push(
          issue(
            "missing_overnumbered_card",
            `treatments.overnumbered.${code}`,
            `${format.label} is missing overnumbered card ${code}.`,
          ),
        );
      }
    }
  }

  const venSignedCodes = [
    "VEN-189S",
    "VEN-190S",
    "VEN-191S",
    "VEN-192S",
    "VEN-193S",
    "VEN-194S",
    "VEN-195S",
    "VEN-196S",
    "VEN-197S",
  ];
  if (
    format.setCode === "VEN" &&
    !sameCodeSet(format.treatments.specialArtCodes, [
      "VEN-SP1",
      "VEN-SP2",
      "VEN-SP3",
      "VEN-SP4",
      "VEN-SP5",
      "VEN-SP6",
    ])
  ) {
    issues.push(
      issue(
        "invalid_special_art",
        "treatments.specialArtCodes",
        `${format.label} must configure exactly VEN-SP1 through VEN-SP6.`,
      ),
    );
  }
  if (
    format.setCode === "VEN" &&
    !sameCodeSet(format.treatments.signedOvernumberedCodes ?? [], venSignedCodes)
  ) {
    issues.push(
      issue(
        "invalid_signed_overnumbered",
        "treatments.signedOvernumberedCodes",
        `${format.label} must configure signed variants VEN-189S through VEN-197S.`,
      ),
    );
  }
  if (
    format.poolKind === "pre-rift" &&
    (format.starterKits?.length ?? 0) !== format.expectedStarterKitCount
  ) {
    issues.push(
      issue(
        "invalid_starter_kit_count",
        "starterKits",
        `${format.label} requires ${format.expectedStarterKitCount} starter kits; found ${format.starterKits?.length ?? 0}.`,
      ),
    );
  }

  for (const domain of SEALED_DOMAINS) {
    const runeCode = format.canonicalRunes[domain];
    const card = runeCode ? catalog.get(runeCode) : undefined;
    const treatment = card ? classifySealedTreatment(format, card) : null;
    if (
      !card ||
      card.id !== runeCode ||
      card.set !== format.setName ||
      !card.type.toLowerCase().includes("rune") ||
      !(card.domains as readonly string[]).includes(domain) ||
      !(treatment === "rune" || treatment === "alternate-rune")
    ) {
      issues.push(
        issue(
          "invalid_canonical_rune",
          `canonicalRunes.${domain}`,
          `${runeCode} is not a resolvable ${domain} rune from ${format.setName}.`,
        ),
      );
    }
  }

  for (const [index, code] of format.treatments.specialArtCodes.entries()) {
    const card = cards.find((candidate) => candidate.id === code);
    if (
      !card ||
      card.set !== format.setName ||
      card.rarity !== "Showcase" ||
      !card.id.toUpperCase().startsWith(`${format.setCode.toUpperCase()}-SP`) ||
      classifySealedTreatment(format, card) !== "special-art"
    ) {
      issues.push(
        issue(
          "invalid_special_art",
          `treatments.specialArtCodes[${index}]`,
          `${code} is not a resolvable special-art card for ${format.label}.`,
        ),
      );
    }
  }
  for (const [index, code] of format.excludedCardCodes.entries()) {
    const card = cards.find((candidate) => candidate.id === code);
    if (!card || classifySealedTreatment(format, card) !== "excluded") {
      issues.push(
        issue(
          "invalid_excluded_card",
          `excludedCardCodes[${index}]`,
          `${code} is not a resolvable excluded card for ${format.label}.`,
        ),
      );
    }
  }

  if (
    format.id !== UNLEASHED_PRERIFT_ID &&
    format.booster.tokenOrRuneSlots > 0 &&
    format.odds.alternateRunePerBox > 0
  ) {
    const alternateRunes = cards.filter(
      (card) => classifySealedTreatment(format, card) === "alternate-rune",
    );
    const valid =
      alternateRunes.length === SEALED_DOMAINS.length &&
      SEALED_DOMAINS.every(
        (domain) =>
          alternateRunes.filter(
            (card) =>
              card.set === format.setName &&
              cardDomains(card).includes(domain) &&
              card.baseCardId === format.canonicalRunes[domain],
          ).length === 1,
      );
    if (!valid) {
      issues.push(
        issue(
          "invalid_alternate_runes",
          "boosterPools.alternateRunes",
          `${format.label} requires exactly one alternate rune for each canonical rune domain.`,
        ),
      );
    }
  }
  if (
    format.id !== UNLEASHED_PRERIFT_ID &&
    format.odds.overnumberedPerBox > 0 &&
    format.odds.signedOvernumberedShare > 0
  ) {
    const signedCodes = format.treatments.signedOvernumberedCodes ?? [];
    const types = format.treatments.signedOvernumberedCardTypes ?? ["Legend"];
    const invalid = signedCodes.filter((code) => {
      const card = catalog.get(code);
      return (
        !card ||
        card.id !== code ||
        card.set !== format.setName ||
        !types.includes(card.type) ||
        classifySealedTreatment(format, card) !== "signed-overnumbered"
      );
    });
    if (signedCodes.length === 0 || invalid.length > 0) {
      issues.push(
        issue(
          "invalid_signed_overnumbered",
          "treatments.signedOvernumberedCodes",
          `${format.label} must resolve every configured signed overnumber variant.`,
        ),
      );
    }
  }

  let pools: SealedCollationPools | null = null;
  if (format.status === "active") {
    pools = buildCollationPools(format, cards);
    const checkEmpty = (enabled: boolean, path: string, what: string, pool: readonly Card[]) => {
      if (enabled && pool.length === 0) {
        issues.push(
          issue(
            "empty_booster_pool",
            path,
            `${format.label} requires a non-empty ${what} collation pool.`,
          ),
        );
      }
    };
    checkEmpty(format.booster.commonSlots > 0, "boosterPools.commons", "common", pools.commons);
    checkEmpty(
      format.booster.uncommonSlots > 0,
      "boosterPools.uncommons",
      "uncommon",
      pools.uncommons,
    );
    checkEmpty(format.booster.rareOrEpicSlots > 0, "boosterPools.rares", "rare", pools.rares);
    checkEmpty(
      format.booster.rareOrEpicSlots > 0 && format.odds.epicPerPack > 0,
      "boosterPools.epics",
      "epic",
      pools.epics,
    );
    checkEmpty(format.booster.foilSlots > 0, "boosterPools.foilAny", "foil", pools.foilAny);
    checkEmpty(
      format.booster.foilSlots > 0,
      "boosterPools.foilRarities",
      "foil rarity",
      foilRarityPools(format, pools, 0.5).flatMap((entry) => entry.cards),
    );
    checkEmpty(
      format.odds.alternateArtPerBox > 0,
      "boosterPools.alternateArts",
      "alternate-art",
      pools.alternateArts,
    );
    checkEmpty(
      format.odds.overnumberedPerBox > 0,
      "boosterPools.overnumbered",
      "overnumbered",
      pools.overnumbered,
    );
    if (format.id === UNLEASHED_PRERIFT_ID) {
      checkEmpty(
        format.booster.tokenOrRuneSlots > 0,
        "boosterPools.inserts",
        "token-or-rune insert",
        [...pools.tokens, ...pools.runes],
      );
    } else {
      checkEmpty(
        format.booster.tokenOrRuneSlots > 0,
        "boosterPools.tokens",
        "token insert",
        pools.tokens,
      );
      checkEmpty(
        format.booster.tokenOrRuneSlots > 0,
        "boosterPools.runes",
        "rune insert",
        pools.runes,
      );
      checkEmpty(
        format.booster.tokenOrRuneSlots > 0 && format.odds.alternateRunePerBox > 0,
        "boosterPools.alternateRunes",
        "alternate-rune insert",
        pools.alternateRunes,
      );
      checkEmpty(
        format.odds.overnumberedPerBox > 0 && format.odds.signedOvernumberedShare > 0,
        "boosterPools.signedOvernumbered",
        "signed-overnumbered",
        pools.signedOvernumbered,
      );
      checkEmpty(
        (format.treatments.ultimateRareCodes?.length ?? 0) > 0,
        "boosterPools.ultimateRares",
        "ultimate-rare",
        pools.ultimateRares.length === format.treatments.ultimateRareCodes?.length
          ? pools.ultimateRares
          : [],
      );
    }
    if (format.booster.guaranteedDomainCommons) {
      for (const domain of SEALED_DOMAINS.slice(0, format.booster.commonSlots)) {
        checkEmpty(
          true,
          `boosterPools.commons.${domain}`,
          `${domain} common`,
          pools.commons.filter((card) => cardDomains(card).includes(domain)),
        );
      }
    }
  }

  if (format.poolKind !== "pre-rift") return { issues, catalog, pools };
  validateStarterKits(format, catalog, issues);
  return { issues, catalog, pools };
}

function sameCodeSet(a: readonly string[], b: readonly string[]): boolean {
  return (
    a.length === b.length &&
    b.every((code) => a.includes(code)) &&
    a.every((code) => b.includes(code))
  );
}

function validateStarterKits(
  format: SealedFormatConfig,
  catalog: Map<string, Card>,
  issues: SealedConfigIssue[],
): void {
  const seenIds = new Set<string>();
  const seenLegends = new Set<string>();
  for (const [index, kit] of (format.starterKits ?? []).entries()) {
    const path = `starterKits[${index}]`;
    if (seenIds.has(kit.id)) {
      issues.push(
        issue(
          "duplicate_starter_kit_id",
          `${path}.id`,
          `Starter kit ID "${kit.id}" is duplicated.`,
        ),
      );
    }
    seenIds.add(kit.id);
    if (seenLegends.has(kit.legendCardCode)) {
      issues.push(
        issue(
          "duplicate_starter_legend",
          `${path}.legendCardCode`,
          `Legend ${kit.legendCardCode} is assigned to more than one starter kit.`,
        ),
      );
    }
    seenLegends.add(kit.legendCardCode);
    const legend = catalog.get(kit.legendCardCode);
    if (legend?.type !== "Legend") {
      issues.push(
        issue(
          "invalid_starter_legend",
          `${path}.legendCardCode`,
          `${kit.legendCardCode} is not a resolvable Legend card.`,
        ),
      );
    }
    if (kit.status === "pending") {
      issues.push(
        issue(
          "starter_kit_pending",
          path,
          `${kit.name}'s exact starter-kit manifest is still pending.`,
        ),
      );
      continue;
    }
    const size = kit.cards.reduce((sum, entry) => sum + Math.max(0, Math.trunc(entry.count)), 0);
    if (size !== format.starterKitSize) {
      issues.push(
        issue(
          "invalid_starter_size",
          `${path}.cards`,
          `${kit.name} must contain ${format.starterKitSize} cards; found ${size}.`,
        ),
      );
    }
    const roleCounts: Record<string, number> = {
      legend: 0,
      champion: 0,
      mainDeck: 0,
      battlefield: 0,
    };
    const seenCards = new Set<string>();
    for (const [cardIndex, entry] of kit.cards.entries()) {
      const cardPath = `${path}.cards[${cardIndex}]`;
      if (seenCards.has(entry.cardCode)) {
        issues.push(
          issue(
            "duplicate_starter_card",
            `${cardPath}.cardCode`,
            `${entry.cardCode} appears in multiple entries; combine it into one counted entry.`,
          ),
        );
      }
      seenCards.add(entry.cardCode);
      if (!Number.isInteger(entry.count) || entry.count <= 0) {
        issues.push(
          issue(
            "invalid_starter_card_count",
            `${cardPath}.count`,
            `${entry.cardCode} must have a positive integer count.`,
          ),
        );
        continue;
      }
      roleCounts[entry.role] = (roleCounts[entry.role] ?? 0) + entry.count;
      if (format.excludedCardCodes.includes(entry.cardCode)) {
        issues.push(
          issue(
            "excluded_starter_card",
            `${cardPath}.cardCode`,
            `${entry.cardCode} is excluded from ${format.label}.`,
          ),
        );
      }
      const card = catalog.get(entry.cardCode);
      if (!card) {
        issues.push(
          issue(
            "missing_starter_card",
            `${cardPath}.cardCode`,
            `${entry.cardCode} is missing from the card catalog.`,
          ),
        );
        continue;
      }
      if (card.set !== format.setName) {
        issues.push(
          issue(
            "starter_card_wrong_set",
            cardPath,
            `${entry.cardCode} belongs to ${card.set}, not ${format.setName}.`,
          ),
        );
      }
      if (classifySealedTreatment(format, card) !== "base") {
        issues.push(
          issue(
            "invalid_starter_treatment",
            cardPath,
            `${entry.cardCode} must use a base ${format.setName} print.`,
          ),
        );
      }
      if (entry.role === "legend" && card.type !== "Legend") {
        issues.push(
          issue("invalid_starter_legend", cardPath, `${entry.cardCode} must be a Legend.`),
        );
      }
      if (
        entry.role === "champion" &&
        !(
          isChampionUnit(card) &&
          (format.starterChampionRarity === undefined ||
            card.rarity === format.starterChampionRarity)
        )
      ) {
        issues.push(
          issue(
            "invalid_starter_champion",
            cardPath,
            `${entry.cardCode} must be a${format.starterChampionRarity ? ` ${format.starterChampionRarity}` : ""} champion unit.`,
          ),
        );
      }
      if (entry.role === "battlefield" && card.type !== "Battlefield") {
        issues.push(
          issue(
            "invalid_starter_battlefield",
            cardPath,
            `${entry.cardCode} must be a Battlefield.`,
          ),
        );
      }
      if (
        entry.role === "mainDeck" &&
        (isChampionUnit(card) ||
          card.type === "Legend" ||
          card.type === "Battlefield" ||
          card.type === "Card" ||
          card.type.toLowerCase().includes("rune") ||
          card.type.toLowerCase().includes("token"))
      ) {
        issues.push(
          issue(
            "invalid_starter_main_deck",
            cardPath,
            `${entry.cardCode} is not a legal core-deck card.`,
          ),
        );
      }
    }
    const legendEntry = kit.cards.find((entry) => entry.role === "legend");
    if (!(roleCounts.legend === 1 && legendEntry && legendEntry.cardCode === kit.legendCardCode)) {
      issues.push(
        issue(
          "invalid_starter_legend",
          `${path}.cards`,
          `${kit.name} must contain exactly its configured legend.`,
        ),
      );
    }
    if (roleCounts.champion !== 1) {
      issues.push(
        issue(
          "invalid_starter_champion",
          `${path}.cards`,
          `${kit.name} must contain exactly one champion unit.`,
        ),
      );
    }
    if (roleCounts.battlefield !== 1) {
      issues.push(
        issue(
          "invalid_starter_battlefield",
          `${path}.cards`,
          `${kit.name} must contain exactly one battlefield.`,
        ),
      );
    }
  }
}

/** `es` — throw when the config has issues. */
export function assertValidSealedFormat(
  format: SealedFormatConfig,
  cards: readonly Card[] = catalogCards(),
): void {
  const { issues } = validateSealedFormat(format, cards);
  if (issues.length !== 0) {
    throw new Error(
      `Invalid ${format.label} configuration: ${issues.map((entry) => entry.message).join(" ")}`,
    );
  }
}

/* ----------------------------------------------------------- collation */

/** `ed` — pick one random entry from a pool. */
function pickOne<T>(pool: readonly T[], rng: () => number): T {
  const value = pool[Math.floor(rng() * pool.length)];
  if (value === undefined)
    throw new Error("Cannot pick a card from an empty sealed collation pool.");
  return value;
}

/** `el` — pick a card, avoiding duplicates when `seen` is provided. */
function pickCard(pool: readonly Card[], seen: Set<string> | null, rng: () => number): Card {
  if (!seen) return pickOne(pool, rng);
  const available = pool.filter((card) => !seen.has(card.id));
  const card = pickOne(available.length > 0 ? available : pool, rng);
  seen.add(card.id);
  return card;
}

/** `em` — foil rarity pools weighted by slot counts. */
export function foilRarityPools(
  format: SealedFormatConfig,
  pools: SealedCollationPools,
  epicPerSlot: number,
): Array<{ cards: Card[]; weight: number }> {
  const { commonSlots, uncommonSlots, rareOrEpicSlots } = format.booster;
  const foilIds = new Set(pools.foilAny.map((card) => card.id));
  const foilOnly = (pool: readonly Card[]) => pool.filter((card) => foilIds.has(card.id));
  const epicShare = pools.epics.length > 0 ? epicPerSlot : 0;
  return [
    { cards: foilOnly(pools.commons), weight: commonSlots },
    { cards: foilOnly(pools.uncommons), weight: uncommonSlots },
    { cards: foilOnly(pools.rares), weight: rareOrEpicSlots * (1 - epicShare) },
    { cards: foilOnly(pools.epics), weight: rareOrEpicSlots * epicShare },
  ].filter(({ cards, weight }) => cards.length > 0 && weight > 0);
}

function pickWeighted(
  pools: ReadonlyArray<{ cards: Card[]; weight: number }>,
  rng: () => number,
): Card[] {
  const total = pools.reduce((sum, entry) => sum + entry.weight, 0);
  let threshold = rng() * total;
  for (const entry of pools) {
    threshold -= entry.weight;
    if (threshold < 0) return entry.cards;
  }
  return pools.at(-1)?.cards ?? [];
}

export interface SealedBoosterPlan {
  config: SealedFormatConfig;
  pools: SealedCollationPools;
  commonSlotPools: Card[][];
  epicPerSlot: number;
  distinctPacks: boolean;
  foilRarityPools: Array<{ cards: Card[]; weight: number }> | null;
  chaseSlot: {
    ultimateRares: Card[];
    overnumbered: Card[];
    alternateArts: Card[];
    specialArts: Card[];
  } | null;
}

/** `(c)` — solve the per-slot epic probability that yields `epicPerPack`. */
function solveEpicPerSlot(format: SealedFormatConfig, printedLayout: boolean): number {
  if (format.id === UNLEASHED_PRERIFT_ID) return 1 - Math.sqrt(1 - format.odds.epicPerPack);
  if (format.odds.epicPerPack <= 0 || format.booster.rareOrEpicSlots <= 0) return 0;
  const rates = treatmentRates(format);
  const chaseRate = chaseRatePerPack(format);
  const chance = (perSlot: number) => {
    if (printedLayout) {
      const slots = format.booster.rareOrEpicSlots;
      return (
        1 - (1 - perSlot) ** Math.max(0, slots - 1) * (chaseRate + (1 - chaseRate) * (1 - perSlot))
      );
    }
    return replacementChance(perSlot, format.booster.rareOrEpicSlots, rates);
  };
  let low = 0;
  let high = 1;
  for (let iteration = 0; iteration < 60; iteration += 1) {
    const mid = (low + high) / 2;
    if (chance(mid) < format.odds.epicPerPack) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

/** `ef` — build the per-format booster plan (pools + probabilities). */
export function buildBoosterPlan(
  format: SealedFormatConfig,
  pools: SealedCollationPools,
  layout: { distinctPacks: boolean; printedLayout: boolean },
): SealedBoosterPlan {
  const chaseEnabled = layout.printedLayout && format.booster.chaseSlot === true;
  const epicPerSlot = solveEpicPerSlot(format, chaseEnabled);
  const commons = pools.commons;
  const domainPools = format.booster.guaranteedDomainCommons
    ? SEALED_DOMAINS.slice(0, format.booster.commonSlots).map((domain) => {
        const pool = commons.filter((card) => cardDomains(card).includes(domain));
        return pool.length > 0 ? pool : commons;
      })
    : [];
  const commonSlotPools = [
    ...domainPools,
    ...Array.from({ length: format.booster.commonSlots - domainPools.length }, () => commons),
  ];
  const ultimateIds = new Set(pools.ultimateRares.map((card) => card.id));
  const specialIds = new Set(pools.specialArts.map((card) => card.id));
  return {
    config: format,
    pools,
    commonSlotPools,
    epicPerSlot,
    distinctPacks: layout.distinctPacks,
    foilRarityPools: layout.distinctPacks ? foilRarityPools(format, pools, epicPerSlot) : null,
    chaseSlot: chaseEnabled
      ? {
          ultimateRares: pools.ultimateRares,
          overnumbered: pools.overnumbered.filter((card) => !ultimateIds.has(card.id)),
          alternateArts: pools.alternateArts.filter((card) => !specialIds.has(card.id)),
          specialArts: pools.specialArts,
        }
      : null,
  };
}

interface PackCard {
  card: Card;
  slot: string;
  sourcePosition: string;
  pack: number;
  isFoil: boolean;
}

/** `eN` — open one booster pack from a plan. */
export function openSealedPack(
  plan: SealedBoosterPlan,
  packNumber: number,
  rng: () => number,
): PackCard[] {
  const {
    config,
    pools,
    commonSlotPools,
    epicPerSlot,
    foilRarityPools: foilPools,
    chaseSlot,
  } = plan;
  const pack: PackCard[] = [];
  const seen = plan.distinctPacks ? new Set<string>() : null;

  for (const [index, pool] of commonSlotPools.entries()) {
    pack.push({
      card: pickCard(pool, seen, rng),
      slot: "Common",
      sourcePosition: `common-${index + 1}`,
      pack: packNumber,
      isFoil: false,
    });
  }
  for (let index = 0; index < config.booster.uncommonSlots; index += 1) {
    pack.push({
      card: pickCard(pools.uncommons, seen, rng),
      slot: "Uncommon",
      sourcePosition: `uncommon-${index + 1}`,
      pack: packNumber,
      isFoil: false,
    });
  }

  const rareSlotCards: PackCard[] = [];
  for (let index = 0; index < config.booster.rareOrEpicSlots; index += 1) {
    const isEpic = pools.epics.length > 0 && rng() < epicPerSlot;
    const pool = isEpic ? pools.epics : pools.rares;
    if (pool.length === 0) continue;
    rareSlotCards.push({
      card: pickCard(pool, seen, rng),
      slot: isEpic ? "Epic" : "Rare",
      sourcePosition: `rare-${index + 1}`,
      pack: packNumber,
      isFoil: true,
    });
  }

  if (chaseSlot) {
    const index = rareSlotCards.length - 1;
    const existing = rareSlotCards[index];
    const replacement = (() => {
      let roll = rng();
      const ultimateRate =
        chaseSlot.ultimateRares.length > 0 ? (config.odds.ultimateRarePerPack ?? 0) : 0;
      if (roll < ultimateRate)
        return { card: pickOne(chaseSlot.ultimateRares, rng), slot: "Ultimate Rare" };
      roll -= ultimateRate;
      const overnumberedRate =
        chaseSlot.overnumbered.length > 0
          ? perBox(config.odds.overnumberedPerBox, config.booster.packsPerBox)
          : 0;
      if (roll < overnumberedRate) {
        return pools.signedOvernumbered.length > 0 && rng() < config.odds.signedOvernumberedShare
          ? { card: pickOne(pools.signedOvernumbered, rng), slot: "Signature Overnumbered" }
          : { card: pickOne(chaseSlot.overnumbered, rng), slot: "Overnumbered" };
      }
      roll -= overnumberedRate;
      const artCount = chaseSlot.alternateArts.length + chaseSlot.specialArts.length;
      const alternateRate =
        artCount > 0 ? perBox(config.odds.alternateArtPerBox, config.booster.packsPerBox) : 0;
      if (roll < alternateRate) {
        const specialShare = config.odds.specialArtShare ?? chaseSlot.specialArts.length / artCount;
        return chaseSlot.specialArts.length > 0 &&
          (chaseSlot.alternateArts.length === 0 || rng() < specialShare)
          ? { card: pickOne(chaseSlot.specialArts, rng), slot: "Special Art" }
          : { card: pickOne(chaseSlot.alternateArts, rng), slot: "Alt Art" };
      }
      return null;
    })();
    if (replacement && existing) {
      rareSlotCards[index] = {
        ...replacement,
        sourcePosition: existing.sourcePosition,
        pack: packNumber,
        isFoil: true,
      };
    }
  } else {
    const freeSlots = rareSlotCards.map((_, index) => index);
    const takeFreeSlot = () => {
      if (freeSlots.length === 0) return null;
      const index = Math.floor(rng() * freeSlots.length);
      return freeSlots.splice(index, 1)[0] ?? null;
    };
    const overnumberedRate = config.odds.overnumberedPerBox / config.booster.packsPerBox;
    if (pools.overnumbered.length > 0 && rng() < overnumberedRate) {
      const isUnleashed = config.id === UNLEASHED_PRERIFT_ID;
      const forced = isUnleashed ? pickOne(pools.overnumbered, rng) : null;
      const signed = rng() < config.odds.signedOvernumberedShare;
      const useSigned = !isUnleashed && signed && pools.signedOvernumbered.length > 0;
      const card =
        forced ?? pickOne(useSigned ? pools.signedOvernumbered : pools.overnumbered, rng);
      const slotIndex = takeFreeSlot() ?? 0;
      const target = rareSlotCards[slotIndex];
      if (target) {
        rareSlotCards[slotIndex] = {
          card,
          slot: (isUnleashed && signed) || useSigned ? "Signature Overnumbered" : "Overnumbered",
          sourcePosition: target.sourcePosition,
          pack: packNumber,
          isFoil: true,
        };
      }
    }
    const alternateRate = config.odds.alternateArtPerBox / config.booster.packsPerBox;
    if (pools.alternateArts.length > 0 && rng() < alternateRate) {
      const card = pickOne(pools.alternateArts, rng);
      const slotIndex = takeFreeSlot() ?? 0;
      const target = rareSlotCards[slotIndex];
      if (target) {
        rareSlotCards[slotIndex] = {
          card,
          slot:
            config.id !== UNLEASHED_PRERIFT_ID &&
            classifySealedTreatment(config, card) === "special-art"
              ? "Special Art"
              : "Alt Art",
          sourcePosition: target.sourcePosition,
          pack: packNumber,
          isFoil: true,
        };
      }
    }
  }
  pack.push(...rareSlotCards);

  for (let index = 0; index < config.booster.foilSlots; index += 1) {
    const pool = foilPools && foilPools.length > 0 ? pickWeighted(foilPools, rng) : pools.foilAny;
    if (pool.length > 0) {
      pack.push({
        card: pickCard(pool, seen, rng),
        slot: "Foil",
        sourcePosition: `foil-${index + 1}`,
        pack: packNumber,
        isFoil: true,
      });
    }
  }

  const hasRunes = pools.runes.length > 0;
  const hasTokens = pools.tokens.length > 0;
  for (let index = 0; index < config.booster.tokenOrRuneSlots; index += 1) {
    let useRune: boolean;
    let useAlternate: boolean;
    const alternateRate = config.odds.alternateRunePerBox / config.booster.packsPerBox;
    if (config.id === UNLEASHED_PRERIFT_ID) {
      useRune = hasRunes && (!hasTokens || rng() < 0.5);
      useAlternate = useRune && pools.alternateRunes.length > 0 && rng() < alternateRate;
    } else {
      useAlternate = pools.alternateRunes.length > 0 && rng() < alternateRate;
      useRune = useAlternate || (hasRunes && (!hasTokens || rng() < 0.5));
    }
    const card = useAlternate
      ? pickOne(pools.alternateRunes, rng)
      : useRune
        ? pickOne(pools.runes, rng)
        : hasTokens
          ? pickOne(pools.tokens, rng)
          : null;
    if (card) {
      pack.push({
        card,
        slot: useAlternate ? "Alt Rune" : useRune ? "Rune" : "Token",
        sourcePosition: `insert-${index + 1}`,
        pack: packNumber,
        isFoil: false,
      });
    }
  }
  return pack;
}

/* --------------------------------------------------------- pool assembly */

/** `ep` — flatten starter + booster picks into pool instances. */
function assemblePoolInstances(
  formatId: string,
  starter: { id: string; cards: PackCard[] } | null,
  packs: PackCard[][],
): SealedPoolCardInstance[] {
  if (formatId === UNLEASHED_PRERIFT_ID) {
    if (!starter) throw new Error("Unleashed Pre-Rift requires a starter kit.");
    let counter = 0;
    const make = (pick: PackCard, source: "starter-kit" | "booster") => ({
      instanceId: `inst-${counter++}`,
      cardCode: pick.card.id,
      source,
      slot: pick.slot,
      ...(pick.pack === undefined ? {} : { pack: pick.pack }),
      isFoil: pick.isFoil,
    });
    return [
      ...starter.cards.map((pick, index) => {
        if (index === 2) counter += 1;
        return make(pick, "starter-kit");
      }),
      ...packs.flatMap((pack) => pack.map((pick) => make(pick, "booster"))),
    ];
  }
  return [
    ...(starter
      ? starter.cards.map((pick) => ({
          instanceId: `${formatId}:starter:${starter.id}:${pick.sourcePosition}`,
          cardCode: pick.card.id,
          source: "starter-kit" as const,
          slot: pick.slot,
          isFoil: pick.isFoil,
        }))
      : []),
    ...packs.flatMap((pack, packIndex) =>
      pack.map((pick) => ({
        instanceId: `${formatId}:booster:${packIndex + 1}:${pick.sourcePosition}`,
        cardCode: pick.card.id,
        source: "booster" as const,
        slot: pick.slot,
        pack: pick.pack ?? packIndex + 1,
        isFoil: pick.isFoil,
      })),
    ),
  ];
}

/** `T` — generate a full sealed pool. */
export function generateSealedPool(options: {
  formatId: string;
  seed: string;
  cards?: readonly Card[];
  rng?: () => number;
}): GeneratedSealedPool {
  const format = getSealedFormat(options.formatId);
  if (format.status !== "active") throw new Error(`${format.label} is unavailable.`);
  const cards = options.cards ?? catalogCards();
  const layout = seedLayoutFlags(options.seed);
  const rng = options.rng ?? seededRng(options.seed);

  if (format.poolKind === "mix") {
    const packs = format.packs ?? assertSealedMix(format.id);
    const perSet = new Map<string, SealedBoosterPlan>();
    for (const pack of packs) {
      const setFormat =
        pack.setCode === format.setCode ? format : makeMixConfig(format.id, packs, pack.setCode);
      const { issues, pools } = validateSealedFormat(setFormat, cards);
      if (issues.length !== 0) {
        throw new Error(
          `Invalid ${setFormat.label} configuration: ${issues.map((entry) => entry.message).join(" ")}`,
        );
      }
      if (!pools) throw new Error(`${format.label} is unavailable.`);
      perSet.set(pack.setCode, buildBoosterPlan(setFormat, pools, layout));
    }
    const expandedPacks = packs
      .flatMap(({ setCode, count }) => Array.from({ length: count }, () => setCode))
      .map((setCode, index) => {
        const plan = perSet.get(setCode);
        if (!plan) throw new Error(`${format.label} has no ${setCode} booster collation.`);
        return openSealedPack(plan, index + 1, rng);
      });
    return {
      formatId: format.id,
      generatorVersion: format.generatorVersion,
      seed: options.seed,
      cards: assemblePoolInstances(format.id, null, expandedPacks),
    };
  }

  const { issues, pools } = validateSealedFormat(format, cards);
  if (issues.length !== 0)
    throw new Error(
      `Invalid ${format.label} configuration: ${issues.map((entry) => entry.message).join(" ")}`,
    );
  if (!pools) throw new Error(`${format.label} is unavailable.`);
  const plan = buildBoosterPlan(format, pools, layout);

  if (format.poolKind === "booster-only") {
    const packs = Array.from({ length: format.booster.packsPerPool }, (_, index) =>
      openSealedPack(plan, index + 1, rng),
    );
    return {
      formatId: format.id,
      generatorVersion: format.generatorVersion,
      seed: options.seed,
      cards: assemblePoolInstances(format.id, null, packs),
    };
  }

  const starterKit = pickOne(format.starterKits ?? [], rng);
  const starterCards: PackCard[] = starterKit.cards.flatMap((entry) => {
    const card = cards.find((candidate) => candidate.id === entry.cardCode);
    if (!card) throw new Error(`Starter card ${entry.cardCode} is missing from the card catalog.`);
    const slot =
      entry.role === "legend"
        ? "Legend"
        : entry.role === "champion"
          ? "Champion Unit"
          : entry.role === "battlefield"
            ? "Battlefield"
            : "Main Deck";
    return Array.from({ length: entry.count }, (_, index) => ({
      card,
      slot,
      sourcePosition: `${entry.role}:${entry.cardCode}:${index + 1}`,
      pack: 0,
      isFoil: false,
    }));
  });
  const packs = Array.from({ length: format.booster.packsPerPool }, (_, index) =>
    openSealedPack(plan, index + 1, rng),
  );

  const legendCard = starterCards.find((pick) => pick.slot === "Legend")?.card;
  const tag = legendCard?.subtypes?.[0];
  const domains = Array.from(
    new Set([
      ...(legendCard ? cardDomains(legendCard) : []),
      ...(tag
        ? pools.championUnits.filter((card) => card.subtypes?.includes(tag)).flatMap(cardDomains)
        : []),
    ]),
  ).filter((domain) => (DOMAIN_ORDER as readonly string[]).includes(domain));
  const primary = domains[0] ?? SEALED_DOMAINS[0] ?? "Fury";
  const secondary = domains[1] ?? domains[0] ?? primary;

  return {
    formatId: format.id,
    generatorVersion: format.generatorVersion,
    seed: options.seed,
    starterKitId: starterKit.id,
    preconDomains: [primary, secondary],
    cards: assemblePoolInstances(format.id, { id: starterKit.id, cards: starterCards }, packs),
  };
}

/** Convenience: classify a generated pool into decklist sections. */
export function sealedPoolSections(
  pool: GeneratedSealedPool,
  cards: readonly Card[] = catalogCards(),
): Record<DeckSectionKey, Array<{ count: number; name: string; cardCode: string }>> {
  const sections: Record<
    DeckSectionKey,
    Map<string, { count: number; name: string; cardCode: string }>
  > = {
    legend: new Map(),
    champion: new Map(),
    mainDeck: new Map(),
    battlefields: new Map(),
    runes: new Map(),
    sideboard: new Map(),
  };
  for (const instance of pool.cards) {
    const card = cards.find((candidate) => candidate.id === instance.cardCode);
    if (!card) continue;
    const key: DeckSectionKey =
      card.type === "Legend"
        ? "legend"
        : card.type === "Battlefield"
          ? "battlefields"
          : card.type === "Rune"
            ? "runes"
            : isChampionUnit(card) && instance.slot === "Champion Unit"
              ? "champion"
              : "mainDeck";
    const bucket = sections[key];
    const existing = bucket.get(card.id);
    if (existing) existing.count += 1;
    else bucket.set(card.id, { count: 1, name: card.name, cardCode: card.id });
  }
  return Object.fromEntries(
    Object.entries(sections).map(([section, bucket]) => [section, [...bucket.values()]]),
  ) as ReturnType<typeof sealedPoolSections>;
}
