# 03 — Card data, deck format, assets & sounds (Rift Atlas simulator)

Specialist analyst #3 (card data / assets / sounds / animation+3D), 2026-10-22.
Sources: `.recon/api/cards.embedded.json`, `card-image-revisions.json`, `asset-manifest.json`,
`.recon/pretty/playapp/*.js`, `.recon/pretty/site/*.js`, `.recon/site/assets/cdn/**`,
`.recon/site/cards-sample/**`. Chunk names are prettified bundle filenames;
the number in parentheses is the Turbopack module id when it helps grep.

Companion files:
* `.recon/specs/data/cards.json` — normalized 1510-card catalog (every original field kept,
  plus `_`-prefixed derived ones), sorted `set → setCode → card number`.
* `.recon/specs/data/card-schema.ts` — TypeScript types + enums + helper contracts.
* `.recon/specs/data/preset-decks.json` — every decklist embedded in the bundles + sealed configs.
* `.recon/specs/03-animations-3d.md` — motion/3D spec.

---

## 1. Card database

### 1.1 Provenance

The canonical catalog is **embedded in the JS bundle**, identically in both apps:

| app | chunk | module | form |
|---|---|---|---|
| play.riftatlas.com | `1s-b1v6u63dg2.js` | `26865` | `let i = [ …1510 literal objects… ]` then `i.map(e => ({...e, imageUrl: remapStaticPath(e.imageUrl)}))` |
| riftatlas.com | `336w80568d601.js` | `82406` | same literal (`let n = [...]`), same order |

Verified byte-identical (1510/1510 records, 0 field diffs, 0 extra ids on either side).
There is **no public card REST endpoint** — data ships with the bundle.

### 1.2 Record schema

Exact field census over all 1510 rows:

| field | type | present on | notes |
|---|---|---|---|
| `id` | string | 1510 | `SET-NNN` + optional variant suffix. `^[A-Z]{2,4}-[A-Z0-9]+$` |
| `name` | string | 1510 | `"Vi, Destructive"` (champion, epithet) / `"Blazing Scorcher"` |
| `energyCost` | number | 1510 | 0 for rune/battlefield/token/legend-ish prints |
| `powerCost` | number | 601 | domain-coloured resource cost |
| `type` | enum | 1510 | see §1.3 |
| `domains` | `Domain[]` | 1510 | 1–2 entries, or `["Unknown"]` |
| `text` | string | 1462 | `[Keyword]`/`[Keyword N]`/`[1]` markup + `Flavor Text` marker line |
| `might` | number | 1510 | 0 when N/A |
| `imageUrl` | string | 1510 | `"/cards/<ID>.webp"` (rewritten to a CDN URL at module load) |
| `imageLocale` | `"zh-CN"\|"ko"` | 20 | shipped art is a localized scan (all ARC-001..006, `OGN-303A`=ko, 13 Radiance `S`/`A` prints, `VEN-155A`) |
| `rarity` | enum | 1510 | see §1.3 |
| `set` | string | 1510 | display name incl. `"Origins \| Nexus Night"` style composites |
| `keywords` | string[] | 849 | normalized keyword names (31 distinct) |
| `subtypes` | string[] | 1024 | regions + tribes + champion names (137 distinct) |
| `isAltArt` | `true` | 253 | always with `baseCardId` |
| `baseCardId` | string | 253 | e.g. `OGN-007A` → `OGN-007` |
| `isBanned` | `true` | 14 | always with `bannedIn` |
| `bannedIn` | `BanEntry[]` | 14 | `{format, effectiveDate, announcementDate, sourceUrl, sourceTitle}` |
| `signatureType` | enum | 59 | `Spell` 48, `Gear` 8, `Unit` 3 |
| `imageFallbackCardId` | string | 7 | signed Vendetta overnumbers reuse base art (`VEN-189S`→`VEN-189`, 190S, 191S, 194S, 195S, 196S, 197S) |

`isPlaceholder`, `source:"token"`, `cardCode`, `isDuplicate`, `exhausted`, … are **not** database
fields — they belong to the resolved/runtime card shape (§1.7).

### 1.3 Enumerations (complete)

* **type** — `Unit` 778, `Spell` 271, `Legend` 161, `Gear` 141, `Rune` 78, `Battlefield` 77,
  `Card` 3 (`OGN-999` Buff, `UNL-T08` XP Tracker, `VEN-T01` Empowered — physical markers),
  `Unit Gear` 1 (`VEN-058` Patched Porobot).
  The client splits multi-word types only if *every* word is in
  `{battlefield, card, champion, gear, legend, rune, spell, token, unit}` (module 26865 `y`),
  so `"Unit Gear"` → `["Unit","Gear"]` but an unknown multiword type stays whole.
* **domains** — `Fury, Calm, Mind, Body, Chaos, Order, Unknown`.
  Mono-domain counts: Body 202, Order 200, Calm 199, Mind 198, Fury 197, Chaos 197, Unknown 96.
  The 96 `Unknown` rows are exactly the 15 `-T` tokens + 3 marker `Card`s + 78 runes.
  78 cards are two-domain (all 15 combinations of the 6 domains occur).
* **rarity** — `Showcase` 372, `Common` 344, `Rare` 311, `Uncommon` 304, `Epic` 179.
* **keywords** (31, with counts) — Reaction 161, Action 121, Assault 75, Deflect 74, Add 67,
  Ganking 65, Empower 60, Shield 58, Empowered 57, Hidden 53, Accelerate 52, Equip 43, Tank 42,
  Deathknell 35, Temporary 32, Ambush 25, Weaponmaster 24, Deploy 22, Repeat 20, Buff 19, Level 19,
  Flow 18, Mighty 16, Disarm 16, Hunt 16, Legion 15, Predict 15, Vision 14, Burn 10, Quick-Draw 7,
  Show Off 6.
  The *renderer's* keyword list (module 389862 `k`) is a smaller 26-entry list; `Burn, Empower,
  Empowered, Flow, Hunt` get special inline handling (`C` map) and unknown keywords fall through as
  plain text.
* **subtypes** (137 distinct) — regions (`Ionia` 141, `Noxus` 84, `Demacia` 59, `Shurima` 59,
  `Piltover` 58, `Bilgewater` 58, `Zaun` 51, `Bandle City` 50, `Mount Targon` 48, `Freljord` 44,
  `Shadow Isles` 41, `The Void` 28, `Ixtal` 12, `Icathia`, `Kathkan`, `Sentinel`, `Trifarian`),
  tribes (`Yordle` 63, `Equipment` 43, `Dragon` 23, `Spirit` 23, `Mech` 22, `Dog` 20, `Poro` 20,
  `Pirate` 19, `Fae` 19, `Demon` 18, `Cat` 17, `Bird` 16, `Elite` 12, `Recruit`, `Bomb`, `Spider`),
  and 100+ champion names (`Ahri`, `Akali`, `Vi`, `Jinx`, … `mech` lowercase, `"Kai'Sa"`,
  `"K'Sante"`, `"Dr. Mundo"`). Full list in `card-schema.ts` / `cards.json`.
  **`subtypes[0]` of a Legend is "the champion tag"** (module 26865 `i()` / `k()`): deck legality
  checks a champion unit with the same tag and `legendXp`-style signature rules key off it.
* **`set`** — `Origins` 354, `Spiritforged` 303, `Unleashed` 293, `Radiance` 253, `Vendetta` 249,
  `Proving Grounds` 24, `Arcane Box Set` 12, `Origins | Nexus Night` 7, `Vendetta | Nexus Night` 7,
  `Spiritforged | Nexus Night` 6, `Secret Garden` 2.
  Set **codes** by id prefix: `OGN` (Origins + 7 Nexus Night + 6 Arcane), `SFD` (+6 NN), `OGS`
  (Proving Grounds), `ARC` (Arcane Box Set), `VEN` (+7 NN), `UNL`, `RAD`, `SGN` (Secret Garden).
  Deck codes know 7 sets: `SET_MAP = {OGN:0, OGS:1, ARC:2, SFD:3, UNL:4, VEN:5, RAD:6}` (SGN is not
  encodable).
* **banned formats** — `Standard Constructed` (12 cards: OGN-110, OGN-168, OGN-177, OGN-182,
  OGN-183, OGN-276, OGN-284, OGN-285, OGN-290, OGN-292, SFD-020, SFD-020A, SFD-122) and
  `Constructed 2v2` (OGN-110, OGN-183, OGS-019). Each entry carries source URLs to
  playriftbound.com announcements.

### 1.4 Per set × type matrix

| set | total | Unit | Spell | Legend | Gear | Battlefield | Rune | Card | Unit Gear |
|---|---|---|---|---|---|---|---|---|---|
| Origins | 354 | 166 | 84 | 37 | 30 | 24 | 12 | 1 | |
| Spiritforged | 303 | 157 | 45 | 25 | 49 | 15 | 12 | | |
| Unleashed | 293 | 159 | 54 | 36 | 20 | 17 | 6 | 1 | |
| Radiance | 253 | 130 | 38 | 29 | 27 | 11 | 18 | | |
| Vendetta | 249 | 141 | 41 | 28 | 15 | 10 | 12 | 1 | 1 |
| Proving Grounds | 24 | 11 | 9 | 4 | | | | | |
| Arcane Box Set | 12 | 12 | | | | | | | |
| Origins \| Nexus Night | 7 | 1 | | | | | 6 | | |
| Vendetta \| Nexus Night | 7 | 1 | | | | | 6 | | |
| Spiritforged \| Nexus Night | 6 | | | | | | 6 | | |
| Secret Garden | 2 | | | 2 | | | | | |

### 1.5 Tokens

Tokens are **ordinary catalog rows**, not a separate collection:

* id pattern `^[A-Z]{2,4}-T\d+[A-Z]?$` (15 rows: RAD-T02; SFD-T01/02/03; UNL-T01/02/03/05/06/07/08;
  VEN-T01/04/05/06), plus legacy token-ish prints referenced by art mapping
  `{OGN-271, OGN-272, OGN-273, OGN-274, UNL-T01}`.
* `domains: ["Unknown"]`, `energyCost: 0`, `rarity: "Common"`, `might` = the token's might,
  `text` often starts with `Flavor Text`-style placeholder `-`.
* Client token test (module 26865 `j`): `types.includes("token") || type.toLowerCase().includes("token")
  || /^[A-Z]{2,4}-T\d+[A-Z]?$/i.test(id)`.
* Board art: `/tokens/<Name>.webp` (full) and `/tokens/thumbs/<Name>.webp` (rail thumbnail) via
  `tokenImage()/tokenThumb()`; the 10 physical token arts map to catalog ids in `TOKEN_ART`
  (`Bird→UNL-T02 … Tentacle→VEN-T06`) and that map is also used to swap a token image back to the
  card art when a token is displayed as a card.
* Runtime token objects use `source: "token"` and are resolved with
  `imageUrl ?? TOKEN_ART[name] ?? fallback`, `type ?? inferred`, `might ?? inferred`.

### 1.6 Alt-arts, variants and localized names

* **Alt arts**: 253 rows have `isAltArt: true` + `baseCardId`; the id suffix is `A` (`OGN-007A`),
  `B` (`OGN-007B`), `P` (promo/pre-rift), `C`, `S` (signed overnumbered), `SPn` (special art).
  59 of them are the Nexus Night prints that also carry a composite `set` name.
* **Signed/overnumbered Vendetta prints** with `imageFallbackCardId` reuse base art; the client
  also has a `/cards/<englishCardId>.webp` fallback candidate for locale art.
* **Sort order** for duplicated names (module 26865 `w`): prefer non-Chinese scripts, prefer
  non-alt-art, then set order `OGN,SFD,OGS,ARC,VEN,UNL,RAD` (`s` map), then overnumbered
  (`number > 221`) last, then id.
* **Localized names**: there is **no localized `name` field**. Localization is *text + art* only:
  * card text: separate locale JSON chunks with `{schemaVersion:2, locale, cards:{<ID>:{printedRulesText,
    rulesEvidence}}}` — `02bk-383zwes8.js` (fr), `3xwrnr9ftjnb3.js` (ko), `1-gn975j0s9u2.js` (zh-CN,
    compact `"<ID>":"<text>"` form). English errata/derived-print data is module 492925.
  * text resolution (`module 492925`): `rulesText ← official errata → project-translated errata →
    project translation → printed scan text`, with `rulesEvidence` provenance strings
    (`verified-official-errata`, `project-translation`, `derived-physical-base-print`,
    `verified-physical-print`, `verified-first-party-scan-transcription`, …).
  * `Flavor Text` is split from rules text with `/^[\t ]*flavou?r text[\t \r]*$/imu`
    (module 387653 → `splitCardText`, `rulesTextOf`, `errataTextOf`).
  * card *art* localization: `imageLocale` + the locale manifests (§1.8).
* **Text markup** (141 distinct bracket tokens): `[Might]` 534, `[Rune]` 283, `[1]`/`[2]`/`[0]`/…
  numeric energy, `[Tap]`, `[Reaction]`, `[Action]`, `[Deflect]`, `[Shield 2]`, `[Assault 2]`,
  `[Level 6]`, `[Stun]`, domain words `[Fury] [Calm] [Mind] [Body] [Chaos] [Order]`. Case is
  inconsistent in the data (`[ACTION]` 37 vs `[Action]` 79) — the renderer upper/lower-folds and
  maps `tap→Exhaust`.
  Inline icons resolve to `/icons/<lower, spaces→"_">.<"svg" if numeric else "webp">`, then
  `/icons/<lower>.svg`, then the base name with `_<digits>` stripped `.webp`/`.svg`
  (module 3z6_mkb37q-85.js `D()`); domain icons are `/icons/{fury,calm,mind,body,chaos,order,
  neutral}.webp`.
* **Catalog views** built at module load: `byId` (also indexes `baseCardId`→card), `byName`
  (normalized name: lowercase, apostrophes removed, non-alphanumerics → space; best print wins),
  `byNameAll` (all prints of a name), `byNameBattlefield`, and `searchTokens` for names.
  Name search uses a normalized Damerau/Levenshtein score with thresholds
  (`≤0.26`, `≤0.34` for names ≤12 chars, `≤0.30` for queries ≥10 chars), prefix/substring bonuses
  (−0.08/−0.05/−0.02·matches) and returns up to 3 suggestions.

### 1.7 Resolved/runtime card shape (module 751995, 26865 `Z`/`n`, 582436)

```js
{
  ...card, cardCode, imageUrl, type, domains, text, energyCost, powerCost, might,
  rarity, set, keywords, subtypes, isPlaceholder:false
}
```
Derived accessors the UI relies on: `resolveCardType()` (`N`), `effectiveMight()` (`G`),
`isTokenRow()` (`j`), `legendTag()`/`isChampionForLegend(card, legendTag)` (`k`, `Q`),
`imageUrlOf()` (`Y`), `hasKeyword(row, kw)` (`q`), `isSignature(row)` (`i`), `tokenCardsOf(name)` (`g`).

### 1.8 Image URL construction (exact client logic)

Two collaborating modules:

* `633272` (manifest + bases) — exported as `S` in other chunks:
  * `S.n` = `"https://assets.riftatlas-workers.com/riftbound/static"`
  * `S.z` = the 187-entry `{path: revision}` map (`asset-manifest.json`)
  * `S.d` = frozen key array of that map
* `957423` (URL builders, chunk `1ixua9twvm95a.js`):

```js
CARDS_BASE   = "https://assets.riftatlas-workers.com/riftbound/cards"   // L(); env NEXT_PUBLIC_* may override
STATIC_BASE  = "https://assets.riftatlas-workers.com/riftbound/static"
SLOTS        = Set("small-v2", "original")
WIDTHS       = [96,128,192,256,320,384,512, 640,768,1024,1280,1536]     // 2x buckets 640..1536
QUALITY      = clamp(75, 92) with default 75                            // m(width, 75)
```

**Card/static asset path** — `toStaticUrl(src)`: strip origin/query, drop leading `/`, drop a
leading `cards/`, drop a leading `small-v2|original` segment, then
`"${staticBase}/${key}?v=${manifest[key]}"`.

**Card art URL** — `buildCardImageUrl({src, slot})` (export `o`, uses internal `F`):

```
base   = CARDS_BASE (or "/" in same-origin mode)
path   = normalise(src)                       // "/cards/OGN-001.webp" → "OGN-001.webp"
rev    = cardImageRevisions["OGN-001.webp"]   // 16-hex cache key
url    = `${base}/${slot}/${path}?v=${rev}`   // slot ∈ {small-v2, original}
```
If `src` already had a query string, that query replaces `?v=` (e.g. locale art signed by
`assetRevision`). Locale art prepends the locale segment (`${base}/${localeSegment}/${slot}/${id}.webp`).

**Responsive / cdn-cgi variant** — `buildResponsiveSrc({src,width,quality})` (export `O`):
1. try the static-asset route: if the path is a manifest key **and** ends in `webp|png|jpg`
   **and** is in the resize-eligible `G` set → `transform(width)`.
2. else if it is a managed card path: `slot = widthBucket ≤ 384 ? "small-v2" : "original"`.
3. transform string = `width=<bucket>,quality=<q>,format=auto,fit=scale-down[,onerror=redirect]`
   (`onerror=redirect` is appended in the small-v2 fallback, omitted in the card-path fallback).
4. final URL = `${origin}/cdn-cgi/image/${transform}${pathname}${search}`
   (relative form `/cdn-cgi/image/…` when base is `"/"`).
* Bucket picker `v(width)`: first bucket ≥ requested, else the largest (1536).
* `G` (resize-eligible) = `Discord-Symbol-*.png`, `ads/tcgplayer-…jpeg`, `auto_pay-poster.webp`,
  `bmc-logo-no-background.png`, `board.webp`, all `cardback-*.png`,
  `effects/rewind-clock-face-v1.webp`, `point-node-outline.png`, `rewind-poster.webp`,
  `showdown-poster.webp`, `tcgplayer-logo-primary-white.png`, every `brand/rift-atlas/*`,
  all `sealed/*`, all `sets/*`, all `tokens/*`, and every `guide-banners/*` **except**
  `guide-banners/challenger-tcg-partner.webp`.
* Responsive width detection from inline styles: `/(^|\s)(1?\d?\d)vw/g` → picks buckets ≥ 1% of the
  smallest `vw` value (2x-oriented).

**Candidate list + locale fallback** — module 928748 `buildCardImageCandidates(...)` (chunk
`123h3ohyw0ag5.js`) returns `{candidates, candidateLocales}`:
1. localized candidate: if the locale has a schema-v2 manifest (`assetPathSegment`,
   `publishedSets: {SET:[ids]}`, `assetRevisions`, `englishAssetCardIds`, `localizedAssetCardIds`)
   and this print is published → `${cardsBase}/${localeSegment}/${assetCardId}.webp?v=${assetRevision}`
   (localized name from `localizedAssetCardIds` when the print is English-named);
2. `small-v2` (or the requested slot) **English** URL;
3. `original` URL as the last fallback.
Candidates are de-duplicated; `candidateLocales` maps each to `locale | imageLocale | null`.

**Loader allow-list / sanitizer** — module 718355 `$(url)`:
origin must be `https://assets.riftatlas-workers.com`, no credentials, total length ≤ 1024,
path must match `CARD_IMAGE_PATH_RE` (above) **or** be `/riftbound/static/<key in manifest>`;
an optional `/cdn-cgi/image/<transform>/` prefix must match `CDN_TRANSFORM_RE`
(`^width=\d{1,4},quality=\d{2},format=(?:auto|webp|avif),fit=scale-down(?:,onerror=redirect)?$`),
and `?v=` must be 8–64 hex chars. Everything else is dropped.

**Verified live** (2026-10-22, `.recon/site/cards-sample/`): `small-v2/OGN-001.webp?v=f5b1b91d61327a2c`
→ 51 898 B **384×536**, `original/OGN-001.webp` → 82 946 B **1030×1438**,
`zh-CN/small-v2/ARC-001.webp` → 88 080 B, `ko/small-v2/OGN-001.webp` → 56 750 B (**384×537**),
`fr/small-v2/RAD-063.webp` → 66 742 B (fr only publishes RAD), `fr/small-v2/OGN-001.webp` → **404**
(not published in fr). `small-v2` is 384 px wide (Showcase prints are 384×538), `original` is
1030 px wide — both at the 88/63 card ratio (0.7159 w/h).
`cdn-cgi/image` transforms work (`board.webp` w=384 → 12 076 B image/webp;
`small-v2/OGN-001.webp` w=384 → 26 300 B, w=192 → 9 748 B) but Cloudflare rate-limits/403s
unauthenticated bursts — treat 403 as throttle, not a wrong URL.

**Revisions**: `card-image-revisions.json` has 1509 entries keyed `"<ID>.webp"` → 16-hex
(same values duplicated at the top of `1ixua9twvm95a.js` as the `d` map). 1503/1510 cards have a
revision; the 7 without are the `imageFallbackCardId` signed prints (art = base print).

---

## 2. Deck format

### 2.1 In-app representation

A registered deck (module 03azfb7rltdws.js, game-state schema) is:
`{ decklistRaw, sections: {legend[], champion[], mainDeck[], battlefields[], runes[], sideboard[]},
totals:{legend,champion,mainDeck,battlefields,runes,sideboard}, errors[], warnings[] }` where each
section entry is `{count, name, cardCode?}`.
Sealed pools add per-instance metadata (`starterKitId`, `preconDomains:[2 domains]`,
`seed`, `generatorVersion`, `formatId`).

Legal Constructed deck (enforced by the parser/validator, §2.4):
**1 legend · 1 champion · 40 main+champion · 3 battlefields · 12 runes · ≤10 sideboard**
(plus up to 3 "Additional Legends" in cards that need them).

### 2.2 Deck-list text format (module 957839, chunk `2nqp-vipvdxlj.js`)

Plain text, one entry per line: **`<count> <name> [<CARD-CODE>]`** (code optional;
`name` may contain `\(…)`-escaped apostrophes). Sections are introduced by headers
(`Legend: Champion: MainDeck: Battlefields: Runes: Sideboard:` — trailing colon optional,
`~~Header~~` decoration allowed, case and spaces ignored, `mainboard|main`, `rune|runepool`,
`side|battlefield` aliases), plus `Additional Legends:`.

Fuzzy header repair: Levenshtein distance / max(len) ≤ **0.34** against the alias table.
Unknown headers are ignored with a warning. Card entries seen before any header are ignored.
Format used for export: `Legend:\n1 Name [CODE]\n\nChampion:\n…` (blank line between sections;
`Additional Legends:` emitted separately when multiple legends are legal).

### 2.3 Deck codes (module 54080 / 673361, same chunk)

Base32 (`ABCDEFGHIJKLMNOPQRSTUVWXYZ234567`) bit-packed, RFC-4122-ish "deck code" with
**format nibble 1** and **version 1–6**:

```
byte0 = 0x10 | version
v1-3 : varint(count) per descending count for main (max 12) then sideboard (max 3)
v4+  : prefix flag + rune-aware encoding (`R` runes, `SP` specials)
v5+  : count groups {count, entries[{set, variant, numbers[]}]}
v6   : chosen champion + additional legends (varint count, then entries)
```
`SET_MAP = {OGN:0, OGS:1, ARC:2, SFD:3, UNL:4, VEN:5, RAD:6}`,
`VARIANT_MAP = {"":0, a:1, s:2, "*":2, b:3}`. Numbers are `Rnn`, `SPn` or 3-digit zero-padded.
The module exposes `getCodeFromDeck(mainDeck, sideboard, chosenChampion?, additionalLegends?)`
and `getDeckFromCode(code, {signedSuffix})` → `{mainDeck, sideboard, chosenChampion,
additionalLegends}`.
UI glue `decodeDeckCodeToDecklist(code)`: decodes → classifies entries by catalog type
(legend→`legend`, battlefield→`battlefields`, rune→`runes`, else `mainDeck`) → picks the legend
(1, or the one matching `chosenChampion`'s tag) → infers the champion from the legend's champion
tag (moves 1 copy out of main), emitting warnings
`decodedDeckWithoutSingleLegend` / `decodedDeckWithoutClearChampion` / `decodedDeckWithMultipleChampions`
when ambiguous. `encodeDecklistToDeckCode(deck)` is the inverse. Codes are capped in a 64-entry
cache; the paste field errors with `pasteDeckCodeFirst` / `couldNotDecodeThatDeckCode`.

### 2.4 Validation rules (module 957839 `v()` — exact strings)

Hard limits / errors:
* raw list ≤ **20 000** chars; ≤ **250** total cards; main deck ≤ **80**; sideboard ≤ **10**;
  deck list ≤ max total cards when expanded.
* required sections present unless `deckRulesMode === "unrestricted"`
  (unrestricted still requires `MainDeck`).
* `Legend` exactly **1** (0 with additional legends); `Additional Legends` ≤ **3** and ≤1 copy each.
* `Champion` exactly **1**.
* `Main Deck + Champion` exactly **40**.
* `Battlefields` exactly **3**, all distinct.
* `Runes` exactly **12**.
* per-name copy limit **3**, or **1** if the card has the `Unique` keyword or `[Unique]` in text;
  spiderling (`"spiderling"`) is exempt (limit null).
* cross-section copies (Champion+MainDeck+Sideboard) ≤ limit, with a "current split" note.
* tokens may never be listed (`tokenIncluded`); cards must sit in their type-correct section
  (`belongsUnder` / `invalidSectionCard`); unknown card codes/names produce did-you-mean suggestions.
* cards outside the legend's domain identity are rejected (`outsideDomainIdentity`).
* Signature cards: ≤ **3** total across the main deck; no other legend's signatures.
* construction/ban: `constructedBan` for banned-in-format prints (`Standard Constructed`,
  `Constructed 2v2`).
* player-facing modes: `format` (`standard-constructed`, sealed formats), `deckRulesMode`
  (`standard` | `unrestricted`), `gameVariant` (`duel`, `teams_2v2`, `free_for_all_3|4`).

`validateDeck(parsed, {format, deckRulesMode, gameVariant})` returns `{valid, reasons[]}`
(short form used before matchmaking: "No battlefields were found in the deck list.",
"No main deck cards were found.", plus bans).

Sealed-specific rules: `championUnit`, `invalidBasicRune`, `tokenRegistration`, `championDomain`,
`coreCount` (core deck ≥ min incl. champion), `runeCount` (exact total), `sealedDomains` (≤2),
`outsidePool`, `sealedSideboard` (registrations don't use a sideboard),
`sideboardChangesSameCards`, `bestOf1SealedRegistrationsCan…` (≤3 physical battlefields in BO1),
`generatedBoosterOnlySealedPoolMust…`.

### 2.5 Preset / starter / sample decks → `.recon/specs/data/preset-decks.json`

**There are no constructed preset decks** in either bundle (no embedded deck codes, no
"featured/sample deck" arrays; the `/play` "Choose a deck" widget reads the signed-in user's saved
decks from Convex). What *is* embedded is the sealed **Pre-Rift starter kits**, 24 complete 15-card
precons (1 legend + 1 champion + 12 main + 1 battlefield, all `count: 1`), plus the sealed format
configs:

| sealed format id | label | set | kind | public play | kits |
|---|---|---|---|---|---|
| `radiance-prerift-v1` | Radiance · Pre-Rift | RAD | pre-rift | yes | 9 (`ekko, evelynn, jarvan-iv, ksante, mordekaiser, orianna, riven, seraphine, ziggs`) |
| `unleashed-prerift-v1` | Unleashed · Pre-Rift | UNL | pre-rift | no | 6 (`khazix, master-yi, jhin, diana, vi, ivern`) |
| `vendetta-prerift-v1` | Vendetta · Pre-Rift | VEN | pre-rift | no | 9 (`jayce, kennen, akali, ambessa, nasus, zed, shen, renekton, mel`) |
| `vendetta-sealed` | Vendetta · Sealed | VEN | booster-only | no | 0 |

Booster collation: `{packsPerPool:5(6 for vendetta-sealed), packsPerBox:24, commonSlots:7,
guaranteedDomainCommons:true, uncommonSlots:3, rareOrEpicSlots:2, foilSlots:1, tokenOrRuneSlots:1}`
= 14 cards/pack. Odds: `{epicPerPack:0.25, alternateArtPerBox:2, alternateRunePerBox:1,
overnumberedPerBox:1/3, signedOvernumberedShare:0.1, isEstimate:true}` (+Radiance
`ultimateRarePerPack:0.00025, specialArtShare:0.5`). Each set defines canonical runes, number
ranges (base/overnumbered), alternate-art suffixes, special-art codes, excluded codes.
Custom sealed pools are declared as `mix-<setLower><packs>[-…]` (max 12 packs, sets in canonical
order), e.g. `mix-ogn2-unl3` → "Custom · Sealed".
Also embedded (module 34432, site copy): the full deterministic pool generator (seed →
`starterKitId` + `preconDomains` + card instances with `slot`/`sourcePosition`/`isFoil`),
deck-share code decoding (`decodeDeckShareCode`) and the sealed registration library.

---

## 3. Assets

### 3.1 CDN layout

```
https://assets.riftatlas-workers.com/riftbound/
  static/<manifest path>?v=<revision>      ← 187-entry manifest (api/asset-manifest.json)
  cards/[<locale>/]{small-v2|original}/<ID>.webp?v=<16-hex>
  cdn-cgi/image/<transform>/<either of the above>?v=<16-hex or query>
```
All 187 manifest entries are already downloaded under `.recon/site/assets/cdn/`
(31 MB total, 0 missing, 0 extra). Revisions appear in two flavours: the manifest hashes
(`?v=505ed5610a3785dd`) and a couple of date-stamped brand URLs (`?v=20260713` in module 106637,
`/bmc-logo-dark-ui.svg?v=a72591fb9e20bf5…` in module 3-d7t6_l98oo1.js — one asset **not** in the
manifest).

### 3.2 Categories with sizes and consumers

| category | # | size | files / notes | used by |
|---|---|---|---|---|
| `misc-ui` | 11 | 22.9 MB | `board.webp` (175 KB, default playmat), `showdown.webp` 11.8 MB + `showdown-poster.webp` 38 KB, `auto_pay.webp` 5.6 MB + `auto_pay-poster.webp`, `rewind.webp` 5.4 MB + `rewind-poster.webp`, `placeholder.svg`, `point-node-outline.png` 297 KB, `turnem-sideways-logo-v1.webp`, `Discord-Symbol-{Black,White}.png`, `tcgplayer-logo-primary-white.png` | `board.webp` = default playmat texture (also the only static asset the glass-map worker samples); `placeholder.svg` = default `fallbackSrc` for every `GameCardArt`; `.webp`/`-poster.webp` pairs = `<video>` feature demos + poster frames (auto-pay / rewind / showdown explainers); `tcgplayer-logo` + `ads/…` in the card-price/deck-purchase UI; `Discord-Symbol-*` in the account/discord-membership dialogs |
| `cardbacks` | 4 | 2.9 MB | `cardback-blue.png` (821 KB, main deck), `cardback-white.png` (430 KB, rune deck), `cardback-black.png` (747 KB, battlefield deck), `cardback-black-landscape.png` (962 KB) | `2-nry424r0961.js` sleeves context: `deck→blue`, `runeDeck→white`, `battlefield→black`; landscape variant for spectator/opponent hands, deck-preview and sideboard cards |
| `guide-banners` | 9 | 929 KB | 9 article banners | content-driven site pages (referenced only via the manifest; no static call site in either bundle) |
| `tokens` | 10 | 721 KB | `tokens/<Name>.webp` full token art (`Bird, Brush, Gold, Mech, Recruit, Reflection, SandSoldier, ShadowClone, Sprite, Tentacle`) | board tokens + token picker (`tokenImage()`), including `--token-art` cosmetic overrides (`tokenArt` customization) |
| `tokens/thumbs` | 10 | 26 KB | `tokens/thumbs/<Name>.webp` 2–4 KB thumbs | token rail / deck-peek panels (`panelImageUrl`) |
| `icons` | 83 | 576 KB | keyword icons (`accelerate, action, add, ambush, assault[_2|_3], buff, burn[_2|_3], deathknell, deflect[_2|_3], empower(ed), equip, flow, ganking, hidden, hunt[_2], legion, mighty, predict, quick-draw, reaction, repeat, shield[_2|_3|_5], tank, temporary, vision, weaponmaster`) + counts `0.svg`–`8.svg` + `level_3|6|11|16.svg` + domains `body, calm, chaos, fury, mind, order, neutral` + `might, rune, tap, empowered, equip, reaction` (mixed `.svg` for `[n]` numerals/levels, `.webp` for pictograms) | card rules-text inline icons (§1.6), domain pips, level/might badges |
| `sounds` | 31 | 379 KB | `sounds/20260716/*.webm` | §4 |
| `sets` | 5 | 371 KB | `sets/{origins,spiritforged,unleashed,vendetta,radiance}-wordmark.webp` with intrinsic widths 1190/1011/997/725/1069 | lobby/deck-format pickers (module 35qz5rkx7yexy.js `sK` map, keyed by set code) |
| `sealed` | 6 | 312 KB | `sealed/{radiance,unleashed,vendetta}-{booster,prerift-kit}.webp` | sealed format/product cards (id-derived; no static call site) |
| `brand` | 10 | 248 KB | `brand/rift-atlas/{app-icon, lockup-{black,primary,white}, mark-{black,header,hollow-gold,primary,white}, social-card}` | module 106637 exposes them as `J.{appIcon,lockupBlack,lockupPrimary,lockupWhite,markBlack,markHeader,markHollowGold,markPrimary,markWhite,openGraph}` with `?v=20260713`; `markHollowGold` is drawn into the rift scene's card back and the matchmaking fallback |
| `effects` | 1 | 198 KB | `effects/rewind-clock-face-v1.webp` | rewind timeline clock face (module 955437, loaded at `width:640`) |
| `ads` | 1 | 147 KB | `ads/tcgplayer-international-shipping-skyscraper.jpeg` | ad slot |
| `setup` | 3 | 123 KB | `setup/first-player-choice-{self,opponent}-v2.webp` (47/46 KB), `setup/player-left-panel-v1.webp` (30 KB) | initiative/first-player choice panels (module 35qz5rkx7yexy.js `tY`,`tZ`; module 0xawjzm3yjpr1.js `mL`) |
| posters | 3 | 119 KB | `auto_pay-poster.webp`, `rewind-poster.webp`, `showdown-poster.webp` | `<video poster>` for the three feature demos |

Totals: **187 files, 29.8 MiB** (`du` 31 MB). Additionally 37 files (~1.8 MB) that are *not* in the
manifest were downloaded from the second asset tree — see §3.3.

### 3.3 There is a SECOND asset tree (cosmetics / ornaments / badges)

`asset-manifest.json` only covers `/riftbound/static/**` (187 entries). A second, 187-entry
revision map lives in `42xlz6r9r64m2.js` (module 131807, extracted to
`.recon/specs/data/cosmetics-manifest.json`) and covers paths that are requested **without** the
`/riftbound/static` prefix — i.e. **same-origin** against each app (`play.riftatlas.com/<path>` or
`riftatlas.com/<path>`, presumably a Next rewrite to the CDN). Verified live:
`https://play.riftatlas.com/cosmetics/poro/pals.riv` → 200 (51 793 B),
`https://play.riftatlas.com/board-lines/legend/corner-top-left.svg` → 200 (7 153 B).

| group | # | contents | consumer |
|---|---|---|---|
| `/cosmetics/creators/**` | 159 | playmats, deck sleeves and token arts by creator (`eunah`, `glitchedgoober`, `lootpixie`, `luindimas`, `nickangerpng`, `paintedbylibby`, `riftatlas`, `vesomnia`); each product ships `thumb.webp` (640), `preview.webp` (1600), `board-1920.webp`, `board-3840.webp`, `board.webp` (3840 or 5120) / `store.webp` (720), and `variants/<name>/{board,store,thumb}.webp` | board customization (playmat/sleeves/token art) + store |
| `/cosmetics/poro/pals.riv` | 1 | the poro emote Rive file | chat/ping emotes |
| `/board-lines/**` | 8 | `{legend, signature-legend}/corner-{top,bottom}-{left,right}.svg` board corner ornaments | board line cosmetic (`boardLines: "default"` / signature-legend) |
| `/points-rail/**` | 6 + 1 | `{legend, signature-legend}/{frame,goal-frame,inlay}.svg` + `ink-brushwork.png` (1 MB texture) | score rail cosmetic |
| `/membership/**` | 3 | `rift-atlas-membership{,-layers,-layers-dark}.webp` | membership upsell |
| `/metafy/**` | 5 | `astronaut.riv` (mascot Rive), `astronaut.png` poster, `ink-seals.webp`, `poro-heart.svg`, `poro-wave.svg` | Metafy link/membership UI |
| `/ui/**` | 6 | `tier-badges/metafy-*-emblem.webp`, `nameplates/metafy-*-review.webp` (+ templated runtime paths `tier-badges/metafy-<tier>-<unit>-<value>.webp`, `role-badges/<role>-<n>.webp`, `role-badges/staff-<n>.webp`, `community-helper-badges/<a>-<b>.webp`, `convergence-badges/place-<n>-<x>.webp`) | player badge/tier cosmetics |

Responsive variants for a cosmetic are chosen by
`getCosmeticResponsiveSrc(src, width)` (module 131807 + 311656): if the path ends in
`/board.webp` it emits a `srcset` of `thumb.webp 640w, preview.webp 1600w, board-1920.webp 1920w,
board-3840.webp 3840w, board.webp (3840|5120)w`; otherwise sleeves/tokens only expose
`store.webp 720w`. `/board-chain-20260908.webp`, `/apple-touch-icon.png` and several templated
badge paths are referenced but were not reachable (404) at recon time.

Downloaded extras (`.recon/site/assets/extra/`, 37 files, ~1.8 MB): both `.riv` files, all 8
board-line SVGs, all 7 points-rail files, membership/metafy art, tier/nameplate badges, one
playmat thumb+preview, one sleeve store art, one cosmetic token thumb.
Script: `.recon/tools/fetch-extra-assets.py` (1 s sleep per request).

### 3.4 Card image samples (dev fixtures)

`.recon/site/cards-sample/` (16 files, 1.2 MB) — fetched with the exact client URL pattern:
`OGN-001`, `OGN-042`, `OGN-101`, `OGN-252`, `SFD-001`, `UNL-001`, `UNL-T02`, `VEN-001`, `VEN-SP1`,
`RAD-001`, `ARC-001`, `SGN-001` (`small-v2`, all 384×536–538), plus `original/OGN-001` (1030×1438),
`original/VEN-001`, `zh-CN/ARC-001`, `ko/OGN-001`, `fr/RAD-063`.
Extra: nothing else is downloaded on purpose (the 1510-card art set is not mirrored).
`cdn-cgi/` is empty — Cloudflare throttled the transform endpoint (3 verified successes recorded in
§1.8 instead).

---

## 4. Sounds

All sounds are WebM/Opus under `/static/sounds/20260716/`, resolved through the same static-URL
builder (`/sounds/20260716/<file>` → `?v=<manifest revision>`). Volume model (module 608607):
SFX volume 0–200 in steps of 5, default 100, persisted in
`localStorage["riftbound_simulator_sfx_volume:v2"]` (v1 was stored as a squared 0–100 value),
exposed through `useSyncExternalStore`; audio only starts after the first
`pointerup|touchend|keydown` (AudioContext autoplay unlock) and the module keeps a 20-entry
delivery log with degradation back-off `[1000, 3000] ms`.

Sound catalog (key → variants, gain, extras) from module 608607:

| key | files | volume | notes |
|---|---|---|---|
| `baron_nashor` | baron_nashor | 0.12 | |
| `card_autopay` | card_autopay1/2/3 | 0.34 | |
| `card_click` | card_click1 | 0.26 | |
| `card_discard` | card_discard1 | 0.32 | |
| `card_draw` | card_draw1 | 0.30 | |
| `card_exhaust` | card_exhaust1/2 | 0.32 | |
| `card_hover` | card_hover1/2/3 | 0.42 | cooldown 35 ms |
| `card_play` | card_play1 | 0.34 | |
| `card_play_from_hand` | card_play_from_hand | 0.34 | |
| `card_recycle` | card_recycle1 | 0.32 | |
| `chat_message` | chat_message | 0.10 | playbackRate 0.6 |
| `game_rewind` | game_rewind5 | 0.10 | no pitch variation |
| `game_forward` | game_rewind1 + game_rewind2 | 0.34 | re-uses rewind takes |
| `game_start` | game_start | 0.10 | no pitch variation |
| `ping` | ping-v2 | 0.08 | `ping.webm` is shipped but **unused** |
| `score_conquer` | score_conquer1 | 0.12 | |
| `score_end` | score_end | 0.36 | |
| `score_generic` | score_generic | 0.11 | |
| `score_hold` | score_hold | 0.055 | |
| `time_warp` | time_warp | 0.08 | |
| `turn_start` | turn_start | 0.05 | playbackRate 0.9 |
| `ui_click` | ui_click1/2 | 0.24 | cooldown 20 ms |
| `ui_confirm` | ui_confirm | 0.30 | |

Trigger map (board chunk `0xawjzm3yjpr1.js` ~53800–54000, `deriveActionSound(action, ctx)`):

| event | sound |
|---|---|
| `draw_cards`→hand, `take_top_from_deck`/`take_card_from_deck`→hand, `draw_rune`, `rune_batch` containing a draw, conquer that draws a card | `card_draw` |
| `draw_cards`→trash, `move_card`→trash, `move_cards_to_trash_batch`, `chain_resolve`→trash/banished, deck-card→trash | `card_discard` |
| `move_card` hand→board, `chain_add` from hand | `card_play_from_hand` |
| `move_card` board→board, `take_*_from_deck`→board, `chain_add` (non-hand), `create_token`, `duplicate_card`, `dockside_play_banished`, `kharox_play_from_trash` | `card_play` |
| `send_to_deck`, `send_to_rune_deck`, `recycle_deck_peek_card`, `recycle_all_trash_to_deck`, `send_rune_to_deck_bottom`, `recycle_rune_for_floating_energy`, `move_off_board_cards_batch`→deck, `chain_resolve`→deck_top/bottom, `rune_batch` recycling | `card_recycle` |
| `payment_batch` with `paymentGroupOrigin === "auto_pay_button"` | `card_autopay` |
| `toggle_exhausted` (state actually flipped) and `rune_batch` rune-exhaust ops | `card_exhaust` |
| `select_battlefield`, `target_arrow_*`, `equip_card`, `adjust_card_counter`, `clear_card_counter`, `adjust_card_might`, `set_card_label` | `card_click` |
| `submit_mulligan`, `submit_sideboard`, sideboard skip, game-result confirmation, `report_game_result`, `request_bo3_rematch` | `ui_confirm` |
| `choose_first_player`, `choose_single_player_turn_order`, `chain_resolve` (no destination), `roll_initiative`, deck-peek ops, `shuffle_deck`, hand/spectator reveal toggles, `set_stop_at_beginning_phase`, `set_skip_draw_phase`, `set_auto_score_from_hold`, `chain_set_repeat/flow/resolve_vote`, `battlefield_conquer_*` UI ops | `ui_click` |
| `rewind_last_action` | `game_rewind` |
| `forward_last_rewind` | `game_forward` |
| score increase (`adjust_score`, `set_score`, …) | `score_generic`; `battlefield_conquer_confirm` → `score_conquer`; `score_hold` when auto-score-from-hold / `end_turn` / `end_beginning_phase`; `score_end` when crossing the victory score |
| turn number increased in `in_game` | `turn_start` (or `time_warp` when `extraTurnResumePlayerId` is set) |
| room mounts the in-game route | `game_start` (module 35qz5rkx7yexy.js:26606) |
| Baron Pit becomes active | `baron_nashor` (fire-once effect, ~1 s visual follow-up) |
| new chat message from another author | `chat_message` |
| ping placed / pointer hover over an opponent card (with 35 ms cooldown) | `ping` / `card_hover` |
| any rewritten button (`hook` wrapper) | `ui_click`; approve dialog → `ui_confirm`, deny → `ui_click` |

---

## 5. Reference

* Extraction/verification tooling: `.recon/tools/normalize-cards.py`, `build-preset-decks.py`,
  `extract-starters.js`, `fetch-card-samples.py`, `snip.py`, `ctx.py`.
* Everything under `.recon/specs/data/` is machine-generated from the bundles, so it can be
  regenerated after a client update (`/api/version` build id is the drift signal).
