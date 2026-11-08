# `.recon/specs/` — index (specialist analyst #2: Game Board UI & Interactions)

| file | what it is | size |
|---|---|---|
| `02-board-ui.md` | **Main deliverable.** Full board-UI spec: component tree + inventory, layout system & verbatim Tailwind class strings, hand-fan / pile-stack / battlefield layout math, card component & visual states, hover preview layer, drag & drop, targeting, assets & SFX map, per-player colours, responsive rules, FFA/2v2 rules, live-browser confirmation, open questions. | ~1100 lines |
| `02-design-tokens.css` | Every design token, verbatim: Tailwind v4 `@layer theme` `:root,:host`, all other custom-property blocks (incl. `.gb-board`), 38 `@font-face`, 46 `@keyframes`, `@layer` order, `@property` registrations. | 2653 lines |
| `02-hotkeys-and-menus.md` | Every keyboard shortcut (press + hold + pointer gestures), every context-menu item → action type, the emote wheel + full emote catalogue, settings/toggles panel, mode & prompt state machine. | ~450 lines |

Scratch (raw evidence, kept for citation):

| file | contents |
|---|---|
| `scratch/css-board-classes.md` | 1058 verbatim CSS rules for board-relevant custom classes (gb-/tablet-/touch-/card-/identity-/sidebar-/time-warp-/chain-/score-/hand-/battlefield-/playmat-/banish-/rune-/showdown-/expected-action-button-…) incl. media-query and `@container` context. |
| `scratch/assets-sounds.md` | 187/187 asset-manifest entries mapped to local files, icon list (83), the SFX registry verbatim, ~50 sound call sites with semantics, card-image slot map, default card back per slot, token art usage. |
| `scratch/board-chunk-10k-25k.md` | Chain stack, showdown, judge/bug chat, match log, counter overlay system, card tags/labels, board-card chips, action dock (`sf`). |
| `scratch/board-chunk-35k-48k.md` | Identity rail + compact opponent boards, turn/phase/time-warp, drag-ghost physics + ordered drop index, deck peek, sidebar/settings. |
| `scratch/chunk-cosmetics-emotes-autopay.md` | Board cosmetics (sleeves/playmat/board-lines catalogue + same-origin `/cosmetics/creators/...` assets), the emote/ping/chat protocol, and the **auto-pay** engine (`payment_batch` + `paymentGroupOrigin:"auto_pay_button"`), plus board-geometry thresholds and the GlassLens/worker bootstrap. |
| `scratch/setup-mulligan-overlays.md` | Setup flow (initiative roll / first-player choice / mulligan / battlefield pick / deck select / sideboarding): shell + z-ladder, the **2-row flex mulligan layout** (not a fan), selection/flip animations, multiplayer mulligan picker, action payloads, English label table. |

Primary sources: `.recon/pretty/playapp/0xawjzm3yjpr1.js` (board, 65 017 lines, one module `430427`),
`439rnwycqsxxv.js` (layout math modules `637428/426582/9961/997490/929289/793143/112691`),
`25vik2nxxo51i.js` (card modules `298551/612518/938822`), `3-2i4k6s343ud.js` (emote catalogue `593673`),
`2atnqtfqvj-z4.js` (setup/mulligan), `2goht72gp0rq8.js` (SFX engine `123139`), plus the compiled
Tailwind v4 CSS in `.recon/site/playapp/dl/_next/static/immutable/chunks/`.
Live captures cross-checked: `.recon/screens/49-54-board-*.png`.
