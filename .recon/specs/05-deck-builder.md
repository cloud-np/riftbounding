# 05 — Deck Builder spec: `riftatlas.com/decks`

Recon date: 2026-10-23/24 · Agent B26 · Read-only (GET + client-side UI only; no login, no write endpoints).
Primary sources: `.recon/pretty/decks/` (prettified bundles), `.recon/browser/decks/` (rendered DOM/network/JSON), `.recon/screens/decks/` (97 screenshots), `.recon/raw/decks/` (raw JS/CSS). Prettify used `node_modules/.bin/prettier --parser babel --ignore-path /dev/null` for JS and `--parser css` for CSS (the repo `.prettierignore` excludes `.recon`, so `--ignore-path /dev/null` is required).
Cross-check: `packages/cards/src/deck-text.ts` + `.recon/specs/data/cards.json`.

> The original builder is a **client-only guest-capable editor** on the marketing site. Guests get one localStorage draft; signed-in users get a Convex-backed deck library. The builder itself never validates against a “Standard vs Radiance pool” selector — it always validates **Standard Constructed** rules and merely includes all sets in the catalog. Radiance is a lobby pool concept (see §5.9).

---

## 1. Routes & entry points

| Route | Title | What it is |
|---|---|---|
| `/decks/new` | `New Deck \| Rift Atlas` | New builder. Restores the single local draft if one exists. |
| `/decks/new?clearDraft=1` | `New Deck \| Rift Atlas` | Clears the local draft/bookmarks scope and opens an empty builder. Used by deck library “New Deck”. |
| `/decks/{savedDeckId}` | `Edit Deck \| Rift Atlas` | Saved-deck editor. Signed-in: loads `getSavedDeckEditorSnapshot`. Guest: opens the local draft (or empty builder); shows “Sign in to load a saved deck.” in the lobby equivalent. `?clearDraft=1` clears first. |
| `/decks/mine` | `Your decks \| Rift Atlas` | Deck library: local draft + saved decks + community decks tabs. Guests see the local draft and a sign-in CTA. |
| `/decks` | `Riftbound Deck Builder - Build and Browse Decks \| Rift Atlas` | Community deck index. “Build a deck” / “New Deck” → `/decks/new`; “Your decks” → `/decks/mine`. |
| `/decks/community/{publishedDeckId}` | `<name> · <legend> deck by <author> \| Rift Atlas` | Public deck detail (list/stats/guide/share/save/play). |
| `/decks/new?savedDeckId=…` | `New Deck` | Legacy/ignored query; the real edit route is `/decks/{id}`. |

Locale prefixes (`/fr`, `/ko`, `/zh-CN`) apply to all routes. `apps/play` routes that consume decks: `https://play.riftatlas.com/?deckCode=<code>` and `https://play.riftatlas.com/?savedDeckId=<id>` (see §8.5).

Entry points observed:

- Lobby **NEW DECK** → `https://riftatlas.com/decks/new` (opens builder; works signed out).
- Lobby **IMPORT DECK** → client-side import modal (does not navigate).
- `/decks` **Build a deck** → `/decks/new`; **Your decks** → `/decks/mine`.
- `/decks/mine` **New Deck** → `/decks/new?clearDraft=1`; local draft **Resume Draft** → `/decks/new` or `/decks/{linkedSavedDeckId}`; saved deck card → `/decks/{id}`.
- Public deck detail **Save to my decks** → sign-in gate; **Play** → sign-in gate pre-login.

---

## 2. Page shell & layout

### 2.1 App shell

Builder pages use the normal site header (`data-testid="app-header"`, sticky, height `--app-header-height` default `55px`) with the **Decks** nav item active. Header contents are the same as `.recon/specs/04-app-shell-lobby.md` §2.1 (logo, global card search, Advanced, Cards/Decks/Events/Sealed/Play, Discord/X, locale, membership, Sign in/Sign up, utility menu). Builder adds no breadcrumb; the workspace itself is the page.

**Theme:** the page is **light** (`html.light`; `--background` ≈ `lab(98.84% …)`). The filter/sort popovers, card detail modal, deck library, and deck workspace use theme tokens and are light. The **import deck**, **deck guide**, and **discard** dialogs use explicit dark navy gradients (`rgba(11,18,29,0.98)` etc.) and stay dark regardless. Preserve this mixed look.

Root after the header:

```html
<main class="flex w-full max-w-none flex-col gap-6 px-2 pt-0 sm:px-4 md:px-6 lg:px-8 pb-0">
  <p class="sr-only">…</p>
  <section class="grid min-h-[78vh] gap-0"
           style="grid-template-columns: 58% 14px minmax(0px, 1fr);">
    <div data-deckbuilder-drop-target="catalog" class="relative min-w-0 transition-[background-color,box-shadow]">
      <div class="pr-4">…catalog…</div>
    </div>
    <button class="sticky top-[var(--app-header-height,55px)] flex h-[calc(100vh-var(--app-header-height,55px))] cursor-col-resize …"
            aria-label="Resize catalog and deck panels">…</button>
    <div data-testid="desktop-deck-workspace-panel"
         class="min-w-0 self-start sticky top-[var(--app-header-height,55px)] h-[calc(100vh-var(--app-header-height,55px))] bg-secondary/[0.06]">…workspace…</div>
  </section>
</main>
```

- Splitter is **58%** catalog, **14px** resizer, `minmax(0,1fr)` workspace. Min 28%, max 72%, keyboard ←/→ step 2, Home 28, End 72. Default `initialCatalogPaneWidth: 58`.
- Desktop two-pane layout is used at **≥1024px**; below 1024px the builder switches to a single catalog + bottom-sheet deck drawer (`window.matchMedia("(max-width: 1023px)")`).
- At 1920px catalog cards are 3 columns; at 1440px 3 columns; at 1000/390px the catalog is full width.
- The catalog scrolls with the page; the workspace is independently scrollable (`h-[calc(100vh-…)]`, `overflow-y-auto`).

### 2.2 Breakpoints / screenshots

| Width | Layout |
|---|---|
| 1920×1080 | Desktop split; catalog 3 columns; workspace right, two internal columns (Main Deck left; Battlefields/Sideboard/Runes right) |
| 1440×1080 | Desktop split; catalog 3 columns; same workspace |
| 1000×900 | Mobile mode; catalog full width; bottom deck drawer (`h-[85vh]`, rounded top); workspace not docked |
| 390×844 | Mobile mode; 2-column catalog; horizontally scrollable section tabs; bottom drawer collapsed to a summary bar |

Screens: `w1920-*`, `w1440-*`, `w1000-*`, `w390-*` (empty, filter, view, search, card detail, gated section, issues, import, imported, drawer, stats, full art, export, named, save gate).

### 2.3 Mobile drawer

```html
<div role="dialog" class="fixed inset-x-0 bottom-0 z-[115] flex flex-col overflow-hidden bg-background shadow-[0_-24px_60px_rgba(0,0,0,0.38)] outline-none h-[85vh] rounded-t-[1.75rem] border-t border-border/70 transition-transform duration-200 ease-out">
  <button data-testid="mobile-deck-drawer-toggle" class="w-full touch-none px-4 pb-3 pt-2 text-left … pr-14">
    Riven Tempo Midrange
    66 cards · Ready to play
  </button>
  <div data-testid="mobile-deck-workspace-panel" class="flex h-full min-h-0 flex-col overflow-hidden bg-secondary/[0.06]">…same workspace…</div>
</div>
```

- Closed state shows name + `N cards · <status>`; status examples `Ready to play`, `Start building to save this deck.`.
- Inside the drawer the workspace header is compact: `List / Full Art / Stats`, `Save`, `Edit` (guide) and no catalog import/export buttons. Deck import/export are desktop-toolbar features; on mobile the catalog still has the search/filter/view controls.
- `data-testid="mobile-deck-overview-toggle"` toggles the compact overview.

---

## 3. Component tree & exact hooks

Full DOM snapshots (prettified): `.recon/pretty/decks/dom-catalog.html`, `dom-card-tile.html`, `dom-workspace-header.html`, `dom-section-maindeck.html`, `dom-mobile-drawer.html`, `dom-import-dialog.html`, `dom-card-detail-dialog.html`, `dom-guide-editor.html`, `dom-filter-dialog.html`, `dom-view-dialog.html`.

### 3.1 Catalog

```
div[data-testid=deckbuilder-catalog][data-deck-workspace-catalog=true][data-catalog-active-tab=legend]
  div.sticky.top-[var(--app-header-height,55px)]…
    nav#deckbuilder-catalog-tabs[aria-label="Catalog sections"][data-catalog-tab-list=true]
      button[data-catalog-tab=legend][aria-pressed=true][aria-label=Legend]
      button[data-catalog-tab=champion]…
      button[data-catalog-tab=mainDeck]…
      button[data-catalog-tab=battlefields]…
      button[data-catalog-tab=sideboard]…
      button[data-catalog-tab=runes]…
    p[data-testid=deckbuilder-catalog-summary][role=status][aria-live=polite]
    input[data-testid=deckbuilder-catalog-search][type=search]
    button[data-testid=deckbuilder-catalog-view-options][aria-label="Sort cards (Name, ascending)"]
    button[aria-label="Filter cards"][aria-controls=deckbuilder-catalog-filter-menu]
  div.px-0.pt-4.pb-4
    div[data-testid=deckbuilder-catalog-grid][data-catalog-grid-layout=portrait]
      article[data-deck-workspace-catalog-card="OGN-255"][data-deck-workspace-bookmark-key="OGN-255"]
      …
    button[data-testid=deckbuilder-catalog-load-more] "Load 24 more cards"
```

Key class strings:

- Sticky catalog header: `sticky top-[var(--app-header-height,55px)] z-10 bg-background/90 px-2 shadow-[0_14px_26px_-27px_rgba(0,0,0,0.55)] backdrop-blur-xl supports-[backdrop-filter]:bg-background/78 py-0.5`
- Section tab: `inline-flex shrink-0 items-center rounded-md border border-border/70 bg-background/95 px-2.5 text-[13px] font-medium text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 aria-pressed:border-transparent aria-pressed:bg-foreground aria-pressed:text-background aria-pressed:shadow-sm h-7`
- Summary: `shrink-0 text-xs text-muted-foreground`
- Search: `w-full rounded-md border border-border/70 bg-background/95 pl-9 pr-10 text-sm text-foreground outline-none transition-colors focus:border-foreground/30 [&::-webkit-search-cancel-button]:appearance-none h-7`
- View button: `relative inline-flex shrink-0 items-center justify-center rounded-md border transition-colors … h-7 gap-1.5 px-2 border-border/70 bg-background/95 text-foreground/72 …`
- Filter button: `relative inline-flex shrink-0 items-center gap-1.5 rounded-md border text-sm font-medium … h-7 px-3 border-border/70 bg-background/95 …`
- Grid: `grid grid-cols-2 gap-x-3 gap-y-3 [--deck-workspace-catalog-active-card-min:var(--deck-workspace-catalog-card-min)] sm:justify-start sm:[grid-template-columns:repeat(auto-fill,minmax(min(100%,var(--deck-workspace-catalog-active-card-min)),1fr))] min-[1920px]:[--deck-workspace-catalog-active-card-min:var(--deck-workspace-catalog-card-min-wide)]`
- Grid inline style: `--deck-workspace-catalog-card-min: clamp(12.75rem, calc(10.25rem + 2.5vw), 15.5rem); --deck-workspace-catalog-card-min-wide: clamp(16.5rem, calc(12rem + 4vw), 19rem);`
- Load more: `inline-flex min-h-10 items-center justify-center rounded-lg border border-border/70 bg-background/95 px-4 text-sm font-semibold …`
- Summary templates: `"{count} of {total} cards for {section}"`; when no cards: `"{count} card(s) for {section}"` (`deckbuilder.cardsOfForSection` / `cardsForSection`).

Section tab labels/order: **Legend, Champion, Main Deck, Battlefields, Sideboard, Runes**. `data-catalog-active-tab` mirrors selection. The selected tab has `aria-pressed=true` and the inverted `aria-pressed:*` classes; it is **not** `role=tab`.

### 3.2 Card tile

```html
<article data-deck-workspace-catalog-card="OGN-255"
         data-deck-workspace-bookmark-key="OGN-255"
         class="group/catalog-card relative w-full justify-self-start max-w-[16.5rem] min-[1920px]:max-w-[19rem]"
         style="content-visibility:auto;contain-intrinsic-size:auto 360px">
  <button aria-label="Add Ahri, Nine-Tailed Fox to the selected deck section"
          class="group relative z-10 block w-full cursor-pointer rounded-xl border text-left … lg:static lg:z-auto border-transparent hover:border-border/70">
    <div class="relative w-full overflow-visible aspect-[488/680]">
      <div data-card-art-frame="silhouette" class="absolute inset-0 overflow-hidden rounded-xl shadow-[…] bg-transparent">
        <img data-rift-image-kind="card" data-rift-image-state="image" data-card-art-route="primary" …>
      </div>
    </div>
  </button>
  <div data-deck-workspace-mobile-actions="OGN-255"
       class="mx-px -mt-[11px] flex h-[42px] items-center justify-evenly rounded-b-xl bg-[#0c121c] pt-[10px] text-white/75 shadow-[…] lg:contents lg:bg-transparent lg:shadow-none">
    <button aria-label="Add Ahri, Nine-Tailed Fox" class="… lg:hidden">+</button>
    <button aria-label="Bookmark Ahri, Nine-Tailed Fox" aria-pressed="false"
            data-deck-workspace-bookmark-toggle="OGN-255" class="… bookmark ribbon …">…</button>
    <div data-deck-workspace-details-anchor="OGN-255" class="lg:pointer-events-none lg:absolute lg:bottom-2 lg:right-2 lg:z-10">
      <button aria-label="View details for Ahri, Nine-Tailed Fox"
              data-deck-workspace-details-trigger="OGN-255" class="…">⤢</button>
    </div>
  </div>
</article>
```

- Desktop: the whole card is an Add button; bookmark ribbon and “View details” appear on hover (details button has `lg:opacity-0 group-hover/catalog-card:opacity-100`).
- Mobile: separate `+`, bookmark, and details buttons below the art.
- `data-deck-workspace-catalog-card` value is the **print/card code** (e.g. `OGN-255`), not the base code. Alt prints are separate cards in the catalog data but the art picker groups by name.
- Card art uses `original` at 1536w and `small-v2` at 320/384; `sizes="(max-width: 640px) 50vw, (max-width: 1919px) 16.5rem, 19rem"`.
- Bookmark ribbon is a CSS clip-path ribbon (`polygon(0 0,100% 0,100% 100%,50% 76%,0 100%)`), grey gradient; `aria-pressed` toggles.

### 3.3 Workspace header

```
div[data-testid=desktop-deck-workspace-panel]   (mobile: data-testid=mobile-deck-workspace-panel)
  div.relative.flex.h-full.min-h-0.flex-col
    div[data-deck-workspace-header=true]
      row 1: "Deck workspace" + status + toolbar (Save, Import deck, Export deck, Private, Show deck only)
      row 2: deck name input + Guide + Play in Simulator
      row 3: tablist List/Full Art/Stats + issues button + Discard Draft
    div[data-deck-workspace-scroll=true] class="@container min-h-0 flex-1 overflow-y-auto px-4"
      div[data-deck-workspace-columns=auto]
        div[data-deck-workspace-column=main]  → Legend/Champion row, Main Deck
        div[data-deck-workspace-column=side]  → Battlefields, Sideboard, Runes
```

Exact hooks:

- `data-deck-workspace-toolbar-action=true` on Save, Import, Export, Private, Show deck only.
- `#deck-name-input`, label `sr-only` “Deck Name”, placeholder computed.
- `button[aria-label="Edit deck guide"]` (visible label “Guide”).
- Play button: class `E0gSfG_button` with `data-mobile="false|true"`; disabled until deck is ready.
- Tablist: `role=tablist aria-label="Deck workspace view"`; buttons `#desktop-deck-workspace-list-tab`, `#desktop-deck-workspace-fullArt-tab`, `#desktop-deck-workspace-stats-tab` (mobile IDs `mobile-…`), `role=tab`, `aria-selected`, `aria-controls`.
- Issues: button `aria-label="N validation issues"`, `aria-expanded`, `aria-controls`; amber theme; popover is a `<section aria-label="…deck validation issues">` portalled to body or nearest dialog.
- Discard Draft: `aria-label="Discard Draft"`; opens custom confirm modal (not a native `<dialog>`).
- `data-deck-workspace-columns=auto` class: `grid items-start gap-y-6 @min-[52rem]:[grid-template-columns:minmax(0,1.6fr)_minmax(0,1fr)] @min-[52rem]:gap-x-6`.
- Main/side columns: `grid min-w-0 content-start gap-y-6`.
- Legend + Champion row: `grid items-start [grid-template-columns:repeat(auto-fit,minmax(min(100%,14rem),1fr))] gap-3`.
- Section grid: `grid items-start justify-start [grid-template-columns:repeat(auto-fit,minmax(min(100%,14rem),1fr))] gap-2`.

Status strings: `Start building to save this deck.` (empty), `Local draft only` (guest/unsaved local), `Unsaved changes`, `Saving changes...`, `Saved <time>`, `Saved to your deck library`, `Private`, `Published`, `Incomplete`. `Private` is a **state label/action**, not a boolean toggle: when saved and ready it opens the publish flow; when published it opens a menu with community link + Make Private.

Deck name placeholder: computed as `"<champion name> / <legend name>"` (localized), or whichever exists, fallback `Saved Deck`. On import the input stays empty, so the placeholder shows e.g. `Riven, Deserter / Riven, The Exile`. Save uses typed value or computed value; only fails if both are empty (`Deck name is required before saving.`). Library rename input has `maxLength=60`.

### 3.4 Section

```html
<section data-deck-workspace-section="mainDeck" data-deckbuilder-drop-target="mainDeck"
         class="relative transition-[background-color,box-shadow] grid self-start gap-2">
  <div data-deck-section-sticky-header="true"
       class="sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/78 flex items-center justify-between gap-3 border-b border-border/60 pb-2 pt-1.5">
    <h3 class="shrink-0 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Main Deck</h3>
    <div class="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-1.5">
      <select aria-label="Group Main Deck list">No Grouping / By Type / By Energy / By Power / By Domain</select>
      <select aria-label="Sort Main Deck list">Name / Type / Energy / Power / Domain / Copies</select>
      <button aria-label="Sort Main Deck ascending">↑</button>
      <span>39/39</span>
      <span class="sr-only">Main Deck count 39/39</span>
    </div>
  </div>
  <div class="grid items-start justify-start [grid-template-columns:repeat(auto-fit,minmax(min(100%,14rem),1fr))] gap-2">
    …empty button or rows…
  </div>
</section>
```

- Section order in DOM: `legend`, `champion`, `mainDeck` (left column); `battlefields`, `sideboard`, `runes` (right column). Legend and Champion share a row above Main Deck.
- Empty section button: `data-deck-empty-section-action="<section>"`, class `inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border/70 bg-background/45 … h-9 text-sm`, label `Add Legend` / `Add Champion` / `Add Main Deck cards` / `Add Battlefields` / `Add Sideboard cards` / `Add Runes`.
- Count badge: `inline-flex min-w-[3.8rem] items-center justify-center rounded-md border px-2 font-semibold tabular-nums … h-7 text-[15px]`; amber for incomplete/legend? Main/side counts use `border-border/70 bg-background/55`; legend/battlefields/runes amber when under/over? Observed amber for 0/1, 0/3, 0/12; green/neutral when full. Use `aria-hidden` count + `sr-only` full label.
- Group/sort selects are only on Main Deck and Sideboard; Legend/Champion/Battlefields/Runes have count only.
- Section header bottom border amber (`border-amber-500/32`) for Legend; neutral for others; the exact color varies by completeness.
- `data-deckbuilder-drop-target` on section and on catalog; drag ghost/overlay logic in `0qthpxaypig65.js`.

### 3.5 Deck row

```html
<div draggable="true" data-deckbuilder-drag-source="deck"
     data-copy-count="3" data-deck-entry-code="VEN-044"
     data-deck-entry-identity="code:VEN-044" data-deck-entry-section="mainDeck"
     class="relative z-0 grid min-w-0 w-full justify-self-start grid-cols-[4.35rem_1.6rem_minmax(0,1fr)] items-center gap-x-1 rounded-md border border-border/60 bg-background/70 p-1 text-[0.8rem] focus-within:z-20">
  <button data-deckbuilder-drag-handle=true aria-label="Preview Astral Heron" class="group/deck-thumb relative h-[3.2rem] w-[4.35rem] …">
    <img … small-v2 …>
  </button>
  <div class="flex shrink-0 justify-self-center flex-col items-center gap-0.5">
    <button aria-label="Increase Astral Heron quantity in Main Deck">+</button>
    <button data-deck-entry-decrement=true aria-label="Decrease Astral Heron quantity in Main Deck">−</button>
  </div>
  <div class="min-w-0 self-stretch py-0.5">
    <span class="truncate">Astral Heron</span>
    <span class="text-[1rem] font-semibold text-[#6aa4c2]">3x</span>
    <span>7 energy</span> · <span>7 <img src="…/might.webp"></span>
    <span data-deck-entry-row-actions=true>
      <button data-deck-entry-move=true aria-label="Move one copy of Astral Heron to Sideboard">⇄</button>
      <button aria-label="View details for Astral Heron">⤢</button>
    </span>
  </div>
</div>
```

- Identity is `code:<CODE>` when a code exists, else `name:<normalized name>`.
- Decrement at count 1 removes the row.
- Move button only on Main Deck/Sideboard; moves one copy to the other section. `Shift + right-click` also moves one copy (bundle string).
- Drag: catalog → Main Deck/Sideboard; deck row → other section or back to catalog to remove one copy. Dragging into a section header is supported (`data-deckbuilder-drop-target`).
- Full Art view replaces rows with card-art tiles and `Add/Remove/⇧ Details` controls; `Duplicate card display` = `Stacked` / `All copies` (S shortcut per bundle).

### 3.6 Dialogs

- **Import**: `div[role=dialog][aria-labelledby=deck-import-dialog-title]`, max-w-5xl, class `relative z-1 flex max-h-[min(90vh,52rem)] w-full max-w-5xl flex-col overflow-hidden border border-[rgba(148,163,184,0.28)] bg-[linear-gradient(180deg,rgba(11,18,29,0.98),rgba(7,12,22,0.98))] shadow-[…]`; header eyebrow “Deck List”, h2 “Import Deck”, status chip, “Use Deck Code”, close `aria-label="Close deck import"`; body `lg:grid-cols-[minmax(0,1fr)_18rem]`; textarea `#deck-import-textarea`; validation panel; footer Cancel/Import Deck. Code panel id `deck-code-input-panel`.
- **Card detail**: `div[role=dialog][aria-modal=true][data-testid=deck-card-detail-modal][aria-labelledby=deck-card-detail-dialog-title]`, max-w-5xl, two-column at ≥700px (hero 360px + info); hero `data-testid=card-detail-hero`; close `aria-label="Close card details"`. Shows name, type, energy, subtypes, rules text, set/rarity/domains/card number, TCGPlayer price/link, “Full card page”.
- **Guide**: `div[role=dialog][aria-modal=true][aria-labelledby=deck-guide-dialog-title]`, max-w-4xl; eyebrow “Deck Guide”, h2 = deck name, description “Add matchup notes, mulligan advice, power turns, and sideboarding plans.”; toolbar `Paragraph / Heading / Subheading / Bold / Italic / Bullet list / Numbered list / Quote / Link / Clear formatting`; contenteditable `role=textbox`; placeholder “Share your mulligan plan, power turns, and matchup notes...”; “No guide added yet.”; Done. Saves into `guideHtml` with the deck.
- **Discard Draft**: custom overlay (not native dialog): eyebrow “CONFIRM ACTION”, title “Discard Draft?”, body “Discard this local draft and return to your deck library?”, Cancel / Discard.
- **Auth/save gate**: shared `<dialog data-account-dialog>` from the site header: “Sign in to Rift Atlas”, Google/Discord/Twitch/email, Turnstile; no builder-specific markup.
- **Publish**: custom confirm dialog with publish form (author name, description max 160, highlight cards up to 3, legend/key-card preview), title “Publish to Community Decks?”, confirm “Publish”. Not observed signed-in; inferred from bundle.
- **Export**: popover `div#…[role=dialog][aria-label="Export deck"]` (the trigger has `aria-haspopup=dialog`), width 56 (14rem), options `Copy decklist`, `Copy deck code`, `Compact share code`, `Share deck`, `Download wallpaper 16:9 PNG · 1080p to 4K`.

---

## 4. Catalog behavior

### 4.1 Section tabs & gating

| Section | Pool when empty/no legend | Gate message | Count after Ahri (Calm/Mind) |
|---|---|---|---|
| Legend | 58 legends | — | 58 |
| Champion | 0 | `Choose a legend first to see matching champions.` | 3 |
| Main Deck | 0 | `Choose a legend first to start building the Main Deck.` | 297 |
| Battlefields | 74 battlefields | — (no legend gate) | 74 |
| Sideboard | 0 | `Choose a legend first to start building the Sideboard.` | 297 |
| Runes | 0 | `Choose a legend first to see matching runes.` | 2 |

- Battlefields is the only pool available before a legend is chosen. It shows all battlefields, including banned ones (with a “Banned” badge), because no domain identity is known.
- After a legend is added, the selected section auto-advances to **Champion**. After a champion is added, it auto-advances to **Main Deck**.
- Main Deck and Sideboard are available with only a legend (champion not required); their pools are filtered by the legend’s domain identity and signature legality.
- If a card has no legal section (e.g. wrong domain), it is not shown in that section’s pool; it can still be imported and will produce validation issues.

### 4.2 Card eligibility (exact)

Let `type = card.type.trim().toLowerCase()`, `legend = legend entry`, `tag = legend.subtypes[0]`.

```
Legend:        type === "legend"
Champion:      type.includes("unit")
               && (domains within legend identity OR Neeko)
               && card.subtypes.includes(tag)
               && card.name.toLowerCase().startsWith(tag.toLowerCase())
Battlefields:  type === "battlefield"          (no domain filter)
Main/Sideboard: not type.includes("champion")
                && type !== "legend" && type !== "battlefield" && type !== "rune"
                && (domains within legend identity OR Neeko)
                && (!card.signatureType || card.signatureType === tag)
Runes:         type === "rune" && domains within legend identity
```

- Domain identity uses unique non-empty domains, ignoring `"unknown"`; every card domain must be in the legend’s domains. `areCardDomainsWithinIdentity` is the same helper used by validation.
- The builder’s champion **catalog filter** is stricter than the parser’s `isChampionForLegend`: it additionally requires `name.startsWith(tag)`. The parser only checks unit + subtype + non-signature (see §5.8 difference).
- Neeko (`Neeko, Blending In`) bypasses the domain-identity restriction for any card (`isNeekoDeckEntry`), and enables Additional Legends.
- Type checks are on the whole trimmed type string for main/side (`"Unit Gear"` is main-deck legal); champion uses `type.includes("champion")` in `tB`, but the pool filter uses `unit`.

### 4.3 Search

- Per-section input, placeholder `Search <Section> cards...`; `data-testid=deckbuilder-catalog-search`; `type=search`; no visible debounce (React `useDeferredValue`).
- Query state is keyed by section **except Sideboard shares Main Deck’s context**: `contextId = section === "sideboard" ? "mainDeck" : section`. So searching/filtering Main Deck also filters Sideboard, and vice versa.
- Search normalizes text: NFKD, locale lowercase, strip diacritics, punctuation → spaces, collapse whitespace. Every whitespace term must be a substring of the haystack.
- Haystack: card `id`, `name`, localized name, rules text (localized), type (localized), rarity (localized), domains, keywords, subtypes, `set` (because `includeSet:true`). It does **not** include flavor text in the builder (`includeFlavor` false).
- No field-prefix/advanced syntax in the builder search; `t:`/`c:` etc. are not parsed here. The global header card search has separate advanced syntax.
- Empty query returns all cards (`isEmpty` false for non-empty whitespace? whitespace-only is empty and returns all).
- No results message: `No cards match this search.`; with Legal-only/bookmarks: `Every matching card is banned. Clear Legal only to show them.` / `No bookmarked cards match this section's search and filters.` / `No cards match the current search and filters.`

### 4.4 Filters (exact facets)

Filter popover: `div#deckbuilder-catalog-filter-menu[role=dialog][aria-labelledby=…-title][data-catalog-overlay=filters]`, width 38rem, sections:

| panelSection | facet id | Label | Control | Options |
|---|---|---|---|---|
| primary | `domain` | Domain | chips/icons, multi | Fury, Calm, Mind, Body, Chaos, Order (icons `/icons/<domain>.webp`) |
| primary | `type` | Type | segmented chips, multi | Unit, Spell, Gear (counts only if present; for Legend constant types may collapse) |
| primary | `rarity` | Rarity | segmented chips, multi | Common, Uncommon, Rare, Epic, Showcase (ordered) |
| properties | `energy` | Energy | segmented chips, multi | 0..6, `7+` |
| properties | `power` | Power | segmented chips, multi | 0..2, `3+` |
| properties | `might` | Might | segmented chips, multi | 0..6, `7+` (units only) |
| advanced | `set` | Set | chips, multi | Origins, Spiritforged, Unleashed, Vendetta, Radiance (counts per set) |
| advanced | `keywords` | Keywords | searchable multi | distinct keywords |
| advanced | `tags` | Tags | searchable multi | distinct subtypes |
| advanced | `abilities` | Abilities | searchable multi | ability ids from `tR.L` (e.g. `exhaust`) with localized labels/icons |
| status | `legal-only` | Legality | toggle | `Legal only` |
| status | `available-to-add` | Availability | toggle | `Available to add` |
| status | `bookmarked-only` | Bookmarks | toggle | `Bookmarked only` |

- Facet counts are computed after search and all **other** facets; options with count 0 are disabled unless selected/`showEmptyOptions`. A card failing exactly one facet increments that facet’s option counts; failing 2+ increments none.
- `Legal only` excludes cards with `bannedIn[].format === "Standard Constructed"`.
- `Available to add` uses the same eligibility/copy-limit checks as the Add button (`e7.z`): battlefields at 1 per name, main deck at 80, champion/main/sideboard at copy limit.
- `Bookmarked only` uses the local bookmark set for the current scope.
- Clear Filters appears when filters are active; `current.clearFilters`.
- The Legend-tab popover only shows Domain, Set, Keywords, Tags, Abilities, Status (property/type/rarity facets collapse when they have no meaningful options). The Main Deck-tab popover shows all facets (observed counts: Type Gear 42/Spell 75/Unit 181; Rarity Common 100/Uncommon 76/Rare 82/Epic 39/Showcase 1; Energy 0:3,1:30,2:66,3:70,4:49,5:35,6:22,7+:23; Power 0:167,1:103,2:23,3+:5; Might 0:2,1:10,2:23,3:37,4:50,5:25,6:20,7+:14; Set Origins 84/Spiritforged 60/Unleashed 59/Vendetta 47/Radiance 48).

### 4.5 View / sort / grouping

View popover: `div#deckbuilder-catalog-sort-menu[role=dialog][aria-label="Sort cards"][data-catalog-overlay=sort]`, width 16rem.

- **Group by** select (label “Group cards”): `No Grouping`, `Domain`, `Type`. Default `No Grouping`.
- **Sort By** radio list: `Name`, `Energy`, `Power`, `Might`, `Type`, `Domain`, `Rarity`, `Set`. Default `Name`.
- **Direction**: `Asc` / `Desc`. Default `Asc`.
- Sort comparator:
  - `energyCost`, `powerCost` (0 for none), `might` numeric;
  - `type` / `domain` / `rarity` / `set` use canonical orders;
  - domain order `Fury, Calm, Mind, Body, Chaos, Order`; rarity `Common, Uncommon, Rare, Epic` (Showcase after); set order from the site set manifest;
  - fallback localized name, then English name, then id.
- Catalog grouping groups within the current section; group headings are localized (`No Domain`, `<n> Energy`, `<n> Power`, type names).
- **Deck list** grouping/sort is separate:
  - Group: `No Grouping`, `By Type`, `By Energy`, `By Power`, `By Domain`.
  - Sort: `Name`, `Type`, `Energy`, `Power`, `Domain`, `Copies`; direction asc/desc.
  - Default: no grouping, Name asc.
- Preferences persist in `riftatlas_deckbuilder_list_preferences_v1` (`catalogGrouping`, `artCopiesLayout`, `fullArtSize`, `groupKey`, `sortDirection`, `sortKey`, `workspaceTab`).

### 4.6 Pagination, bookmarks, art variants

- Catalog page size **24**; “Load 24 more cards” appends 24. Summary shows total pool count, not page count.
- Bookmarks: local per scope; ribbon button `data-deck-workspace-bookmark-toggle`; key `riftatlas_deck_workspace_bookmarks_v2:<scope>`, value `{version:2,cardIds:[...]}`; legacy `v1` key migrated. Scopes: `constructed:local:<scopeId>`, `constructed:saved:<savedDeckId>`, `sealed:<id>:<id>`.
- Alt art/print variants: catalog data has 253 alt-art rows with `isAltArt`/`baseCardId`; the builder groups by name into `printVariants` and shows `N alt arts` (actually total print variants, e.g. Ahri = 4, Riven = 3). Art picker: “Choose Art”, “Show N art variants”, “Close art picker”. Selecting an art swaps the deck entry’s card code/name print while keeping count; `replaceEntryPrint`.
- Bookmark filter and art picker are independent of deck validation.

### 4.7 Add / remove / move

- Clicking a card (desktop) or `+` (mobile) adds **one copy** to the currently selected section.
- Legend: replaces the current legend with `{count:1,name,cardCode}`; resets champion to empty; filters main deck to cards legal under the new legend; auto-selects Champion.
- Champion: replaces champion with `{count:1,…}`; auto-selects Main Deck.
- Main/Sideboard/Runes/Battlefields: find by identity; increment count or push.
- UI blocks:
  - copy limit reached → toast `Maximum <max> copies of "<name>" reached.`
  - battlefields same name at 1 → toast `Only 1 copies of "<name>" are allowed in Battlefields.`
  - Neeko 3 additional legends already → toast `Neeko already has three legends.`
  - main deck would exceed 80 → toast `Reduce the Main Deck to 80 cards before importing.`
- Copy limit checks apply to Champion/Main Deck/Sideboard (`["champion","mainDeck","sideboard"]`), summed across those sections. Battlefields use per-name 1. Runes have no copy-limit block.
- Remove: `−` decrements; at 1 it removes. Move button Main↔Sideboard moves one copy. Drag back to catalog removes one copy.
- Dragging a catalog card to Main Deck/Sideboard; dragging a deck card to the other section or catalog. Shift+right-click moves one copy (bundle string).
- `+`/`−` buttons are disabled when `e7.z` says unavailable (copy limit, battlefield limit, main 80); the Add button itself may remain enabled and show the toast (observed for copy limit: button stayed enabled, toast appeared).
- Deck-only toggle `[data-testid=deck-only-toggle]` hides the catalog and expands the workspace; label “Show deck only”.

---

## 5. Deck data model & section rules

### 5.1 Draft model (localStorage v5)

```ts
type DeckSectionKey = "legend" | "champion" | "mainDeck" | "battlefields" | "runes" | "sideboard";
interface DeckEntry { count: number; name: string; cardCode?: string }

interface DeckbuilderDraftV5 {
  version: 5;
  name: string;
  guideHtml: string;
  linkedSavedDeckId: string | null;
  deckSections: Record<DeckSectionKey, DeckEntry[]>;
  bookmarkScopeId: string;                 // uuid
  selectedSection: DeckSectionKey;
  lastSavedSignature: string | null;       // JSON.stringify({name, guideHtml, deckSections: normalize(...)})
  lastSavedStatus: "ready" | "incomplete" | null;
  lastSavedAt: number | null;
  hasUnsavedChanges: boolean;
  startingLegendVacant?: true;             // Neeko-only
}
```

Observed empty draft:

```json
{"version":5,"name":"","guideHtml":"","linkedSavedDeckId":null,
 "deckSections":{"legend":[],"champion":[],"mainDeck":[],"battlefields":[],"runes":[],"sideboard":[]},
 "bookmarkScopeId":"7d60bd7a-…","selectedSection":"legend",
 "lastSavedSignature":null,"lastSavedStatus":null,"lastSavedAt":null,"hasUnsavedChanges":false}
```

Normalization merges duplicate entries by `code:<CODE>` or `name:<normalized name>`, clamps counts, drops empty names/counts, sorts all sections except Legend by name then code. Legend order is preserved (starting legend first for Neeko).

### 5.2 Section counts / required sizes

| Section | UI count | Required | Notes |
|---|---|---|---|
| Legend | 0/1 | exactly 1 | Neeko: 1 starting + up to 3 Additional Legends |
| Champion | 0/1 | exactly 1 | must be legal for starting legend |
| Main Deck | 0/39 | 39 (+ champion = 40) | builder shows 39 max in the count badge; parser requires main+champion = 40 when main > 0 |
| Battlefields | 0/3 | exactly 3 | 1 copy per name |
| Runes | 0/12 | exactly 12 | no per-name copy limit in UI |
| Sideboard | 0/10 | at most 10 | copy limit 3/Unique 1 across sections |

- Main Deck safety cap 80 (not 39) for saving/incomplete decks; validation issue if not exactly 40 with champion.
- Total deck cap 250 cards (parser warning/error).
- Raw decklist cap 20,000 chars.
- Builder count badges use `REQUIRED_CORE_DECK_COUNT - REQUIRED_CHAMPION_COUNT = 39` for Main Deck.

### 5.3 Copy limits (exact)

```ts
MAX_CARD_COPIES = 3;
MAX_BATTLEFIELD_COPIES = 1;
MAX_SIDEBOARD_COUNT = 10;
MAX_MAIN_DECK_SAFETY_COUNT = 80;
MAX_SIGNATURE_CARD_COUNT = 3;
MAX_EXPANDED_CARD_TOTAL = 250;
MAX_DECKLIST_RAW_LENGTH = 20000;
```

`getCardCopyLimit({name, cardCode})`:

1. `spiderling` (case/space-normalized name) → `null` (unlimited).
2. Card has keyword `Unique` or rules text matching `/\[\s*unique\s*\]/i` → `1`.
3. Otherwise → `3`.

Limits apply per normalized name, summed across **Champion + Main Deck + Sideboard**, and separately per section. Battlefields: 1 per name, no copy limit from the 3-copy rule. Runes: no per-name limit. Legend/Champion: exactly 1 (UI replaces rather than increments). Signature cards: total count in Main Deck ≤ 3.

### 5.4 Domain identity, champion legality, signatures

- Legend domains (unique, case-insensitive, ignore `unknown`) define the deck identity. Every card in Champion/Main/Sideboard/Battlefields/Runes must have all its domains inside that set; otherwise error:
  `"<Section> contains "<name>", whose <domains> domain is/are outside this deck's <legend domains> domain identity."`
- Champion must be a unit whose subtypes include the starting legend’s first subtype; parser additionally requires `!signatureType`. Error:
  `Champion contains "<name>", which is not a legal champion unit for <tag>. Choose a non-signature unit with the <tag> tag.`
- Signature cards (`card.signatureType`) for another legend tag are errors in Main Deck/Sideboard:
  `"<Section> contains "<name>", a signature <type> for <tag>. No signatures of other Legend types are allowed when your legend is <tag>."`
- Main Deck signature count > 3:
  `Main Deck contains <n> Signature cards. Maximum allowed is 3 total.`
- Builder catalog champion filter additionally requires name starts with legend tag; this is a UI-only narrowing.

### 5.5 Neeko / Additional Legends

- `NEEKO_CARD_NAME = "Neeko, Blending In"`. A deck “includes Neeko” if Main Deck or Sideboard contains Neeko with count > 0.
- Max legends = `1 + 3 * (includesNeeko ? 1 : 0)` = 4.
- Legend section may contain 1 starting legend + up to 3 Additional Legends, each count 1, each name unique.
- Export splits:
  ```
  Legend:
  1 Neeko, Blending In

  Additional Legends:
  1 <legend 2>
  ...
  ```
- Builder has `startingLegendVacant` state and `getNeekoLegendOptionEntries`/`setStartingLegend` helpers; when Neeko is present, adding a legend can place it as an additional legend instead of replacing the starting legend. This flow was **not exercised signed-out**; the bundle is the source.
- Errors: `Additional Legends must contain at most 3 card(s). Found <n>.`, `Additional Legends contains <n> copies of "<name>". Maximum allowed is 1.`, `Neeko already has three legends.` (toast).

### 5.6 Bans

- Builder validates bans in **Standard Constructed** only (`format: "standard-constructed"`, `deckRulesMode: "standard"`).
- Lobby 2v2 validation additionally checks `Constructed 2v2`.
- `bannedIn` data has 14 print rows / 13 unique names (Draven alt art duplicate):
  Ekko, Recurrent; Fight or Flight; Stealthy Pursuer; Scrapheap; Stacked Deck; Aspirant's Climb; Obelisk of Power; Reaver's Row; The Arena's Greatest; The Dreaming Tree; Draven, Vanquisher (SFD-020 + SFD-020A); Called Shot; Master Yi, Wuju Bladesman (2v2 only).
- Message: `"<name>" is banned in <format>.` Deduped by normalized name; one message per name/format.
- Catalog shows a “Banned” badge on banned cards; `Legal only` filter hides them; banned cards are otherwise visible/selectable.
- Builder import with errors is allowed; lobby import is stricter (requires READY TO IMPORT).

### 5.7 Validation messages (exact; parser + `isDeckReadyForMatch`)

Parser errors (blocking; builder issue list = `errors` only):

| Rule | Exact message |
|---|---|
| raw length > 20,000 | `Deck list cannot exceed 20,000 characters. Found <n>.` |
| unknown header (with repair) | `Line <n>: Unknown section header "<x>". Did you mean "<y>"? This section was ignored.` |
| unknown header (no repair) | `Line <n>: Unknown section header "<x>". This section was ignored.` |
| unparsable line | `Line <n>: Could not parse "<x>". Expected format like "3 Card Name" or "3 Card Name [ABC-123]".` |
| entry before header | `Line <n>: Card entry "<x>" appeared before a known section header and was ignored.` |
| unknown code | `Line <n>: Unknown card code "<code>" in <Section>.` |
| name/code mismatch | `Line <n>: "<name>" does not match card code "<code>" (<catalog name>).` |
| unknown card | `Line <n>: Unknown card "<name>" in <Section>. Did you mean "<a>"?` (1/2/3 suggestion forms) |
| missing required section | `Missing required section: <Section>.` (Legend, Champion, Main Deck, Battlefields, Runes; unrestricted mode skips Battlefields and only Main Deck is blocking) |
| other legend signature | `"<Section> contains "<name>", a signature <type> for <tag>. No signatures of other Legend types are allowed when your legend is <tag>."` |
| illegal champion | `Champion contains "<name>", which is not a legal champion unit for <tag>. Choose a non-signature unit with the <tag> tag.` |
| domain outside identity | `"<Section> contains "<name>", whose <domains> domain is/are outside this deck's <legend domains> domain identity."` |
| signature count | `Main Deck contains <n> Signature cards. Maximum allowed is 3 total.` |
| legend count | `Legend must contain exactly 1 card(s). Found <n>.` |
| additional legends cap | `Additional Legends must contain at most 3 card(s). Found <n>.` |
| additional legend duplicate | `Additional Legends contains <n> copies of "<name>". Maximum allowed is 1.` |
| champion count | `Champion must contain exactly 1 card(s). Found <n>.` |
| main+champion | `Main deck + champion must contain exactly 40 card(s). Found <n>.` |
| main deck safety | `Main Deck can contain at most 80 cards. Found <n>.` |
| battlefield count | `Battlefields must contain exactly 3 card(s). Found <n>.` |
| battlefield duplicates | `Battlefields contains <n> copies of "<name>". Maximum allowed is 1.` |
| rune count | `Runes must contain exactly 12 card(s). Found <n>.` |
| sideboard cap | `Sideboard can contain at most 10 card(s). Found <n>.` |
| main copy limit | `MainDeck contains <n> copies of "<name>". Maximum allowed is <limit>.` |
| side copy limit | `Sideboard contains <n> copies of "<name>". Maximum allowed is <limit>.` |
| cross-section copy limit | `"<name>" appears <n> times across Champion, Main Deck, and Sideboard. Maximum allowed is <limit>. Current split: <n> Champion, <n> Main Deck, <n> Sideboard.` |
| total cards > 250 | `Deck list can contain at most 250 total cards. Found <n>.` |
| bans (unrestricted only) | `"<name>" is banned in Standard Constructed.` |

Parser warnings (not shown as builder issues; do not block):
`Line <n>: "<name>" is a token and cannot be included in deck lists.`; `Line <n>: "<name>" belongs under <Section>, not <Section>.`; `Line <n>: "<name>" is not a valid <Section> card.`

`isDeckReadyForMatch(parsed, {format, gameVariant, deckRulesMode})`:

1. if `parsed.errors.length > 0` → invalid with those errors;
2. Standard + standard mode + no battlefields → `No battlefields were found in the deck list.`;
3. no main deck entries → `No main deck cards were found.`;
4. Standard + standard mode → ban reasons for `Standard Constructed` (plus `Constructed 2v2` when `gameVariant === "teams_2v2"`).
5. `valid = reasons.length === 0`.

Empty deck issue count = 7: 5 missing sections + Legend exactly 1 + Champion exactly 1.

### 5.8 Differences vs `packages/cards/src/deck-text.ts`

The port is **behaviorally equivalent** for parse/validate in the paths the builder uses, but the API surface and a few UI helpers differ:

| # | Original builder/validator | `packages/cards` | Impact |
|---|---|---|---|
| 1 | `parseDecklist(raw, opts)` default `validateCatalog:false` | `parseDeckText(raw, opts)` default `validateCatalog:true` | If the builder agent calls without options, our version validates catalog and may produce errors the original would not. Pass `{validateCatalog:true}` explicitly for builder/import. |
| 2 | `buildDecklistText` | `exportDeckText` | Rename/alias needed. |
| 3 | `normalizeDeckSections` | `normalizeSections` | Rename/alias needed. |
| 4 | `emptyDeckSections` | private `emptySections` | Export needed for builder initialization. |
| 5 | `sectionLabel` | `sectionDisplayName` | Rename/alias needed. |
| 6 | `formatDeckEntryLine` | `formatDeckEntry` | Rename/alias needed. |
| 7 | `isDeckReadyForMatch` | `validateDeck` | Same behavior; rename/alias. |
| 8 | `deckIncludesNeeko` | `hasMultipleLegends` | Same behavior; rename/alias. |
| 9 | `decodePercentEncodedDecklist` | `decodePercentEscapes` | Same behavior; rename/alias. |
| 10 | `expandDeckEntries` | `expandCounts` | Same behavior; rename/alias. |
| 11 | `getCardCopyLimit` | private `copyLimit` | **Missing export.** Builder UI needs it for Add-button gating/toasts. |
| 12 | `getMainDeckSafetyLimitError` | inline `>80` check | **Missing helper.** Needed for the 80-card toast/save gate. |
| 13 | `getMaximumLegendCount`, `countStartingLegends`, `getNeekoLegendOptionEntries` | not present | **Missing.** Needed for Neeko/Additional Legends builder UI. |
| 14 | `setStartingLegend`, `removeLegendEntry`, `replaceEntryPrint`, `orderStartingLegendFirst`, `isNeekoDeckEntry`, `isLegendForChampion`, `entryNameMatchesCard` | not present / partial | **Missing builder helpers.** |
| 15 | `totalCards` | `sectionTotal` (per section) | Sum manually or add `totalCards`. |
| 16 | `validateConstructedDeckBans`, `validateStandardConstructedDeckBans` | `banReasons` | Wrappers missing; behavior equivalent. |
| 17 | Constants `MAX_*`, `REQUIRED_*`, `NEEKO_*`, `STANDARD_CONSTRUCTED_BAN_FORMAT`, `CONSTRUCTED_2V2_BAN_FORMAT` | hardcoded / not exported | Export constants for exact UI counts. |
| 18 | `startingLegendVacant` draft state | not present | **Missing Neeko UI state.** |
| 19 | Builder catalog champion filter requires `name.startsWith(tag)` | `isChampionForLegend` does not | UI pool is narrower than validator; this is intentional in the original, but a builder must reproduce the name-prefix filter separately. |
| 20 | Radiance/upcoming pool detection (`matchmakingPool`) | not present in `deck-text` | Lobby concern, not builder validation. |
| 21 | `validateCatalog` false path: no catalog errors; structural rules still apply | same | No difference. |
| 22 | `unrestricted` mode: catalog issues + missing non-main sections become warnings; ban reasons appended to warnings | same | No difference. |
| 23 | Message strings/punctuation/pluralization | verified identical in the port | No difference found. |
| 24 | Card data (1510 rows, alt arts, bans, signatureType) | `cards.json` same 1510 ids and fields | No data gap; see §12. |

Also note `packages/cards/src/deck-text.ts` does **not** export `getCardCopyLimit`, so `apps/play` must either export the private function or reimplement the exact rules (spiderling unlimited, Unique 1, else 3).

### 5.9 Standard vs Radiance card pools

- The builder has **no pool selector**. It always validates Standard Constructed (`format: "standard-constructed"`, `deckRulesMode: "standard"`) and shows all sets in the catalog.
- Radiance is the `RAD` set (48 cards in the Main Deck pool; 9 in the Set facet for Legend). It is included in `cards.json` and the builder catalog.
- Lobby pool detection (`matchmakingPool`):
  ```
  if preferOriginsOnly → "origins"
  else if upcomingConfig.enabled && N(upcomingConfig) && (deck contains a RAD card || preferUpcomingSet) → "upcoming"
  else → "standard"
  ```
  `upcomingConfig = { enabled: true, setName: "Radiance", standardFrom: 2026-10-23T00:00:00-07:00 }`.
  `N(config)` is true only while `now < standardFrom` (or no standardFrom).
- Consequence: before 2026-10-23, a deck containing any Radiance card auto-selected “Radiance · Pre-Rift” in the lobby (seen in the 2026-10-22 walkthrough). On/after 2026-10-23, Radiance is Standard; observed lobby summary on 2026-10-23/24 = `1v1 · BO1 · Standard` even for a RAD deck.
- There is **no separate Radiance validation rule set** in the builder: same 40/3/12/10 sizes, same 3/1 copy limits, same Standard Constructed ban list. “Radiance · Pre-Rift” is a lobby pool/mode, not a builder format.
- The only Radiance-specific checks are lobby-side pool detection and the signed-in gate on the “Radiance · Pre-Rift” quick-match tab (`title="Sign in to use Radiance · Pre-Rift."`).

---

## 6. Deck stats

Stats tab is computed from **Main Deck only** (champion, sideboard, battlefields, runes excluded), deduped by lowercased name with counts summed. Empty: `Add main deck cards to see curve and distribution stats.` Labels live in `current.deckStats.*`.

Definitions (module `18660` in `39l8wesqj5d9y.js`):

- `totalMainDeckCards = N`; `knownMainDeckCards = A` (cards with a catalog entry/energyCost); `unknownMainDeckCards = C`.
- `averageEnergy = sum(energyCost * count) / A` (null if A=0).
- `averageMight = sum(might * count) / count(units with might)` (null if none).
- `unitCount = count(type includes Unit)`.
- `powerCardCount = count(powerCost > 0)`.
- `energyCurve`: buckets 0..max energy, count + percentage of N; unknown-cost cards appended as `Unknown` with count C.
- `mightCurve`: buckets min..max might among units; count/percentage.
- `powerCostCurve`: buckets 1..max power among power cards; count/percentage.
- `powerDemand`: rows keyed by domain combination (`Calm`, `Chaos`, `Calm / Chaos`, …) with `cards` and `power` totals; sorted by fewer domains, then domain order.
- `runeDistribution`: sum rune counts by **first domain** of each rune card; percentage of runes.
- `typeDistribution`: Unit / Spell / Gear / Unknown counts; percentages.
- `domainDistribution`: counts per domain (multi-domain cards count in each); percentages.
- `keywordDistribution`: counts per keyword across main deck cards.

UI: summary dl (`Main Deck`, `Avg Energy`, `Avg Might`, `Power Cards`), type distribution chips (Unit/Spell/Gear + dashed Champion), energy curve bar chart, Power & Runes percentages, domain table (Domain / Cards / Power / Runes), power-cost bars, Unit Might bars, Keywords list. Screens: `w*-11-stats`, `15-stats-1920`, `33-deck-detail-stats-1920`.

Observed summary for the Riven deck (39 main): `Main Deck 39`, `Avg Energy 2.8`, `Avg Might 3.5`, `Power Cards 13`; type `Unit 15 / Spell 18 / Gear 6` (+ dashed `Champion`); power `29% / 53% / 18%`; runes `50% / 50%`; domains Calm 23/5/6, Chaos 19/9/6, Calm/Chaos 3/3/–; keywords Reaction 13, Hidden 10, Action 7, Equip 3, Ganking 3, Accelerate 2, Add 2.

> The exact chart labels/counts are in `.recon/browser/decks/stats-dom.json`; use the formulas above rather than copying screenshot numbers. The energy-curve numbers in the DOM are the source of truth.

---

## 7. Deck text import/export

### 7.1 Deck text grammar

```
Legend:
1 <Name> [CODE]

Champion:
1 <Name> [CODE]

MainDeck:
3 <Name> [CODE]
...

Battlefields:
1 <Name> [CODE]

Runes:
6 <Name> [CODE]

Sideboard:
1 <Name> [CODE]
```

- Header detection: line ends with `:` or is wrapped in `~~…~~`; alias matching strips colon/space/case; aliases: `legend`, `additionallegends`/`additionallegend`, `champion(s)`, `maindeck`/`mainboard`/`main`, `battlefields`/`battlefield`, `runes`/`rune`/`runepool`, `sideboard`/`side`.
- Header fuzzy repair: Levenshtein distance / max length ≤ 0.34; repaired header is reported as “Did you mean …? This section was ignored.” if unknown.
- Entry: `^(\d+)\s+(.+?)(?:\s+\[([A-Za-z0-9-]+)\])?$`. Count must be positive. **No `x` suffix**: `3x Defy` parses as name `x Defy` and errors.
- Card code optional; if present it must exist, and name must match the code’s card name (loose ASCII/space/case comparison). If name only, exact catalog lookup first, then suggestions.
- Type/section checks: Legend/Battlefields/Runes are typed; Champion/Main/Sideboard are not; wrong section is a warning, token is a warning, unknown card/code is an error.
- Additional Legends block (Neeko): `Additional Legends:` header after Legend; up to 3 entries; each count 1; export splits 1 starting legend + rest.
- Import merges duplicate names/codes and sorts; counts are per print/code identity.

### 7.2 Export format (observed)

“Copy decklist” produced **no card codes**:

```
Legend:
1 Riven, The Exile

Champion:
1 Riven, Deserter

MainDeck:
3 Astral Heron
2 Back Off
...
3 Zhonya's Hourglass

Battlefields:
1 Back-Alley Bar
1 Emperor's Dais
1 Star Spring

Runes:
6 Calm Rune
6 Chaos Rune

Sideboard:
1 Adaptatron
...
2 Vex, Apathetic
```

- Header for main is **`MainDeck:`** (no space), matching the parser’s canonical label.
- Blank line between sections; no trailing blank line.
- Internal parse/validation text uses `includeCardCodes:true` (codes included); user-facing copy omits codes.
- Deck code: “Copy deck code” copies a compact code (256 chars for the Riven sample, starts `CQ…`). It lazily loads `encodeDecklistToDeckCode`; if some cards can’t encode: `Some cards in this deck cannot be encoded yet. Copy the decklist instead.` / retry `Retry deck code check` / load error `Deck code export could not load. Try again, or copy the decklist instead.`
- Deck code import: “Use Deck Code” panel, input `Paste deck code...`, `Load Deck`; decode fills the deck-list textarea and shows READY TO IMPORT. Invalid code: `Could not decode that deck code.`; unsupported: `Some cards in this deck cannot be encoded yet. Copy the decklist instead.` (strings `deckbuilder.couldNotDecodeDeckCode`, `deckbuilder.deckCodeUnsupported`).
- Compact share code option shows `Compact share code` / `Check deck code compatibility` / `Checking deck code compatibility…`; disabled until deck code is available.
- Share deck option shares a public URL (or prompts save/publish if local); public page share modal shows `https://riftatlas.com/decks/community/<id>` + “Send to a friend” (sign-in).
- Download wallpaper: 16:9 PNG 1080p–4K, with wallpaper settings dialog (not exercised).

### 7.3 Import dialog states

- Toolbar `aria-label="Import deck"`; dialog `aria-labelledby=deck-import-dialog-title`.
- Tabs/buttons: `Deck List` (default) / `Use Deck Code`; code panel `#deck-code-input-panel`.
- Empty: status “Paste a deck export to continue.”; Import Deck disabled; validation panel “Paste a deck list to preview counts and validation.” + “You can import unfinished lists here and keep fixing them in the deck editor.”
- Valid: green status `Ready to Import`; counts `1/1 legend`, `1/1 champion`, `39/39 main deck`, `3/3 battlefields`, `12/12 runes`, `10/10 sideboard cards`; footer “Import this list into the deck editor when you're ready.”
- Errors: red status `Parser Errors`; heading `Errors`; footer “Import into the editor and keep fixing the list there.” Import button remains enabled (builder allows importing invalid lists). Observed errors for unknown cards, wrong counts, copy limit.
- Warnings: amber status `Warnings`; footer “Warnings are okay. You can still import and continue editing.” (We triggered warnings only in parser internals; the visible import state showed errors for duplicate lines because duplicates are merged before validation.)
- Code tab: “Paste a deck code to load the full deck list.”; `Cancel` / `Load Deck`; loading a valid code fills the deck list and status becomes READY TO IMPORT.
- Import replaces the current deck sections and does not set a name; draft status becomes `Local draft only`. Import is client-side only; no server write.

---

## 8. Persistence & API

### 8.1 Guest / local storage

All keys observed (builder + lobby):

| Key | Store | Shape / purpose |
|---|---|---|
| `riftatlas_deckbuilder_draft_v1` | localStorage | Single draft v5 (see §5.1). Auto-saved on every edit; restored on `/decks/new`; linked to saved deck via `linkedSavedDeckId`. |
| `riftatlas_deck_workspace_bookmarks_v1` | localStorage | Legacy bookmark set (`{version:1,cardIds}`), migrated to v2. |
| `riftatlas_deck_workspace_bookmarks_v2:<scope>` | localStorage | `{version:2,cardIds:[...]}`; scope `constructed:local:<id>` or `constructed:saved:<id>`. |
| `riftatlas_deckbuilder_list_preferences_v1` | localStorage | `{catalogGrouping,artCopiesLayout,fullArtSize,groupKey,sortDirection,sortKey,workspaceTab}`. |
| `riftatlas_deckbuilder_pending_auth_action_v1` | sessionStorage | `{version:1,kind:"save_deck"|"publish_deck", options?, deckSource?, suggestedName?}`; replayed after sign-in. |
| `riftatlas.card_pricing_summary.v1` | localStorage | TCGPlayer price cache (`{version:1,expiresAt,updatedAt,prices:[{cardId,cheapestPrice}]}`). |
| `riftatlas.analytics_sample.v1` | localStorage | analytics sample float (unrelated). |

- Guest has **one** draft, not a library. `/decks/mine` shows it as “LOCAL DRAFT” with “Resume Draft”, “Saved locally”, identity, and last-saved time; `New Deck` clears it (`?clearDraft=1`).
- `hasUnsavedChanges` is computed by comparing `lastSavedSignature` (JSON of name/guide/normalized sections) with the current signature. A linked draft with unsaved changes is considered a resumable draft.
- If a linked saved deck disappears, the draft is detached and opened as a new unsaved deck (`That saved deck no longer exists. Your browser draft is now open as a new unsaved deck.`).
- No cookies/auth for guest builder; no server calls except static assets and `auth.riftatlas.com/api/auth/get-session` (returns no session).

### 8.2 Signed-in backend (Convex)

Transport: Convex client to `https://wary-sturgeon-712.convex.cloud` (`0i3lu0u9jz3zw.js`). The builder uses Convex queries/mutations, not REST. Signed-out builder makes no deck API calls. All shapes below are inferred from call sites in the bundles; write endpoints were **not called**.

#### `savedDecks.listSavedDeckSummaries`

Args `{}`. Returns `SavedDeckSummary[]` (lobby/library). Used when `authReady && signedIn && userId`; cached ~5 min, refreshed on focus/visibility, reconciled after save/delete.

```ts
interface SavedDeckSummary {
  id: string;                         // savedDeckId (Convex id)
  name: string;
  status: "ready" | "incomplete";
  identity: string;                   // e.g. "Riven, The Exile · Riven, Deserter"
  featureCardId?: string;
  featureCardImageUrl?: string;
  lastUsedAt: number;                 // ms
  updatedAt: number;                  // ms
  publishedDeckId?: string | null;
}
```

#### `savedDecks.resolveSavedDeckForPlay` / `resolveSavedDeckForPlayFresh`

Args: `{ deckId, knownLegalityVersion?, knownRevision?, knownStatus? }` (`Fresh` adds `recordUse?`).

```ts
type DeckContent =
  | { kind: "parsedDeck"; parsedDeck: ParsedDeck }   // sections + totals
  | { kind: "deckCode"; deckCode: string };

type ResolveResult =
  | { kind: "found"; deck: {
      id: string; name: string; status: "ready"|"incomplete";
      legalityVersion: string; revision: number;
      deckContent: DeckContent; publishedDeckId?: string|null;
    } }
  | { kind: "unchanged"; legalityVersion: string; revision: number; status: string }
  | { kind: "missing" }
  | { kind: "unavailable" };
```

Client converts `parsedDeck` to `deckSections`; for `deckCode` it decodes + parses with `validateCatalog:true`. Lobby uses `Fresh` when selecting a deck; library uses plain resolve for share.

#### `savedDecks.getSavedDeckEditorSnapshot`

Args `{ deckId }`; returns `null` or:

```ts
{
  id: string; name: string; status: "ready"|"incomplete";
  guideHtml: string; legalityVersion: string; revision: number;
  updatedAt: number; deckContent: DeckContent;
  publishedDeckId?: string|null;
}
```

Used by `/decks/{id}`. `getSavedDeckWorkspaceState({deckId})` returns the same without `deckContent` (status/legality/revision/updatedAt/publishedDeckId) for live reconciliation.

#### `savedDecks.upsertSavedDeck`

Builder save (create or update):

```ts
// args
{
  deckId?: string;                 // omit for new deck
  name: string;
  deckSections: Record<DeckSectionKey, DeckEntry[]>;
  guideHtml: string;
}
// returns
{ id: string; name: string; guideHtml: string; status: "ready"|"incomplete";
  legalityVersion: string; revision: number }   // client stamps updatedAt = Date.now()
```

#### `savedDecks.createSavedDeck` (lobby Save Deck)

```ts
// args
{ name: string; decklistRaw: string }
// returns
{ id: string; legalityVersion: string; revision: number; status: "ready"|"incomplete" }
```

#### `savedDecks.renameSavedDeck`

Args `{ deckId, name }`; returns `{ previousRevision, legalityVersion, revision, status }`.

#### `savedDecks.deleteSavedDeck`

Args `{ deckId }`; returns `{ id }` (client removes summary/bookmarks/draft link).

#### Community decks

| Function | Args | Returns / effect |
|---|---|---|
| `communityDecks.publishSavedDeck` | `{ savedDeckId, publicAuthorName, description, highlightCards }` | `{ id: publishedDeckId }`; only ready decks; saves first if dirty. |
| `communityDecks.unpublishSavedDeck` | `{ savedDeckId }` | removes publication; deck stays private. |
| `communityDecks.clonePublishedDeck` | `{ publishedDeckId }` | `{ savedDeckId }` (clone to library). |
| `communityDecks.getPublishedDeckCodeFirst` | `{ publishedDeckId }` | `{ deckContent }` or null. |
| `communityDecks.togglePublishedDeckLike` | `{ publishedDeckId }` | like toggle. |
| `communityDecks.getPublishedDeckViewerStates` | `{ publishedDeckIds }` | viewer like/ownership state for cards. |
| `communityDecks.listPublishedDeckCommentPage` | `{ publishedDeckId, cursor? }` | comment page (public detail). |
| `communityDecks.listPublishedDeckPage` (paginated) | `{ cursor?, endCursor?, sortBy, legendName?, domain?, pageSize?, rowCount? }` | `{ items, continueCursor, isDone, rowCount }` (library/community page). |
| `deckPlayLinks.create` | `{ savedDeckId? / deckCode? }` | link record/url used to launch simulator. |

Publish form: author name (required), description max 160, highlight cards up to 3, preview; confirm title “Publish to Community Decks?”. Only `status === "ready"` can publish; if dirty, save first; if not saved, “Save the deck before publishing it.” / “Only ready decks can be published.”

### 8.3 Save / publish gating (observed UI)

- **Save** (toolbar, always visible): guest → account dialog; pending action stored in sessionStorage; signed-in → upsert. Empty deck name is allowed if a computed name exists; otherwise toast “Deck name is required before saving.”
- **Private** (lock icon): disabled until saved + ready + no pending mutation; if no publication, clicking starts publish; if published, opens a menu with “Copy community link” and “Make Private”. Tooltip “Private”. Confirm “Move Deck Back to Private?” → “This will remove the current Community Deck publication and keep the deck only in your private library.”
- **Play in Simulator**: disabled until `isDeckReadyForMatch(...).valid`; guest → account dialog; signed-in → save if needed, then navigate to play URL with `savedDeckId`. Incomplete deck click → toast “Incomplete decks can be saved, but they cannot be played yet.” / “Only ready decks can be published.”
- **Discard Draft**: confirm; clears local draft + bookmark scope and returns to `/decks/mine` or `/decks/new`.
- **Delete** (saved deck): confirm “Delete Deck?” / “Delete Deck and Remove Publication?”; deletes via Convex, clears bookmarks/draft link.
- **Maintenance**: `Deckbuilder temporarily unavailable`; “Deck creation and editing are temporarily disabled during scheduled maintenance.” / “…starting 30 minutes before scheduled maintenance.”

### 8.4 Deck library `/decks/mine`

- Header: eyebrow `RIFTBOUND / DECKS`, h1 `YOUR DECKS`; actions `Browse decks` → `/decks`, `New Deck` → `/decks/new?clearDraft=1`; search “Search by deck name or legend…”; tabs `All decks`, `Ready`, `Incomplete`, `Published`; sort `Recently updated`, `Name A–Z`.
- Guest: sign-in card “Sign in to save and publish decks” + “Local drafts still work without an account. Sign in to sync your library and share completed decks with the community.”; local draft card still shown.
- Local draft card: `LOCAL DRAFT` badge, feature card art, name, identity, `Saved locally` / `Saved <time>`, footer `Continue building`; opens draft href.
- Saved deck card: art, name, identity, status badge (Ready/Incomplete, Private/Published/Publication paused), last used/last changed, actions open, share, delete, publish/unpublish; opens `/decks/{id}`.
- Community deck cards (when browsing `/decks`): Play/Clone/Save to my decks gates; like/comment counts; share.
- The lobby’s **Choose Deck** modal uses the same `listSavedDeckSummaries` query but is a compact dialog: eyebrow `Deck Library`, h2 `Choose Deck`, search `Search saved decks…`, sort `Recent / Updated / Name`, summary rows, `Select` / `Selected`, rename/delete/share; “Needs update” for incomplete; “No saved decks yet. Save a deck to start building.”; “No matching saved decks.”; reconnect banner. Selecting a summary loads it for play.

### 8.5 Lobby deck selection & simulator integration

- **Import deck list** in lobby is client-side, guest-capable. It parses with `validateCatalog:true` and `deckRulesMode:"standard"` (signed-in) or `"unrestricted"` (signed-out), shows counts and validation, and only enables Import at `READY TO IMPORT`. It stores the deck in the lobby’s active deck state (not a saved deck).
- **Use Deck Code** tab decodes a code, fills the deck list, same validation.
- **Choose Deck** (signed-in) fetches `listSavedDeckSummaries({})`, selects a summary, calls `resolveSavedDeckForPlayFresh({deckId})`, sets the active deck and provenance; missing/unavailable states: “This saved deck is unavailable. Choose another deck.”; “The deck library is reconnecting. Try again in a moment.”
- URL entry: `https://play.riftatlas.com/?deckCode=<code>` loads the deck client-side and cleans the URL; `?savedDeckId=<id>` loads a saved deck for signed-in users, and for guests shows the local draft plus “Sign in to load a saved deck.”; `?playMode=sealed&sealedDraftId=…` for sealed.
- Builder **Play in Simulator** → if signed-in/ready: save via `upsertSavedDeck` then `window.location.assign(playUrl)` where `playUrl = https://play.riftatlas.com/?savedDeckId=<id>` (locale-aware); if guest: pending auth action `{kind:"save_deck"}` then account dialog; after sign-in the save is replayed and the deck loads.
- Room registration payload (when creating/joining a constructed room):
  ```ts
  constructedDeckRegistration: {
    decklistRaw: string;
    matchmakingPool: "standard" | "origins" | "upcoming";
    savedDeckId: string | null;
    savedDeckName: string | null;
    savedDeckRevision: number | null;
    savedDeckLegalityVersion: string | null;
    savedDeckStatus: "ready" | "incomplete" | null;
    savedDeckOwnerUserId: string | null;
    deckRulesMode: "standard" | "unrestricted";
    matchFormat: "bo1" | "bo3";
  }
  ```
  The lobby validates with `isDeckReadyForMatch(parsed, {format:"standard-constructed", deckRulesMode})`; incomplete saved decks can be assigned in unrestricted but not standard.

---

## 9. Public deck page & deck index

`/decks/community/{publishedDeckId}`:

- Header: `Back to Decks`; legend/key-card art; title; `by <author> · <legend> · Updated <date>`; description; buttons `Play`, `Save to my decks`, like count (heart), comment count, `Share <name>`.
- List/Stats tabs; section counts `1/1`, `1/1`, `39/39`, `3/3`, `10/10`, `12/12`; entries use `1X`/`3X` prefix and energy/might chips; Guide rich text below; TCGPlayer “Buy this Deck” affiliate link.
- `Play` and `Save to my decks` are sign-in gates pre-login. `Share` opens a modal with the public URL, copy button, “Send to a friend” (sign-in).
- No decklist export/copy button on the public page; no edit.
- Stats uses the same `current.deckStats` component.
- `/decks` index: “DECKS”, “Build a deck”, “Your decks” (`/decks/mine`), premier events (TopDeck.gg), Legends spotlight, Community Decks with domain filter and sort `Recent / Trending / Hearts / Comments / Clones`; cards link to detail.
- Screens: `32`–`36`, `37`, `41`.

---

## 10. i18n

- Locales: `en`, `fr`, `ko`, `zh-CN`; builder strings come from the site RSC catalog, namespace `deckbuilder.*` (266 keys), plus `current.*`, `deckLibrary.*`, `deckFit.*`, `cardBookmarks.*`, `deckCatalog.*`, `advanced.*`, `web.abilities.*`, `common.*`, `search.*`.
- Full resolved EN table (all 266 `deckbuilder.*` keys + 546 non-deckbuilder keys used by builder code): **`.recon/specs/05-deck-builder-i18n.md`**; raw JSON: `.recon/specs/data/builder-i18n-strings.json`, `.recon/specs/data/site-messages.json`, `.recon/specs/data/site-i18n-full.json`.
- Key groups: workspace/status (`deckWorkspace`, `localDraftOnly`, `startBuildingToSave`, `unsavedChanges`, `savingChanges`, `savedAt`, `savedToLibrary`, `private`, `published`); import (`importDeck`, `deckList`, `importValidation`, `readyToImport`, `parserErrors`, `warnings`, `useDeckCode`, count templates); export (`exportDeck`, `copyDecklist`, `copyDeckCode`, `compactShareCode`, `shareDeck`, `downloadWallpaper`); sections/group/sort; validation/copy limits; art picker/drag; publish/delete; guide; stats (`current.deckStats.*`).
- ICU placeholders are arrays (e.g. `["Saved ",["time"]]`, plural `["count",2,{one,other}]`). Preserve the wire shapes or reimplement equivalent pluralization.
- Observed exact strings that matter: `Start building to save this deck.`, `Local draft only`, `Ready to play`, `Ready to Import`, `Parser Errors`, `Import Validation`, `Choose a legend first to see matching champions.`, `Choose a legend first to start building the Main Deck.`, `Maximum <n> copies of "<name>" reached.`, `Only 1 copies of "<name>" are allowed in Battlefields.`, `Main deck + champion must contain exactly 40 card(s). Found <n>.`

---

## 11. Assets

Card art (builder):

- Original: `https://assets.riftatlas-workers.com/riftbound/cards/original/{CODE}.webp?v={hash}`.
- Small: `https://assets.riftatlas-workers.com/riftbound/cards/small-v2/{CODE}.webp?v={hash}`.
- CDN transform: `https://assets.riftatlas-workers.com/cdn-cgi/image/width={w},quality=75,format=auto,fit=scale-down/riftbound/cards/{slot}/{CODE}.webp?v={hash}`.
- Catalog tile: `srcset` 320/384 small-v2, 512/640/768/1024/1280/1536 original; `sizes="(max-width:640px) 50vw, (max-width:1919px) 16.5rem, 19rem"`.
- Deck row: `small-v2` 96/128/192/256/320/384, `sizes="70px"`; detail modal: original 96…1536, `sizes` 360/340.
- Alt-art prints use their own code (`RAD-173S`, `OGN-303A`, …). `cards.json` has 253 alt rows.
- Icons: domain icons `/icons/{fury,calm,mind,body,chaos,order}.webp`; might `https://assets.riftatlas-workers.com/riftbound/static/icons/might.webp?v=…`; energy/power chips are text badges; bookmark is CSS ribbon; header/logo assets per 04 spec.
- **Source-asset quirk:** some battlefield print assets are stored upside-down in the CDN (verified `OGN-275`, `OGN-276`, `UNL-205`, `UNL-206`, `UNL-207`); the builder renders them as-is and does not auto-rotate. Preserve this if matching pixel-for-pixel.
- Card art attributes: `data-rift-image-kind="card"`, `data-rift-image-state`, `data-card-art-route="primary"`, `data-card-art-source`, `data-card-art-fallback-index`, `data-card-art-direct-retry`. Use the existing `@rift/cards` image builder and fallback/silhouette frame.

---

## 12. Card data source coverage

- Builder card catalog is embedded in `.recon/pretty/decks/336w80568d601.js` (`let n = [...]`, 1510 rows).
- `.recon/specs/data/cards.json` has **1510 rows with exactly the same IDs**; core fields identical for all rows: `name`, `energyCost`, `powerCost`, `type`, `domains`, `text`, `might`, `rarity`, `set`, `keywords`, `subtypes`, `imageUrl`, `imageLocale`.
- Builder data also has `isAltArt` (253), `baseCardId` (253), `signatureType` (59), `bannedIn` (14 rows), `imageLocale` (20). `cards.json` covers all of these; it stores alt flags as `_isAltArt`/`_baseCardId` and adds `isBanned`, `_setCode`, `_types`, `_domains`, `_isToken`.
- Differences: builder data uses `isAltArt`/`baseCardId`; `cards.json` uses `_isAltArt`/`_baseCardId`. `cards.json` lacks the CDN `?v=` hashes and `imageLocale` is present (20 rows). No missing card IDs or core field differences.
- Sets present: Arcane Box Set, Origins, Origins | Nexus Night, Proving Grounds, Radiance, Spiritforged, Spiritforged | Nexus Night, Secret Garden, Unleashed, Vendetta, Vendetta | Nexus Night. Types: Unit, Spell, Rune, Gear, Legend, Battlefield, Card, Unit Gear.
- Conclusion: `.recon/specs/data/cards.json` **fully covers** the builder’s card source; only normalize `_isAltArt`/`_baseCardId` names and supply CDN version hashes if pixel-identical URLs are required.

---

## 13. What could not be observed without logging in

- Signed-in Convex responses: `listSavedDeckSummaries`, `getSavedDeckEditorSnapshot`, `resolveSavedDeckForPlay*`, `upsertSavedDeck`, `createSavedDeck`, `renameSavedDeck`, `deleteSavedDeck`, publish/unpublish/clone. Shapes above are from call sites; not server-confirmed.
- Actual save/publish/delete submissions and server validation errors; we only opened the sign-in/save gate and did not submit.
- Publish dialog and “Private/Published” menu as a signed-in user; inferred from bundle.
- Account deck library with real saved decks; guest local draft was observed.
- Signed-in deck selection in the lobby and `?savedDeckId=` success path; guest path only showed local draft + “Sign in to load a saved deck.”
- “Radiance · Pre-Rift” signed-in quick-match mode; tab disabled signed-out.
- Share-to-friend POST and membership/auth flows; Cloudflare Turnstile POSTs were not triggered.
- Wallpaper generation/copy (menu observed; settings dialog not exercised).
- Drag/drop interactions (bundle/i18n only; not exercised).
- Hover preview: builder has no large hover preview; desktop hover reveals bookmark/details only. (Board/lobby hover preview is separate.)
- Deck code import success was observed (code filled the import list, READY TO IMPORT); invalid-code error copy was not visually exercised.
- Maintenance gating, 2v2 ban path, Neeko Additional Legends UI, art picker, and sealed integration were not exercised.

---

## 14. Screenshot index (`.recon/screens/decks/`, 97 files)

| Group | Files |
|---|---|
| 1920 core | `w1920-01-empty` … `w1920-15-save-gate` (empty, filter, view, search, card detail, gated section, issues, import-filled, imported, stats, full art, export, named, save gate) |
| 1440 core | `w1440-01-empty` … `w1440-15-save-gate` |
| 1000 mobile | `w1000-01-empty` … `w1000-15-save-gate` (drawer, stats, full art) |
| 390 mobile | `w390-01-empty` … `w390-15-save-gate` (2-col, drawer, stats, full art) |
| Extra states | `01`–`09` filter/view/detail/issues/save/export/import; `12`–`13` filled import; `15` stats; `18` save gate; `20` export menu; `22` full art; `23` invalid import; `24` warning/duplicate import; `25` deck-code tab; `31` main-deck filter; `44` guide editor; `47` deck-code loaded; `48` champion pool, `49` battlefields, `50` runes, `51` sideboard, `52` battlefields settled (upside-down asset quirk) |
| Lobby / library / public | `26` lobby import, `27` lobby deck, `28` choose gate, `30` builder play gate, `32` deck detail, `33` stats, `34` play gate, `35` save gate, `36` 390 detail, `37` decks index, `38` mine guest, `39` mine draft, `40` edit route with draft, `41` share modal, `42` clear-draft, `43` edit route no draft, `45` lobby deck code, `46` lobby savedDeckId guest |

---

## 15. Rebuild checklist for `apps/play`

1. Add routes `/decks/new`, `/decks/[savedDeckId]`, `/decks/mine`, `/decks`, `/decks/community/[id]` (or keep the deck builder in `apps/site` and link from play; the user’s scope says building decks is in scope, so `apps/play` needs it).
2. Reuse `@rift/cards` catalog (1510 rows) and `@rift/cards` deck text parse/export; export the missing helpers (`getCardCopyLimit`, constants, `isDeckReadyForMatch`, Neeko helpers) or reimplement exactly.
3. Implement the single localStorage draft v5 + bookmark/preferences keys; guest flow first.
4. Implement catalog tabs/search/facets/sort/group/pagination/bookmarks/art variants and section eligibility.
5. Implement workspace header, sections, rows, add/remove/move/drag, copy-limit toasts, issues popover.
6. Implement List/Full Art/Stats, guide editor, import/export menu, deck code lazy encode/decode.
7. Implement save/publish gating: guest auth dialog + pending action; signed-in Convex upsert; publish form; deck library.
8. Wire Play in Simulator to `https://play.riftatlas.com/?savedDeckId=<id>` (or `?deckCode=<code>` for guest/local) and room `constructedDeckRegistration`.
9. Use the exact class strings/data hooks in §3; verify at 1920/1440/1000/390 against `.recon/screens/decks/`.
10. Re-run validation against `packages/cards` and the message table in §5.7; add tests for empty deck (7 issues), valid Riven deck (0 issues), copy limits, bans, Neeko, and Standard/Radiance lobby pool detection.
