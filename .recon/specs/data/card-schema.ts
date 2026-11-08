/**
 * Rift Atlas simulator — card DB schema, as embedded in the client bundle.
 *
 * Source of truth (extracted, byte-identical in both trees):
 *   play.riftatlas.com  : /_next/static/immutable/chunks/1s-b1v6u63dg2.js  (module 26865)
 *   riftatlas.com       : /_next/static/immutable/chunks/336w80568d601.js  (module 82406)
 * 1510 entries. Normalized copy: .recon/specs/data/cards.json
 *
 * NOTE: in the bundle the catalog literal has NO TypeScript types — the field set below
 * was recovered from the literal + the consumers in 1s-b1v6u63dg2.js / 123h3ohyw0ag5.js.
 */

/* ------------------------------------------------------------------ enums */

/** `type` as stored in the catalog. Values are Title Case; "Unit Gear" is the only
 *  compound one (exactly 1 card), and the client splits multi-word types on whitespace
 *  when *all* words are in CARD_TYPE_WORDS (module 26865, `a()`/`y` export). */
export type CardType =
  | 'Unit'       // 778
  | 'Spell'      // 271
  | 'Legend'     // 161
  | 'Gear'       // 141
  | 'Rune'       // 78
  | 'Battlefield'// 77
  | 'Card'       // 3   — non-deck marker cards: OGN-999 "Buff", UNL-T08 "XP Tracker", VEN-T01 "Empowered"
  | 'Unit Gear'; // 1   — VEN-058 "Patched Porobot"

/** The token set used to decide whether `type` is splittable and, elsewhere, for
 *  token/type lookups. Lower-case. */
export const CARD_TYPE_WORDS = new Set([
  'battlefield', 'card', 'champion', 'gear', 'legend', 'rune', 'spell', 'token', 'unit',
] as const);

/** Card domains. "Unknown" is used by every hidden/token print. */
export type Domain = 'Fury' | 'Calm' | 'Mind' | 'Body' | 'Chaos' | 'Order' | 'Unknown';

/** Canonical (deck-building) domain order used by sealed generators and deck codes. */
export const DOMAIN_ORDER: Domain[] = ['Fury', 'Calm', 'Mind', 'Body', 'Chaos', 'Order'];

export type Rarity = 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Showcase';
// counts: Showcase 372, Common 344, Rare 311, Uncommon 304, Epic 179

/** `set` display strings (the `setCode` prefix of `id` is the machine key). */
export type SetName =
  | 'Origins'                 // 354   OGN
  | 'Spiritforged'            // 303   SFD
  | 'Unleashed'               // 293   UNL
  | 'Radiance'                // 253   RAD
  | 'Vendetta'                // 249   VEN
  | 'Proving Grounds'         // 24    OGS
  | 'Arcane Box Set'          // 12    ARC
  | 'Origins | Nexus Night'   // 7     OGN (*A prints)
  | 'Vendetta | Nexus Night'  // 7     VEN (*A prints)
  | 'Spiritforged | Nexus Night' // 6  SFD (*A prints)
  | 'Secret Garden';          // 2     SGN

/** Set code → deck-code / image-path segment. Matches the client's SET_MAP
 *  (module 620966, `getCodeFromDeck`/`getDeckFromCode`). */
export const SET_MAP = { OGN: 0, OGS: 1, ARC: 2, SFD: 3, UNL: 4, VEN: 5, RAD: 6 } as const;
export type SetCode = keyof typeof SET_MAP | 'SGN';

/** Alternate-print variant suffix → deck-code variant id. */
export const VARIANT_MAP = { '': 0, a: 1, s: 2, '*': 2, b: 3 } as const;

/** `keywords[]` values actually observed in the catalog (31 distinct) with counts. */
export type Keyword =
  | 'Reaction' /*161*/ | 'Action' /*121*/ | 'Assault' /*75*/ | 'Deflect' /*74*/
  | 'Add' /*67*/ | 'Ganking' /*65*/ | 'Empower' /*60*/ | 'Shield' /*58*/
  | 'Empowered' /*57*/ | 'Hidden' /*53*/ | 'Accelerate' /*52*/ | 'Equip' /*43*/
  | 'Tank' /*42*/ | 'Deathknell' /*35*/ | 'Temporary' /*32*/ | 'Ambush' /*25*/
  | 'Weaponmaster' /*24*/ | 'Deploy' /*22*/ | 'Repeat' /*20*/ | 'Buff' /*19*/
  | 'Level' /*19*/ | 'Flow' /*18*/ | 'Mighty' /*16*/ | 'Disarm' /*16*/
  | 'Hunt' /*16*/ | 'Legion' /*15*/ | 'Predict' /*15*/ | 'Vision' /*14*/
  | 'Burn' /*10*/ | 'Quick-Draw' /*7*/ | 'Show Off' /*6*/;

/** `signatureType` — present on 59 "Signature" cards (Spell 48 / Gear 8 / Unit 3).
 *  Signature cards are locked to a Legend's subtype; the deck validator enforces
 *  "≤ 3 Signature cards across the main deck" and "no other legend's signatures". */
export type SignatureType = 'Spell' | 'Unit' | 'Gear';

/** One ban-list entry (`bannedIn[]`, 14 cards). */
export interface BanEntry {
  format: 'Standard Constructed' | 'Constructed 2v2';
  effectiveDate: string;   // ISO date
  announcementDate: string;// ISO date
  sourceUrl: string;
  sourceTitle: string;
}

/* ------------------------------------------------------------------ record */

/** A catalog row, exactly as stored in the bundle (all fields optional except the
 *  ones the client dereferences unconditionally: id, name, energyCost, type, domains,
 *  might, imageUrl, rarity, set). */
export interface Card {
  /** Stable print id, `SET-NNN[variant]`. Variant chars: '' | 'A' | 'B' | 'P' | 'C'
   *  (promo) | 'S' (signed) | 'SPn' (special art) | 'Rn' (rune) | 'Tn' (token/extra). */
  id: string;
  name: string;
  /** 0 for runes, battlefields, tokens and most legends. */
  energyCost: number;
  /** Only on 601 cards; power is the domain-coloured resource. */
  powerCost?: number;
  type: CardType;
  domains: Domain[];       // 1..2 entries; ['Unknown'] for tokens/markers
  /** Rules text. Contains `[Keyword]` / `[Keyword N]` / `[1]` markup and, when the
   *  print has flavour, a line that is exactly `Flavor Text` (regex
   *  /^[\t ]*flavou?r text[\t \r]*$/imu) followed by the flavour paragraph. */
  text?: string;           // absent on 48 cards (rune/battlefield prints)
  might: number;           // 0 when not applicable
  /** Managed asset path, later rewritten to an absolute CDN URL at module load:
   *  `.map(e => ({...e, imageUrl: remapStaticAssetPath(e.imageUrl)}))`. */
  imageUrl: string;        // "/cards/<ID>.webp"
  /** Present on 20 cards whose shipped art is a localized scan. */
  imageLocale?: 'zh-CN' | 'ko';
  rarity: Rarity;
  set: SetName;
  keywords?: Keyword[];    // 849 cards
  subtypes?: string[];     // 1024 cards, 137 distinct values (regions + champions + tribes)
  /** 253 alt-art prints; always paired with baseCardId. */
  isAltArt?: true;
  /** Set on all 253 alt-art prints (e.g. OGN-007A → OGN-007). */
  baseCardId?: string;
  isBanned?: true;         // 14 cards
  bannedIn?: BanEntry[];
  signatureType?: SignatureType;
  /** 7 signed Vendetta overnumbers reuse the base print's art. */
  imageFallbackCardId?: string;

  /* ---- derived by .recon/tools/normalize-cards.py (not in the bundle) ---- */
  _setCode?: SetCode;
  _types?: string[];       // lower-cased split of `type`, e.g. ["unit","gear"]
  _domains?: Domain[];     // `domains` without "Unknown"
  _isToken?: boolean;      // /^[A-Z]{2,4}-T\d+[A-Z]?$/i
  _isAltArt?: boolean;
  _baseCardId?: string;
}

/* ------------------------------------------- derived client-side card model */

/** The board layer wraps catalog rows in a "resolved" shape (module 751995 `$`,
 *  module 26865) that always carries an image and a canonical type. */
export interface ResolvedCard extends Partial<Card> {
  cardCode?: string;       // catalog id once resolved
  imageUrl: string;
  type: CardType | '';
  isPlaceholder: boolean;  // true for unresolved tokens / empty slots
  source?: 'token';        // token objects carry this discriminator
}

/* --------------------------------------------------- tokens & token art map */

/** Tokens are ordinary catalog rows with an id `…-Tn`, `domains:["Unknown"]` and a
 *  physical token image under `/tokens/`. The board maps token names → art file
 *  (module 582436, `o`): */
export const TOKEN_ART: Record<string, string> = {
  Bird: 'UNL-T02', Brush: 'UNL-T03', Gold: 'SFD-T03', Mech: 'SFD-T01',
  Recruit: 'OGN-273', Reflection: 'UNL-T06', SandSoldier: 'SFD-T02',
  ShadowClone: 'VEN-T05', Sprite: 'OGN-274', Tentacle: 'VEN-T06',
};
/** Catalog ids that the token-art resolver treats as "token deck cards": */
export const TOKEN_CARD_IDS = new Set([...Object.values(TOKEN_ART), 'OGN-271', 'OGN-272', 'UNL-T01']);
/** Token image paths built by the board: `/tokens/<Name>.webp` (full) and
 *  `/tokens/thumbs/<Name>.webp` (panel/rail thumbnail). */
export const tokenImage = (name: string) => `/tokens/${name}.webp`;
export const tokenThumb = (name: string) => `/tokens/thumbs/${name}.webp`;

/* ------------------------------------------------------ image-slot contract */

/** Call sites name a logical slot; module 926062 maps slot → asset size bucket. */
export type ImageSlot = 'thumb' | 'board' | 'hand' | 'preview' | 'hover'
                      | 'battlefieldDraft' | 'original';
export const SLOT_TO_SIZE: Record<ImageSlot, 'small-v2' | 'original'> = {
  thumb: 'small-v2', board: 'small-v2', hand: 'small-v2',
  preview: 'original', hover: 'original', battlefieldDraft: 'original', original: 'original',
};
/** Client-side CDN path allow-list (module 718355):
 *  ^\/riftbound\/cards\/(?:zh-CN\/)?(?:original|small-v2)\/[A-Z]{3}-[A-Z0-9]+\.webp$ */
export const CARD_IMAGE_PATH_RE =
  /^\/riftbound\/cards\/(?:zh-CN\/)?(?:original|small-v2)\/[A-Z]{3}-[A-Z0-9]+\.webp$/u;
/** cdn-cgi transform allow-list for the query string:
 *  ^width=\d{1,4},quality=\d{2},format=(?:auto|webp|avif),fit=scale-down(?:,onerror=redirect)?$ */
export const CDN_TRANSFORM_RE =
  /^width=\d{1,4},quality=\d{2},format=(?:auto|webp|avif),fit=scale-down(?:,onerror=redirect)?$/u;

/* ------------------------------------------------------- text parsing helpers */

/** Splits raw `text` on the `Flavor Text` marker line (module 387653). */
export function splitCardText(text: string): { rulesText: string | null; flavorText: string | null };
/** Rules text only (removes the flavour paragraph). */
export function rulesTextOf(text: string | undefined): string;
/** Extracts an errata block when the text starts with `Card Errata Text`. */
export function errataTextOf(text: string): string | null;
/** Inline-keyword icon candidates for a `[Foo]` / `[Foo 2]` markup token
 *  (module 3z6_mkb37q-85.js): `/icons/<lower, spaces→_>.<svg if numeric else webp>`,
 *  `/icons/<lower>.svg`, then the base name (`_<n>` stripped) `.webp`/`.svg`. */
export function keywordIconCandidates(token: string): string[];
