# Chunk deep-dive — cosmetics · emotes/pings/chat · auto-pay · board geometry

Static analysis of prettified Turbopack chunks in `.recon/pretty/playapp/`.
Primary files: `2-nry424r0961.js`, `0ltxa4_95njgw.js`, `1w8d13szpogkp.js`,
`439rnwycqsxxv.js` (line 1090→end), targeted greps of `0xawjzm3yjpr1.js`.
Cross-referenced (module owners): `3-d7t6_l98oo1.js`, `42xlz6r9r64m2.js`,
`2goht72gp0rq8.js`, `2i0ajg8a836h8.js`, `35_5a-hj_uv52.js`, `35qz5rkx7yexy.js`,
`3-2i4k6s343ud.js`, `25vik2nxxo51i.js`, `1ixua9twvm95a.js`, `37nl_3xxi7for.js`.

Module-id → role map (ids are global across chunks):

| id | file | role |
|---|---|---|
| 533812 / 708691 | 2-nry424r0961.js | board customization runtime (playmat/sleeves/boardLines providers + resolvers + preload) |
| 382743 | 2-nry424r0961.js | liquid-lens / glass "frozen paint" svg filter machinery |
| 11023 / 655454 | 2-nry424r0961.js | animation offset scheduler, playmat fracture keyframes |
| 946505 | 0ltxa4_95njgw.js | tiny external store factory |
| 650212 | 0ltxa4_95njgw.js | Poro Rive emote renderer + `EmoteGlyph` export `f` |
| 791101 | 0ltxa4_95njgw.js | hover-preview geometry (358/258/394/284 boxes) |
| 537435/371465 | 0ltxa4_95njgw.js | **presence store** (hover/ping/emote/typing reducer) |
| 299043 | 0ltxa4_95njgw.js | realtime connection message strings |
| 234536 | 0ltxa4_95njgw.js | `DEFAULT_CUSTOMIZATION`, Metafy tiers, sanitize |
| 114032/118154/618260/797897/432014 | 1w8d13szpogkp.js | **gameplay action client / realtime runtime** |
| 495270/356081 | 2i0ajg8a836h8.js | protocol message validator + batch/auto-pay-intent validation |
| 123139/608607 | 2goht72gp0rq8.js | SFX player + volume store + SFX catalogue (`v`) |
| 888811/324758 | 35_5a-hj_uv52.js | **auto-pay planner + payment-batch op builder** |
| 593673 | 3-2i4k6s343ud.js | **emote catalogue** |
| 961201 | 3-d7t6_l98oo1.js | **cosmetics catalogue** (+ artists, entitlement, normalize) |
| 371055 | 3-d7t6_l98oo1.js | entitlement table (cosmeticId → creator/allowed slots) |
| 593285 / 39321 / 94427 | 3-d7t6_l98oo1.js | boardLines/pointsRail gating, clamps, token art |
| 298551 | 25vik2nxxo51i.js | GameCardArt incl. card-back/sleeve renderer |
| 637428 / 426582 / 793143 / 997490 / 929289 | 439rnwycqsxxv.js | board layout math (analysed by other agent — recap only) |
| 190298 | 439rnwycqsxxv.js | **GlassLens** (`ar.f`) — glass-map worker consumer |
| 265496 / 980803 / 510914 | 439rnwycqsxxv.js | glass-map worker bootstrap |
| 643471 | 37nl_3xxi7for.js | glass-map generator (displacement/highlight RGBA maps) |

---

# A. CUSTOMIZATION (file `2-nry424r0961.js` + catalogue chunks)

## A.1 Customizable item types (exact ids)

Four **board slots** (`compatibleSlots` / `allowedSlots`):

```
u = ["deckSleeve", "runeDeckSleeve", "battlefieldSleeve"]     // 3-d7t6:1320, 371055:2036
"playmat"                                                      // single-slot
```

Plus non-catalogue slots held in the same customization document
(`3-d7t6_l98oo1.js` module 961201 export `w`, lines 1823-1900):

```
tokenArt (per token type id), pointsRail ("default"|"ink"|"legend"|"signature_legend"),
boardLines ("default"|"ink"|"legend"|"signature_legend"), hideBoardChrome (bool),
playZoneGlass (bool), playZoneFrost (0..1), playmatIntensity (0.1..1),
playmatContrast (0..1), playmatAnimationsEnabled (bool), showTierBadge (bool),
tierBadgePosition (int), nameplateMode ("default"|"tier"), pinnedBadgeIds (string[]),
emoteWheel (array of 6 emote ids), nameplateTier ("legend"|"signature_legend").
```

Not customizable here: avatar (not found in these chunks), name/tag (convex profile).

## A.2 Cosmetics catalogue (module 961201, `3-d7t6_l98oo1.js` 1125-1902)

Export names: `V`=artists map, `r`=items array, `g`=getItem(id), `y`=label key
(pickerGroup aware), `Z`=getVariant(item, variantId), `Q`=isEntitled,
`B`=resolveSlot(item selection, slot), `w`=normalizeCustomization.

Item shape:

```js
{ id, releasedAt: null | ISO, labelKey, compatibleSlots: [...],
  entitlement: "free" | "standard_customization", publicationState: "published",
  storeImageSrc, artist: <artist object|null>, pickerGroup?: {id,labelKey}, variants: [...] }
```

Variant shapes: `{ id, labelKey, boardImageSrc, previewImageSrc, thumbnailImageSrc,
animatedAccent?: {primary,secondary} }`; inline statics also carry `entitlement`/`imageSrc`.

**Every item id + variants + label keys (verbatim):**

| item id | entitlement | slots | variants (id → labelKey) | releasedAt |
|---|---|---|---|---|
| `table_skin_rift_atlas_starfall` | `free` | playmat | `rift-atlas-starfall-ember`→starfallEmber, `-aether-blue`→starfallAetherBlue, `-sunset`→starfallSunset, `-verdant`→starfallVerdant (each `animatedAccent` e.g. ember `{primary:"#e2553f",secondary:"#f6d365"}`, aether-blue `{"#38c6f4","#5278ff"}`, sunset `{"#bd55f6","#ffb257"}`, verdant `{"#46d58f","#37abbe"}`) | null |
| `sleeve_pack_rift_atlas` | `free` | 3 sleeve slots | `ember`→starfallEmber, `aether-blue`→starfallAetherBlue, `sunset`→starfallSunset, `verdant`→starfallVerdant | null |
| `table_skin_super_galaxy_snack_force` | standard | playmat | `default`→original | null |
| `table_skin_loot_pixie` | standard | playmat | `mint`→variants.mint, `pink`→variants.pink | null |
| `table_skin_loot_pixie_poro_pack` | standard | playmat | `default` | `2026-09-16T00:00:00+02:00` |
| `deck_sleeve_loot_pixie_poro_pack` | standard | 3 sleeves | `default` | `2026-09-14T00:00:00+02:00` |
| `table_skin_vesomnia` | standard | playmat | `default` | `2026-09-24T03:00:00Z` |
| `table_skin_painted_by_libby_evelynn` | standard | playmat | `default` | `2026-10-17T08:48:46Z` |
| `table_skin_painted_by_libby_lulu` | standard | playmat | `default` | `2026-10-17T08:48:46Z` |
| `deck_sleeve_vesomnia_akali` | standard | 3 sleeves | `default` | `2026-09-26T22:38:00Z` |
| `table_skin_luindimas` | standard | playmat | `default`, `sketch` | `2026-09-21T10:00:00Z` |
| `deck_sleeve_luindimas` | standard | 3 sleeves | `default`, `sketch`, `silver`, `green`, `purple` | `2026-09-21T10:00:00Z` |
| `deck_sleeve_void_hunter` | standard | 3 sleeves | `default` | null |
| `sleeve_pack_super_galaxy_snack_force_nova` | standard | 3 sleeves | `orange`, `blue`, `purple` (`pickerGroup`=`super_galaxy_snack_force_sleeves`) | null |
| `sleeve_pack_super_galaxy_snack_force_radiant` | standard | 3 sleeves | `red`, `yellow`, `green` (same pickerGroup) | null |

Label keys (exact): `current.customization.catalog.items.{starfall,
snackForceSleeves,riftAtlasSleeves,superGalaxySnackForce,lootPixiePlaymat,
lootPixiePoroPackPlaymat,lootPixiePoroPack,vesomniaPlaymat,
paintedByLibbyEvelynn,paintedByLibbyLulu,akaliSleeves,luindimasPlaymat,
luindimasSleeves,voidHunter,snackForceNova,snackForceRadiant}` and
`...variants.{original,sketch,silver,green,purple,mint,pink,orange,blue,red,
yellow,starfallEmber,starfallAetherBlue,starfallSunset,starfallVerdant}`.

Artists map `o` (id, slug, displayNameKey `current.customization.catalog.artists.*`,
kind `artist|community`, socials, `madeBy`): `nickangerPng` (slug nickangerpng,
socials X/IG), `eunah` (X @kgynh), `glitchedGoober` (Etsy/IG/X/TikTok),
`poroPack` (kind `community`, madeBy `lootPixie`), `luindimas`, `vesomnia`
(adult:true on X), `lootPixie`, `paintedByLibby`.

**Asset URL pattern** (all relative, served from the APP origin, not the CDN —
verified `GET https://play.riftatlas.com/cosmetics/.../thumb.webp` → 200 image/webp):

```
/cosmetics/creators/<slug>/playmats/<itemId>/[variants/<variantId>/]{board.webp,preview.webp,store.webp,thumb.webp}
/cosmetics/creators/<slug>/sleeves/<itemId>/[variants/<variantId>/]{board.webp,store.webp,thumb.webp}
```

Variant helper for snack-force sleeves (verbatim, 3-d7t6:1310-1319):

```js
function d(e, t, a) {
  let i = `/cosmetics/creators/nickangerpng/sleeves/${e}/variants/${t}`;
  return { id: t, labelKey: a, boardImageSrc: `${i}/board.webp`,
           previewImageSrc: `${i}/store.webp`, thumbnailImageSrc: `${i}/thumb.webp` };
}
```

Every path gets `?v=<revision>` via module 311656 export `G` (`42xlz6r9r64m2.js:937+`,
revision table module 131807 inline JSON, e.g.
`"/cosmetics/creators/riftatlas/playmats/table_skin_rift_atlas_starfall/variants/rift-atlas-starfall-ember/board.webp":"1579c78eb378d1dc"`).
Board playmats additionally have `board-1920.webp` / `board-3840.webp` revisions.

**Board-lines / points-rail / nameplate assets** (module 131807 keys):
`/board-lines/legend/corner-{top-left,top-right,bottom-left,bottom-right}.svg`,
`/board-lines/signature-legend/corner-*.svg`,
`/points-rail/legend/{frame,goal-frame,inlay}.svg`,
`/points-rail/signature-legend/{frame,goal-frame,inlay}.svg`,
`/points-rail/ink-brushwork.png`,
`/ui/nameplates/metafy-{legend,signature-legend}-review.webp`,
`/ui/tier-badges/metafy-{champion,legend,signature-legend,supporter}-emblem.webp`,
`/cosmetics/poro/pals.riv` (Rive file for Poro emotes).

Static (CDN) default card backs (module 633272 static manifest in
`1ixua9twvm95a.js:1535+`, base `https://assets.riftatlas-workers.com/riftbound/static`):
`cardback-blue.png` rev `1fee21bf638b9cb8`, `cardback-white.png` `e60116d5a1e2eddb`,
`cardback-black.png` `46c03a14aaac1029`, `cardback-black-landscape.png` `dc33540653e13e68`,
`board.webp` `505ed5610a3785dd`.

Default card-back chosen by slot (module 533812 `R`, 2-nry424r0961.js:231-237):

```js
function R(L = "deck") {
  return "runeDeck" === L ? "/cardback-white.png"
       : "battlefield" === L ? "/cardback-black.png"
       : "/cardback-blue.png";
}
```

## A.3 Defaults + validation

`DEFAULT_CUSTOMIZATION` — module 234536 export `X` (`0ltxa4_95njgw.js:1721-1736`):

```js
let l = { mode: "default", cosmeticId: null, variantId: null },
  o = { playmat: l, deckSleeve: l, runeDeckSleeve: l, battlefieldSleeve: l,
        hideBoardChrome: !1, playZoneGlass: !1, playZoneFrost: r.w /* 0.3 */,
        playmatIntensity: 0.8, playmatContrast: r.V /* 0.7 */,
        playmatAnimationsEnabled: !0, showTierBadge: !0,
        nameplateMode: "default", pinnedBadgeIds: [] };
```

Clamps (module 39321 exports): `V`=0.7, `w`=0.3, `o`=0.1;
`O`=clamp01→default 0.3 (frost); `Y`→default 0.7 (contrast);
`B`=clamp 0.1..1→default 0.8 (intensity).

boardLines / pointsRail gating (module 593285, `3-d7t6:2182-2258`):
options `["default","ink","legend","signature_legend"]`;
unlock dates `{ ink:"2026-09-30T18:44:00Z", legend:"2026-10-07T22:17:19Z",
signature_legend:"2026-10-07T22:17:19Z" }`; pointsRail dates
`{ legend:"2026-10-11T23:35:00Z", signature_legend:"2026-10-11T23:35:00Z" }`.
Value accepted only if `(tier, required)` matches, or requisites include
`"tier_recognition"` badge (applies to boardLines via export `O`). CSS-var key
builders `boardLines:${e}` / `pointsRail:${e}`.

Metafy tiers (module 234536 export `r`):
`["member","supporter","champion","legend","signature_legend"]`;
`H` → `metafy-tier-${tier}` (null for member/empty); `x` → `metafy-tier-${tier}`
only for legend/signature_legend else `"standard"`.
Poro/nameplate gating: `canUsePoroEmotes = (tier==="legend"||tier==="signature_legend")
&& badges.includes("tier_recognition")` (593673 export `W`, same rule as 393285 `W`).

`normalizeCustomization` (961201 `w`, `3-d7t6:1811-1900`): resolves each slot via
`B(sel, slot)`/`_()`, drops unentitled cosmetics via `i.$` (371055), forces
`mode:"default"` when invalid, clamps numeric fields, keeps default
`playmatIntensity` 0.8, truncates `pinnedBadgeIds` to `t.W` unique non-hidden
badges, `nameplateMode` ∈ `"default"|"tier"`, `tokenArt` via `94427 z`,
`pointsRail`/`boardLines` via `593285 P/Y`.

Sanitize-with-entitlement (module 234536 export `i`, `0ltxa4:1764-1795`):
drops `pointsRail`/`boardLines` that fail date gating, and resets each slot to
`{mode:"default",...}` when `(0,t.$)(cosmeticId, entitlements)` is false;
`hideBoardChrome`/`playZoneGlass`/`playmatIntensity` etc. only retained when the
playmat is custom. `I` = setSlot (auto-enables `playZoneGlass:true` when a
playmat slot switches to custom).

## A.4 Entitlement / purchase flags (module 371055, `3-d7t6:2021-2180`)

- `$` = isCosmeticEntitled(cosmeticId, ownerCreatorId=null, grants=[]):
  true when `entitlement === "free"`, or owner creator match, or a grant matches.
- `W` = creator relation map `{ poroPack: ["lootPixie"] }` (poroPack cosmetics are
  also usable by lootPixie).
- grant scope kinds: `"all"` | `"creator"` (`{creatorId}`) | `"cosmetic"`
  (`{cosmeticId}`), normalized by export `f`; `B`=artistId whitelist
  `["eunah","glitchedGoober","lootPixie","luindimas","nickangerPng","paintedByLibby","poroPack","vesomnia"]`.
- module 94427: token art entitlement `"free"|"standard_customization"`,
  artistId gates like above (exports `B`, `Z`).

## A.5 How a choice is applied at runtime (module 533812)

`resolveBoardCustomization` (`T`, 2-nry424r0961.js:845-887) converts the server
document into the runtime object consumed by the board:

```js
playmat: { src: t.variant.boardImageSrc, intensity: clamp01(0.1..1),
           contrast: clamp01(0..1, dflt .7), animatedAccent: t.variant.animatedAccent,
           animationsEnabled: !1 !== L.playmatAnimationsEnabled },
deckSleeve/runeDeckSleeve/battlefieldSleeve: { src: variant.boardImageSrc },
boardLines / pointsRail: kept only when !== "default",
tokenArt: filtered map,
hideBoardChrome: !!(playmat && L.hideBoardChrome),
playZoneFrost: only when playmat && playZoneGlass → clamp01,
```

Contexts exposed by provider `M` (readers `a`,`y`,`s`,`u`):
`a`=board chrome `"default"|"glass"|"hidden"`, `y`=boardLines value,
`s`=playZoneFrost, `u`=tokenArt map; `t`=the playmat component itself.

- **Playmat** → component `z` (2-nry424r0961.js:496-659): `<div
  className="gb-board-playmat pointer-events-none absolute isolate overflow-hidden
  rounded-[inherit] bg-[rgb(16_24_36)]" aria-hidden="true" data-board-playmat="true"
  data-board-playmat-side={side} style={{opacity, filter:"saturate(..)"}}>` +
  `<picture class="absolute inset-0"><source type="image/webp" srcSet={srcset}
  sizes="100vw">` + next/image `className="h-full w-full select-none object-cover"
  style={{filter:"contrast(0.800)"}}` + SVG "playmat fracture" energy overlay
  (`playmat-fracture-<useId>` linearGradient using `animatedAccent.primary/secondary`,
  24 fracture paths with staggered delays). Contrast math (verbatim 522-539):
  `imageFilter = contrast(c)` with `c = clamp01(L)^2 toFixed(3)`;
  `energyOpacity = c²`; `energyVisible = intensity*c² > 0.01`.
- **Sleeves** → card-back renderer `ef` = module 298551 export `L`
  (`25vik2nxxo51i.js:2662-2762`): `src = explicit ?? (I?.src ?? default(slot))`,
  filter `sleeveFilter` applied only when a custom sleeve exists; default srcs
  from `p.Z`/`p.R` (=533812 `Z`/`R`).
- **boardLines** → DOM contract only: `data-board-lines="<value|undefined>"` on
  cards/piles/zones + `data-top-board-lines`/`data-bottom-board-lines`/
  `data-lines-frame` on the board; `data-lines-controls` on the root. The visual
  frame SVGs (`/board-lines/<folder>/corner-*.svg`) are rendered by the
  customization preview (`43x9j1fvz-ta7.js:1582`) and by CSS on the board.
  `"ink"` renders as PNG slices of `/points-rail/ink-brushwork.png` (module 206752,
  see D.4).
- **pointsRail** → score rail UI (`2pyelkif8rfxt.js:2996-3003`) with
  frame/goalFrame/inlay SVGs per tier; `"ink"` also uses brushwork slices.
- **tokenArt** → context (module 94427): resolveTokenImage by token name incl.
  special-case `"baron pit"` (regex `/^baron\s*pit(?:\s*token)?$/i`).
- **playZoneFrost** → CSS var `--play-zone-frost` (`F` → `{ "--play-zone-frost": L }`).
- **playmatIntensity** → playmat layer opacity + glass lens opacity +
  `--self-glass-intensity` / `--opponent-glass-intensity` (board chunk 63223-63224);
  opponents’ playmats get dimmed via `d` (dim, 817-832):
  `saturation = round(100*(0.5+0.5*t))/100`, `sleeveFilter = saturate((0.5+0.5*t).toFixed(3))`.
- **playZoneGlass/hideBoardChrome** → GlassLens (section D/E) and board chrome
  classes; `hideBoardChrome` → boardChromeStyle `"hidden"`.
- **emoteWheel** → emote wheel component (board chunk `tn`, `ti`/`tl` at 1853-1888);
  `(0, e6.z)(wheel)` normalizes (falls back to 6 defaults).
- **nameplate/tier badges** → identity patch (module 464907 `_`): builds
  `{subscriptionTier, tierBadgePosition, tierTenure, nameplateStyleId, badges}`.

## A.6 Board consumers of customization (board chunk refs, detail §E)

`0xawjzm3yjpr1.js`: 34279 (`rH.t` playmat behind compact score tiles),
34788 (`rH.M` per-player rail with `customization: h?.[id]`),
39548/39561/39579 (trash/banished pile backs per owner),
41686 (`tp.L` card back with `slot:"deck"`), 42615 (`rH.M` token art),
44119/44125 (zone-move flight card backs), 63237/63254 + 63247/63263 (board
top/bottom playmat + GlassLens `ar.f`), 63505/63541 (opponent board / hand),
63857, 64515-64568 (per-player customization map + playmat preloading and
failure fallback).
---

# B. EMOTES / PINGS / CHAT (`0ltxa4_95njgw.js` + module owners)

## B.1 Emote catalogue (module 593673, `3-2i4k6s343ud.js:3215-3479`)

Export names: `p`=all 24, `P`=6 poro (`n`), `I`=poro id array, `V`=18 base (`t`),
`W`=canUsePoroEmotes(tier,badges), `t`=getEmoteLabelKey, `q`=swapInWheel,
`i`=isValidEmoteId, `X`=isValidEmoteWheel, `N`=isRiveEmote, `z`=normalizeEmoteWheel.

**Base emotes (`V`)** — `{id, releasedAt, label, glyph, accentColor, labelKey}`:

| id | label | glyph | accent | labelKey |
|---|---|---|---|---|
| `thumbs_up` | Thumbs Up | 👍 | #f3cf7a | emoteThumbsUp |
| `heart` | Heart | ❤️ | #ff8aa0 | emoteHeart |
| `laugh` | Laugh | 😂 | #ffd36d | emoteLaugh |
| `wow` | No | ❌ | #ff9a9a | emoteNo |
| `cry` | Wait | ⏳ | #d6c08c | emoteWait |
| `angry` | Angry | 😠 | #ff9a7a | emoteAngry |
| `wave` | Hello | 👋 | #f3cf7a | emoteWave |
| `clap` | Well played | 👏 | #ffd36d | emoteClap |
| `thinking` | Thinking | 🤔 | #d6c08c | emoteThinking |
| `surprised` | Surprised | 😮 | #ffe09a | emoteSurprised |
| `sad` | Sad | 😢 | #8acbff | emoteSad |
| `party` | Celebrate | 🎉 | #c5a3ff | emoteParty |
| `sob` | Sobbing | 😭 | #8acbff | emoteSob |
| `skull` | Skull | 💀 | #d7e6ed | emoteSkull |
| `scream` | Scream | 😱 | #a8d7ff | emoteScream |
| `good_luck` | Good luck | 🍀 | #9de3a6 | emoteGoodLuck |
| `thanks` | Thanks | 🙏 | #f3cf7a | emoteThanks |
| `good_game` | Good game | 🤝 | #9ed8ee | emoteGoodGame |

`good_luck`/`thanks`/`good_game` releasedAt `"2026-09-18T00:00:00+02:00"`, rest null.

**Poro emotes (`P`)** — Rive artboards (see B.2):

| id | label | glyph | accent | labelKey |
|---|---|---|---|---|
| `poro_wave` | Poro Hello | 👋 | #8de0dc | emotePoroWave |
| `poro_heart` | Poro Love | ❤️ | #ff91b4 | emotePoroHeart |
| `poro_laugh` | Poro Laugh | 😂 | #ffd580 | emotePoroLaugh |
| `poro_thinking` | Poro Thinking | 🤔 | #c7b0ff | emotePoroThinking |
| `poro_sad` | Poro Sad | 😢 | #8ecfff | emotePoroSad |
| `poro_party` | Poro Celebrate | 🎉 | #ffe299 | emotePoroParty |

Wheel rules: must be **exactly 6 unique valid ids** (`c`: `6 === e.length` and
`new Set(e).size === 6`); default wheel (module export `z` fallback)
`l = ["thumbs_up","heart","laugh","wow","cry","angry"]`. Poro emotes require
`legend|signature_legend` + `tier_recognition` badge (`W`). Emote hotkey, board
chunk 6481-6487: `{ id: "emote_mode", description: "Open the emote wheel",
shortcuts: [{ code: "KeyE" }, { key: "e" }] }`; ping mode `{ id: "ping_mode",
description: "Ping your own cards for the opponent", shortcuts: [{ code: "KeyP" },
{ key: "p" }] }`.

## B.2 Poro Rive renderer (module 650212, `0ltxa4_95njgw.js:139-1158`)

- Export `f` = `EmoteGlyph({id, animated, playback="preview", replayToken})`:
  `(0, n.N)(id)` (Rive/poro) → internal component `p`; else
  `<span aria-hidden>{catalog.find(id)?.glyph}</span>`.
- Rive runtime: `e.A(246031).then(RuntimeLoader.awaitInstance)`; art asset
  `fetch((0, a.G)("/cosmetics/poro/pals.riv"))` (revision-suffixed); single cached
  promise `u`; error string `"Poro animation could not load"`.
- `new Rive({ canvas, buffer, artboard: <emote id>, stateMachine: "Reaction",
  autoplay:!1, enableRiveAssetCDN:!1, shouldDisableRiveListeners:!0,
  layout: new Layout({fit: Fit.Contain}) })`.
- Element attrs: `data-poro-emote`, `data-poro-playback`, `data-poro-rive`,
  `data-poro-reaction`, `data-poro-replay`; playback `"preview"|"burst"`; gated by
  IntersectionObserver + `(prefers-reduced-motion: reduce)` + document.hidden.
- Inline SVG fallback palette (fur/horn/etc): `#fffef8→#fff5e8→#d2e4e8`,
  `#f6d59f→#cb9166→#95624f`, pink/eye families `#ffcd80/#ffd5da/#ffa8ce`, sparkle
  path `M0-9 3-3 9 0 3 3 0 9-3 3-9 0-3-3Z`, heart
  `M0 12C-5 8-19-1-19-11C-19-24-3-25 0-15C4-25 19-24 19-11C19-1 5 8 0 12Z`.
- Emote flight duration (board chunk `r3`, 5590-5592): poro → **3200 ms**, base →
  **1080 ms**; card/emote overlay lifetime `r3(id) + 96`; arc offset
  `(eventId parity ±1) * max(10,min(24,0.02*boardWidth))` px (50598-50600) and
  `offsetXPx/offsetYPx` scaled by 0.18 when reduced flash mode (`y`).

## B.3 Presence store (module 537435/371465, `0ltxa4_95njgw.js:1572-1713`)

Initial snapshot (frozen):
`{hoveredCardIdByPlayerId:{}, cardPingByPlayerId:{}, boardEmoteByPlayerId:{},
chatTypingByPlayerId:{}}` (exports `Q`=snapshot, `W`=createStore, `B`=applyEvent).
Event `type` literals: `hover_state` `{playerId, hoveredCardId}`; `card_ping`
`{playerId, cardPing:{cardId,pingedAt,intent}|null}`; `board_emote` `{playerId,
boardEmote:{emoteId,emoteAt}|null}`; `chat_typing` `{playerId, isTyping}`;
`player_offline` `{playerId}` (clears all four); `clear`.
Ping equality helper `o` compares `{cardId,pingedAt,intent}`; `z`=setIfChanged;
`G`=merge.

## B.4 Wire shapes (module 432014 factory = action client, `1w8d13szpogkp.js`)

Outgoing presence (coalesced ≤ every 750 ms, `1w8d13szpogkp.js:1351-1385`):

```js
socket.send(JSON.stringify({ type: "presence_update", gameInstanceId, ...r }))
// r ∈ { hoveredCardId, hoveredAt, pingedCardId, pingedAt, pingIntent,
//        emoteId, emoteAt, chatTyping }
```

Publishers (exports of the hook): `publishHoverCardId`, `publishCardPing(cardId,
pingedAt, intent)`, `publishBoardEmote(emoteId, emoteAt)`, `publishChatTyping(bool)`.
Pending publish queue flushes `{emoteId,emoteAt}` and `{pingedCardId,pingedAt,pingIntent}`
on join (rP, 1387+).

Incoming `presence_event` → `event.type` ∈
`presence_snapshot {connectedPlayerIds}` | `player_presence {playerId, state:"online"|"offline"}`
| `hover_state {playerId, hoveredCardId}` | `card_ping {playerId, pingedCardId,
pingedAt, pingIntent}` | `board_emote {playerId, emoteId, emoteAt}` |
`chat_typing {playerId, typingTtlMs}` (`1w8d13szpogkp.js:2319-2388`).

Validation (`2i0ajg8a836h8.js` module 495270, lines 798-846): `pingIntent` ∈
`"general" | "trigger_ability" | "discard_target"`; `emoteId` must be a catalogue
id; `typingTtlMs` number|null; playerId/gameInstanceId ≤160 chars.

**Ping TTL**: ping visual TTL = `uo.B` = **2400 ms** (module 105913,
`25vik2nxxo51i.js:7284` exports `B:2400`, `n: e=>1.5*e`, `J`). Incoming pings are
deduped (`pF.z`), newest wins, expiry via `max(0, 2400 - (now - receivedAt))`;
the ping sound plays once per new accepted ping.

## B.5 Chat

- Send (`1w8d13szpogkp.js:3465-3491`): `{type:"chat_send", gameInstanceId, text,
  ...(clientEntryId?{clientEntryId}:{}), ...(judgeCallId?{judgeCallId}:{})}`; text
  normalized by module 201332 `W` = whitespace-collapse + trim, **cap 200 chars
  for players / 1000 chars in the multiline path** (spectator on a judge channel:
  `(0, t.W)(text, a)`); the judge-call question is separately
  `e.replace(/\s+/gu," ").trim().slice(0, 1e3)` (1000). Judge-channel sends
  require `judgeChannels.some(c => c.callId===n && c.canSend)`.
- Server syncs (`2i0ajg8a836h8.js` cases 526-565): `chat_send`, `chat_sync
  {gameInstanceId, chatEntries, chatAccess?}`, `chat_append {gameInstanceId, entry}`;
  judge-adjacent types: `judge_call_create|judge_call_private_create|judge_call_close|
  judge_call_sync|judge_feedback_submit|judge_feedback_result`.
- Entry shape consumed by the board chat panel (`0xawjzm3yjpr1.js:14465-14537`):
  `{ id, kind: "chat"|"judge", entryKind?, judgeCall?, authorPlayerId, author,
  authorRole: "player"|"judge", verifiedJudge:boolean, visibility:"public"|"private",
  judgeCallId?, text, at }`; tones `"verified-judge"|"community-judge"|"player"|"opponent"`
  (`data-chat-entry-tone`); panel attrs `data-chat-panel-root`, `data-chat-message-list`.
- `chatAccess` shape (`2i0ajg8a836h8.js:539-563`): `{canSend, authorId,
  judgeChannels:[{callId, visibility, canSend}]}` (≤32 channels).
- Typing: local timeout mirror of `typingTtlMs`; `chatTyping` presence flag.

## B.6 Sounds per emote/ping/chat (module 123139/608607, `2goht72gp0rq8.js:3799+`)

Catalogue (id → files/volume): `ping` → `sounds/20260716/ping-v2.webm` volume
`0.08`, `pitchVariation:!1`; `chat_message` → `sounds/20260716/chat_message.webm`
(`playbackRate: 0.6`) volume `0.1`; `card_autopay` → `card_autopay1/2/3.webm`
volume `0.34`; also `ui_click` (ui_click1/2, cooldown 20 ms), `ui_confirm`,
`card_hover` (3 variants, cooldown 35 ms), `turn_start`, `game_start`,
`score_*`, `game_rewind*`/`game_forward`, `time_warp`, `baron_nashor`, etc.
File URL: `/sounds/20260716/<name>` → static CDN
`https://assets.riftatlas-workers.com/riftbound/static/sounds/20260716/<name>`.

Triggers (board chunk): incoming card ping → `(0, rl.y)("ping")` (51073); new chat
message by another player → `rl.y("chat_message")` (13062), preload via
`rl.C("chat_message")` (13040); **emotes play no SFX** (Rive only). SFX player
(module 123139): `y`=playSound(id, {volumeScale, cooldownMs, cooldownKey}),
`c`=preloadAll, `C`=primeSound, `f`=diagnostics (AudioContext state, buffers,
recent playback); module 608607: `q`=useSfxVolume hook, `p`=volume fraction,
`D`=200 max, `C`=0, `n`=5 step; localStorage key
`riftbound_simulator_sfx_volume:v2` (v1 migrated with a square curve).

---

# C. AUTO-PAY

Auto-pay is **not** a distinct action type. It is one `payment_batch` action with
`paymentGroupOrigin:"auto_pay_button"` plus an `autoPay` intent that lets the
client optimistically re-derive it and lets the server validate it.

## C.1 UI flow (board chunk `0xawjzm3yjpr1.js`)

1. Hover a hand/champion/banished card → `fs()` (47826-47898) calls
   `l9({roomPhase, busy, inFlight, card, board, normalBattlefieldCount})` →
   `{canAutoPay, hasPlan, plan}`; when affordable sets `autoPayUi.previewCardId`
   (reducer case `set_auto_pay_preview_card_id`, 47670) → card poses show
   `autoPayPreviewExhausted/Recycled/RecycledExhaustedCardIds` (from plan summary
   `rN.L`), board gets `data-pose-preview`.
2. Click / confirm (`handleAutoPayCard`, 47862-47897): rebuild plan, ops
   `(0, rN.Y)(plan)`, clear preview, `set_auto_pay_in_flight(true)`, dispatch:

```js
s({ type: "payment_batch", operations: t, paymentGroupOrigin: "auto_pay_button",
    autoPay: { purpose: "play", zone: e, cardId: c.id } });
"dispatched" === r.status && (await r.completion);
```

3. Empower variant (`gK`, 60480-60536): plans from card text (`rN.p`) with
   `risenAltarDiscount: (0, rk.b)(e, zone, card)`, appends final
   `{type:"set_card_label", zone, cardId, slot, label}` op,
   `autoPay.purpose:"empower"`, origin `"auto_pay_button"`.
4. Guard `l9` verbatim (19061-19069):

```js
function l9(e) {
  let { roomPhase: t, busy: r, inFlight: a, card: n, board: o } = e;
  if ("in_game" !== t || r || a || n.hidden || !o)
    return { canAutoPay: !1, hasPlan: !1, plan: null };
  let i = (0, rN.q)(o, (0, rN.l)(n), { normalBattlefieldCount: e.normalBattlefieldCount });
  return { canAutoPay: !!i?.canAutoPay, hasPlan: null !== i, plan: i };
}
```

5. Local state machine: `hL` reducer cases `set_auto_pay_preview_card_id` and
   `set_auto_pay_in_flight` → `state.autoPayUi = { previewCardId:null, inFlight:false }`
   (47605). `dispatchBoardActionDirect` statuses `"blocked"|"handled_locally"|"dispatched"`
   (54105-54131); `"dispatched"` returns `{completion}` which callers await
   (`.catch(hT)`/`.catch(hE)` = no-op handlers, 47585-47586).
   `inFlight` also blanks the auto-pay button (data attributes) and gates `l9`.

## C.2 Cost model & plan (modules 324758/888811, `35_5a-hj_uv52.js`)

- Card cost normalization `n.l` (x): `{energyCost, powerCost, domains, cardCode,
  name, type}` from card fields, falling back to the embedded DB (module 26865 `W`).
- Domains set: `["body","calm","chaos","fury","mind","order"]`; `unknown|neutral`
  filtered; rune domain fallback from `"<domain> rune"` name regex.
- Card text cost parser (`u`): `[N]` → energy, `[rune]` → null power req, domain
  tags → power requirements; alternatives split on `/\s+or\s+/i`; rejects lines
  with extra text. Two header discount rules:
  - `/ability\s+costs\s+\[(\d+)\]\s+less\s+if\s+you\s+control\s+(\d+)\s+or\s+fewer\s+runes/i`
  - `/ability\s+costs\s+\[(\d+)\]\s+less\s+for\s+each\s+rune\s+you\s+control/i`
- `risenAltarDiscount` (`rk.b`=S, 1651-1659): true when the zone is a normal
  battlefield whose selected battlefield title (lowercased) is `"risen altar"`,
  the card is exhausted (`t._`), and no brush is set; the card then gets
  alternatives: `energyCost-1`, or drop one power requirement.
- Plan (`rN.q`=y, 1285-1521), resource priority:
  1. `floatingEnergy`/`floatingPower` first: `min(cost, floating)`.
  2. Untapped rune-area runes: energy runes (`i.E`), energy+power runes with
     matching domain (`i.x`), power runes (`i.y`); plus card abilities:
     conduit (`i.x`), power-conduit (`i.I`), gold (`i.y`), seal/legend (`i.j`)
     with exact legend text `"use only to play spells"` /
     `"use only to play gear or use gear abilities"`.
  3. `canAutoPay: 0 == B - D && 0 === ed` (no unsatisfied residual).
- Operations builder (`rN.Y`=w, 1520-1585), in order:
  `adjust_floating_resource{resource:"energy",delta:-n}` →
  `toggle_exhausted{zone, cardId, expectedExhausted:!1}` ×(conduits,
  energy+power, energy runes, seal, legend, gold) →
  `adjust_floating_resource{resource:"power",delta:-n}` →
  per power rune: `recycle_rune_for_floating_energy{cardId}` or
  `send_rune_to_deck_bottom{cardId}`.
- Preview summary (`rN.L`, 1606-1630): `{exhaustedCardIds:Set,
  recycledCardIds:Set, recycledExhaustedCardIds:Set, floatingEnergyDelta:
  granted - energyFromFloating, floatingPowerDelta: -powerFromFloating}`.
- Batch limits (module 356081, `2i0ajg8a836h8.js:16-103`): max **128** ops;
  `payment_batch`: `toggle_exhausted` (boolean `expectedExhausted`, valid zone via
  780855 `S`), `set_card_label` (valid zone `u`, valid slot `n.O`, string label);
  `floating_resource_batch`: `clear_floating_resources`, `adjust_floating_resource`
  (energy|power, finite non-zero delta), `send_rune_to_deck_bottom`,
  `recycle_rune_for_floating_energy`; `rune_batch`: `draw_rune`, `set_rune_exhausted`.
  Errors: `` `Invalid ${kind.replaceAll("_"," ")} operations.` `` /
  `"Expected exhaustion state is required."` / `"Invalid card label slot."`
- Auto-pay intent validator (356081 `L`): non-empty `cardId` and either
  `purpose:"play"` with `zone ∈ {"hand","champion","banished"}`, or
  `purpose:"empower"` with a valid label zone (`r.u` zip `u`).

## C.3 Action envelope & error codes (module 797897, `1w8d13szpogkp.js`)

Exports: `a` = `"auto_pay_unavailable"`, `K` = `"Auto-pay could not complete
because the card or available resources changed. No resources were spent."`,
`M` = `class AutoPayUnavailableError extends Error` (`name:"AutoPayUnavailableError"`).

Also module 114032 heartbeat: `{type:"ping", gameInstanceId, sentAt}`/`pong`
(idleIntervalMs 20000, timeoutMs 8000), and 118154 diagnostics counters
(`staleActionRejections, droppedActionQueues, reconnects, resyncs, ackTimeouts,
heartbeatTimeouts, connectionErrors, stalledConnections, snapshotCanceledIntents,
lastRoundTripMs, lastSocketClose`).

Send path `sendGameplayAction` (3891-4077): serializes `{type:"action_intent",
gameInstanceId, action, actorPlayerId, clientActionId, clientBaseSequence}`;
single in-flight action (`GameplayActionPendingError` "Gameplay action already
pending."); ack timeout 5000 ms with up to 2 resends, then reject
`GameplayActionOutcomeUnknownError` "The realtime room did not acknowledge the
action."; liveness probe at 2000 ms; returns `"committed"|"noop"`. Branch-epoch
mismatch → `GameplayActionStaleStateError` ("Realtime state changed unexpectedly.
Resyncing the live match.", `retryReady` flag) and reconnect/resync
(`resume_game` + `unsettledAction {clientActionId, actorPlayerId}`).

Server error handling (3272-3290, verbatim):

```js
e.reject(
  t.code === L                                  // "auto_pay_unavailable"
    ? new W()                                   // AutoPayUnavailableError
    : "forward_unavailable" === t.code
      ? (((r = Error(t.message)).name = J), r)  // GameplayForwardUnavailableError
      : Error(u.userMessage ?? t.message));
```

Other codes: `D.L="stale_action_state"` (module 495270 in `2i0ajg8a836h8.js`:
`D`="activity_history_seated", `M`="control_superseded", `L`="stale_action_state";
`g`=4007, `y`=4008 close codes, `P`="match"); `"runtime_persistence_failed"` +
`mutationClass:"reject_retryable"` → `GameplayActionOutcomeUnknownError`; mutation
classes `"reject_invalid"|"reject_retryable"|"resync_required"`; auth codes set
`{"connection_reauthorization_required","player_not_registered","seat_control_denied","spectator_session_denied"}`;
`account_banned`, `room_not_found`, `bootstrap_required|bootstrap_failed`,
`runtime_restore_failed`, `judge_call_rate_limited` (uses `retryAfterMs`);
error frames validate `retryable`, `retryAfterMs`, `authoritativeSequence`.

User-facing mapping (`35qz5rkx7yexy.js:2889-2899`):

```js
function rD({ rawError: e, fallbackMessage: t, environment: r }) {
  return e instanceof rR.M ? rR.K
    : "production" === r ? t
    : e instanceof Error && e.message.trim().length > 0 ? e.message
    : "string" == typeof e && e.trim().length > 0 ? e : t;
}
```

Optimistic re-derivation (`35qz5rkx7yexy.js:24443-24452`):

```js
if ("payment_batch" === a.type && void 0 !== a.autoPay) {
  let l = (0, cr.L)(a.autoPay) ? (0, cE.M)(t, i, a.autoPay) : null,
      o = l ? e(t, r, l, n) : { nextState: t, changed: !1, handled: !0 };
  return o.changed && l ? { ...o, appliedAction: l } : { ...o, errorMessage: rR.K };
}
```

So when the client cannot re-derive/apply the batch, it shows the canned message
and spends nothing. `"auto_pay_button"` batches are excluded from floating-power
granting (`grantsFloatingPower: "auto_pay_button" !== a.paymentGroupOrigin`, 22920).

Sound feedback (board chunk `cV`, 53852-53855, verbatim):

```js
case "payment_batch":
  return "auto_pay_button" === e.paymentGroupOrigin ? "card_autopay" : null;
```

`card_autopay` → `card_autopay1/2/3.webm` volume 0.34. The auto-pay button click
plays `ui_click`. Failure path: no dedicated SFX; the in-flight spinner is driven
by `autoPayUi.inFlight`, and the failure message comes from the error mapper above.
---

# D. BOARD GEOMETRY (file `439rnwycqsxxv.js`, line 1090→end)

> Lines 1-1088 (modules 637428/426582/997490/929289/793143) were analysed by
> another agent. The constants that item D names are in that range; recap first,
> then everything from 1090.

## D.0 Recap of modules in lines 1-1088

- module 426582 exports: `R`=1.6714284, `Z`=1.2, `e`=1.392857, `t`=5.2
  (rem card width), `i`=computeStep, `a`=spreadLayout (weights:
  `exhaustedExtraRem` dflt 1, `prevWeight`/`currentWeight` 0.65, edge-inset opts),
  `v`=prefix sums, `k`/`y`/`l`/`T` variants; helper `n(e,t) = (e/5.2)*t`
  (rem→px scale by 5.2rem card width).
- module 637428 exports (lines 1023-1085) — verbatim numbers:
  `S`=**600**; `G`=**{ beside: 1.8, above: 4 }**; `o`=tablet layout
  (`"touch"===t && e.widthPx>=1024 && e.heightPx>=600`); `Z`=`H(board, mode)`
  (phone-portrait detection, signature `(board:{widthPx,heightPx}, mode) => bool`);
  `f`=deriveLayout (see below); `a`=resolveInputMode
  (`"touch"` when `widthPx<1440 || heightPx<800`, else `"desktop"`);
  `M`=phonePortrait fallback.
- module 637428 `f` verbatim core (1041-1067):

```js
function ({ board: e, field: t, mode: n, cardHeightRem: r, cardSizeScale: i,
           rootRemPx: a, usesCompactOpponentRail: o,
           phonePortrait: l = H(e, n) }) {
  let d = "touch" === n,
    s = e.widthPx <= 850 || l,
    u = d && e.widthPx <= 1e3 && e.heightPx >= e.widthPx,
    c = r * i * a,
    h = 2.12 * c + L.above * a,
    f = t.heightPx - h - (o ? 0.3 * t.heightPx : h),
    p = d && t.widthPx <= 1e3 && f >= 1.5 * c;
  return { arrangement: l ? "phone-portrait" : "standard",
           density: s ? "narrow" : "regular",
           short: e.heightPx <= 580, tightRail: e.heightPx <= 420,
           identity: u ? "raised" : "corner",
           handControls: p ? "above" : "beside",
           reserveHandEnd: d && (e.widthPx >= 1e3 || u) };
}
```

- module 793143: hand fan layout (`--hand-fan-bottom-overflow`,
  `--card-width`, `--card-height` CSS vars; export `Q` = `t ? e*n+_ : e`).

## D.1 module 112691 (1088-1385) — hover-card preview layer

Export name literal `"HoverCardPreviewLayer"` (memo + forwardRef with imperative
`{show, clear}`; `show(card, x, y, landscape, rotationDeg, sizeVariant, scale)`).
Uses module 791101 geometry:
- `c({landscape, rotationDeg, sizeVariant, scale})` → outer/image box; constants
  **358×258 (landscape default), 394×284 (battlefield), 258×358 (portrait)** rem×scale;
  rotation 90/270 swaps width/height.
- `m({viewportWidth, viewportHeight}) = Math.min(1.16, Math.max(1,
  Math.min(vw/1600, vh/900)))`.
- `u(box)` → `${outerWidth}px`; `I({vw,vh,previewSizeScale})` size string.
- `d({targetRect, horizontalAnchorRect, previewWidthPx, previewHeightPx,
  viewportWidth, viewportHeight, preferredSide="right"})` → `{x, y, side}` with
  **18 px gap** from the target, **12 px** min viewport margin, flips
  `right ↔ left` when clipped.
- Image slot: `X = E.landscape ? "hover" : "preview"` (line 1214); art rules via
  module 192422 `k(card, {initialImageLocale, previewSession})`.

## D.2 modules 119583 + 190298 (1787-2273) — GlassLens (+ worker bootstrap)

`119583.f` = boot hook for the glass-map subsystem: `t.E.current || (0, n.f)();
let [e] = useState(t.d.current)` (t = module 307216 runtime state; n = module
295506 init). Returns availability flag.

`190298.f` = **GlassLens** component (board chunk `ar.f`), props `{customization,
glass, className, sizes}`:
- enabled only when `customization.playmat && glass && playZoneFrost != null`
  and `CSS.supports("clip-path", 'path("M 0 0 H 1 V 1 Z")')`.
- Gathers pane shapes from the registry (`glass.panes()`; module 382743 —
  `{element, pseudo}` incl. `::before`), plus ResizeObserver; shape extraction
  (`E`) computes per-pane `{x,y,width,height,radii[4]}` from
  `getBoundingClientRect()` + computed border radii, scaled by
  `scale = offsetWidth / rect.width`; marks `covered` panes and the `skewed` flag
  when `|scale - offsetHeight/rect.height| > 0.01 * scale`.
- Two-tier rendering:
  - first paint / non-worker: `(0, c.F)(shapes)` clip-path + main-thread map
    (`l._({width, height, shapes})` → canvas `toDataURL()`), LRU `Map` cap **4**;
  - resize (180 ms debounce): `B.render({width, height, shapes})` via worker;
    fallback to main thread when `Worker`/`OffscreenCanvas` unavailable; worker
    timeout **10000 ms** → falls back forever (`v()`), geometry change debounce
    **250 ms**, skewed retry cap **40**.
- Worker protocol: `new (e.r(265496))(Worker, { type:"module", name:"board-glass" })`
  (module 265496 = next-worker factory, module 510914 = its shim that encodes
  `#params=` / `SharedWorker ?params=` with `NEXT_DEPLOYMENT_ID`,
  `NEXT_CLIENT_ASSET_SUFFIX`). `postMessage(geometry)`; reply `{map}` or
  `"failed" in data`.
- Output: `{clipPath, covered, map:{displacement, highlight (blob URLs),
  scale, dispose()}}`; board chunk toggles `data-glass-mirrored` (module 382743
  `M` = `"data-glass-mirrored"`) on covered panes.
- DOM (verbatim 2142-2154):

```jsx
<div ref aria-hidden="true" data-board-glass="true"
  className="gb-board-glass pointer-events-none absolute overflow-hidden rounded-[inherit]"
  style={{ ...(0, o._)(frost), clipPath: k?.clipPath ?? "inset(50%)",
           opacity: t.playmat?.intensity }}>
```

- SVG filter `id="board-glass-<useId>"` (feGaussianBlur `stdDeviation = frost² *
  16` → `feImage displacement` → 3× `feDisplacementMap` + `feColorMatrix`
  channel isolation → arithmetic composites → `feImage highlight` → saturate 5 →
  `in`/`over` glint/sheen). Channel matrices verbatim (1836-1852):

```js
{ channel:"red",   bend: 1 + l.j, matrix:"1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" }
{ channel:"green", bend: 1,       matrix:"0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0" }
{ channel:"blue",  bend: 1 - l.j, matrix:"0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0" }
```

  (`l` = module 643471; `l.j` = **0.08**, `l._` = map generator, `l.i` = **0.42**.)
- Optics child: `className:"gb-board-glass-optics absolute inset-0"`,
  `style={{ "--glass-lens": "url(#<id>)" }}`, renders the playmat again
  (`o.t` = module 533812 playmat) with `energy:!1`.
- Idle/disabled state clears to `null`; `t.playmat?.intensity` drives the layer
  opacity (see §A.5).

### D.3 module 980803 / 265496 (tail, 2427-2443) — worker asset + bootstrap

```js
980803, (e) => { e.q("/_next/static/immutable/media/glass-map.worker.2yeqpt07c2cj2.ts"); },
265496, (e) => { e.v(e.r(510914).f(
  "static/immutable/chunks/turbopack-worker-17xj571juv_5b.js",
  ["static/immutable/chunks/37nl_3xxi7for.js",
   "static/immutable/chunks/turbopack-2flrc96g-xrc4.js",
   "static/immutable/chunks/turbopack-1cvbnb3nlabgn.js"])); },
```

The worker runtime module 643471 (`37nl_3xxi7for.js:3+`) exports `j`=0.08,
`i`=0.42, `_` = `makeGlassMaps({width, height, shapes})` →
`{displacement, highlight, scale}` (`Uint8ClampedArray` RGBA; bezel
`min(52, w/3, h/3)`; superellipse normal profile `h(t) = (1-(1-t)^4)^0.25`,
`e = -sqrt(3)/2`; RG = normal x/y centered at 128; highlight = max depth row;
returns `null` when depth 0).

## D.4 module 206752 (1386-1516) — ink-brushwork rail slices

Exports `j` = `"/points-rail/ink-brushwork.png"`; `C(values, vertical, width,
height)` → `{ slices: [...], crop }`. Constants (verbatim):

```js
t = [[679,732],[850,662],[664,582],[848,507],[676,431],[850,357],[682,275],[851,209],[769,108]];
n = [149,294,449,602,756,911,1070,1228,1395];  r = [901,901,901,903,903,901,901,901,900];
u = vertical ? Math.min(h/145, w/(150*Math.max(1,len))) : (0.44*w)/174;
thickness w = vertical ? (x gap) : Math.min(2.5, 0.22*|D.y - n.y|);
crop = vertical ? {x:0,y:826,w:1536,h:156} : {x:528,y:18,w:460,h:796};
```

Slice entries `{x, y, width, height, fadeStart, fadeEnd, matrix[6]}`; used by the
score/points rail renderer (`2pyelkif8rfxt.js:215,255,396`) for `"ink"` styles;
rendered as an SVG `<image href="/points-rail/ink-brushwork.png?v=...">` masked
by the slices.

## D.5 Remaining modules in 1090→end

| module | exports | what it returns / constants |
|---|---|---|
| 439355 | `x(count)` = `{ duration: Math.min(2100, 680 + (Math.max(1,Math.abs(count)) - 1) * 310) }`; `k(t)` = piecewise ease over `[0.14, 0.6, 0.4]` phases with sine blends (`n = 1 - (0.14+1-0.6)/2`) | roll/score animation timing |
| 675519 | `p`=100, `j`=25, `T`=5, `d()` = `[value, setValue]` hook | opponent-cosmetics dim %; localStorage `riftbound_simulator_opponent_cosmetics`, clamp `Math.min(100, Math.max(25, v))` rounded to 5 |
| 807795 | `j(a,b)` id-difference, `f(a,b,epsilon=0.5)` threshold, `g` no-op | list/number diff utils |
| 241762 | `i` = badge catalogue (`...425078.c`, `k(1e4)`, `a.j/a.z`, `a.y`, `r.S`, `{id:n.y,label:n.A.pillar,communityHelperRank:"pillar"}`), `J`=false, `K` noop, `v()` hook | local (self) customization snapshot: parses JSON from a store and merges over `DEFAULT_CUSTOMIZATION` + `normalizeCustomization` |
| 464907 | `u(customization, identity, selection)` preview for `kind ∈ token|emote|pointsRail|boardLines|board|nameplate`; `_(customization, tier, badges, tenure)` identity patch `{subscriptionTier, tierBadgePosition, tierTenure:{unit:"month",value:1}, nameplateStyleId:"metafy-tier-<tier>", badges}` | customization screen logic |
| 481874 | lucide `circle-check` icon component | 24×24, aliases `check-circle-2` |
| 836275 | lucide `circle-x` icon | aliases `x-circle` |
| 151112 / 726264 | lucide `settings-2` icon; `f(reason)` maps `{private_deck→"playOnBlockedPrivateDeck", guest_deck→"playOnBlockedGuestDeck", series_in_progress→"playOnBlockedSeries", multiplayer→"playOnBlockedMultiplayer"}` else null | UI atoms |
| 985406 / 593358 | lucide `swords` / `undo-2` icons | UI atoms |
| 510914 | `f(WorkerRef, url, deps)` worker-constructor shim | handles `SharedWorker` vs `Worker`, injects `#params=` JSON |

---

# E. Board chunk (`0xawjzm3yjpr1.js`) — targeted grep results (item 5)

`wc -l` = 65 017. Raw hit counts: `playmat` 17, `boardLine(s)` 16,
`board-line` 8 (subset/duplicates of boardLines), `customization` 19,
`sleeve` **0**, `cardBack`/`cardback` 6, `glass-map` 0, `glassMap` 0,
`offscreen` (case-insensitive) 0, `postMessage` 0, `OffscreenCanvas` 0,
`worker` 0.

### E.1 playmat (17 hits)

- 26891: `(eI ? "gb-playmat-zone-ornament" : "gb-playmat-zone-glass")` — zone
  fill class; `tk = "glass" === tv` (boardChromeStyle context, 26468-26473).
- 26897: `tw && "gb-playmat-zone-hidden-chrome"` (`tw = "hidden" === tv`).
- 26898: `null !== t_ && "gb-playmat-zone-frosted"` (`t_` = playZoneFrost for
  "base"/"runeArea" zones only, 26472).
- 26985 `tk && "gb-playmat-zone-header"`; 26998 `"gb-playmat-zone-count"`;
  27105 `"gb-playmat-zone-count-chip"` (zone header/counter pills).
- 30903: `null !== m && "gb-playmat-resources-frosted"` + `style: (0, rH._)(m)`
  (`--play-zone-frost`) on `[data-player-area="resources"]` grid.
- 42670 / 42840: battlefield card-row wrappers `u && "gb-playmat-zone-hidden-chrome"`
  for opponent/self rows (u/m = hideBoardChrome per side).
- 61765-61768: `y_ = !!yk.playmat?.src.trim()`, `yj = !!yC?.playmat?.src.trim()`,
  `yI = !!(y_ && yk.hideBoardChrome)`, `yP = !!(yj && yC?.hideBoardChrome)`
  (self/opponent custom-playmat + chrome-hidden flags).
- 63223-63224 (verbatim): `"--self-glass-intensity": yk.playmat?.intensity ?? 1`,
  `"--opponent-glass-intensity": yC?.playmat?.intensity ?? 1` on
  `[data-board-play-area]`.
- 63237/63245 + 63254/63262 (verbatim):

```jsx
(0, a.jsx)(rH.t, { side:"opponent", customization:yC,
  className:"inset-x-[0.18rem] top-[0.18rem] bottom-1/2 z-0 rounded-t-[0.42rem]",
  loading:"eager", fetchPriority:"high" }),
(0, a.jsx)(ar.f, { customization:yC, glass:yN,
  className:"inset-x-[0.18rem] top-[0.18rem] bottom-1/2 z-0 rounded-t-[0.42rem]" }),
(0, a.jsx)(rH.t, { side:"self", customization:yk,
  className:"inset-x-[0.18rem] top-1/2 bottom-[0.18rem] z-0 rounded-b-[0.42rem]",
  loading:"eager", fetchPriority:"high" }),
(0, a.jsx)(ar.f, { customization:yk, glass:yS,
  className:"inset-x-[0.18rem] top-1/2 bottom-[0.18rem] z-0 rounded-b-[0.42rem]" }),
```

  `rH` = module 533812 (file 1), `ar` = module 190298 (file 4, GlassLens),
  `yS`/`yN` = `(0, rH.s)`+`uS`/`uN` glass availability flags (61769-61770).
- 64515-64568: customization map build
  `s.boardCustomizationsByPlayerId?.[id] ?? (0, rH.T)(id.identity?.boardCustomization)`;
  playmat preload `(0, t6.s)(sources, ...)`; on failed source:
  `{ ...r, playmat: void 0, hideBoardChrome: !1 }` (64567-64568).
- 34279: compact score-table tile playmat backdrop
  `<rH.t customization={t} className="inset-[0.08rem] z-0 rounded-[0.22rem]"
  sizes={t6.r} loading="eager" />`, and 34789 per-player rail
  `<rH.M customization={h?.[e.id]}><up .../></rH.M>`.

### E.2 boardLines / board-line (16 hits)

- 24463 & 24683: pile `section`/`button` — `"data-board-lines": ex`, where
  `ev = (0, rH.y)()`; `ex = (0, rH.w)(ev)` (24456-24458; `rH.w` maps
  `"default" → undefined`).
- 27768: board zone `section` (drop-zone root) `"data-board-lines": E`.
- 40295/40339/40378/40407/40537: battlefield-might overlay pipeline; portal
  element gets `"data-board-lines": f` (40537) plus
  `"data-might-glass": null !== k ? "true" : void 0` (40538), class
  `"battlefield-might"`, anchor class `"battlefield-might-anchor invisible"`,
  surface `"battlefield-might-surface"`, glint `"battlefield-might-glint"`,
  number `"battlefield-might-number"`.
- 42259-42264 (verbatim):

```jsx
"data-top-board-lines": rR,   // rR = (0, rH.w)(k?.boardLines)  → opponent half
"data-bottom-board-lines": rM, // rM = (0, rH.w)(_?.boardLines) → self half
"data-lines-frame": (rR || rM) && !s ? "true" : void 0,
```

- 42665 / 42835: battlefield card-row drop zones (opponent/self)
  `"data-board-lines": rR` / `rM`.
- 63074: board root `"data-lines-controls": (0, rH.w)(yk.boardLines)` next to
  `data-board-arrangement`, `data-board-density`, `data-board-short`,
  `data-board-tight-rail`, `data-board-measured`, `data-tablet-layout` (63072-63095).

### E.3 cardBack (6 hits)

- 24218-24219: pile props `cardBackImageUrl: H`, `cardBackSlot: F`
  (default `"deck"`, 24242); 24346-24348:
  `alt: eg("sim.board.namedCardBack", { name: D })`,
  `className: "cardBack absolute left-0 top-0 border-transparent shadow-none"`.
- 26202: card flip back
  `(0, a.jsx)(tp.L, { slot: h ? "runeDeck" : "deck", insetPx: 0,
  alt: Z(h ? "sim.runeCardBack" : "sim.cardBack") })` (`tp` = module 298551).
- 30870: rune pile `cardBackSlot: "runeDeck"` (`label: s("sim.runeDeck")`,
  `dataPileSlot: "runeDeck"`, `prominentCount: true`).
- 42524: hidden battlefield placeholder
  `sources: ["/cardback-black-landscape.png"]`, `diagnosticKind: "card-back"`,
  `alt: e6("current.hiddenBattlefieldPlaceholder")`, `sizes: "240px"`, `quality: 75`.
- 51512: hit test `(t.querySelector(".cardBack") ?? t).getBoundingClientRect()`.

### E.4 customization (19 hits)

34280, 34789, 39548 (`rH.M` wrapping hand/trash), 39561, 39579 (trash/banished
pile `en = "opponent" === owner ? z : T`), 41689 (`tp.L` card back with
`customization: r` and `slot: "deck"`), 42616 (`rH.M customization={_}` around
token tray), 44119/44125 (`rH.M customization={l}` for zone-move flights),
63239/63246/63263/63323/63326 (board areas), 63506 (`rH.M` opponent board),
63542 (`rH.M` self hand), 63858 (side panel), 64515-64568 (map build above).
Sleeve consumption lives in module 298551 (`25vik2nxxo51i.js`), verbatim
2662-2708:

```js
j = (0, p.Z)(C),                              // default/context cardback for slot
E = (0, p.H)(C),                              // sleeveFilter when sleeve is custom
r = void 0 === y ? void 0 : (0, p.S)(y, C),   // custom sleeve src for slot
i = m ?? (void 0 === y ? j : (I?.src ?? (0, p.R)(C))),
A = void 0 === y ? E : I ? y?.sleeveFilter : void 0,
// <div className="absolute rounded-[inherit] overflow-hidden pointer-events-none"
//      style={{inset:"1px"}}><Image className="h-full w-full object-cover select-none"
//      style={A ? {filter:A} : undefined}/></div>
```

(`p` = module 533812; `I` = customization passed in; `m` = explicit `src`.)

### E.5 sleeve / glass-map / glassMap / offscreen / postMessage

- `sleeve` — 0 hits in the board chunk.
- `glass-map` / `glassMap` / `offscreen` (any case) / `postMessage` /
  `OffscreenCanvas` / `worker` — 0 hits in the board chunk. The only glass wiring
  visible from this chunk is `(0, rH.s)()` (playZoneFrost context) and
  `ar.f` = module 190298 (GlassLens, file 4); the worker + offscreen canvas code
  lives exclusively in file 4 / the worker chunks.
- Emote-related DOM in the board chunk: `"data-board-emote-sender-player-id"` /
  `"data-board-emote-player-color"` (5848-5849), overlay lifetime `r3(id) + 96`
  (50625-50631), plus the `emote_mode`/`ping_mode` hotkeys (§B.1).

---

## Surprises / gotchas

1. **Auto-pay is not an action type**: it is a `payment_batch` with
   `paymentGroupOrigin:"auto_pay_button"` and `autoPay:{purpose:"play"|"empower",
   zone, cardId}`. The client re-derives the batch locally for optimistic apply
   (`cE.M` = module 888811 `M`) and shows the canned message if it changed.
   `"auto_pay_unavailable"` is the only server code mapped to a dedicated Error
   class, and its consumer is the generic error message mapper `rD`.
2. **Cosmetic art is same-origin** (`https://play.riftatlas.com/cosmetics/...`,
   verified 200) with `?v=` revisions; only static UI (cardbacks, sounds, icons,
   board.webp) comes from `assets.riftatlas-workers.com/riftbound/static`.
3. **Poro emotes are Rive artboards** (artboard name = emote id, state machine
   `"Reaction"`, file `/cosmetics/poro/pals.riv`), 3200 ms vs 1080 ms for glyph
   emotes; emotes have **no SFX** — only ping (TTL 2400 ms) and chat_message do.
4. **Board lines** are attribute-driven (`data-board-lines`,
   `data-[-top|-bottom]-board-lines`, `data-lines-frame`, `data-lines-controls`);
   Metafy-gated options (`ink` 2026-09-30, `legend`/`signature_legend` 2026-10-07)
   need the `tier_recognition` badge. `"ink"` draws `/points-rail/ink-brushwork.png`
   slices; legend variants use SVG corner frames.
5. **Board chunk carries no worker/offscreen/glass strings** — the GlassLens
   (`ar.f` = module 190298) and worker bootstrap (`265496`/`980803`/`510914`)
   live in `439rnwycqsxxv.js`, the map generator in worker chunk `37nl_3xxi7for.js`
   (module 643471: bend 0.08, bezel `min(52,w/3,h/3)`).
6. The auto-pay cost engine (module 324758/888811 in `35_5a-hj_uv52.js`) is
   fully client-side: floating resources → rune exhaustion → power-rune recycling
   → conduit/gold/legend/seal abilities, with a card-text parser and two
   "ability costs less" discount patterns; max 128 ops per batch.
