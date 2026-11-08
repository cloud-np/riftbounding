# 04 — Launcher page spec: `https://riftatlas.com/play`

Source of truth: `.recon/site/play.html` (prerender), `.recon/site/play.rsc.txt` (flight), `.recon/browser/play.rendered.html` (hydrated DOM), `.recon/browser/interactives.json`,
CSS module `.recon/site/dl/_next/static/immutable/chunks/3go3sf_kw5o6g.css` (all `IcFxxa_*` rules), assets in `.recon/site/assets/`.
Framework: Next.js 16.4.2 App Router + React 19 + React Compiler, Tailwind v4 + one CSS-module class family (`IcFxxa_*`). Host: Vercel.
There is **no FAQ section** in the current build (the earlier "FAQ" report was wrong). Page = site chrome header + announcement bar + `<main>` with 5 blocks + site footer.

## 0. Page metadata (verbatim)

- `<title>`: `Play Riftbound Online - Multiplayer, Solo & Sealed | Rift Atlas`
- description: `Play Riftbound online at play.riftatlas.com: find a quick match, host a private room, play solo, play constructed or sealed, and spectate games.`
- keywords: `Riftbound,Riftbound cards,Riftbound card database,Riftbound card search,play Riftbound online,Riftbound simulator,Riftbound deck builder,Riftbound sealed simulator,TCG,trading card game,League of Legends,card database,card search,deck builder,sealed simulator,play simulator,Rift Atlas`
- robots `index, follow`; canonical `https://riftatlas.com/play`; hreflang alternates: en `/play`, zh-CN `/zh-CN/play`, fr `/fr/play`, ko `/ko/play`, x-default `/play`.
- og:title `Play Riftbound Online - Rift Atlas`; og:description `Launch the unofficial Rift Atlas simulator for quick matchmaking, private rooms, solo practice, constructed and sealed play, and spectating at play.riftatlas.com.`; og:image `https://assets.riftatlas-workers.com/riftbound/static/brand/rift-atlas/rift-atlas-social-card.webp?v=20260713`; twitter card `summary_large_image` + same title/description.
- body classes: `min-h-screen overflow-x-hidden font-sans antialiased`; root wrapper `<div class="flex min-h-dvh flex-col">` → `<div class="min-h-0 flex-1">`.
- theme vars used by page CSS: `--foreground`, `--primary`, `--primary-foreground`, `--muted-foreground`, `--border`, `--secondary`, `--background`; fonts `--font-brand` (Bricolage Grotesque), `--font-geist-mono`, Geist sans default.

## 1. Header (site app-chrome, shared) — markup after hydration

`<header data-testid="app-header" data-site-chrome class="sticky top-0 z-50 border-b border-border/55 shadow-[0_14px_28px_-26px_rgba(0,0,0,0.72)] bg-background/92 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80">`
inner `div.w-full.px-3.py-2.sm:px-4.lg:px-5.2xl:px-6` → `div.flex.flex-wrap.items-center.gap-2`:

1. Brand link (`aria-label="Rift Atlas home"`, href `/`): mark image `assets.riftatlas-workers.com/cdn-cgi/image/width=256,.../riftbound/static/brand/rift-atlas/rift-atlas-mark-header.webp?v=20260713` (`h-6 w-auto`, width 128 height 148) + `<span class="font-brand hidden min-[430px]:inline text-base">Rift Atlas</span>`.
2. Card-search `<form>` (flex-1, `lg:max-w-[24rem]` and grows with query length): submit button (`aria-label="Submit card search"`, title "Search cards"), `<input data-testid="header-card-search" placeholder="Search cards...">`, syntax-help button, `Ctrl K` / `⌘ K` kbd chip (button opens help: "Use the up and down arrow keys to navigate suggestions, Enter to choose, and Escape to close.").
3. Nav links (each class `relative inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-md border border-transparent bg-transparent px-2.5 text-xs font-medium text-foreground/64 transition-colors hover:bg-secondary/35 hover:text-foreground`; active adds `bg-secondary/50 text-foreground after:…after:bg-primary/80`): **Advanced** `/advanced`, **Cards** `/cards`, **Decks** `/decks`, **Events** `/events`, **Sealed** `/sealed`, **Play** `/play` (current page ⇒ active).
4. Right cluster `div.ml-auto.flex.shrink-0.items-center.gap-1.5`:
   - icon buttons (h-9 w-9 rounded-full, tooltip inside): **Contact** `/contact` (lucide mail), **Discord** `https://discord.gg/8vfhVuUXmT` (image `Discord-Symbol-Black.png?v=3667ac4e3a56f19d`), **Follow us on X** `https://x.com/playriftatlas`; tooltips `Contact`, `Discord`, `Follow us on X`.
   - theme button `aria-label="Toggle theme"` (lucide sun, tooltip `Theme`; label becomes **Dark mode** in dark theme).
   - locale `<select>` (label `EN`, options `EN / 简体中文 / FR / 한국어`) — see i18n spec; switch sets cookie + navigates to `/fr|/ko|/zh-CN` prefix.
   - membership button `aria-label="Rift Atlas · Membership: Choose a membership"` (member mark layers `--riftatlas-mark-light: url(/membership/rift-atlas-membership-layers.webp?v=2c63b42b11aec410)` / `…-dark.webp?v=09b18d188b44b593`).
   - Buy Me a Coffee link `https://buymeacoffee.com/riftatlas` (img `/bmc-logo-dark-ui.svg?v=a72591fb9e20bf5c`, tooltip `Buy me a coffee`).
   - mobile menu button `aria-label="Open menu"` `aria-controls="mobile-navigation-menu"` (lucide menu), hidden ≥xl.
   - Signed-out: `Sign in` → `/sign-in?redirect_url=%2Fplay` (text link, h-9 px-3 text-xs) and `Sign up` → `/sign-up?redirect_url=%2Fplay` (`bg-primary text-primary-foreground h-9 px-3.5 text-xs`).
   Prerender shows skeleton placeholders for this whole cluster (search input area etc. are client-rendered).

## 2. Announcement bar (below header, site chrome)

`<aside aria-label="RiftAtlas builder story" data-testid="builder-story-announcement" class="border-b border-border/55 bg-secondary/[0.14] backdrop-blur-xl supports-[backdrop-filter]:bg-secondary/[0.11]">`
`div.page-shell.flex.min-h-11.items-center.gap-2.py-1.5` →
- link `https://how-i-build.riftatlas.com` (target _blank): bold `Six months of building RiftAtlas` (mobile: `Six months of RiftAtlas`) + `—` + `Read the story` (text-primary) + lucide arrow-up-right.
- separator `·`
- button (opens membership dialog): member mark + `Consider supporting us` (mobile `Support us`) + filled heart icon.
- dismiss button `aria-label="Dismiss builder story announcement"` (lucide x).

## 3. `<main class="IcFxxa_page">`

### 3.1 Hero `<section aria-labelledby="play-page-title" class="IcFxxa_container IcFxxa_hero">`
`IcFxxa_heroTop` grid `minmax(0,1.1fr) minmax(0,1fr)`, align end, gap 64px, mb 48px:
- eyebrow `<p class="IcFxxa_eyebrow">Rift Atlas / Simulator</p>`
- `<h1 id="play-page-title" class="font-brand IcFxxa_title">Play Riftbound<br><span>online.</span></h1>` (span = primary color)
- intro `max-width:480px`: `<p class="IcFxxa_intro">Find an opponent in Quick Match, host a room for friends, or test a deck on your own, right in your browser.</p>`
- actions `<div class="IcFxxa_actions">`:
  - `<a href="https://play.riftatlas.com/" target="_blank" rel="noopener noreferrer" class="IcFxxa_primaryButton" data-testid="play-launch-simulator">Open simulator <svg lucide arrow-right/> <span class="sr-only">(opens in a new tab)</span></a>`
  - `<a class="IcFxxa_textLink" href="/decks">Choose a deck <svg arrow-right/></a>`
- fine print `<p class="IcFxxa_finePrint">Free to play · No download required</p>`
- board figure `<figure class="IcFxxa_board">`:
  - `figcaption`-less bar `<div class="IcFxxa_boardBar">` with `span[data-testid=play-domain-icons].IcFxxa_domains` containing 6 icons 18×18 lazy: `…/static/icons/{body.webp?v=8f667e4ec1b9b748, calm.webp?v=b50d713a1483c62c, chaos.webp?v=224b21112ac43e32, fury.webp?v=096b571a0d211bc2, mind.webp?v=6048cf14d9a113ef, order.webp?v=f00299635232b05a}` (order on page = body, calm, chaos, fury, mind, order), and `<a class="IcFxxa_hostLink" data-testid="play-board-simulator-link" href="https://play.riftatlas.com/" target="_blank">play.riftatlas.com <svg arrow-right/> <span class="sr-only">(opens in a new tab)</span></a>`
  - `<img class="IcFxxa_boardImage" src="/play/board-chain-20260908.webp?dpl=…" width=1800 height=1000 alt="Rift Atlas simulator with Rebuke on the chain targeting the opposing Kai'Sa, Survivor at a battlefield.">`

### 3.2 "Ways to play" `section.IcFxxa_container.IcFxxa_modesSection`
`<h2 id="ways-to-play-title" class="IcFxxa_sectionTitle">Ways to play</h2>` + `<ul data-testid="play-mode-grid" class="IcFxxa_modes">` 4 `<li class="IcFxxa_mode">` (4-col grid, vertical dividers `border-left`, first/last no side padding). Each: lucide icon 22×22 (primary color) + `<h3>` + `<p>`:

| icon | h3 | p |
|---|---|---|
| crosshair | Quick Match | Constructed or Sealed, Best of 1 or Best of 3, against the next player in the queue. |
| key-round | Private Room | Duel, free-for-all or 2v2 with up to four players. Invite friends or share the room code. |
| flask-conical | Solo Room | Test a deck on your own, or play both sides of a game. |
| eye | Spectate | Enter a room code to watch a match in progress. |

### 3.3 "Play tools" `section.IcFxxa_toolsSection` (bordered band, `background: color-mix(in srgb, var(--secondary) 35%, var(--background))`)
Inside `div.IcFxxa_container`: `<h2 id="play-tools-title" class="IcFxxa_sectionTitle">Play tools</h2>` + `div.IcFxxa_features` with 3 `article.IcFxxa_feature` (alternating columns `.34fr/1fr`; even children flip and copy moves right):

1. `aria-labelledby="play-feature-rewind" data-testid="play-feature-rewind"` — h3 `Rewind`; p `Take back your last action instead of rebuilding the board by hand.` — media `div[data-testid=play-feature-rewind-media].IcFxxa_featureMedia` → poster `<img loading="lazy" width=1440 height=1000 src="/play/rewind-60fps-20260909.webp" alt="Rift Atlas simulator showing a recycled card action being rewound.">` + hidden lazy `<video muted loop playsinline preload="none" width=1440 height=1000 aria-label=same alt>` (source `/play/rewind-60fps-20260909.mp4`) + play button bottom-right `aria-label="Play Rewind motion preview"` (40×40 rounded-full black/70, lucide play).
2. `play-feature-auto-pay` — h3 `Auto-pay`; p `Auto-pay exhausts and recycles the runes a card needs, and the match log records every payment.` — `/play/auto-pay-60fps-20260909.webp|mp4`, 1440×700, alt `Rift Atlas simulator showing automatic payment for a card cost.`
3. `play-feature-conquer` — h3 `Conquer prompts`; p `When a unit takes a battlefield, a prompt beside it offers the right reward, such as Conquer + Score. In showdowns it also shows who has focus and lets you pass it.` — `/play/conquer-60fps-20261008.webp|mp4`, 840×660, alt `Rift Atlas simulator showing a unit moving to a battlefield and the conquer and score prompt.`

### 3.4 "More features" `section.IcFxxa_container.IcFxxa_tableSection`
`<h2 id="play-table-title" class="IcFxxa_sectionTitle">More features</h2>` + `<ul data-testid="play-table-features" class="IcFxxa_tableFeatures">` 6 `<li>` (3-col grid, 12×40 gap). Each with lucide icon 20×20 primary + h3 + p:

| icon | h3 | p |
|---|---|---|
| layers-3 | Deck import | Paste a list or deck code, or open any Rift Atlas deck straight in the simulator. |
| package-open | Sealed | Open packs, build from your pool, and take it into Quick Match or a room. |
| message-circle | Friends & messages | Add friends by code, chat, and invite them straight into your room. |
| palette | Customize | Playmats, sleeves, board lines and emotes. |
| smartphone | Phones and tablets | A touch layout made for small screens, with nothing to install. |
| languages | English, 简体中文, Français, 한국어 | Switch languages any time. Card text and artwork follow your language where available, with English used when a translation is missing. |

### 3.5 End actions `div.IcFxxa_container.IcFxxa_endActions`
- `<a … class="IcFxxa_primaryButton" data-testid="play-launch-simulator-footer" href="https://play.riftatlas.com/" target="_blank" rel="noopener noreferrer">Open simulator` + arrow + sr-only `(opens in a new tab)`
- `<a class="IcFxxa_textLink" href="/decks">Choose a deck` + arrow
- `<a class="IcFxxa_textLink" href="https://discord.gg/8vfhVuUXmT" target="_blank" rel="noopener noreferrer">Join the Discord` + arrow + sr-only `(opens in a new tab)`

## 4. Footer (site footer, rendered outside the `<main>`)

`<footer role="contentinfo" data-site-footer class="border-t border-border/70 bg-background/85 backdrop-blur-sm">`
`div data-testid="site-footer-inner" class="flex w-full flex-col gap-3 px-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6 sm:px-4 md:px-6 lg:px-8"` → row (`sm:flex-row sm:items-center sm:justify-between`):
- `<p class="max-w-3xl text-sm leading-6 text-muted-foreground">Rift Atlas was created under Riot Games' "Legal Jibber Jabber" policy using assets owned by Riot Games. Riot Games does not endorse or sponsor this project.</p>`
- `<nav aria-label="Footer" class="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">` links (class `rounded-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background`): `Patch Notes` `/changelog`, `Legal Notice` `/legal-notice`, `Privacy Policy` `/privacy-policy`, `Terms of Service` `/terms-of-service`, `Media Kit` `/media-kit`, `Contact` `/contact`.
- Also present in layout (not visible on this page): `<section aria-label="Notifications alt+T" …>` toaster region.

## 5. CSS module `IcFxxa_*` (exact, from `3go3sf_kw5o6g.css`)

Base:
```css
.IcFxxa_page{color:var(--foreground)}
.IcFxxa_container{width:min(1320px,100% - 80px);margin-inline:auto}
.IcFxxa_hero{padding-block:64px 80px}
.IcFxxa_heroTop{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);align-items:end;gap:64px;margin-bottom:48px}
.IcFxxa_eyebrow{color:var(--primary);font-family:var(--font-geist-mono),monospace;letter-spacing:.19em;text-transform:uppercase;font-size:.68rem;font-weight:700}
.IcFxxa_title{letter-spacing:-.035em;margin-top:22px;font-size:clamp(56px,5.1vw,76px);line-height:1.02}
.IcFxxa_title>span{color:var(--primary)}
.IcFxxa_heroIntro{max-width:480px}
.IcFxxa_intro{color:var(--muted-foreground);font-size:15px;line-height:1.8}
.IcFxxa_actions,.IcFxxa_endActions{display:flex;flex-wrap:wrap;align-items:center;gap:16px 24px}
.IcFxxa_actions{margin-top:28px}
.IcFxxa_primaryButton,.IcFxxa_textLink{display:inline-flex;justify-content:center;align-items:center;gap:16px;min-height:48px;font-size:13px;font-weight:600}
.IcFxxa_primaryButton{background:var(--primary);color:var(--primary-foreground);border-radius:4px;padding:12px 20px;transition:filter .2s}
.IcFxxa_primaryButton:hover{filter:brightness(1.12)}
.IcFxxa_textLink{color:var(--muted-foreground);transition:color .2s}
.IcFxxa_textLink:hover{color:var(--primary)}
.IcFxxa_primaryButton:focus-visible,.IcFxxa_textLink:focus-visible,.IcFxxa_hostLink:focus-visible{outline:2px solid var(--primary);outline-offset:5px;border-radius:3px}
.IcFxxa_finePrint{color:var(--muted-foreground);margin-top:20px;font-size:11px}
.IcFxxa_board,.IcFxxa_featureMedia{border:1px solid var(--border);background:var(--background);border-radius:6px;overflow:hidden;box-shadow:0 24px 60px #0003}
.IcFxxa_boardBar{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px 24px;padding:12px 20px}
.IcFxxa_domains{display:flex;gap:14px}
.IcFxxa_domains img{opacity:.75}
.IcFxxa_hostLink{display:inline-flex;min-height:32px;align-items:center;gap:8px;color:var(--muted-foreground);font-family:var(--font-geist-mono),monospace;letter-spacing:.04em;font-size:11px;transition:color .2s}
.IcFxxa_hostLink:hover{color:var(--primary)}
.IcFxxa_hostLink>svg{width:14px;height:14px}
.IcFxxa_boardImage{display:block;width:100%;height:auto}
.IcFxxa_sectionTitle{border-bottom:1px solid color-mix(in oklab,var(--border) 50%,transparent);font-family:var(--font-brand),sans-serif;letter-spacing:-.025em;margin-bottom:8px;padding-bottom:8px;font-size:20px;font-weight:700}
.IcFxxa_modesSection{padding-bottom:80px}
.IcFxxa_modes{display:grid;grid-template-columns:repeat(4,minmax(0,1fr))}
.IcFxxa_mode{padding:20px 24px 8px}
.IcFxxa_mode:first-child{padding-left:0}
.IcFxxa_mode:last-child{padding-right:0}
.IcFxxa_mode+.IcFxxa_mode{border-left:1px solid var(--border)}
.IcFxxa_mode>svg,.IcFxxa_tableFeatures svg{color:var(--primary)}
.IcFxxa_mode h3,.IcFxxa_tableFeatures h3{letter-spacing:-.015em;margin-top:18px;font-size:16px;font-weight:600}
.IcFxxa_mode p,.IcFxxa_tableFeatures p{color:var(--muted-foreground);margin-top:8px;font-size:13px;line-height:1.7}
.IcFxxa_toolsSection{border-block:1px solid var(--border);background:color-mix(in srgb,var(--secondary) 35%,var(--background));padding-block:64px 88px}
.IcFxxa_features{display:grid;gap:64px;margin-top:40px}
.IcFxxa_feature{display:grid;grid-template-columns:minmax(0,.34fr) minmax(0,1fr);align-items:center;gap:56px}
.IcFxxa_feature:nth-child(2n){grid-template-columns:minmax(0,1fr) minmax(0,.34fr)}
.IcFxxa_feature:nth-child(2n) .IcFxxa_featureCopy{order:1}
.IcFxxa_featureCopy h3{letter-spacing:-.025em;font-size:22px;font-weight:600}
.IcFxxa_featureCopy p{max-width:360px;color:var(--muted-foreground);margin-top:12px;font-size:14px;line-height:1.8}
.IcFxxa_tableSection{padding-top:64px}
.IcFxxa_tableFeatures{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px 40px}
.IcFxxa_tableFeatures li{padding-block:20px 8px}
.IcFxxa_tableFeatures p{max-width:340px}
.IcFxxa_endActions{border-top:1px solid var(--border);margin-top:56px;padding-block:32px 80px}
```
`@media (max-width:1100px)`: container `calc(100% - 48px)`; heroTop gap 40px; mode padding-inline 16px; feature gap 36px, columns `.42fr`.
`@media (max-width:899px)`: hero block 44/56px; heroTop 1 column gap 24 mb 32; title `clamp(46px,8vw,68px)`; heroIntro max 580; modes 2 cols (odd padding-left 0, even padding-right 0, 3rd no border-left, items ≥3 border-top + mt 12); tools 48/64, features gap 48 mt 32; feature 1 col gap 16 (copy order back to 0, p max 540); table 2 cols column-gap 32; endActions mt 40 pb 56.
`@media (max-width:599px)`: container `calc(100% - 32px)`; hero pt 32; title `clamp(39px,11.8vw,60px)`; intro 14/1.7; eyebrow .1em/10px; boardBar padding 12; domains gap 10 & img 16×16; mode pb 12, odd pr 12 / even pl 12; mode p 12px; tableFeatures 1 col row-gap 4, li becomes 2-col grid `20px 1fr` gap 14 with `li>:not(svg){grid-column:2}`; title zh override `:lang(zh-CN){font-size:clamp(36px,4.3vw,64px);line-height:1.22}`.
`@media (prefers-reduced-motion:reduce)`: `.IcFxxa_page *{transition:none}`.

## 6. Assets & routes used

| asset | path |
|---|---|
| hero board | `/play/board-chain-20260908.webp` (4790×…) |
| rewind | `/play/rewind-60fps-20260909.webp` + `.mp4` |
| auto-pay | `/play/auto-pay-60fps-20260909.webp` + `.mp4` |
| conquer | `/play/conquer-60fps-20261008.webp` + `.mp4` |
| domain icons | `https://assets.riftatlas-workers.com/riftbound/static/icons/{body,calm,chaos,fury,mind,order}.webp?v=…` |
| header mark | `…/riftbound/static/brand/rift-atlas/rift-atlas-mark-header.webp?v=20260713` (resized via `/cdn-cgi/image/width=…`) |
| bmc logo | `/bmc-logo-dark-ui.svg` (same-origin) |
| favicons | `/favicon.ico?favicon.…`, `/apple-touch-icon.png?v=20260713` |

Outbound/CTA links: `https://play.riftatlas.com/` (primary + board bar), `/decks` (Choose a deck), `https://discord.gg/8vfhVuUXmT`, `https://how-i-build.riftatlas.com`, `/changelog /legal-notice /privacy-policy /terms-of-service /media-kit /contact`, `https://buymeacoffee.com/riftatlas`, `https://x.com/playriftatlas`.

Notes for a 1:1 rebuild: the 4 demo webps are all static `/play/*` files on the site origin; the `<video>` elements have **no `<source>` child in the initial HTML** — the mp4 is attached client-side on play (lazy `preload="none"`, poster webp always rendered, `data-motion-state="Still preview"` wrapper). Tailwind arbitrary values (`bg-background/92`, `supports-[backdrop-filter]:…`) are used as-is; the `IcFxxa_` module is a plain CSS module, not Tailwind.
