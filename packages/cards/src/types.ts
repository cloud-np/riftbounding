/**
 * @rift/cards — catalog types (port of `.recon/specs/data/card-schema.ts`).
 *
 * The original catalog is a 1510-entry literal embedded in the client bundle
 * (module 26865); the typed model below mirrors it field for field, plus the
 * `_`-prefixed fields added by the recon normalizer.
 */

/* ------------------------------------------------------------------ enums */

/** `type` as stored in the catalog ("Unit Gear" is the only compound one). */
export type CardType =
  "Unit" | "Spell" | "Legend" | "Gear" | "Rune" | "Battlefield" | "Card" | "Unit Gear";

/** Words the client uses to decide whether a multi-word `type` is splittable. */
export const CARD_TYPE_WORDS: ReadonlySet<string> = new Set([
  "battlefield",
  "card",
  "champion",
  "gear",
  "legend",
  "rune",
  "spell",
  "token",
  "unit",
]);

/** Card domains. "Unknown" is used by every hidden/token print. */
export type Domain = "Fury" | "Calm" | "Mind" | "Body" | "Chaos" | "Order" | "Unknown";

/** Canonical (deck-building) domain order. */
export const DOMAIN_ORDER: readonly Domain[] = ["Fury", "Calm", "Mind", "Body", "Chaos", "Order"];

export type Rarity = "Common" | "Uncommon" | "Rare" | "Epic" | "Showcase";

/** `set` display strings (the id prefix is the machine key). */
export type SetName =
  | "Origins"
  | "Spiritforged"
  | "Unleashed"
  | "Radiance"
  | "Vendetta"
  | "Proving Grounds"
  | "Arcane Box Set"
  | "Origins | Nexus Night"
  | "Vendetta | Nexus Night"
  | "Spiritforged | Nexus Night"
  | "Secret Garden";

/** Set code → deck-code id (module 620966 `SET_MAP`). */
export const SET_MAP = { OGN: 0, OGS: 1, ARC: 2, SFD: 3, UNL: 4, VEN: 5, RAD: 6 } as const;
export type SetCode = keyof typeof SET_MAP | "SGN";

/** Alternate-print variant suffix → deck-code variant id (module 620966). */
export const VARIANT_MAP: Readonly<Record<string, number>> = { "": 0, a: 1, s: 2, "*": 2, b: 3 };

/** Set sort order used by the catalog's "best print" comparator (module 26865 `s`). */
export const SET_SORT_ORDER: Readonly<Record<string, number>> = {
  OGN: 0,
  SFD: 1,
  OGS: 2,
  ARC: 3,
  VEN: 4,
  UNL: 5,
  RAD: 6,
};

/** `keywords[]` values actually observed in the catalog (31 distinct). */
export const KEYWORDS = [
  "Reaction",
  "Action",
  "Assault",
  "Deflect",
  "Add",
  "Ganking",
  "Empower",
  "Shield",
  "Empowered",
  "Hidden",
  "Accelerate",
  "Equip",
  "Tank",
  "Deathknell",
  "Temporary",
  "Ambush",
  "Weaponmaster",
  "Deploy",
  "Repeat",
  "Buff",
  "Level",
  "Flow",
  "Mighty",
  "Disarm",
  "Hunt",
  "Legion",
  "Predict",
  "Vision",
  "Burn",
  "Quick-Draw",
  "Show Off",
] as const;
export type Keyword = (typeof KEYWORDS)[number];

/** The renderer's smaller keyword list (module 3z6_mkb37q-85 `k`). */
export const RENDERER_KEYWORDS = [
  "Accelerate",
  "Action",
  "Add",
  "Assault",
  "Burn",
  "Deathknell",
  "Deflect",
  "Empower",
  "Empowered",
  "Equip",
  "Flow",
  "Ganking",
  "Hidden",
  "Hunt",
  "Legion",
  "Mighty",
  "Reaction",
  "Ready",
  "Recycle",
  "Repeat",
  "Shield",
  "Swift",
  "Tank",
  "Temporary",
  "Vision",
  "Weaponmaster",
] as const;

/** Special inline keyword labels (module 3z6_mkb37q-85 `C`). */
export const SPECIAL_INLINE_KEYWORDS: Readonly<Record<string, string>> = {
  burn: "Burn",
  empower: "Empower",
  empowered: "Empowered",
  flow: "Flow",
  hunt: "Hunt",
};

/** `signatureType` — present on 59 "Signature" cards. */
export type SignatureType = "Spell" | "Unit" | "Gear";

/** One ban-list entry (`bannedIn[]`, 14 cards). */
export interface BanEntry {
  format: "Standard Constructed" | "Constructed 2v2";
  effectiveDate: string;
  announcementDate: string;
  sourceUrl: string;
  sourceTitle: string;
}

/* ------------------------------------------------------------------ record */

export interface Card {
  id: string;
  name: string;
  energyCost: number;
  powerCost?: number;
  type: CardType;
  domains: Domain[];
  text?: string;
  might: number;
  imageUrl: string;
  imageLocale?: "zh-CN" | "ko";
  rarity: Rarity;
  set: SetName;
  keywords?: string[];
  subtypes?: string[];
  isAltArt?: true;
  baseCardId?: string;
  isBanned?: true;
  bannedIn?: BanEntry[];
  signatureType?: SignatureType;
  imageFallbackCardId?: string;

  /* ---- derived by .recon/tools/normalize-cards.py (not in the bundle) ---- */
  _setCode?: SetCode;
  _types?: string[];
  _domains?: Domain[];
  _isToken?: boolean;
  _isAltArt?: boolean;
  _baseCardId?: string;
}

/** The raw embedded catalog file (`data/cards.json`). */
export interface CardCatalogFile {
  schemaVersion: string;
  source: string;
  count: number;
  derived: string[];
  cards: Card[];
}

/* ----------------------------------------------------------- image slots */

/** Logical call-site slots; module 926062 maps slot → asset size bucket. */
export type ImageSlot =
  "thumb" | "board" | "hand" | "preview" | "hover" | "battlefieldDraft" | "original";

export type ImageSlotSize = "small-v2" | "original";

/** module 926062 `h`/`m`. */
export const SLOT_TO_SIZE: Readonly<Record<ImageSlot, ImageSlotSize>> = {
  thumb: "small-v2",
  board: "small-v2",
  hand: "small-v2",
  preview: "original",
  hover: "original",
  battlefieldDraft: "original",
  original: "original",
};

/* --------------------------------------------------------- text helpers */

export interface SplitCardText {
  rulesText: string | null;
  flavorText: string | null;
}

export interface ParsedDeckEntry {
  count: number;
  name: string;
  cardCode?: string;
}

/** Decoded deck-code entry (the wire form has no display name). */
export interface DeckCodeEntry {
  count: number;
  cardCode?: string;
  name?: string;
}

export type DeckSectionKey =
  "legend" | "champion" | "mainDeck" | "battlefields" | "runes" | "sideboard";

export type DeckSections = Record<DeckSectionKey, ParsedDeckEntry[]>;

export type DeckTotals = Record<DeckSectionKey, number>;

export interface ParsedDeck {
  raw: string;
  sections: DeckSections;
  totals: DeckTotals;
  warnings: string[];
  errors: string[];
}

export interface DeckRulesOptions {
  format?: string;
  deckRulesMode?: "standard" | "unrestricted";
  gameVariant?: "duel" | "teams_2v2" | "free_for_all_3" | "free_for_all_4" | string;
}

export interface DeckValidationResult {
  valid: boolean;
  reasons: string[];
}
