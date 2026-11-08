# Board chunk spec — `.recon/pretty/playapp/0xawjzm3yjpr1.js` lines ~9 985 – 25 190

Reverse-engineered from the prettified turbopack chunk (single module **430427**, exports at file end;
module 2642 is the 4-line tail import). Range under study: **lines 10 000 – 25 000** (with ~15 lines of
lead-in/lead-out quoted for context where a declaration starts just outside the slice).

React Compiler memo-cache boilerplate (`C[0] !== x ? … : (v = C[1])`) is ignored throughout.

---

## 0. SCOPE MAP — what is actually in this slice

| Requested subsystem | In this slice? | Where the full thing lives (same file) |
|---|---|---|
| `tablet-chain-*` chain panel | **NO** | 31 700 – 34 000 (`tablet-chain-panel`, `tablet-chain-entry-heading`, …) |
| Chain **stack** (`data-chain-*`, `chainEntry`) | **YES** | `iI` 14 667–15 300 + action hints `ie`/`it` 10 887–11 045 + log classifier 11 064–11 216 |
| Showdown / conquer prompts | fragment only | Full UI `data-showdown-*`, `expected-action-button--showdown` at 40 700–41 300. In slice: only the log-action classifier entries `battlefield_conquer_*` (11 136–11 139) and `attacker_confirm_conquer` not present (53 806+) |
| Mulligan UI / `data-mulligan-*` | fragment only | Full UI at 27 925–31 700. In slice: only the log turn-grouping text sniff `"mulligans are complete. Starting the game."` (11 703) |
| Judge call / bug report / chat overlays | **YES (major)** | 9 985–15 300 (`o$`, `oH`, `oF`, `oK`, `ob`, `i_`, `ij`, `ib`–`ix`, `ik`, `iC`) |
| Card label / tag wheel, counters, buffs, duplicate mode | **YES** | 16 846–24 660 (counter overlay system, card tags, board card actions, action dock) |
| Prompt/dialog primitives | **YES** | `oh` (9 644), hint popovers `dO`, `dU`, `dM`, dock popovers in `sf` |
| Misc. also in slice | | match log `io`/`ii`, target-arrow SVG layer `i1`/`i8`/`le`, score/identity rails `iZ`, disconnect badges, piles `sq`, token quick bar `sa`, legend-XP counter `sO` |

In-file module references used by this slice (external chunks, class strings **not** defined here):
`tp = e.i(298551)` (board action-button/tooltip/card primitives — `tp.w,I,x,N,F,a,$,m,S,M,g,r,y,E,K`),
`th = e.i(851810)` (`th.k` card component, `th.S,D,o,l,$,w` …), `of = e.i(147801)` (`of.w,d,j`),
`om = e.i(924285)` (AnimatePresence), `tc = e.i(779142)` (`tc.w` fine-pointer, `tc.G` watch),
`nU = e.i(201332)` (chat limits `nU.T`, `nU.o`), `ox = e.i(708446)` (screenshot limits `ox.B`, `ox.l`),
`b.f` = framer-motion, `l.f` = clsx-like join, `a.jsx(s)` = jsx runtime, `g.r` = i18n hook, `y.memo` = React.memo.

Icons defined just outside/inside slice: `nY` arrow-up-to-line (recycle), `nJ` bug, `n5` gallery-horizontal-end,
`n3` gem, `ot` move, `od` star, `oN` circle-alert, `oA` circle-question-mark, `oT` sparkles, `oB` thumbs-up,
`oi` send-horizontal, `la` toggle-left, `lo` toggle-right, `ls` cog, `lu` venetian-mask.

---

## 1. Judge-call message components (9 985 – 10 720) — `o$`, `oH`, `oF`, `oK` (+`ob` 9 790)

`function o$(e)` — predicate `isJudgeCallOpenAwaitingAnswer`:
```
!e.parentCallId && "open" === e.status && ("pending" === e.delivery || "posted" === e.delivery)
  && !e.deliveryFailureCode && !e.deliveryPendingReason
```

### 1.1 `oH` (9 994–10 037) — “private content” marker
Resolves i18n `sim.judgeCall` → `visibility.onlyYou` twice (aria-label + title, memoised twice — benign).
Renders `oD.f` icon inside:
```jsx
<span className="ml-auto inline-flex shrink-0">
  <span role="img" data-testid={testId} aria-label={t} title={r}
    className="inline-flex h-[1.05rem] w-[1.05rem] cursor-help items-center justify-center rounded-full border border-[rgba(190,177,241,0.28)] bg-[rgba(65,49,100,0.38)] p-0 text-[#dcd3ff] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#cbbdff]" />
</span>
```
Icon class inside: `h-[0.58rem] w-[0.58rem]`, `strokeWidth: 1.9`.
Test-ids used: `judge-private-question-marker`, `judge-private-thread-marker`, `judge-private-answer-marker`,
`judge-private-status-marker`, `bug-private-message-marker`, `bug-private-thread-marker`, `bug-private-delivery-marker`.

### 1.2 `oF` (10 038–10 070) — sr-only live announcer
Diffs `value` prop into state; renders `<span className="sr-only" role="status" aria-live="polite" aria-atomic="true">`.

### 1.3 `oK` (10 071–10 719) — JudgeCallMessage `li`
Props: `{ judgeCall, entryKind, answerWait, feedback, feedbackAvailable=true, closeAvailable=true,
isRequester=false, onClose, onEdit, onSubmitFeedback }`.
State read off the judge-call object: `id, parentCallId, status ("open"|"answered"|"closed"|"expired"),
visibility ("public"|"private"), question, requestedByPlayerName/Id, requestedAt, delivery
("pending"|"posted"|"failed"|"unavailable"), deliveryFailureCode ("account_banned"|"content_rejected"),
deliveryRejectionReason ("severe_abuse"|"unintelligible"), deliveryPendingReason ("review_unavailable"),
discordThreadUrl, closedAt, expiresAt, correctsAnswerId, correctedByAnswerId,
answer { text, translation{text,language}, judgeDisplayName, answeredAt, judgeApprovedAt, verifiedJudge,
communityHelperRank|contributionLevel, answeredCount }`.
Renders up to four `<li>` variants by `entryKind` (`question`|`thread`|`answer`|`status`):

**question** — `li data-testid="judge-question-chat-message"`:
```
className = clsx(
 "w-[calc(100%-0.42rem)] justify-self-center rounded-[0.22rem] border border-[rgba(132,196,222,0.22)] bg-[rgba(8,28,42,0.76)] px-[0.34rem] py-[0.28rem] text-[#d8edf5] shadow-[inset_0_0_0_1px_rgba(132,196,222,0.05)]",
 isOpen && "border-l-2 border-l-[#8bbcd7]/70 px-[0.45rem] py-[0.4rem]")
```
Inner: `div.flex.items-start.gap-[0.3rem]` → `div.min-w-0.flex-1` with
- heading `p` : `m-0 text-[0.52rem] font-bold uppercase tracking-[0.08em] text-[#7ea6bd]` (`questionHeading`)
- question `p` : `mt-[0.1rem] whitespace-pre-wrap break-words text-[0.66rem] leading-[1.38] text-[#d8e6f4]`
- requestedBy `p` : `mt-[0.12rem] text-[0.55rem] text-[#7188a3]` (rich link via `oO._`)
- `oF` announcer
- open calls append `div data-testid="judge-call-status-message" aria-live="polite"` block
  `mt-[0.35rem] border-t border-[#8bbcd7]/15 pt-[0.3rem]` containing status row
  `m-0 flex items-center gap-[0.25rem] text-[0.6rem] font-semibold text-[#acd2e7]` with spinner
  `h-[0.66rem] w-[0.66rem] shrink-0 animate-spin motion-reduce:animate-none` (pending) or clock icon.
- footer row (only when `discordThreadUrl || closeAvailable`):
  `mt-[0.2rem] flex flex-wrap items-center justify-between gap-x-[0.35rem] gap-y-[0.15rem]`
  - thread link `a data-testid="judge-waiting-thread-link"`:
    `inline-flex min-h-6 items-center gap-[0.18rem] text-[0.6rem] text-[#b5eaf1] underline decoration-[#b5eaf1]/40 underline-offset-2 hover:text-[#e4fbff] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#9fe5ef]`
  - close button `data-testid="judge-close-request"`:
    `inline-flex min-h-5 items-center gap-[0.12rem] rounded-[0.16rem] border border-[rgba(172,194,218,0.24)] bg-[rgba(31,44,59,0.54)] px-[0.24rem] text-[0.52rem] font-semibold text-[#c4d1df] hover:border-[rgba(197,215,235,0.4)] hover:text-[#edf5fd] focus-visible:outline-2 focus-visible:outline-[#9fe5ef] disabled:cursor-default disabled:opacity-50`
    auto-clears its busy state after 10 s (`setTimeout … 1e4`).

**thread** — `li data-testid="judge-discord-thread-system-message"` (only when `!o$(judgeCall)`):
same base class as question; `thread.systemHeading` heading; link
`mt-[0.1rem] inline-flex min-h-5 items-center gap-[0.18rem] text-[0.64rem] font-semibold text-[#b5eaf1] underline decoration-[rgba(181,234,241,0.42)] underline-offset-2 …`; `oH` marker.

**answer** — `li data-testid="judge-answer-chat-message"`:
```
className = "w-[calc(100%-0.42rem)] justify-self-center rounded-[0.28rem] border border-l-2 border-[#79c9bc]/20 border-l-[#79c9bc]/70 bg-linear-to-br from-[#142b34] to-[#101c2b] px-[0.5rem] py-[0.45rem] text-[#edf5fa]"
```
- heading `m-0 text-[0.55rem] font-bold uppercase leading-[1.4] tracking-[0.08em] text-[#8dd8cb]` — key = `correctionHeading`|`additionalAnswerHeading`|`answerHeading`
- `oC.f` badge `data-testid="judge-approved-badge"` (label `judgeApproved`)
- contribution badge `span data-testid="judge-contribution-badge" data-contribution-level={q} role="img" aria-label={...}` class `ml-auto inline-flex min-h-4 shrink-0 cursor-help items-center gap-[0.12rem] text-[0.48rem] text-[#96b2c2]`
- helper name row `judge-answer-helper` class `m-0 min-w-0 break-words text-[0.8rem] font-bold leading-[1.35]`
- verified badge `oC.f` `{label: verifiedJudge, size:"regular"}`
- answer text `judge-answer-text`, lang = translation.language; class
  `mt-[0.38rem] whitespace-pre-wrap break-words border-t border-[#a3c9d8]/15 pt-[0.35rem] text-[0.8rem] leading-[1.5] text-[#f0f7fc]`
  (replaced text wrapped in `<del className="text-[#96b2c2] decoration-1">`)
- translation toggle `judge-answer-translation` + button class
  `rounded-sm underline-offset-2 hover:text-[#b4eee3] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8dd8cb]` (toggles `showTranslation`/`showOriginal`)
- brevity note `mt-[0.45rem] rounded-[0.18rem] bg-[#07131f]/35 px-[0.32rem] py-[0.28rem] text-[0.6rem] leading-[1.45] text-[#9cabbc]`
- feedback row (when `onSubmitFeedback`): `mt-[0.22rem] flex flex-wrap items-center gap-[0.2rem] border-t border-white/10 pt-[0.22rem]`
  - group `role="group" aria-label={feedback.prompt}` with two buttons `data-testid="judge-feedback-helpful"` / `"judge-feedback-unclear"` (`aria-pressed` = rating match); base
    `inline-flex min-h-5 items-center gap-[0.18rem] rounded-[0.16rem] border px-[0.28rem] text-[0.55rem] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-[#9fe5ef] disabled:cursor-default`
    selected `border-[rgba(151,231,202,0.5)] bg-[rgba(64,145,119,0.28)] text-[#d8fff0]`
    unselected `border-[rgba(144,204,185,0.24)] bg-[rgba(9,36,37,0.58)] text-[#add7ca] hover:border-[rgba(151,231,202,0.44)] hover:text-[#e4fff5] disabled:opacity-55`
  - status span class `text-[0.54rem] leading-[1.3]` + (`sr-only` when no message) + failed tone `text-[#efb597]` else `text-[#83aa9f]`

**status** — `li data-testid="judge-call-status-message"` when no answer:
```
clsx("w-[calc(100%-0.42rem)] justify-self-center rounded-[0.2rem] border px-[0.32rem] py-[0.24rem]",
  (failed/unavailable && (rejected || !closedExpired)) ? "border-[rgba(226,171,124,0.24)] bg-[rgba(52,33,25,0.78)] text-[#efc3a1]"
  : closedExpired ? "border-[rgba(156,169,188,0.2)] bg-[rgba(24,32,43,0.72)] text-[#b9c5d3]"
  : "border-[rgba(132,196,222,0.2)] bg-[rgba(8,28,42,0.68)] text-[#b9d6e4]")
```
Row `flex items-start gap-[0.28rem]`; title `m-0 text-[0.58rem] font-semibold`; description
`mt-[0.08rem] text-[0.55rem] leading-[1.35] opacity-75`; edit button `mt-[0.2rem] min-h-6 text-[0.6rem] font-semibold underline underline-offset-2`; appeal link `(0,nZ.k)("/appeal", locale)` same classes.
Wait estimate `p data-testid="judge-answer-wait-estimate"` class `mt-[0.08rem] text-[0.55rem] leading-[1.35] opacity-90` with rich `status.postedWait[Seconds|Capped]Description` (strong = `font-bold`).
I18n keys: `sim.judgeCall.{questionHeading, answerHeading, correctionHeading, additionalAnswerHeading, requestedBy, thread.open, thread.systemHeading, editQuestion, appeal, close, closeAria, answerBrevity[WithThread], status.{accountBanned,contentRejected,closed,expired,pending,posted,unavailable,failed}[Description], status.postedWait*Description, feedback.{helpful,unclear,pending,thanks,retryableError,unavailable,prompt}, contribution.{answeredCount,<rank>}, judgeApproved[Description], verifiedJudge[Description], seconds/minutes}`.

### 1.4 `ob` (9 790–9 905) — bug screenshot control (declared just left of slice)
`data-testid="bug-report-screenshot-control"` wrapper `grid min-w-0 gap-1 px-[0.12rem] text-[#d7b595]`;
checkbox `className="accent-[#d7a36f]"`; label `inline-flex cursor-pointer items-center gap-1.5 text-[0.6rem] font-semibold`;
status `m-0 flex items-center gap-1 text-[0.55rem]` + spinner `size-3 animate-spin`; error `m-0 text-[0.55rem] leading-snug`.
Keys `sim.bugReport.screenshot.{attach,audience,capturing,errors.<code>}`. Capture is `navigator.mediaDevices.getDisplayMedia`,
`displaySurface` must be `"browser"`; downscales to `ox.l` max edge, tries JPEG q .85/.7/.55 ≤ `ox.B` bytes.
Errors (`ow extends Error`): `cancelled|tabRequired|captureFailed|unsupported`.

---

## 2. Match log (10 724 – 11 997) — `o2`, `ir`, `ia`, `io`, `ii`

### 2.1 Constants (10 724–10 764)
Type-scale clamps (reused by chat too):
```
oq = "text-[clamp(0.6rem,0.5rem+0.28vmin,0.8rem)]"
oU = "text-[clamp(0.54rem,0.46rem+0.24vmin,0.72rem)]"
oZ = "text-[clamp(0.68rem,0.58rem+0.32vmin,0.9rem)]"
oX = "text-[clamp(0.64rem,0.54rem+0.28vmin,0.82rem)]"
oG = "text-[clamp(0.5rem,0.44rem+0.2vmin,0.66rem)]"
oV = "text-[clamp(0.6rem,0.53rem+0.26vmin,0.8rem)]"
oY = clsx("m-0 flex items-baseline gap-[0.12rem] text-[#e2ebf8] leading-[1.24]", oV)   // log row text
oQ = clsx("text-(--text-dim) leading-[1.08] opacity-[0.82] mr-[0.16rem]", oG)          // timestamp
o0 = "inline-flex h-[0.78rem] w-[0.78rem] shrink-0 items-center justify-center"
o8 = "h-[1.34rem] w-[1.34rem]"
o5 = { type: "spring", stiffness: 420, damping: 34, mass: 0.62 }                       // chain stack + chat motion spring
oJ = image "/tokens/thumbs/Gold.webp"
```
`o2` = actionKind → {Icon, messageKey}:
| kind | icon | key |
|---|---|---|
| turn | `n0.f` | `sim.board.matchLogActionTurn` |
| inspect | `eY.f` | `sim.board.matchLogActionInspect` |
| draw | `n5` | `sim.board.matchLogActionDraw` |
| deck | `n6.f` | `sim.board.matchLogActionDeck` |
| trash | `oc.f` | `sim.board.matchLogActionTrash` |
| resource | `n3` | `sim.board.matchLogActionResource` |
| board | `ot` | `sim.board.matchLogActionBoard` |
| spell | `n7.f` | `sim.board.matchLogActionSpell` |
| battle | `os.f` | `sim.board.matchLogActionBattle` |
| score | `ou.f` | `sim.board.matchLogActionScore` |
| legend-xp | `od` | `sim.board.matchLogActionLegendXp` |
| rewind | `oa.f` | `sim.board.matchLogActionRewind` |
| forward | `or.f` | `sim.board.matchLogActionForward` |

### 2.2 `ir` (11 045) — grouping helper
Appends an entry to last group when same turn/`activity`, else pushes
`{kind:"turn",turnNumber,turnPlayerId,entries:[…]}` or `{kind:"activity",entries:[…]}`.

### 2.3 `ia` (11 064–11 215) — LogActionIcon
`actionKind` prop wins if it’s a key of `o2`; else maps `actionType` string →
bucket. Full switch (verbatim action strings):
- **turn**: `end_turn`, `end_beginning_phase`, `set_extra_turn`
- **inspect**: `peek_deck_top`, `peek_deck_bottom`, `dismiss_deck_peek`, `set_deck_peek_card_reveal`, `set_deck_peek_cards_reveal`, `set_hand_reveal`, `set_card_hidden`, `set_card_revealed_to_opponent`
- **draw**: `draw_cards`, `take_top_from_deck`, `take_card_from_deck`
- **deck**: `shuffle_deck`, `recycle_deck_peek_card`, `recycle_all_trash_to_deck`, `clear_deck_peek`, `put_deck_peek_card_on_top`, `send_to_deck`
- **trash**: `move_cards_to_trash_batch`
- **resource**: `draw_rune`, `send_rune_to_deck_bottom`, `recycle_rune_for_floating_energy`, `payment_batch`, `rune_batch`, `send_to_rune_deck`, `floating_resource_batch`, `adjust_floating_resource`, `clear_floating_resources`
- **board**: `roll_die`, `create_token`, `move_card`, `move_off_board_cards_batch`, `transfer_card_control`, `equip_card`, `toggle_exhausted`, `adjust_card_might`, `unlink_banished_card`, `dockside_banish_unit`, `dockside_play_banished`, `kharox_play_from_trash`, `animate_orianna_gear`, `choose_neeko_legend`, `duplicate_card`, `set_battlefield_brush`
- **spell**: `chain_add`, `chain_resolve`, `chain_set_repeat`
- **battle**: `battlefield_conquer_pass_focus`, `battlefield_conquer_pass_response`, `battlefield_conquer_dismiss`, `battlefield_conquer_confirm`
- **score**: `set_score`, `adjust_score`
- **legend-xp**: `adjust_legend_xp`
- **rewind**: `rewind_last_action`
- **forward**: `forward_last_rewind`
- default → null ⇒ placeholder dot:
  `span data-log-action-placeholder="true"` class `o0`; dot `h-[0.2rem] w-[0.2rem] rounded-full bg-[rgba(181,203,231,0.44)]` `data-log-action-placeholder-dot`.
Icon chip: `clsx(o0, "rounded-[0.13rem] border border-[rgba(181,203,231,0.18)] bg-[rgba(10,22,37,0.38)] text-[rgba(181,203,231,0.82)]")`
with `data-log-action-kind={kind}` `data-log-action-label={label}`; icon `h-[0.58rem] w-[0.58rem]`, strokeWidth 2.

### 2.4 `io` (11 216–11 625) — MatchLogEntry
Props: `{text, authorPlayerId, at, actionKind, actionType, meId, meName, opponentId, opponentName,
onCardHoverPreview, onCardHoverPreviewEnd}`.
Author inference: text starts with `"<meName> "` → me; `"<opponentName> "` → opponent; else `authorPlayerId`.
Row `li`:
```
className="relative rounded-[0.24rem] border border-[rgba(166,185,209,0.12)] bg-[rgba(32,49,70,0.84)] py-[0.1rem] pr-[0.24rem] pl-[0.38rem]"
```
Author tick `span` `absolute left-[0.08rem] top-[0.12rem] bottom-[0.12rem] w-[0.1rem] rounded-full` +
me `bg-[rgba(120,221,183,0.92)] shadow-[0_0_6px_rgba(120,221,183,0.5)]`
opponent `bg-[rgba(255,187,110,0.92)] shadow-[0_0_6px_rgba(255,187,110,0.45)]`
neutral `bg-[rgba(166,185,209,0.44)]`.
Rich text rendering via `oW.O(text, locale)` token stream:
- `resource-amount`: wrapper `inline-flex items-center gap-[0.12rem] align-middle leading-none` `data-log-resource-amount`, `data-log-energy`, `data-log-power`;
  energy badge `inline-flex size-[0.86rem] shrink-0 items-center justify-center rounded-full border border-black/10 bg-white text-[0.53rem] font-bold leading-none text-[#0a0f18] shadow-[0_1px_2px_rgba(0,0,0,0.18)]` `data-log-energy-badge`; power icons group `inline-flex items-center -space-x-[0.18rem]` `data-log-power-icons`; power pip `size-[0.76rem] rounded-[0.07rem]` (image `oP.r`); “>6 or 0” shows numeric `mr-[0.08rem] text-[0.56rem] font-semibold`.
- `card`: `button` class `inline-flex items-center gap-[0.14rem] rounded-[0.12rem] align-middle text-[#f4fbff] transition-colors hover:text-[#fff2c9] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[rgba(255,226,167,0.72)]`;
  attrs: `data-hover-preview-anchor`, `data-preview-landscape`, `data-battlefield-marker` (card type battlefield), `data-log-gold-token` (name "gold"), `data-log-card-art-only` (`payment_batch`);
  art `span data-log-card-art="true"` class `relative inline-block shrink-0 overflow-hidden border border-black/45 bg-[rgba(8,15,25,0.82)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]` + gold `size-[0.82rem] rounded-[0.1rem]` else `h-[0.82rem] w-[1.14rem] rounded-[0.1rem]`; art img (`og.GameCardArt`) `object-cover opacity-[0.95] saturate-[0.92]` + battlefield `object-center` else `object-top`, `profile:"thumb"`, sizes `18px`; name span `data-log-card-name` class `inline rounded-[0.08rem] font-bold text-[#f4fbff] underline decoration-[rgba(151,201,255,0.36)] decoration-dotted underline-offset-[0.12rem] transition-colors hover:text-[#fff2c9] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[rgba(255,226,167,0.72)]`.
  Hover triggers `onCardHoverPreview(card, element, "left")`; `onMouseMove/onFocus`, end on `onMouseLeave/onBlur`.
- `rune`: icons from `oP.O(domain)`; spans `data-log-rune-icon="true"` / `data-log-rune-localized` / `data-log-rune-compact`,
  group class `inline-flex items-center gap-[0.12rem] align-middle leading-[1.24]`; rune icon `inline-block rounded-[0.06rem] align-middle` (10×10).

### 2.5 `ii` (11 626–11 994) — MatchLog
Props: `{meId, meName, meDisplayName, opponentId, opponentName, opponentDisplayName, players,
currentTurnNumber, currentTurnPlayerId, logEntriesOverride, matchLogExpanded, onCardHoverPreview,
onCardHoverPreviewEnd, onToggleExpanded}`.
- Lazily reveals 40 entries at a time; `IntersectionObserver` with `rootMargin:"0px 0px 100% 0px"` on a
  spacer `li ref aria-hidden data-match-log-more={q} className={oV} style={{height:`calc(${q} * 2.16em)`}}`.
- Turn grouping `U()`: uses `ir`; sniffs text `.endsWith("mulligans are complete. Starting the game.")` or
  `" auto-started test setup."` to reset author tracking; `.endsWith(" ended their turn.")` to decrement turn.
- Root `clsx(of.w, "relative h-full min-h-0 overflow-hidden grid grid-rows-[minmax(0,1fr)_auto]")`.
- Empty title `h3` `clsx("pointer-events-none absolute top-[0.14rem] left-[0.2rem] z-1 uppercase tracking-wider text-(--text-soft) opacity-[0.74]", oq)` key `sim.matchLogTitle`.
- Group `li data-match-log-group={kind} data-turn-number data-turn-player-id`; section `grid gap-[0.05rem]`;
  divider row `flex items-center gap-[0.22rem] px-[0.12rem] uppercase tracking-[0.08em] font-semibold` + `oG`
  + tone me `text-[rgba(139,229,196,0.9)]`, opponent `text-[rgba(255,196,128,0.9)]`, neutral `text-[rgba(176,195,220,0.82)]`,
  `data-match-log-turn-divider`; hairlines `h-px min-w-[0.5rem] flex-1` with gradients
  `bg-[linear-gradient(90deg,rgba(120,221,183,0.08),rgba(120,221,183,0.5))]` etc.; label `px-[0.14rem] opacity-60` "·".
- List `ul` `relative z-2 min-h-0 overflow-auto list-none m-0 p-0 pr-[0.02rem] grid auto-rows-min content-start gap-[0.16rem]` + more-spacer.
- Toggle button `relative z-3 mt-[0.04rem] w-full inline-flex items-center justify-center h-[1.02rem] rounded-none border-x-0 border-b-0 border-t border-[rgba(176,196,222,0.26)] bg-[linear-gradient(180deg,rgba(25,40,61,0.88),rgba(18,30,48,0.92))] text-[rgba(177,195,220,0.92)] transition-colors hover:text-(--text-soft) hover:border-[rgba(198,215,240,0.38)]`, child chevron "▾" class `clsx("leading-none transition-transform duration-180", oX, expanded && "rotate-180")`; keys `sim.collapseMatchLog`/`sim.expandMatchLog`.
- i18n: `sim.{matchLogTitle,player,playerTurn,turn,earlierActivity}`.

---

## 3. Chat panel `ij` (12 296 – 14 666) — judges + bug report + chat

### 3.1 Props
```
{roomCode, privateContentScopeKey, localAuthorId, perspectivePlayerId, chatExpanded, chatEntries,
 typingPlayers, panelLayoutClass, canSend, sendPaused, judgeChatChannels, judgeChatHelper,
 judgeChatEntry, gameInfoOpen, judgeCall, judgeCalls, judgeActionsAvailable, judgeAnswerWait,
 judgeCallCooldownUntil, judgeFeedbackByCallId, bugReportDeliveryReceipt, showGameInfoHint,
 onToggleExpanded, onSendChat, onDismissGameInfoHint, onOpenHotkeys, onTypingChange,
 onRequestJudgeCall, onCloseJudgeCall, onSubmitJudgeFeedback, onSubmitBugReport}
```
Defaults: `typingPlayers=[]`, `panelLayoutClass="grid-rows-[auto_minmax(0,1fr)_auto]"`,
`judgeCall=null`, `judgeActionsAvailable=true`, `judgeAnswerWait=null`, `judgeFeedbackByCallId=<module Map im>`.

### 3.2 Message-merge
Chat + judge calls are merged into one timeline: entries `{at, key, kind:"chat"|"judge", entryKind:"question"|"thread"|"answer"|"status", tieBreakOrder:0..4}` sorted by `at`, then tieBreak, then key. Answer entries sort at `answer.answeredAt`; status entries at `closedAt|expiresAt|requestedAt`.

### 3.3 Chat command language (10 700–12 100 helpers)
- `id="@judge"`, `is="@bug"`, `ic=["public","private"]`, `iu=1000 + id.length + 9` (=1016) max length when judge command active but no channel.
- `ih(text, cmd)` → `{content, contentStart}` if text starts (case-insensitive) with cmd followed by whitespace.
- `ib(text)` parses `@judge [public|private] <question>`:
  returns `{explicitVisibility, question, questionStart, visibility ("public"|"private"|null), visibilityInputState: "explicit"|"incomplete"|"invalid"|"default", visibilitySuggestions, visibilityTokenEnd, visibilityTokenStart}`.
  Suggestion matching = exact prefix match, then Levenshtein-ish distance ≤1 (also swapped-adjacent pair) for `invalid`.
- `ig` = compact form of `ib`. `iy(text)` parses `@bug <description>` (clamped to 1000 chars, CRLF normalised).
- `iv(text)` = `@judge` command text from a question/visibility; `ix(text)` = `@bug …`; `iw(text, visibility, {replaceSuggestion})` rewrites the visibility token.
- `ik(el)` autogrows a textarea to min 3 lines / max 3·lineHeight+padding+border, toggling `overflowY auto|hidden`.
- `iC(from, to)` mirrors width + scrollTop/scrollLeft from textarea to highlight layer.

### 3.4 Composer token highlight
`ip` token classes (verbatim):
```
judge:   "rounded-[0.16rem] bg-[rgba(54,151,169,0.34)] shadow-[inset_0_0_0_1px_rgba(130,230,242,0.34)] [box-decoration-break:clone] [-webkit-box-decoration-break:clone]"
bug:     "rounded-[0.16rem] bg-[rgba(184,109,45,0.34)] shadow-[inset_0_0_0_1px_rgba(247,195,139,0.34)] …"
public:  "rounded-[0.16rem] bg-[rgba(42,137,151,0.28)] shadow-[inset_0_0_0_1px_rgba(151,230,241,0.28)] …"
private: "rounded-[0.16rem] bg-[rgba(105,83,166,0.34)] shadow-[inset_0_0_0_1px_rgba(206,195,255,0.32)] …"
visibilityIncomplete: "rounded-[0.16rem] bg-[rgba(181,129,42,0.34)] shadow-[inset_0_0_0_1px_rgba(250,205,119,0.38)] …"
visibilityInvalid:    "rounded-[0.16rem] bg-[rgba(164,61,61,0.38)] shadow-[inset_0_0_0_1px_rgba(255,153,153,0.4)] …"
```
Highlight `<pre ref data-testid="chat-composer-highlight" aria-hidden>` class
```
clsx("pointer-events-none absolute inset-y-0 left-0 z-0 m-0 w-full select-none overflow-hidden whitespace-pre-wrap wrap-break-word border-0 bg-transparent px-[0.24rem] py-[0.19rem] [font-family:inherit] leading-[1.2] text-transparent forced-colors:hidden", oZ)
```
Wrapped tokens are `<span data-chat-composer-token={kind} className={ip[kind]}>`; trailing newline appends `"\u200b"`.

### 3.5 Composer textarea
```
data-testid="chat-composer-input" wrapper div className eu (see below)
textarea: ref rows=1 value disabled={!canSendInput} aria-invalid (incomplete|invalid)
  aria-describedby={questionHintId} data-judge-visibility-state={visibilityInputState}
  maxLength = judgeChannel ? channel-specific (nU.o) : 1016
  className = clsx("relative z-1 m-0 block w-full resize-none overflow-y-hidden whitespace-pre-wrap wrap-break-word rounded-[inherit] border-0 bg-transparent px-[0.24rem] py-[0.19rem] text-(--text-main) leading-[1.2] outline-none placeholder:text-[#8498af] focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0", oZ)
```
Wrapper base:
```
clsx("relative min-w-0 overflow-hidden rounded-[0.24rem] border border-[rgba(166,185,209,0.2)] bg-[rgba(34,52,74,0.9)] focus-within:border-[rgba(166,185,209,0.32)] focus-within:shadow-[0_0_0_1px_rgba(166,185,209,0.12)]", …state)
```
State overrides:
- judge armed: `!border-[rgba(126,211,226,0.54)] !bg-[rgba(10,57,66,0.94)] shadow-[inset_0_0_0_1px_rgba(82,190,205,0.08)] focus-within:!border-[rgba(151,230,241,0.72)]`
- visibility incomplete: `!border-[rgba(250,205,119,0.58)] focus-within:!border-[rgba(255,221,151,0.78)]`
- visibility invalid: `!border-[rgba(255,153,153,0.58)] focus-within:!border-[rgba(255,183,183,0.8)]`
- bug armed: `!border-[rgba(238,176,113,0.42)] !bg-[rgba(61,39,24,0.92)] focus-within:!border-[rgba(247,195,139,0.58)]`
Placeholder/aria-label switch: judge → `sim.judgeCall.questionPlaceholder`; bug → `sim.bugReport.descriptionPlaceholder`; else `sim.typeMessage`.
Keyboard (`onKeyDown`): **Tab/Enter** with 1 visibility suggestion → accept & rewrite; **ArrowDown** focuses first
`[data-judge-visibility-suggestion]`; **Enter** (submit predicate `(0, nG.f)(nativeEvent)`) → `submit()`.
Composer columns: `clsx("relative grid gap-[0.12rem] items-end", gridCols)` where gridCols = `"grid-cols-1"` if any footer
controls else `"grid-cols-[minmax(0,1fr)_auto]"`.

### 3.6 Judge channel context row
`div data-testid="judge-chat-composer-context"` class `col-span-full grid grid-cols-[minmax(0,1fr)_auto] items-center gap-[0.25rem] px-[0.12rem]`
- `<select aria-label={sim.judgeChat.channel}>` class `w-full rounded border border-[rgba(151,174,198,0.3)] bg-[#14283b] px-1 py-[0.16rem] text-[0.6rem] text-[#d9f5f8] pointer-coarse:text-[16px]`; options `""`→`sim.judgeChat.matchChannel`, per channel `privateChannel`/`publicChannel` + index when >1, unavailable channel option.
- help `details data-testid="judge-chat-help"` class `relative`; summary class `flex cursor-pointer list-none items-center justify-center rounded p-1 text-[#91a4bb] hover:text-[#d9f5f8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9fdff2] [&::-webkit-details-marker]:hidden`; tooltip `p` class `absolute right-0 bottom-full z-30 mb-1 w-56 max-w-[calc(100vw-2rem)] rounded border border-[rgba(151,174,198,0.3)] bg-[#14283b] p-2 text-[0.65rem] leading-[1.4] text-[#d9f5f8] shadow-lg` (private/public audience + final-answer hint).
- closed hint `col-span-full m-0 text-[0.53rem] leading-[1.3] text-[#91a4bb]` (`sim.judgeChat.closedHint`).
- unavailable `div role="status" data-testid="judge-chat-unavailable"` class `col-span-full rounded border border-[rgba(151,174,198,0.25)] bg-[#14283b] px-1 py-1 text-[0.55rem] leading-[1.35] text-[#b8c9dc]`; Discord link `https://discord.com/channels/1479513379902197812/1492755442508501203`.
- send paused `p data-testid="chat-send-paused"` class `col-span-full m-0 px-[0.12rem] text-[0.6rem] leading-[1.35] text-[#f0c69e]` (`sim.chatSendPaused`).

### 3.7 Judge visibility suggestion radiogroup
Rendered via AnimatePresence when `@judge` active with `{id, role:"radiogroup", data-testid:"judge-visibility-suggestions",
 aria-label, initial:{opacity:0,y:-3}, animate:{opacity:1,y:0}, exit, transition:{duration:0.1}}` class `flex h-6 min-w-0 items-stretch gap-[0.14rem]`.
Each option: `span.group/judge-visibility.relative.flex.h-6.min-w-0.flex-1` → button `role="radio" aria-checked`
`data-judge-visibility-suggestion={v}` base class:
```
clsx("inline-flex h-6 min-h-0 min-w-0 flex-1 items-center justify-center gap-[0.14rem] rounded-[0.18rem] border px-[0.2rem] py-0 font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#9fe5ef]", …)
```
- selected private `border-[rgba(206,195,255,0.62)] bg-[rgba(72,58,112,0.96)] text-[#f0ecff] shadow-[inset_0_0_0_1px_rgba(223,216,255,0.1)]`
- selected public `border-[rgba(151,230,241,0.62)] bg-[rgba(28,86,104,0.96)] text-[#effdff] shadow-[inset_0_0_0_1px_rgba(184,241,248,0.12)]`
- idle private `border-[rgba(185,173,236,0.24)] bg-[rgba(52,42,83,0.62)] text-[#c8bee9] hover:border-[rgba(206,195,255,0.48)] hover:text-[#e9e3ff]`
- idle public `border-[rgba(126,211,226,0.24)] bg-[rgba(14,45,64,0.72)] text-[#addce3] hover:border-[rgba(151,230,241,0.48)] hover:text-[#e8fcff]`
Radio dot `inline-flex h-[0.62rem] w-[0.62rem] shrink-0 items-center justify-center rounded-full border` (+ selected border/bg tints, inner `h-[0.28rem] w-[0.28rem] rounded-full`).
Tooltip `span id data-testid="judge-{v}-visibility-tooltip" role="tooltip"`:
```
clsx("pointer-events-none absolute bottom-[calc(100%+0.32rem)] z-150 w-[min(14rem,calc(100vw-1rem))] rounded-[0.24rem] border bg-[rgba(8,25,39,0.98)] px-[0.46rem] py-[0.36rem] text-left text-[0.6rem] font-medium leading-[1.4] tracking-normal opacity-0 shadow-[0_10px_24px_rgba(2,8,18,0.5)] transition-opacity duration-120 group-hover/judge-visibility:opacity-100 group-focus-within/judge-visibility:opacity-100",
 private → "right-0 border-[rgba(206,195,255,0.3)] text-[#e9e3ff]" ; public → "right-0 border-[rgba(151,230,241,0.3)] text-[#d9f5f8]")
```
Keys `sim.judgeCall.visibility.{public,private}[Description]`, `…visibility.suggestions`. Arrow keys cycle, Escape returns focus.
Question hint `p data-testid="judge-question-hint"` class `col-span-full m-0 px-[0.12rem] text-[0.6rem] leading-[1.35] text-[#b6d8df]`.
Message counter `p data-testid="judge-chat-message-limit"` class `col-span-full m-0 flex items-center justify-between gap-2 px-[0.12rem] text-[0.53rem] leading-[1.3] text-[#91a4bb]` (newline hint + `sim.judgeChat.messageLength {count,limit}`).

### 3.8 Footer buttons row
`div.flex.w-full.min-w-0.items-center.gap-[0.08rem]` = [judge trigger, bug trigger, game info, status text, send].

**`call-judge-trigger`** (`group/judge-help relative inline-flex shrink-0` wrapper):
class `clsx("inline-flex min-h-6 min-w-[4.5rem] shrink-0 items-center justify-center gap-[0.13rem] rounded-[0.24rem] border px-[0.16rem] py-[0.18rem] font-semibold leading-[1.15] transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#9fe5ef]",
 armed → "border-[rgba(144,225,238,0.52)] bg-[rgba(28,86,104,0.96)] text-[#e8fcff]",
 idle → "border-[rgba(126,211,226,0.28)] bg-[rgba(14,45,64,0.86)] text-[#b6e8ef] hover:border-[rgba(151,230,241,0.48)] hover:bg-[rgba(22,65,84,0.96)] hover:text-[#e8fcff] disabled:cursor-not-allowed disabled:border-[rgba(151,174,198,0.16)] disabled:bg-[rgba(17,30,48,0.52)] disabled:text-[#687d93]")`
+ `oX`; `data-judge-cooldown-seconds` attr; aria-label switches `sim.judgeCall.{trigger|activeTrigger|cooldownTrigger|buttonStates.sending}`;
onClick injects draft `iv(text)` and focuses composer. Icon: spinner `h-[0.64rem] w-[0.64rem] shrink-0 animate-spin motion-reduce:animate-none`, clock `n0.f`, else `on.f`.
Community tooltip `span id data-testid="judge-community-tooltip" role="tooltip"`:
`pointer-events-none absolute right-0 bottom-[calc(100%+0.42rem)] z-140 w-[min(17rem,calc(100vw-1rem))] rounded-[0.28rem] border border-[rgba(151,230,241,0.28)] bg-[rgba(8,25,39,0.98)] px-[0.56rem] py-[0.44rem] text-left text-[0.64rem] font-medium leading-[1.4] tracking-normal text-[#d9f5f8] opacity-0 shadow-[0_12px_28px_rgba(2,8,18,0.52),inset_0_1px_0_rgba(224,252,255,0.06)] transition-opacity duration-120 group-hover/judge-help:opacity-100 group-focus-within/judge-help:opacity-100` (`sim.judgeCall.communityTooltip`).

**`report-bug-trigger`**: base
`inline-flex min-h-6 shrink-0 items-center justify-center gap-[0.13rem] rounded-[0.24rem] border px-[0.16rem] py-[0.18rem] font-semibold leading-[1.15] transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#f0bd87] disabled:cursor-wait disabled:opacity-60`
armed `border-[rgba(238,176,113,0.52)] bg-[rgba(111,66,29,0.96)] text-[#fff1df]`; idle `border-[rgba(238,176,113,0.28)] bg-[rgba(65,41,23,0.86)] text-[#efc79d] hover:border-[rgba(247,195,139,0.48)] hover:bg-[rgba(91,55,27,0.96)] hover:text-[#fff1df]`; icon `nJ` bug `h-[0.64rem] w-[0.64rem] shrink-0`; onClick injects `ix(text)`.

**`game-info-trigger`** (+ AnimatePresence hint `oh` `data-testid="game-info-hint"`): class
`clsx("inline-flex min-h-6 min-w-6 items-center justify-center gap-[0.14rem] rounded-[0.24rem] border bg-[rgba(17,31,58,0.72)] px-[0.2rem] py-[0.18rem] font-semibold leading-[1.15] text-[#cfe0fb] transition-colors hover:border-[rgba(207,222,245,0.36)] hover:bg-[rgba(26,43,72,0.92)] hover:text-[#edf4ff] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#a8d9ed]",
 highlight → "border-[rgba(185,219,255,0.72)] shadow-[0_0_0_2px_rgba(129,190,255,0.2),0_0_16px_rgba(91,161,238,0.22)]", else "border-[rgba(178,198,229,0.22)]")` + `oX`; `aria-haspopup="dialog"`.

**status text** (`bugReportDeliveryReceipt && status!=="submitted"`): `span role="status" aria-live="polite"` class `clsx("min-w-0 truncate px-[0.12rem] font-semibold","text-[#f0b18d]",oU)` key `sim.bugReport.throttled|submitError`.

**send** (`data-testid` none): `disabled = !(canSend…)`; class
`clsx("ml-auto inline-flex shrink-0 items-center justify-center gap-[0.13rem] rounded-[0.24rem] border border-[rgba(166,185,209,0.24)] bg-[rgba(57,81,110,0.92)] px-[0.2rem] py-[0.18rem] font-semibold leading-[1.15] text-(--text-soft) focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#9fe5ef] disabled:cursor-default disabled:opacity-[0.55]", oX)`; icon `oi` send-horizontal `h-[0.64rem] w-[0.64rem] shrink-0`; label `sim.send`; judge → `${send}: ${sim.judgeCall.cardTitle}`, bug → `${send}: ${sim.bugReport.cardTitle}`.

### 3.9 Submit routing (`rN` handler)
1. `ig(draft)` → judge path: guard `judgeActionsAvailable && !inFlight && !sending && cooldownOver && visibility && question` → `onRequestJudgeCall(question, visibility)` returns clientRequestId; shows optimistic receipt 10 s.
2. `iy(draft)` → bug path: `description.length >= 10`, builds `clientReportId` `bug:${crypto.randomUUID()}` (fallback ts+rand), optional `{screenshot:{mimeType,data,width,height,capturedAt}}`, calls `onSubmitBugReport(report)`; result `{status:"throttled"|…, retryAfterMs, evidenceStatus:"unavailable"|…, discordThreadUrl}`; on `evidenceStatus==="unavailable"` creates a Blob download `rift-atlas-bug-screenshot.jpg`; local receipt `{status:"submitted", description, scopeKey, evidenceStatus, screenshotFailed, screenshotDownloadUrl?, discordThreadUrl?}`; failures → `{status:"failed", scopeKey}`; 5 s auto-dismiss for non-submitted receipts.
3. else plain chat `onSendChat(text, judgeChannelId?)`.

### 3.10 Message list & entries
`ul ref data-chat-message-list="true" onScroll=…` class
`relative z-2 h-full min-h-0 overflow-auto list-none m-0 p-0 pr-[0.02rem] grid grid-cols-[minmax(0,1fr)] auto-rows-min content-start gap-[0.08rem] select-text`.
Judge entries → `oK` (props in §1.3; `onEdit` re-injects `@judge <vis> <question>`).
Chat `li`: `title/aria-label` from `sim.chatMessageAccessibility`; attrs:
`data-chat-entry-tone="verified-judge"|"community-judge"|"player"|"opponent"`; class
```
clsx("w-fit max-w-[calc(100%-0.42rem)] cursor-text select-text rounded-[0.22rem] border py-[0.12rem] px-[0.18rem]",
  isMineOrSpectator ? "justify-self-end" : "justify-self-start",
  verifiedJudge ? "border-[rgba(195,164,255,0.5)] bg-[rgba(66,39,100,0.88)] shadow-[inset_0_0_0_1px_rgba(195,164,255,0.1)]"
  : judgeAuthor ? "border-[rgba(118,191,255,0.45)] bg-[rgba(26,54,88,0.88)] shadow-[inset_0_0_0_1px_rgba(118,191,255,0.1)]"
  : isMineOrSpectator ? "justify-self-end border-[rgba(123,226,183,0.28)] bg-[rgba(22,58,49,0.82)] shadow-[inset_0_0_0_1px_rgba(123,226,183,0.08)]"
  : "justify-self-start border-[rgba(205,176,115,0.28)] bg-[rgba(70,51,28,0.8)] shadow-[inset_0_0_0_1px_rgba(205,176,115,0.09)]")
```
Body `p` class `min-w-0 select-text whitespace-pre-wrap wrap-anywhere text-[#e2ebf8] leading-[1.24]`;
sr-only prefix; author header `span data-authorized-spectator-chat-author="true"` class
`mb-[0.08rem] flex min-w-0 items-center gap-[0.2rem] text-[0.5rem] font-semibold uppercase tracking-[0.06em] text-[#9fdff2]`
(name via `oO._`; verified badge `oC.f`; else badge pill `inline-flex shrink-0 items-center gap-[0.16rem] border border-[rgba(116,239,255,0.26)] bg-[rgba(20,67,82,0.5)] px-[0.16rem] py-[0.02rem]`);
message text renderer `oy.f` class `clsx("min-w-0 select-text", oZ)`;
private marker `span data-testid="judge-private-chat-marker"` class `ml-1 text-[0.52rem] text-[#dcd3ff]`;
reply-privately button class `ml-1 text-[0.52rem] underline underline-offset-2` (`sim.judgeChat.replyPrivately`);
time `span` class `clsx("ml-[0.22rem] inline-block whitespace-nowrap align-baseline text-(--text-dim) leading-[1.1] opacity-[0.72]", oU)`.
Chat receipt `i_` appended at list end.
Footer below list: "new messages" button and typing indicator (classes above).
Typing tones (`il`): `player: "bg-[#78ddb7] shadow-[0_0_10px_rgba(120,221,183,0.82)]"`, `ally: "bg-[#7fc7f2] shadow-[0_0_10px_rgba(127,199,242,0.78)]"`, `opponent: "bg-[#ffbb6e] shadow-[0_0_10px_rgba(255,187,110,0.82)]"`; dot `iz` = `clsx("h-[0.34rem] w-[0.34rem] shrink-0 rounded-full", il[tone])` with `data-typing-player-tone`.
Keys: `sim.{chat,collapseChat,expandChat,newMessages,typingOne,typingMany,typeMessage,send,you,staff,staffChatAuthor,chatMessageAccessibility,messageAt}`.
Root: `<section data-chat-panel-root="true" className={clsx("min-h-0 grid gap-[0.08rem] px-[0.02rem]", panelLayoutClass)}>` — children: expand button, `div.clsx(of.w,"relative min-h-0 overflow-hidden")` (empty title `sim.chat`, list, new-message button, typing indicator), composer grid `eH`.

---

## 4. Bug-report receipts `i_` (12 137 – 12 295)

Renders up to 3 `<li>`s from `{description, discordThreadUrl, status, failureCode, rejectionReason, pendingReason, onEdit}`:
1. private message `li data-testid="bug-report-private-message"`:
```
"w-[calc(100%-0.42rem)] justify-self-end rounded-[0.22rem] border border-[rgba(238,176,113,0.24)] bg-[rgba(67,40,22,0.78)] px-[0.34rem] py-[0.28rem] text-[#f8e5d2] shadow-[inset_0_0_0_1px_rgba(238,176,113,0.05)]"
```
heading `m-0 text-[0.52rem] font-bold uppercase tracking-[0.08em] text-[#d69e6b]` (`sim.bugReport.cardTitle`); body `clsx("mt-[0.1rem] whitespace-pre-wrap wrap-anywhere text-[#f8e5d2]", oZ)`; `oH` marker.
2. thread `li data-testid="bug-discord-thread-system-message"`:
`"w-[calc(100%-0.42rem)] justify-self-center rounded-[0.22rem] border border-[rgba(238,176,113,0.22)] bg-[rgba(47,31,21,0.82)] px-[0.34rem] py-[0.28rem] text-[#f6dfc7] shadow-[inset_0_0_0_1px_rgba(238,176,113,0.05)]"`;
heading `…text-[#d69e6b]` for `sim.bugReport.thread.systemHeading`; link class `clsx("mt-[0.1rem] inline-flex min-h-5 items-center gap-[0.18rem] font-semibold text-[#f2c99e] underline decoration-[rgba(242,201,158,0.42)] underline-offset-2 hover:text-[#fff0df] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#f0bd87]", oZ)`; `oH` marker.
3. delivery `li data-testid="bug-report-delivery-status-message" data-delivery-status={status} role="status" aria-live="polite"`:
`"w-[calc(100%-0.42rem)] justify-self-center rounded-[0.22rem] border border-[rgba(238,176,113,0.22)] bg-[rgba(47,31,21,0.82)] px-[0.34rem] py-[0.28rem] text-[#f6dfc7]"`;
title `m-0 text-[0.58rem] font-semibold` (`sim.bugReport.submitted`); description `mt-[0.08rem] text-[0.55rem] leading-[1.35] opacity-80` choosing
`accountBanned|severeAbuseRejected|unintelligibleRejected|contentRejected|deliveryFailed|reviewUnavailable|deliveryPending`;
appeal link `(0,nZ.k)("/appeal",locale)` class `mt-[0.2rem] inline-flex min-h-6 items-center text-[0.6rem] font-semibold underline underline-offset-2` for `account_banned`;
edit button `mt-[0.2rem] min-h-6 text-[0.6rem] font-semibold underline underline-offset-2` (`sim.bugReport.editReport`) when `content_rejected && !severeAbuse && description && onEdit`.
Screenshot failure block `div role="status" data-testid="bug-report-screenshot-upload-failed"` class
`grid gap-1 rounded border border-[rgba(238,176,113,0.28)] px-1.5 py-1 text-[0.58rem] leading-snug text-[#f0c69e]` with download link (`download="rift-atlas-bug-screenshot.jpg"` class `underline underline-offset-2`) and dismiss button `justify-self-start underline underline-offset-2` (resets receipt via `iB`).

---

## 5. Chain stack `iI` (14 667 – 15 300) + action hints `ie`/`it` (10 887 – 11 045)

### 5.1 Props (all callbacks; game state comes from `entries`)
```
{onPingChainEntry, pingModeActive=false, chainCardPing, compact=false, cardSizeScale=1, entries,
 resolvableEntryId, meId, meName, laneWidthRem=15.5, onResolveTopEntryByContextMenu, onRecycleTopEntry,
 onChainEntryDragStart, onChainEntryDragEnd, onQuickTargetFromTopEntry, onToggleRepeatFromTopEntry,
 onToggleFlowFromTopEntry, queuedExtraTurnEntryIds=[], onToggleExtraTurn, onRemoveTargetArrowsFromTopEntry,
 canApproveTopEntry=false, hasTargetArrowsFromTopEntry=false, suppressTopEntryTargetTooltips=false,
 onCardHover, onCardHoverEnd}
```
Chain-entry fields read: `entry.id`, `entry.card`, `entry.byPlayerId`, `entry.byPlayerName`,
`repeatEnabled`, `flowEnabled`, plus card flags `(0,o.z)(card)` unit, `(0,o.h)(card)`, `(0,o.$)(card)`.

### 5.2 Layout math
- `T = compact ? 0.55 : Math.max(0.94, laneWidthRem / 15.5)`
- per-depth `A` (0 = top): `V = 0.9975 * (A===0?13.2:A===1?12.2:11.2) * T`
- width `Y`: compact → `"min(100%, calc(var(--compact-chain-card-height, 10.5rem) * 63 / 88))"`,
  else `min(${V*cardSizeScale}rem, 100%, calc(var(--chain-stack-height, 100rem) * ${V / ((laneWidthRem-0.3)*1.207)}))`
- rest offsets `Q=-(14*A*T)` px, `J=-(6*A*T)` px, rotate `ee=-(6.5*A)` deg, scale `et=1-0.024*A`, opacity `ea=A===0?1:Math.max(0.68,0.9-0.1*A)`, `zIndex: A===0?40:20-A`.
- animated with framer `b.f.div`: initial `{x:20,y:24,rotate:5,scale:0.96,opacity:0}`, animate `{x:0,y:0,rotate:0,scale:1,opacity:1}`, exit `{x:-34,y:-12,rotate:-12,scale:0.9,opacity:0}`, transition `o5` spring (opacity `{duration:0.2}`), wrapped in `om.f` (AnimatePresence, `initial:false`). Card aspect: `aspect-[5.2/7.52]`, bottom `bottom-[0.55rem]` (top) / `bottom-[0.65rem]`.

### 5.3 DOM / attributes (verbatim)
```
motion.div  data-chain-entry-id={id}  data-chain-depth={A}  class "absolute overflow-visible aspect-[5.2/7.52] bottom-[0.55rem|0.65rem]"
 └ div     data-chain-stack-pose="true"  class clsx(
      "group group/chain-card relative h-full w-full overflow-visible bg-[rgba(16,24,39,0.84)] transition-[transform,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
      depth 0 & owner ? "rounded-[0.32rem] border border-[rgba(139,222,189,0.58)] shadow-[0_0_0_1px_rgba(120,221,183,0.38),0_0_26px_rgba(120,221,183,0.46),0_12px_24px_rgba(3,9,23,0.52)]"
      : depth 0      ? "rounded-[0.32rem] border border-[rgba(255,198,128,0.58)] shadow-[0_0_0_1px_rgba(255,187,110,0.38),0_0_26px_rgba(255,187,110,0.44),0_12px_24px_rgba(3,9,23,0.52)]"
      : owner        ? "rounded-[0.3rem] border border-[rgba(139,222,189,0.44)] shadow-[0_0_0_1px_rgba(120,221,183,0.24),0_0_18px_rgba(120,221,183,0.28),0_8px_16px_rgba(4,10,24,0.42)]"
                     : "rounded-[0.3rem] border border-[rgba(255,198,128,0.44)] shadow-[0_0_0_1px_rgba(255,187,110,0.24),0_0_18px_rgba(255,187,110,0.28),0_8px_16px_rgba(4,10,24,0.42)]")
   [action stack] div data-chain-top-card-action-stack="true" class "pointer-events-none absolute left-[0.1rem] top-[0.1rem] z-40 flex flex-col gap-[0.18rem]"
     ├ extra-turn  button data-chain-top-card-action="true" data-chain-modifier-toggle="extra-turn"
     │   class clsx(tp.w, "group/action pointer-events-auto relative inline-flex h-[2.35rem] w-[2.35rem] items-center justify-center hover:z-140 focus-visible:z-140", pressed && tp.I)
     ├ recycle     button data-chain-top-card-action="true" class clsx(o4,"relative")  icon o6 (arrow-up-to-line)
     ├ repeat      button data-chain-top-card-action="true" data-chain-modifier-toggle="repeat" class clsx(o4,"relative", repeatEnabled && tp.x)
     └ flow        button data-chain-top-card-action="true" data-chain-modifier-toggle="flow"   class clsx(o4,"relative", flowEnabled  && tp.N)
```
where
```
o4 = `${tp.w} group/action inline-flex h-[2.35rem] w-[2.35rem] items-center justify-center opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto hover:z-140 focus-visible:z-140`
o8 = "h-[1.34rem] w-[1.34rem]"
```
Buttons carry `aria-label` (`sim.queueExtraTurnFor`/`sim.cancelExtraTurnFor` with `{cardName}`, `sim.recycleToDeck`, `sim.markRepeatFor`/`sim.clearRepeatFor`, `current.markFlowFor`/`current.clearFlowFor`), `aria-pressed` for toggles. Tooltips `tp.F variant:"board"` with `sim.{extraTurn…, recycle, repeat[On], flow…}`.

Card button is `th.k`:
```
{card, sourceCardId: card.id, kind:"chainEntry", owner:"self",
 onTouchDragStart, actions:[…menu items…], className:"relative h-full w-full overflow-hidden rounded-[inherit]",
 "data-card-id": card.id, "data-target-anchor":"chain", draggable:{
   id:"extra-turn" label sim.queueExtraTurn/cancel — run toggles
   id:"ping"       label sim.compactPing
   id:"trash"|"banished" label sim.tablet.trash|sim.tablet.banish   (units get both)
   id:"target"     label sim.tablet.target
   id:"recycle"    label sim.tablet.recycle
   id:"repeat"     label sim.repeat
   id:"flow"       label current.flow
   id:"clear"      label sim.tablet.removeTargets
 }, role:"button" (when resolvable), tabIndex, aria-label current.cardPreview {cardName}, onClick/onKeyDown Enter|Space, drag/drop handlers, onContextMenu}
```
Card media: `tp.S {overlay:false, imageInsetPx:0, imageProfile:"preview", imageSizes, imageLoading:"eager", imageFetchPriority: depth0?"high":undefined, battlefieldArtOrientation:"portrait"}`.

Modifier indicator stack (depth 0, when any active):
```
span data-chain-modifier-indicator-stack="true" class clsx("pointer-events-none absolute top-[0.52rem] z-30 flex flex-col gap-[0.22rem]", extraTurn ? "time-warp-chain-indicators" : "left-1/2 -translate-x-1/2 items-center")
 ├ extra-turn  span class "time-warp-chain-badge" data-chain-modifier-indicator="extra-turn"   (text sim.extraTurn)
 ├ repeat      span data-chain-modifier-indicator="repeat" class "relative inline-flex items-center gap-[0.3rem] whitespace-nowrap rounded-full border border-[rgba(246,217,136,0.54)] bg-[linear-gradient(180deg,rgba(109,82,25,0.96),rgba(72,53,14,0.98))] px-[0.34rem] py-[0.24rem] text-[#fff1c8] shadow-[0_8px_20px_rgba(12,8,2,0.38),inset_0_1px_0_rgba(255,246,222,0.2)]"  (icon chip + text sim.repeat + pill "x2")
 └ flow        span data-chain-modifier-indicator="flow"   class "relative inline-flex items-center gap-[0.3rem] whitespace-nowrap rounded-full border border-[rgba(145,228,244,0.58)] bg-[linear-gradient(180deg,rgba(22,89,108,0.96),rgba(12,57,74,0.98))] px-[0.34rem] py-[0.24rem] text-[#ddfaff] shadow-[0_8px_20px_rgba(2,14,20,0.42),inset_0_1px_0_rgba(222,251,255,0.18)]" (text current.flow)
```
Inline SVG icons: recycle = `o6` (24×24, paths `M7.2 7.2h8.7l-2.4-2.4` / `M16.8 16.8H8.1l2.4 2.4` / `M16.8 7.2 19.4 9.8v3.1` / `M7.2 16.8 4.6 14.2v-3.1`), repeat = `o7` (4 paths), flow = `o9` (3 wavy `M3.8 7.4c1.8-1.7 …` paths). Target button (`tp.m`, `sim.chooseTargetHold`, top-right `right-[0.1rem] top-[0.1rem] z-40`), clear arrows (`tp.$`, `sim.removeArrowsFrom`, `right-[0.1rem] top-[2.63rem] z-40` when `hasTargetArrowsFromTopEntry`).

### 5.4 Interactions
- Hover: `z.current` tracks last hovered entry id; `onCardHover` on `mouse`, cleared on leave/blur/pointerdown-capture for non-mouse.
- Click: resolvable → `scroll`?? no: if `pingModeActive && onPingChainEntry` → ping; else toggle hover preview.
- Keyboard: Enter/Space triggers `click()`.
- Right-click (top entry only, drag enabled, `onResolveTopEntryByContextMenu`): computes `banish|trash` via `(0,d.i)(e, platformModifier)` + ctrl/meta logic (shiftKey → none; ctrl/meta without platformModifier → none; modifier+unit → `"banished"` else `"trash"`), skipping targets inside `[data-chain-top-card-action="true"]`.
- Drag start/end → `onChainEntryDragStart/…End`.

### 5.5 `ie` (10 887) — ChainCardActionHint row
```
span class "inline-flex items-center justify-center gap-[0.22rem] whitespace-nowrap text-center text-(length:--card-action-hover-detail-size) font-semibold leading-none tracking-[0.02em] text-[#dce8f8]"
    data-chain-card-action={action}      children = [<kbd/shortcut>, <label>]
```

### 5.6 `it` (10 920) — ChainCardActionHints tooltip (props `{canResolve, canResolveByContextMenu, canBanish, canApprove, canTarget, platformModifier}`)
Rows (`ie`): resolve `S` (+ `/` + right-mouse glyph when context-menu allowed), banish `⌘/Ctrl` + right-mouse glyph (key `(0,d.H)(modifier)`), approve `A`, target `T`.
Container:
```
span aria-hidden="true" class "pointer-events-none absolute right-[-1.25rem] top-1/2 z-180 -translate-y-1/2 rounded-[0.12rem] border border-[rgba(171,191,238,0.42)] bg-[linear-gradient(168deg,rgba(27,44,72,0.96),rgba(36,56,88,0.94))] px-[0.32rem] py-[0.2rem] text-(--text-soft) font-semibold uppercase opacity-0 shadow-[inset_0_0_0_1px_rgba(209,224,255,0.08),0_8px_18px_rgba(3,8,20,0.45)] transition-opacity duration-120 group-hover/chain-card:opacity-100 group-focus-within/chain-card:opacity-100"
  data-chain-card-action-hints="true"
  data-chain-card-action-hints-overlap="card"
  data-chain-card-action-hints-placement="right"
  inner span class "grid justify-items-center gap-[0.12rem]"
```
Keys `sim.{resolve,banish,target}`, `current.approve`. Chip class for shortcuts: `ax` with `"min-h-[0.9rem] px-[0.2rem] py-[0.08rem] text-[0.54rem]"`; mouse glyph `a_ {button:"right"|"left"}`.

---

## 6. Disconnect / offline badges (15 301 – 15 518)

- `i$` (15 351–15 441) `DisconnectBadge {disconnectedSinceMs, label, containerClassName, badgeClassName, dotClassName}` — ticks every 1 s, hidden for first 10 s (`h < 1e4 → null`).
  container = `"[--disconnect-badge-thickness:1.76rem] " + containerClassName`;
  badge `div role="status" aria-live="polite"` = `` `inline-flex h-(--disconnect-badge-thickness) w-[7.06rem] items-center justify-center gap-[0.12rem] rounded-[0.24rem] border px-[0.16rem] py-[0.14rem] ${badgeClassName}` ``;
  dot `` `h-[0.44rem] w-[0.44rem] rounded-full animate-pulse motion-reduce:animate-none ${dotClassName}` ``;
  label `text-[0.56rem] font-black uppercase tracking-[0.04em] leading-none whitespace-nowrap`; seconds `w-10 text-right text-[0.56rem] font-bold leading-none whitespace-nowrap tabular-nums`.
- `iH` OfflineBadge (self): container `absolute right-[calc(50%+var(--score-track-rail-width)/2+var(--disconnect-badge-thickness)/2+0.12rem)] bottom-full mb-[3.8rem] translate-x-1/2 z-40`; badge `-rotate-90 border-[rgba(255,204,168,0.66)] bg-[linear-gradient(168deg,rgba(93,57,24,0.96),rgba(64,37,16,0.95))] text-[#ffe9d4] shadow-[inset_0_0_0_1px_rgba(255,224,193,0.15),0_14px_26px_rgba(20,10,2,0.5)]`; dot `bg-[#ffb46b]`; label `sim.offline`. Gated by `iF` on `phase==="in_game" && localRealtimeConnected===false`.
- `iK` OpponentDisconnectedBadge: container `absolute left-[calc(50%+var(--score-track-rail-width)/2+var(--disconnect-badge-thickness)/2+0.12rem)] top-full mt-[3.8rem] -translate-x-1/2 z-40`; badge `rotate-90 border-[rgba(255,196,196,0.66)] bg-[linear-gradient(162deg,rgba(92,27,33,0.97),rgba(64,20,25,0.95))] text-[#ffe4e4] shadow-[inset_0_0_0_1px_rgba(255,218,218,0.15),0_14px_26px_rgba(22,4,8,0.5)]`; dot `bg-[#ff8c98]`; label `sim.disconnected`; suppressed for `single_player`/bots.

## 6b. Score + identity rails `iZ` (15 519 – 15 968)

Props list (see file 15 519–15 560). Renders: center line ornament (`hidden absolute top-1/2 …` with `gb-centerline-dash` pseudo), player/opponent identity rails (`identityRailTurn` + `identityRailTurnOn/Off`, `data-player-identity-rail="self|opponent"`), score rails (`data-board-player-scores`, `data-board-opponent-scores`) using external rail components `iW.a` (score track) / `iW.z` (identity badge), action timers (`playerActionTimer`, `opponentActionTimer`), menu model (social target `{roomCode, playerId}` + items `silence-opponent` (checked `opponentSilenced`), `report-player`; `onCopyLabel` copies player name via `iX` clipboard) and the disconnected badge `iK`. Root `_` (15 519) is a fragment of `[s,m,p,b,w,k]`.

---

## 7. Target-arrow SVG overlay (15 969 – 16 671)

- `iX` (15 969) — `navigator.clipboard.writeText(name.trim())` async, throws `"Clipboard is unavailable"`.
- `iG` normalises arrows to `{sourceCardId,targetCardId,sourceAnchor,targetAnchor}`; `iV(arrows, chainCardId)` filters chain-anchored arrows for current top chain card; `iY` deep-compares (tolerance 0.5 px + path string); `iQ(cardId, anchor)` finds `[data-card-id]` elements preferring `dataset.targetAnchor === "chain"`; `iJ` projects point onto card edge; `i0` clamp.
- `i1` (16 109) TargetArrowSvg — `svg className="fixed inset-0 z-2147483600 pointer-events-none w-screen h-screen" aria-hidden`; `defs` with markers `gb-target-arrow-head-self` (fill `rgba(135,231,255,0.98)`) and `…-opponent` (fill `rgba(255,200,132,0.98)`), plus one marker per `playerColorKey` `gb-target-arrow-head-${color}`.
- `i2` (16 181) arrow group: `g data-target-arrow-player-id data-player-color` with glow path (strokeWidth 5.5, `rgba(95,201,230,0.34)` self / `rgba(255,170,90,0.34)` opp), main path (2.4, solid + `markerEnd`), start circle r=3.1; key `target-arrow-${playerId|owner}-${index}`.
- `i8` (16 247) TargetArrowLayer — recomputes geometry on rAF (`(0,i3.g)("target_arrow_frame")`), listens ResizeObserver + resize, 450 ms settle window, quadratic curve `M x y Q cx cy x2 y2` with bow `f = min(110, max(24, 0.2*h))`.
- `le` (16 477) TargetArrows — resolves zone-card elements (own board zone map via `i9`), filters arrows hiding entries whose source/target is the top chain card (`iV`), then renders `i8`. Zone keys: `base,battlefieldA,battlefieldToken,battlefieldB,battlefieldC,champion,legend` (+`runeArea` for labels).

---

## 8. Card render model `ll` (16 707 – 16 802)

Builds a pure view-model consumed by `d_` (BoardCard) & chain stack:
```
identity   {owner, zone, cardId}
interaction{hidden, dragging, disabled, overlaysSuppressed}
visual     {faceDown, exhausted, autoPayPreviewExhausted, autoPayPreviewRecycled,
            restRotationDeg (rO: exhausted→ -90 or 90 by autoPay flags), animatedRotationDeg, animation}
indicators {showDuplicateBadge: isDuplicate, showMightBuffBadge, mightBuffAmount (z.d)}
actions.counters {display (z.S), controls (canAdjust&&canClear), quickAdd, actionsSuppressed}
actions.labels   {display (z.S && !hideLabels), interactive (… && (canEdit||canDelete)), suspended}
actions.removeTemporaryMightBuff, revealToOpponent, quickTarget, clearTargetArrows,
actions.quickEquip (gear+attached-anchor rules), quickEmpower, neekoLegends
```
Face-down default `(0, eO.o)(card)`.

---

## 9. Counter overlay system (16 846 – 18 677, plus `dI` 20 623, `sO` 23 827)

### 9.1 `lf` (16 846) — CounterActionHints
Rows `data-card-counter-action="add"|"subtract"|"scroll"` inside
`span data-card-counter-action-hints="true" class "grid gap-[0.12rem]"`; row class
`lh = "grid grid-cols-[max-content_1fr] items-center gap-[0.22rem] whitespace-nowrap text-left text-(length:--card-action-hover-detail-size) font-semibold leading-none tracking-[0.02em] text-[#dce8f8]"`.
Add row `current.addOneCounter` + left-mouse glyph; subtract rows swap visibility on hover
(`group-has-[[data-card-counter-adjust=subtract]:hover]/counter:hidden` etc.); scroll row `aC` + `current.scrollCounterHint`.
`lb` (16 968) = universal stop (preventDefault/stopPropagation/stopImmediatePropagation).

### 9.2 Class constants (16 973–16 996)
```
lg = "pointer-events-none absolute left-1/2 bottom-[var(--card-counter-bottom,0px)] z-56 h-(--card-counter-height) w-(--card-counter-track-width) -translate-x-1/2"
ly = "absolute bottom-0 h-(--card-counter-height) w-(--card-counter-slot-width)"
lv = "absolute left-1/2 bottom-0 inline-flex h-(--card-counter-height) min-w-(--card-counter-min-width) -translate-x-1/2 items-center justify-center rounded-(--card-counter-radius) border px-(--card-counter-pad-x) text-(length:--card-counter-font-size) font-bold leading-none [font-variant-numeric:tabular-nums] shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_8px_18px_rgba(4,8,20,0.52)]"
lx = "absolute left-0 inline-flex h-(--card-counter-control-height) w-full items-center justify-center rounded-(--card-counter-control-radius) border text-(length:--card-counter-control-font-size) font-black leading-none shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_6px_12px_rgba(5,10,24,0.45)] pointer-events-auto transition-[border-color,background-color,color,transform] duration-120 disabled:opacity-[0.34] disabled:pointer-events-none hover:enabled:scale-[1.03]"
lw = probe style {height:0,left:"50%",top:"50%",width:0,position:"absolute",pointerEvents:"none"}
lk = probe style {left:"calc(50% + 1rem)", …}
lP(counter) red → "border-[rgba(255,190,190,0.74)] bg-[linear-gradient(172deg,rgba(173,38,38,0.96),rgba(118,23,23,0.93))] text-[#ffebee]"
            white → "border-[rgba(228,236,247,0.86)] bg-[linear-gradient(172deg,rgba(252,254,255,0.98),rgba(226,233,246,0.95))] text-[#1f324c]"
lS(counter) red/white hover variants (see file 17 019–17 034)
lI(counter, slotCount, centerSingle) → "left-1/2 -translate-x-1/2" | "left-0" | "right-0"
```

### 9.3 `lA` (17 034) — CounterOverlayProvider
Context provider that portals absolutely-positioned counter layers above the board:
- registration map `registerEntry/notifyLayoutChanged/notifyContentChanged/showEntry/handleEntryPointerLeave`;
- wheel handler on `[data-card-counter-scroll]` buttons (accumulates 40 units);
- geometry from anchor probes (`slot`,`center`,`axis`) → `{scale,widthPx,heightPx,centerXPx,centerYPx,rotationDeg}`;
- wheel/`tc.G`-based hide (`showEntry`, hover key, pressed key);
- portal root: `div data-card-counter-overlay-root="true" className="pointer-events-none absolute inset-0 overflow-visible" style={{zIndex:10000}}`.
Each layer:
```
div ref data-card-counter-layer="true" data-card-counter-overlay-surface="true"
    data-card-counter-owner  data-card-counter-zone  data-card-counter-card-id
    data-card-counter={counter}  data-card-counter-mode={mode}  data-card-counter-key
    className="pointer-events-auto absolute h-(--card-counter-height) w-(--card-counter-slot-width) overflow-visible group/counter"
    style {left,top,width,height,transform:`translate(-50%,-50%) rotate(…deg) scale(…)`}
```
`mode="quickAdd"` → `lD`; else → `lM`. Tooltip `tp.F variant:"board"` label `lf` `className="bottom-[calc(100%+var(--card-counter-control-height)+0.3rem)] group-has-[[data-card-counter-scroll]:hover]/counter:opacity-100"`.

### 9.4 `lM` (17 525) — CounterControls (existing counter)
Buttons (all `data-card-counter-control="true"`):
- badge buttons `data-card-counter-overlay-badge="true"` `data-card-counter-scroll="true"` tabIndex −1 `aria-hidden` disabled; class `clsx("z-20 pointer-events-auto select-none", lv, lP(counter), "border-[rgba(244,249,255,0.96)]")`; left-click `onAdjust(+1)`, right-click `onAdjust(−1)`, `aria-description = current.scrollCounterDescription`.
- `+` button `data-card-counter-adjust="add"` class `clsx(lx,"before:absolute before:-inset-1 before:content-['']","bottom-full",lS(counter))` `aria-label current.increaseCounter {counter}`.
- `−` button `data-card-counter-adjust="subtract"` same but `"top-full"`, `aria-label current.decreaseCounter`.
- clear button `data-card-counter-clear-width` class `clsx("absolute top-0 inline-flex h-(--card-counter-height) w-(--card-counter-clear-width) items-center justify-center rounded-(--card-counter-control-radius) border border-[rgba(190,206,232,0.74)] bg-[linear-gradient(170deg,rgba(62,80,110,0.94),rgba(45,61,86,0.9))] text-[#edf4ff] shadow-[inset_0_1px_0_rgba(234,243,255,0.32),0_5px_12px_rgba(10,14,24,0.48)] pointer-events-auto transition-[border-color,background-color,color,transform] duration-120 disabled:opacity-[0.34] disabled:pointer-events-none hover:enabled:scale-[1.03] hover:enabled:border-[rgba(214,228,248,0.92)] hover:enabled:bg-[linear-gradient(170deg,rgba(72,92,126,0.96),rgba(54,72,101,0.92))] hover:enabled:text-[#ffffff]","before:absolute before:-inset-1 before:content-['']", red? "right-full -mr-px" : "left-full -ml-px")` icon `f.X` size `h-(--card-counter-clear-icon-size) w-(--card-counter-clear-icon-size)` strokeWidth 3, `aria-label current.removeCounter`.
Counter names: `current.redCounterName` / `current.whiteCounterName`.

### 9.5 `lD` (17 948) — QuickAddCounterButton
Single `+`/`−` button (`+` for white, `−` for red) with hover color variants, `aria-label current.addCounter`, `aria-description current.scrollCounterDescription`.

### 9.6 `lE`/`lT`/`lz`/`lB`/`lL` (18 104–18 677)
- `lE` = invisible probes.
- `lT` = per-counter anchor `div data-card-counter-anchor="true" data-card-counter-owner/zone/card-id/counter/mode/key` registered into `lA` via context; computes `key = ${owner}:${zone}:${cardId}:${counter}:${mode}`; renders children (the visible badge) + probes.
- `lz` = `div data-card-counter-frame="true" class "pointer-events-none absolute left-1/2 top-1/2 z-56 w-full -translate-x-1/2 -translate-y-1/2" style {"--card-counter-angle","--card-counter-progress"}`.
- `lB` = static counter display `div data-card-counter-single|data-card-counter-paired class lg` with `div data-card-counter-display={counter} class clsx(lv,lP(counter))`.
- `lL` = layer of one/two counters (`data-card-counter-layer/single/paired`), `adjustButtonsExpanded` forces both slots; badge button `data-card-counter-badge="true"` class `clsx("z-20 pointer-events-auto select-none transition-[border-color,background-color,color,transform] duration-120 disabled:opacity-[0.34] disabled:pointer-events-none hover:enabled:scale-[1.03]", lv, lP(counter), !suppressed && "group-hover:border-[rgba(244,249,255,0.96)]")`; click +1, right-click −1 (unless disabled).
- `dI` (20 623) InlineCounterHint — inside counter-hover-scope boards: `span class "pointer-events-none absolute inset-0 z-130"` with `style transform rotate(-{animatedRotationDeg}deg)` and `tp.F label=<lf/>` class `"[.gb-card-action-hover-scope[data-card-action-hover-active=true]_&]:opacity-100"`.

### 9.7 `sO` (23 827) — Legend XP + `s$` pile counter (24 060)
- `sO` props `{value, disabled, onAdjust, upright}`; overlay `div data-legend-xp-overlay="true" data-legend-xp-value={0..99} class "pointer-events-none absolute inset-x-0 top-0 z-80"`.
  - `button`/`span` `popoverTarget` (Popover API) class `clsx("flex h-7 w-full items-center justify-center rounded-[0.2rem] border border-[#aec8e7]/50 bg-[#101d31]/95 px-1 text-[#f3f8ff] shadow-[0_2px_6px_#030814aa] [font-variant-numeric:tabular-nums]", interactive && "pointer-events-auto touch-manipulation hover:brightness-125")`; label `sim.xp` (span `text-[0.56rem] font-semibold`) + value `w-[1.4rem] text-center text-[0.86rem] font-black`; upright → `"rotate-180 origin-center"`.
  - inline ± overlay `div data-legend-xp-inline-controls="true" class "pointer-events-none absolute inset-0 hidden items-center justify-between [@media(hover:hover)_and_(pointer:fine)]:flex"`; buttons `pointer-events-auto h-7 w-5 rounded-[0.2rem] bg-[#101d31] text-base opacity-0 transition-opacity hover:bg-[#293e59] focus-visible:opacity-100 group-hover/xp:opacity-100 group-focus-within/xp:opacity-100 disabled:text-white/30`, labels `current.decrease|increaseLegendXpCounter`.
  - touch popover portal `div data-legend-xp-controls="true" role="group" aria-label=sim.legendXp popover="auto" class "fixed right-auto bottom-auto m-0 h-fit w-44 rounded-md border border-[#aec8e7]/50 bg-[#101d31] p-1.5 text-[#f3f8ff] shadow-xl"`; `− / +` 44px buttons `h-11 w-11 shrink-0 rounded border border-white/25 bg-white/10 text-xl disabled:opacity-40`.
- `s$` PileCounter: `strong data-pile-counter={value} class clsx("z-30 pointer-events-none leading-none [font-variant-numeric:tabular-nums] rounded-[0.36rem] border border-[rgba(220,236,255,0.24)] bg-[linear-gradient(180deg,rgba(60,86,120,0.24)_0%,rgba(11,19,33,0.52)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_0_0_1px_rgba(240,247,255,0.05),0_4px_14px_rgba(4,10,21,0.34)] backdrop-blur-md backdrop-saturate-150", prominent ? "text-[#f7fbff] text-[1.38rem] font-black tracking-[-0.03em] px-[0.34rem] py-[0.1rem]" : "text-[#d4e2ff] text-[0.62rem] px-[0.22rem] py-[0.1rem]")` + text-shadow classes.

---

## 10. Card labels / tags / buffs (18 979 – 19 310)

### 10.1 Predicates & payloads
- `l1(card)` quick-equip predicate; `l2/l4/l5` zone allow-lists (incl. `runeArea` for labels).
- `l3(zone, card)` → label payload: `{ type: "set_card_label", owner: "self", zone, cardId: card.id, slot: (0,e2.e)(card), label: e2.c }` (`e2.c` = default empty label, `e2` external labels module).
- `l8` = can draw target arrow (excludes chain unless allowed, arrow onto same source/target).
- `l6/l7` autopay/target rules; `l9` autopay plan via `rN.q(o,(0,rN.l)(n),{normalBattlefieldCount})`.
- `de(zone, card)` = can add to chain (not trash/banished/runeArea && external rule); `dt({shiftKey,ctrlKey,metaKey,platformModifier,zone})` → `"banished"` | `"trash"` | null (hand/base/battlefield zones; champion → trash only without modifier).
- `dr(source,target)` → `{ type: "target_arrow_add", sourceCardId, sourceAnchor, targetCardId, targetAnchor }`.
- `da(arrow, chainEntry)` → chain-source arrow payload.

### 10.2 `dd` (19 116) — CardTagControls
Props `{card, disabled, insetPx=1, suspendInteraction, onEdit, onDelete, onAdjust}`.
Labels = `card.temporaryMightBuff` as `{label:"Buff N", slot:"buff"}` + mapped `card.customLabels` **first** then custom (`t = [...buffLabels, ...custom]` — buff first).
For each label with `slot !== undefined` renders `div className="card-tag-controls"` with inline style
`{backgroundColor, borderColor, textColor}` from `(0,ts.N)(label)` and handlers `onKeyDown=dm` (stop Enter/Space),
`onContextMenu=du`, `onPointerDown=dc`, `onClick=ds` (all stopPropagation).
Buttons `className="card-tag-control"`:
- decrease `dn.f` size 14, `aria-label sim.decreaseTag {tag}`, `disabled || count===99` on increase, `aria-label sim.increaseTag`
- edit `di.f` size 13 (`current.editCardLabel`) when numeric slot && onEdit && !(0,ts.U)(label)
- delete `oc.f` size 13 (`current.deleteCardLabel`) when numeric slot && onDelete
Wrapped by `tp.r {labels, suspendInteraction, insetPx, className:"z-70", renderTrailingActions}` (external label renderer).

### 10.3 Board-card action-button class constants (19 283–19 307)
```
df = `${tp.w} group/action absolute z-50 inline-flex items-center justify-center w-[1.9rem] h-[1.9rem] opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto hover:z-140 focus-visible:z-140`
db = `${df} ${tp.a}`
dg = "right-[0.1rem] top-[0.1rem]"
dx = "right-[0.1rem] top-[2.18rem]"
dw = "right-[0.1rem] top-[4.26rem]"
dy = clsx(df, dg)
dv = clsx(lJ.R, "group relative w-full h-full pointer-events-auto")
dk = `${tp.N} opacity-100 pointer-events-auto`
dC = fallback translator map for sim.{hiddenCard,cardFallback,youInSentence,yourOpponent,boardCardControlledBy[OwnedBy]}
```

### 10.4 `d_` (19 307 – 20 553) — BoardCard
Props (verbatim list in §“props” above, lines 19 310–19 400): `readOnly, card, playerId, renderModel, buttonClassName,
children, overlayRotationOffsetDeg=0, cardDropIndex, contentClassName, hoverToneClass, labelInsetPx=1,
showFaceDownRevealHint, actionOverlays, controllerPresentation, controllerCueMode="player-label",
quickTargetButtonClassName, pinged, pingEventId=null, draggable, contextMenuEnabled, onCardSelect,
onCardContextMenu, onCardDragStart, onCardDragEnd, onCardHover, onCardHoverEnd, onAdjustCardCounter,
onClearCardCounter, onRemoveMightBuff, onSetCardRevealToOpponent, onQuickTargetCard,
onRemoveTargetArrowsForSource, onQuickEquipCard, onQuickEmpowerCard, onQuickEmpowerCardPreviewChange,
onBeginPlayHidden, onEditCardLabel, onDeleteCardLabel`.
**Context menu action list** built at 19 700–19 900 (ids / i18n labels):
`ping sim.compactPing` · `recycle sim.tablet.recycle` (runeArea) · `tap sim.tablet.play` · `play-hidden sim.tablet.hidden` ·
`chain sim.tablet.addToChain` · `give-control sim.tablet.giveControl` (`requiresControlRecipient:true`) ·
`trash sim.tablet.trash` · `banish sim.tablet.banish` (non-champion) · `target sim.tablet.target` ·
`clear-targets sim.tablet.removeTargets` · `equip sim.tablet.equip` · `animate-gear sim.oriannaAnimateGear` ·
`choose-neeko-legend` · `empower|disempower sim.tablet.{empower,disempower}` · `reveal sim.tablet.reveal` ·
`remove-buff sim.removeBuff`.
Surrounding DOM:
- root card visual `button` attrs: `data-drop-zone`, `data-drop-index`, `data-card-id`,
  `data-board-card-visual="true"`, `data-visual-owner`, `data-visual-hidden`, `data-visual-dragging`,
  `data-exhausted`, `data-face-down`, `data-pose-preview="recycle-exhaust|recycle|exhaust|none"`,
  `data-pose-animation="${kind}-${active|pending}"|"none"`, `data-controller-player-id`,
  `data-card-owner-player-id`, `data-preview-landscape="false"`, `data-preview-rotation="0"`, `aria-label`.
- wrapper `div.relative.w-full.h-full` (`w` = `clsx("relative w-full h-full", contentClassName)`) attrs:
  `data-hover-preview-anchor="true"`, `data-preview-landscape="false"`, `data-preview-rotation="0"`,
  `data-card-id`, `data-drop-zone`, `data-controller-player-id`, `data-card-owner-player-id`,
  `data-team-label`, `data-player-color`, pointer hover handlers.
- chips: equipped `span` class `pointer-events-none absolute left-(--card-label-stack-left) bottom-(--card-label-stack-left) z-20 inline-flex items-center justify-center rounded-(--card-label-chip-radius) border border-[rgba(139,222,189,0.58)] bg-[rgba(19,55,46,0.9)] px-(--card-label-chip-pad-x) py-(--card-label-chip-pad-y) text-(length:--card-label-chip-font-size) leading-none font-semibold tracking-[0.04em] uppercase text-[#c8f6e3] shadow-[0_4px_10px_rgba(3,20,16,0.45)]` (`sim.equipped`);
  face-down reveal hint (`current.playFromHidden`) and revealed chip (`current.revealed`) as quoted at 19 990–20 030.
- counter layer: `lL` when controls/quickAdd, else `lB` when display; wrapped in `lz` frame.
- controller badge `span data-battlefield-controller-badge="true" data-controller-placement="outside-top-center" data-controller-relation data-controller-cue-mode data-player-color` + outline `span data-battlefield-controller-outline="true" data-player-color`; classes quoted at 20 090–20 130 (duel-native variants, border tints `border-[#72c6ff]/56` self, `border-[#69ddb3]/56` ally, `border-[#c9788d]/46` opponent).
- top-right action buttons: `T` animate-gear (`ls` cog icon, `data-card-action="animate-gear"`), `z` choose-neeko-legend (`lu` mask icon), `K` dynamic (`dj`), empower button via `tm` (motion button) with `onPreviewChange`, reveal (`eY.f`/`eQ.f` icons; `z-130` + `dk` when revealed), target (`tp.m`), clear arrows (`tp.$`), equip (`tp.E`); plus duplicates `O` `span data-card-copy-tag` class `card-copy-tag pointer-events-none absolute top-0 z-70 border border-teal-200/80 bg-[#145a60] font-extrabold uppercase text-teal-50 shadow-[0_2px_6px_#0008]` (`sim.copyBadge`), neeko borrowed tag `L`, unit tag `B` (`lY`), and `$` = `dd` label controls when `renderModel.actions.labels.display`.
- final `th.k` wrapper receives `{...rest, card: faceUp?card:null, sourceCardId, zone, owner, onTouchDragStart, actionContent, counters, labels, actions, renderDesktopBanishAction:false, className: dv, onPointerEnter/Move/Leave}`.

### 10.5 `dj` (20 554) — BoardCardDynamicAction
Picks dynamic action from `(0,th.D)(card) ?? (0,th.o)(card,zone)`; renders `button className={df}` style `{right:"0.1rem", top:`${0.1+2.08*slot}rem`}`, `data-card-action={id}`; icons: `banish-top`→`tp.K`, `dockside-banish`→`lt.f` (18), else `eq.f`; tooltip `tp.F variant:"board"`.

### 10.6 Buff-related bits
- Might buff badge shown via `renderModel.indicators.showMightBuffBadge` + `mightBuffAmount` (`z.d`).
- Temporary buff chip text `Buff ${card.temporaryMightBuff}` (`dd`).
- Remove: context menu id `remove-buff` (`sim.removeBuff`); in `d_` gated by `renderModel.actions.removeTemporaryMightBuff`.
- Dock arming: `sf` `buffActionArmed` / `onArmBuffAction` (keys `sim.armBuffActionAria`, `sim.cancelBuffActionAria`, `sim.applyBuffShortcut`, `sim.cancelBuff`).
- Duplicate: dock `duplicateActionArmed` / `onArmDuplicateAction` (`sim.armDuplicateActionAria`, `sim.cancelDuplicateActionAria`, `sim.duplicateShortcut`, `sim.cancelDuplicateShortcut`); card badge `data-card-copy-tag` + text `sim.copyBadge`; `card.isDuplicate` drives it.

---

## 11. Piles, main/rune-deck hints, banished button (23 744 – 25 190)

### 11.1 `sq` (24 180) — CardPile
Props: `{label, inspectionOnly, hoverLabel, hoverDetail, hoverContent, count, showCount=true, hideLabel,
cardBackImageUrl, cardBackSlot="deck", prominentCount, stackPresentation="standard", centerStackTopCard,
viewerUpright, counterUpright, counterPlacement="top-right", disabled, dropActive, onElementRef, onPress,
onContextPress, onTopCardDragStart, onTopCardDragEnd, onDrop, onDragOver, onDragLeave, dataPileSlot,
dataPileOwner, banishLinkCardId}`.
Layer math: `sW(count, stackConfig, centerTop)` + configs `sH` (standard: depth thresholds 0→0,1→1,3→2,6→3,12→4,20→5,35→6,∞→7; spread 0/.12/.2/.29/.38/.47/.56 rem; maxSpread .56; minOpacity .52 step .11; minScale .93 step .017) and `sF` (compact: 0→0,1→1,∞→2; spread 0/.16; maxSpread .16; minOpacity .68 step .14; minScale .97 step .012).
DOM (`inspectionOnly`/non-interactive branch and interactive branch share children `[P(label tooltip), N(layers wrapper)]`):
- interactive root `button data-touch-action-target="true"` attrs:
  `data-board-lines`, `data-pile-slot`, `data-pile-owner`, `data-pile-count`, `data-stack-presentation`,
  `data-stack-depth`, `data-stack-top-card-centered ("true"|"false")`, class
  `group/action relative h-auto w-fit min-h-0 rounded-[0.08rem] border-none bg-transparent p-[0.08rem] inline-flex items-center justify-center shadow-none overflow-visible appearance-none text-inherit opacity-100 cursor-pointer after:content-[''] after:absolute after:inset-[0.08rem] after:pointer-events-none after:gb-ornament-pile disabled:cursor-default disabled:bg-transparent disabled:text-inherit disabled:opacity-100 focus-visible:outline-none` + `eC`("after:opacity-[0.24]"|"after:opacity-[0.56]") + dropActive `of.j`.
- label `p` class `absolute left-[0.22rem] top-[0.16rem] text-(--text-dim) text-(length:--board-micro-label-size) uppercase tracking-[0.06em] text-shadow-none`
- layers `div` style width/height `calc(var(--card-width) + ${maxSpread}rem*var(--pile-stack-spread-scale,1))`; per-layer `div.clsx(of.d,"absolute left-0 top-0 border-transparent shadow-none")` transform `translate(calc(${offsetRem}rem*scale), …) scale(${s})`; top card back via `tp.g` `class "cardBack absolute left-0 top-0 border-transparent shadow-none"`.
- count `div data-pile-count-placement={top-right|top-left|bottom-right|bottom-left} class clsx("absolute z-40 pointer-events-none", placementPos, counterUpright && "rotate-180 origin-center")` + `s$`.
- Pile menu ids: `press` (`sim.drawShortcut`, `sim.look`, `sim.board.channelExhausted` label variants), `look`, `burn` (`sim.toTrash`, mainDeck only), `ready` (`sim.channelReady`, runeDeck only).
- Wrapper `th.k { card:null, sourceCardId:`pile-${owner}-${slot}`, owner, kind: onTopCardDragStart?"mainDeckCard":"boardCard", onTouchDragStart, className:"inline-flex relative", actions }`.

### 11.2 `sU` (24 755) Main-deck hints & `sZ` (24 857) Rune-deck hints
Both render `tp.F variant:"board"` with `span data-main-deck-action-hints="true" data-command-modifier-active="true|false"` /
`data-rune-deck-action-hints`, class `grid gap-[0.12rem]`; rows class
`grid grid-cols-[2.5rem_auto] items-center gap-[0.22rem] whitespace-nowrap text-left text-(length:--card-action-hover-detail-size) font-semibold leading-none tracking-[0.02em] text-[#dce8f8]`,
each row `data-main-deck-action="draw|look|burn"` / `data-rune-deck-action="channel_exhausted|look|channel_ready"`.
Mouse glyphs `a_ {button:"left"|"right"}` + optional modifier chip `ax` (`(0,d.H)(platformModifier)`).
Keys: `sim.{drawShortcut,look,toTrash,burn,channelReady,board.channelExhausted}`. `(0,d0)(modifiers)` → `"channel_ready"|"channel_exhausted"`.

### 11.3 `sX` (24 965 – ~25 190) — BanishedPileButton
`memo` props `{anchorRef, count, owner, onOpenBanished}`; portal into `document.body`; button class:
```
clsx("fixed z-145 inline-flex max-w-[calc(100vw-1rem)] items-center justify-center gap-[0.22rem] overflow-hidden whitespace-nowrap rounded-[0.18rem] border px-[0.54rem] py-[0.24rem] text-center text-[0.66rem] font-semibold uppercase leading-[1.05] tracking-[0.06em] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_0_1px_rgba(12,10,22,0.4),0_8px_18px_rgba(5,10,24,0.26)] transition-[border-color,background-color,color,box-shadow]",
 self     → "border-[rgba(176,154,232,0.72)] bg-[linear-gradient(180deg,rgba(59,46,92,0.98),rgba(34,25,56,0.98))] text-[#ddd1ff] hover:border-[rgba(208,191,255,0.82)] hover:bg-[linear-gradient(180deg,rgba(71,56,108,0.99),rgba(42,31,68,0.99))] hover:text-[#f0e8ff]"
 opponent → "border-[rgba(194,176,248,0.74)] bg-[linear-gradient(180deg,rgba(71,54,110,0.98),rgba(41,29,66,0.98))] text-[#e6d8ff] hover:border-[rgba(223,209,255,0.86)] hover:bg-[linear-gradient(180deg,rgba(82,63,124,0.99),rgba(49,35,78,0.99))] hover:text-[#f5eeff]")
```
Attrs `data-banished-pile-button="self|opponent"`, `data-compact`; content = hidden measure span + icon/label
(`sim.banishedCount {count}` or icon `lt.f` size 11 + count when compact); `aria-label current.openBanishedCards {owner}`.
Anchor math keeps the button within viewport near `anchorRef`, re-measured on rAF + ResizeObserver + `.gb-board` resize events (`iL.f`).

---

## 12. Token quick bar (21 895 – 22 408)

- `d5(name, slug)` → `{name, imageUrl:"/tokens/${slug}.webp", panelImageUrl:"/tokens/thumbs/${slug}.webp"}`.
- `d4` presets: Recruit, Gold, Mech, Sand Soldier(`SandSoldier`), Sprite, Bird, Reflection, Shadow Clone(`ShadowClone`), Tentacle.
- `d3` = base zone order (Gold first); `d8` = battlefields order (Gold removed, Bomb appended via `(0,d2.W)("Bomb")`).
- `d7` panel class: `grid grid-cols-5 grid-rows-2 w-max gap-[0.22rem] overflow-visible rounded-[0.18rem] border shadow-[inset_0_1px_0_rgba(255,255,255,0.065),0_10px_22px_rgba(3,8,18,0.24)] backdrop-blur-xl backdrop-saturate-150 transition-[max-width,max-height,opacity,padding,border-color,background-color] duration-150 ease-[cubic-bezier(0.2,0.7,0.2,1)]`.
- `d9(zone, locale)` zone label; `se(name,url)` token preview card; `st` TokenArt (80×80, art crop class `gb-card-art-crop` or `object-cover`, polish span `absolute inset-0 rounded-[0.1rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(6,10,18,0.18)_72%,rgba(6,10,18,0.42))] shadow-[inset_0_0_0_1px_rgba(242,247,255,0.08)]`, wrapper `pointer-events-none absolute inset-[0.04rem] overflow-hidden rounded-[0.1rem] bg-[rgba(6,12,22,0.72)]` + `data-token-art-crop`).
- `sr` TokenOptions — buttons class `group/token-option relative h-10 w-10 shrink-0 overflow-hidden rounded-[0.14rem] border border-[rgba(177,201,228,0.16)] bg-[rgba(14,26,45,0.76)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md backdrop-saturate-150 transition-[border-color,box-shadow,background-color,filter] duration-120 disabled:cursor-default disabled:opacity-[0.45] hover:enabled:border-[rgba(207,229,251,0.36)] hover:enabled:bg-[rgba(22,39,64,0.84)] hover:enabled:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_7px_16px_rgba(3,8,18,0.2)] focus-visible:outline-2 focus-visible:outline-[rgba(201,226,255,0.72)] focus-visible:outline-offset-1`;
  name tooltip `pointer-events-none absolute left-1/2 bottom-[calc(100%+0.16rem)] z-20 inline-flex -translate-x-1/2 items-center justify-center whitespace-nowrap rounded-[0.1rem] border border-[rgba(171,191,238,0.34)] bg-[rgba(17,30,50,0.96)] px-[0.3rem] py-[0.13rem] text-(--text-soft) text-[0.5rem] font-semibold leading-none tracking-[0.035em] opacity-0 shadow-[inset_0_0_0_1px_rgba(209,224,255,0.06),0_8px_18px_rgba(3,8,20,0.4)] transition-opacity duration-120 group-hover/token-option:opacity-100 group-focus-visible/token-option:opacity-100`;
  `aria-label sim.addTokenTo {tokenName, zone}`; hover forwards preview anchored to `panelAnchorRef`.
- `sa` TokenQuickBar — trigger button class
  `clsx("group/action relative grid h-[1.52rem] w-[1.52rem] place-items-center rounded-[0.14rem] border border-[rgba(181,205,234,0.26)] bg-[rgba(18,31,51,0.66)] text-[#cfe2f7] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_5px_12px_rgba(3,8,18,0.18)] backdrop-blur-md backdrop-saturate-150 transition-[border-color,background-color,color,box-shadow] duration-120 group-hover/token-bar:border-[rgba(204,226,249,0.42)] group-hover/token-bar:bg-[rgba(29,47,72,0.72)] group-hover/token-bar:text-[#f0f7ff] group-hover/token-bar:shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_7px_16px_rgba(3,9,20,0.24)] focus-visible:outline-2 focus-visible:outline-[rgba(201,226,255,0.72)] focus-visible:outline-offset-1", open && "border-[rgba(204,226,249,0.42)] bg-[rgba(29,47,72,0.72)] text-[#f0f7ff] shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_7px_16px_rgba(3,9,20,0.24)]")`
  with `dl.f` icon; inline panel visible on `group-hover/token-bar`; click opens a **portal** `div data-testid="token-quick-panel"` with inline styles `position:fixed; zIndex:2147483000`, placement computed to prefer the anchor’s right side, clamped to viewport. Escape / outside mousedown closes (`sn` returns `!e`).
  Root `div data-token-quick-bar="true"` class `group/token-bar flex items-start gap-[0.16rem] [[data-board-dragging=true]_&]:pointer-events-none` style `{zIndex:4000}`.

---

## 13. Board action dock `sf` (22 514 – 23 743) + dice toggle `sh` (22 462)

### 13.1 `sh` DiceToggle
`framer span` rotate `180*!!hidden` (`(0,dY.P)`), scale `1.04|1`, icon `tp.M` class `w-[1.16rem] h-[1.16rem] opacity-100|90`, transition `sp = {duration:0.34, ease:[0.22,1,0.36,1]}`.

### 13.2 `sf` props
```
{busy, className, buffActionArmed, counterActionArmed, legendXpCounterEnabled, battlefieldMightEnabled,
 showSavedTogglesHint, stopAtBeginningPhaseEnabled, showTemporaryUnitHint, skipDrawPhaseEnabled,
 autoScoreFromHoldEnabled, duplicateActionArmed, labelActionArmed, transferControlActionArmed,
 emoteActionActive, diceActionActive, onArmBuffAction, onArmCounterAction, onSetLegendXpCounterVisible,
 onSetBattlefieldMightVisible, onDismissSavedTogglesHint, onSetStopAtBeginningPhase,
 onDismissTemporaryUnitHint, onSetSkipDrawPhase, onSetAutoScoreFromHold, onArmDuplicateAction,
 onArmLabelAction, onArmTransferControlAction, onOpenEmoteWheel, onOpenDiceWheel}
```
Exact nesting:
```
_ (outer)  div ref  data-help-anchor="board-controls"  class clsx("relative z-150 inline-flex items-center", className)
           onMouseLeave (hover-intent reset)  onKeyDown (Tab trap inside open panel)
 ├─ B      div class "relative"  onMouseMove={e => eR("actions"|"toggles", e)}   children = [h (actions button), z (actions panel portal)]
 └─ (O ?)  div class "relative"                                                  children = [hints (oh saved-toggles / temporary-unit), toggles button, toggles panel portal]
```
Hovering a button arms auto-open after intent (`eR`), clicking toggles (`eM`); `Escape`, outside `mousedown/touchstart`, or `fullscreenchange` closes (`eS`).

**Toggle switch** (used by `t(e)` renderer): wrapper `span class "relative inline-flex h-[1.18rem] w-[2.72rem] shrink-0 items-center rounded-[0.16rem] border px-[0.12rem] shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] transition-[border-color,background-color] duration-150"` + on `"border-[rgba(173,214,255,0.4)] bg-[rgba(41,82,121,0.88)] text-[#eff8ff]"` / off `"border-[rgba(147,181,219,0.24)] bg-[rgba(24,40,63,0.88)] text-[#cbd9ea]"`; ON/OFF label span and knob with 3 grip bars (classes quoted in file 22 890–22 930): label `sim.on|sim.off`, `sim.counterPlus|counterMinus` for counters.

**Main action button** (`h`) class `C`:
```
clsx("group/action relative grid h-[1.84rem] w-[2.18rem] place-items-center rounded-[0.16rem] border border-[rgba(181,205,234,0.24)] bg-[rgba(18,31,51,0.66)] text-[#d3e4f7] shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_5px_12px_rgba(3,8,18,0.18)] backdrop-blur-md backdrop-saturate-150 transition-[border-color,background-color,color,box-shadow] duration-140 hover:border-[rgba(204,226,249,0.4)] hover:bg-[rgba(29,47,72,0.72)] hover:text-[#f0f7ff] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.09),0_7px_16px_rgba(3,9,20,0.22)] focus-visible:outline-2 focus-visible:outline-[rgba(201,226,255,0.72)] focus-visible:outline-offset-1",
 T(other toggles open ? "h-[2.52rem] w-[3.26rem] rounded-l-[0.18rem] rounded-r-[0.08rem] border-r-0" : "h-[2.52rem] w-[3.26rem] rounded-[0.18rem]"),
 armed(any action) && "border-[rgba(162,236,198,0.52)] bg-[rgba(21,72,53,0.72)] text-[#e4fff2] shadow-[inset_0_1px_0_rgba(228,255,241,0.11),0_8px_18px_rgba(3,9,20,0.26)]",
 open && "border-[rgba(204,226,249,0.42)] bg-[rgba(29,47,72,0.72)] text-[#f0f7ff]")
```
`aria-label current.openBoardActionPanel`, `aria-pressed={anyArmed}`, `aria-expanded`; icon `li.f` `h-[1.42rem] w-[1.42rem]`; label span `board-control-label` text `sim.actions`; tooltip `tp.F`.

**Toggles button** (second half of segmented control): same base class + `"-ml-px h-[2.52rem] w-[3.26rem] rounded-l-[0.08rem] rounded-r-[0.18rem]"`, hover `$` from hover state "any toggle line"? (see code), open `"toggles" === ew` → `"border-[rgba(204,226,249,0.42)] bg-[rgba(29,47,72,0.72)] text-[#f0f7ff]"`; icon `la/lo` toggle-left/right `h-[1.53rem] w-[1.53rem]` strokeWidth 2.05; `aria-label current.openBoardTogglesPanel`; `aria-describedby` hint ids.

**Popover panels** — use native Popover API when available (`eI` = supports showPopover): `popover="manual"` (or `void 0`), `inert` when closed, `data-board-action-panel="actions"|"toggles"`, mounted via portal into `document.fullscreenElement ?? body` when no popover support. Panel class:
```
clsx("fixed z-170 m-0 flex w-max max-w-[calc(100vw-1rem)] items-center justify-center overflow-hidden rounded-[0.18rem] border shadow-[inset_0_1px_0_rgba(255,255,255,0.065),0_12px_24px_rgba(3,8,18,0.28)] backdrop-blur-xl backdrop-saturate-150 transition-[max-height,opacity,border-color,background-color,transform] duration-160 ease-[cubic-bezier(0.2,0.7,0.2,1)]",
 open ? "max-h-[18.2rem] translate-y-0 border-[rgba(174,199,227,0.26)] bg-[rgba(11,20,35,0.82)] opacity-100 pointer-events-auto"   // toggles: max-h-52
      : "max-h-0 translate-y-[0.18rem] border-transparent bg-transparent opacity-0 pointer-events-none")
```
Columns: actions `"inline-flex min-w-37 flex-col items-stretch divide-y divide-[rgba(174,199,227,0.12)]"`; toggles `"inline-flex min-w-47 …"`.
Panel action-row class (all rows; e.g. counter/buff/duplicate/label/give-control/emote/dice):
```
"group/action relative inline-flex h-[2.22rem] w-full shrink-0 items-center justify-start whitespace-nowrap px-[0.68rem] text-(length:--board-action-font-size) font-semibold leading-none uppercase tracking-[0.055em] text-[#d8e6f6] transition-[background-color,color] duration-120 disabled:cursor-default disabled:opacity-[0.45] hover:enabled:bg-[rgba(116,151,194,0.12)] hover:enabled:text-[#f0f7ff] focus-visible:outline-2 focus-visible:outline-[rgba(201,226,255,0.72)] focus-visible:outline-offset-[-1px]"
```
Row list & keys:
| row | pressed style | keys |
|---|---|---|
| counter (with hover split −/+) | white `bg-[rgba(241,246,255,0.94)] text-[#101c2e]`, red `bg-[rgba(126,34,34,0.92)] text-[#ffe8e8]`; split buttons `bg-[rgba(102,32,36,0.94)] text-[#ffe8e8] hover:bg-[rgba(126,39,43,0.96)]` / `bg-[rgba(225,234,246,0.96)] text-[#1f2d42] hover:bg-[rgba(240,246,255,0.98)]` | `sim.armCounterActionAria`, `sim.cancelCounterActionAria`, `sim.addCountersShortcut`, `sim.cancelCounter {counter}`, `sim.counterPlus|counterMinus`, `sim.addMinusCounter/addPlusCounter`, `current.applyMinusCounter/applyPlusCounter` |
| buff | `bg-[rgba(36,106,77,0.86)] text-[#e2fff3]` | `sim.armBuffActionAria`, `sim.cancelBuffActionAria`, `sim.applyBuffShortcut`, `sim.cancelBuff` |
| duplicate | `bg-[rgba(20,95,99,0.86)] text-[#e8fffd]` | `sim.armDuplicateActionAria`, `sim.cancelDuplicateActionAria`, `sim.duplicateShortcut`, `sim.cancelDuplicateShortcut` |
| label | `bg-[rgba(111,86,28,0.86)] text-[#fff4d9]` | `sim.armLabelActionAria`, `sim.cancelLabelActionAria`, `sim.labelCardShortcut`, `sim.cancelLabelShortcut` |
| give control | `bg-[rgba(26,91,111,0.86)] text-[#ddfbff]` | `sim.armGiveControlActionAria`, `sim.cancelGiveControlActionAria`, `sim.giveControl`, `sim.cancelGiveControl` |
| emote wheel | `bg-[rgba(108,82,34,0.82)] text-[#fff1cd]` | `current.openEmoteWheelShortcutE`, `sim.emoteShortcut` |
| dice wheel | same as emote | `current.openDiceWheelShortcutShiftR`, `sim.rollDieShortcut` |
Order in panel: counter, buff, duplicate, label, give-control, emote, dice.

**Toggles panel** rows (`data-board-toggle={key}`, `data-board-toggle-label`): `stop-at-beginning` (`sim.stopAtBeginningPhase`), `skip-draw-phase` (`current.skipDrawPhase`), `auto-score-from-hold` (`sim.autoScoreFromHold`), `xp-counter` (`sim.xpCounter`), `battlefield-might` (`sim.battlefieldMight.toggleLabel`); row class adds `"relative w-full px-[0.72rem] pr-[4.34rem] text-left normal-case tracking-[0.03em]"`, multiline `"h-[2.68rem] py-[0.26rem]"`, enabled `"bg-[rgba(43,82,118,0.54)] text-[#edf6ff]"`; `aria-label current.disableSetting|enableSetting {setting}`; label `text-[0.72rem] font-semibold uppercase tracking-[0.045em]`; right switch `absolute right-[0.72rem] top-1/2 w-[2.72rem] -translate-y-1/2`.
Hints: `oh` `data-testid="saved-board-toggles-hint"`, `data-testid="temporary-unit-hint"` (custom framer popover, class `absolute right-0 bottom-[calc(100%+0.34rem)] z-130 flex w-64 max-w-[calc(100vw-1rem)] items-start gap-[0.38rem] rounded-[0.36rem] border border-[rgba(212,227,251,0.42)] bg-[linear-gradient(180deg,rgba(20,34,59,0.99),rgba(12,23,43,0.99))] px-[0.5rem] py-[0.46rem] text-left shadow-[0_14px_34px_rgba(3,8,20,0.48)]`, enable button `mt-2 rounded border border-[rgba(205,220,244,0.3)] px-2 py-1 text-[0.64rem] font-semibold text-[#edf4ff] hover:bg-white/10 disabled:opacity-50`).
Behaviour: hover auto-opens after intent (`onMouseMove` → `eR(target)`), click toggles; outside mousedown/Escape/screen-watch closes; popover focus trapping (`Tab` cycles inside panel), `Escape` handled; `fullscreenchange` closes.

---

## 14. Prompt / hint / dialog primitives (exact base strings)

1. **`oh` (9 644)** — anchored hint popover, props `{id, testId, title, body, dismissLabel, onDismiss, placement="above"|"side"}`
```
motion.div id data-testid role="status" aria-live="polite"
  initial {opacity:0,y:6,scale:0.98} animate {opacity:1,y:0,scale:1} exit {opacity:0,y:4,scale:0.98} transition {duration:0.16,ease:"easeOut"}
  placement above → "right-0 bottom-[calc(100%+0.34rem)]" ; side → "top-0 right-[calc(100%+0.34rem)]"
  class "pointer-events-auto absolute z-130 flex w-48 max-w-[calc(100vw-1rem)] items-start gap-[0.38rem] rounded-[0.36rem] border border-[rgba(212,227,251,0.42)] bg-[linear-gradient(180deg,rgba(20,34,59,0.99),rgba(12,23,43,0.99))] px-[0.5rem] py-[0.46rem] text-left shadow-[0_14px_34px_rgba(3,8,20,0.48)]"
 title p "m-0 text-[0.62rem] font-bold uppercase tracking-[0.08em] text-[#edf4ff]"
 body  p "mt-[0.12rem] text-[0.64rem] leading-[1.32] text-[#b9cce9]"
 dismiss button "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[0.18rem] border border-[rgba(205,220,244,0.18)] text-[#c8daef] hover:border-[rgba(223,234,249,0.32)] hover:text-white focus-visible:outline-2 focus-visible:outline-[#a5dcff]" (icon f.X h-3 w-3 strokeWidth 1.7)
 arrow span data-testid={`${testId}-pointer`} "absolute h-[0.54rem] w-[0.54rem] rotate-45 border-r border-[rgba(212,227,251,0.42)] bg-[rgba(12,23,43,0.99)]" + above:"right-[0.9rem] -bottom-[0.29rem] border-b" / side:"top-[0.9rem] -right-[0.29rem] border-t"
```
2. **`dO` (21 170)** Orianna gear hint — portal into `[data-board-play-area]`; `motion.div role="status" aria-live="polite" data-testid="orianna-gear-hint" data-placement="above|below"`, class
`pointer-events-none absolute z-130 flex w-48 max-w-[calc(100vw-1rem)] items-start gap-[0.38rem] rounded-[0.36rem] border border-[rgba(212,227,251,0.42)] bg-[linear-gradient(180deg,rgba(20,34,59,0.99),rgba(12,23,43,0.99))] px-[0.5rem] py-[0.46rem] text-left shadow-[0_14px_34px_rgba(3,8,20,0.48)]`, initial `{opacity:0,scale:0.98}` animate `{opacity:1,scale:1}` transition `{duration:0.16,ease:"easeOut"}`; arrow classes `absolute h-[0.54rem] w-[0.54rem] rotate-45 border-[rgba(212,227,251,0.42)] bg-[rgba(12,23,43,0.99)]` + `-top-[0.29rem] border-t border-l` / `-bottom-[0.29rem] border-r border-b`; keys `oriannaGearHint[Title], oriannaGearHintBody|oriannaGearHintTouchBody, dismissOriannaGearHint`.
3. **`dU` (21 485)** touch rune-recycle hint — same popover chrome; `data-testid="touch-rune-recycle-hint"`, localStorage key `riftbound_simulator_touch_rune_recycle_hint_seen_v1` (`dq`), keys `runeRecycleHintTitle/Body, dismissRuneRecycleHint`.
4. **`dM` (20 838)** resources popover portal — `div data-resources-popover="true" className="gb-resources-popover"` into `document.fullscreenElement ?? document.body`.
5. **`dD` (20 866)** floating resources summary — `data-resources-toggle` (span when static, button when toggle) class `gb-resources-summary` / `gb-resources-summary pointer-events-auto`; energy `span data-resources-summary-energy data-tone class "gb-resources-summary-energy"`; power `span data-resources-summary-power class "gb-resources-summary-power"`; aria `sim.floatingResourcesSummary {energy,power}`.
6. **Judge tooltips** — plain absolutely positioned spans with `pointer-events-none … opacity-0 … transition-opacity duration-120 group-hover/…:opacity-100 group-focus-within/…:opacity-100` (see §1.3, §3.7, judge community tooltip).
7. **Popover-API panels** — `sf` (13.2) and `sO` (§9.7) — the only native-`popover` usages in the slice.

---

## 15. Notes on shared style objects inside slice

- `d6 = (0, lH.B)(lH.K)` and `d7` returned by image styles (token art style).
- `lK = (0,lH.B)(lH.L)`, `lW = (0,lH.B)(lH.r)`, `lG = (0,lH.B)(lH.M)` — background-position styles for neeko/unit-tag art.
- Domain art gradients (`su`) and domain icons (`ss`): Body/Calm/Chaos/Fury/Mind/Order/Unknown with radial gradient bg classes (quoted in file 22 430–22 470); used by rune/domain icons.
- `sl`/`sd` CSS custom property shims for rune-deck lane x; `sm={type:"spring",stiffness:500,damping:30}`, `sp={duration:0.34,ease:[0.22,1,0.36,1]}`.

---

## 16. Component inventory (line ranges; JSX-returning unless marked)

| # | minified | lines | name | purpose |
|---|---|---|---|---|
| 1 | `o$` | 9 985–9 993 | isJudgeCallAwaitingAnswer | predicate: open judge call still unanswered |
| 2 | `oH` | 9 994–10 037 | JudgePrivateMarker | “only you can see this” eye-shield badge |
| 3 | `oF` | 10 038–10 070 | LiveRegionAnnouncer | sr-only aria-live status diff |
| 4 | `oK` | 10 071–10 719 | JudgeCallMessage | question/thread/answer/status chat `<li>`s + feedback |
| 5 | `o6` | 10 764–10 774 | RecycleIcon | `arrow-up-to-line` icon (recycle chain card) |
| 6 | `o7` | 10 775–10 836 | RepeatGlyphIcon | inline SVG repeat glyph |
| 7 | `o9` | 10 837–10 886 | FlowGlyphIcon | inline SVG flow glyph |
| 8 | `ie` | 10 887–10 919 | ChainCardActionHint | one action/keycap row `data-chain-card-action` |
| 9 | `it` | 10 920–11 044 | ChainCardActionHints | hint tooltip (resolve/banish/approve/target) |
| 10 | `ir` | 11 045–11 063 | groupLogEntries | turn/activity grouping helper |
| 11 | `ia` | 11 064–11 215 | LogActionIcon | actionType→kind icon chip; full switch |
| 12 | `io` | 11 216–11 625 | MatchLogEntry | rich log line (cards/runes/resources) |
| 13 | `ii` | 11 626–11 994 | MatchLog | log list, lazy reveal, turn dividers, collapse |
| 14 | `i_` | 12 137–12 295 | BugReportReceipts | bug message/thread/delivery `<li>`s |
| 15 | `ij` | 12 296–14 666 | ChatPanel | chat + judge + bug composer/list/triggers |
| 16 | `iI` | 14 667–15 300 | ChainStack | floating chain-entry card stack |
| 17 | `i$` | 15 351–15 441 | DisconnectBadge | reconnecting badge + seconds counter |
| 18 | `iH` | 15 442–15 468 | OfflineBadge | self offline badge (rotated) |
| 19 | `iF` | 15 469–15 479 | LocalRealtimeBadgeGate | shows `iH` in game when ws down |
| 20 | `iK` | 15 480–15 517 | OpponentDisconnectedBadge | opponent presence badge |
| 21 | `iZ` | 15 519–15 968 | BoardScoreAndIdentityRails | score rails, identity badges, action timers, player menus |
| 22 | `i1` | 16 109–16 180 | TargetArrowSvg | fixed full-screen SVG arrow layer |
| 23 | `i2` | 16 181–16 223 | TargetArrowPath | glow+line+marker+origin dot |
| 24 | `i5` | 16 224–16 242 | TargetArrowMarker | per-player-color defs marker |
| 25 | `i8` | 16 247–16 458 | TargetArrowLayer | rAF geometry + ResizeObserver layer |
| 26 | `le` | 16 477–16 671 | TargetArrows | resolves card elements, filters top-chain-card arrows |
| 27 | `ll` | 16 707–16 802 | buildCardRenderModel | pure view-model for board/chain cards (no JSX) |
| 28 | `lf` | 16 846–16 967 | CounterActionHints | add/subtract/scroll hint rows |
| 29 | `lA` | 17 034–17 524 | CounterOverlayProvider | portal/registry/anchor math for counters |
| 30 | `lM` | 17 525–17 947 | CounterControls | badge ±/clear cluster (existing counters) |
| 31 | `lD` | 17 948–18 103 | QuickAddCounterButton | single +/− quick-add button |
| 32 | `lE` | 18 104–18 137 | CounterAnchorProbes | invisible center/axis probes |
| 33 | `lT` | 18 138–18 422 | CardCounterAnchor | registers anchor, renders badge children |
| 34 | `lz` | 18 423–18 452 | CardCounterFrame | rotation frame wrapper (`--card-counter-angle`) |
| 35 | `lB` | 18 453–18 512 | CardCounterDisplay | static counter chips (single/paired) |
| 36 | `lL` | 18 513–18 677 | CardCounterLayer | interactive counter layer (1–2 counters) |
| 37 | `lF` | 18 681–18 713 | CardArtCrop | cropped art span (`gb-card-art-crop`) |
| 38 | `lq` | 18 716–18 853 | NeekoLegendsControl | neeko legend options button |
| 39 | `lZ` | 18 854–18 903 | NeekoBorrowedTag | borrowed-legend tag (`gb-neeko-borrowed-tag`) |
| 40 | `lY` | 18 919–18 975 | OriannaUnitTag | orianna unit tag (`card-unit-tag`) |
| 41 | `dd` | 19 116–19 264 | CardTagControls | label rows + edit/delete/adjust controls |
| 42 | `d_` | 19 307–20 553 | BoardCard | full board card: visuals, chips, actions, labels, counters |
| 43 | `dj` | 20 554–20 622 | BoardCardDynamicAction | per-card extra action button |
| 44 | `dI` | 20 623–20 655 | InlineCounterHint | counter hint inside hover scope |
| 45 | `dM` | 20 838–20 865 | ResourcesPopover | portal popover for resources |
| 46 | `dD` | 20 866–20 976 | FloatingResourcesSummary | floating energy/power pill |
| 47 | `dR` | 20 659–20 834 | useZoneMidpointObserver | zone midpoint geometry observer (no JSX) |
| 48 | `dB` | 20 984–21 166 | computeRailLayout | card rail layout solver (no JSX) |
| 49 | `dO` | 21 170–21 463 | OriannaGearHint | gear-animation hint popover |
| 50 | `dU` | 21 485–21 718 | TouchRuneRecycleHint | first-run touch hint popover |
| 51 | `dX` | 21 722–21 774 | useCardRailWidth | rail width hook (no JSX) |
| 52 | `dJ` | 21 779–21 881 | buildBoardParticipantsModel | participants→cards/controller model (no JSX) |
| 53 | `st` | 21 956–22 013 | TokenArt | token image with crop/polish |
| 54 | `sr` | 22 014–22 109 | TokenOptions | token preset buttons |
| 55 | `sa` | 22 110–22 407 | TokenQuickBar | token trigger + hover panel + portal |
| 56 | `sh` | 22 462–22 513 | DiceToggle | initiative dice toggle icon |
| 57 | `sf` | 22 514–23 743 | BoardActionDock | actions + toggles dock, popovers, arm states |
| 58 | `sO` | 23 827–24 059 | LegendXpControl | legend-XP counter (inline + popover) |
| 59 | `s$` | 24 060–24 102 | PileCounter | pile count chip |
| 60 | `sq` | 24 180–24 754 | CardPile | deck/trash/rune piles with stack layers |
| 61 | `sU` | 24 755–24 856 | MainDeckActionHints | draw/look/burn hint rows |
| 62 | `sZ` | 24 857–24 964 | RuneDeckActionHints | channel/look/ready hint rows |
| 63 | `sX` | 24 965–25 190 | BanishedPileButton | floating banished-count button (portal) |
| A1 | `oh` | 9 644–9 759 | HintPopover | reusable anchored hint (adjacent, used in slice) |
| A2 | `ob` | 9 790–9 905 | BugScreenshotControl | screenshot checkbox/capture UI (adjacent) |

Non-JSX helpers worth naming (same slice): `ib`,`ig`,`iy`,`iv`,`ix`,`iw` (chat command parsing), `ih`,`ik`,`iC`,
`iP`,`iS`,`iN`,`iR`,`iA`,`iM`,`iD`,`iE`,`iT`,`iz`,`iB` (chat/log plumbing), `iX` (clipboard), `iG`,`iV`,`iY`,`iQ`,`iJ`,`i0`,`i4`,`i6`,`i9` (arrows),
`l1`–`l9`,`de`,`dt`,`dr`,`da` (card rules), `ds`,`dc`,`du`,`dm`,`dp`,`dh`,`dC` (tag/menu helpers),
`lC`,`l_`,`lj`,`lI`,`lP`,`lS`,`lN`,`lR` (counter math/colors), `dT`,`dz`,`dL`,`d$`,`dH`,`dF` (rail helpers),
`d0`,`d1` (channel/display-cards), `d5`,`d9`,`se` (tokens), `sn`,`sK`,`sW` (piles), `sM`–`sT`,`sB`,`sL` (equality/intersection), `sg`,`sy`,`sv`–`sN` (classes/noops), `sb` (23 720, external hook), `so` (22 411, external style).

---

## 17. Open questions / cross-references for other slices

1. `tp`, `th`, `of`, `om`, `tc`, `nU`, `ox`, `e2`, `ts`, `z`, `eO`, `eC` live in other chunks — the actual class strings for `tp.w/x/N/a/$/m/E/K/y/S/M/g/r/F` (action button/tooltip/card primitives) must be pulled from module 298551’s chunk.
2. Actual action wire payloads for `adjust_card_counter`, `clear_card_counter`, `chain_set_repeat`, `chain_set_flow`,
   `chain_set_resolve_vote`, `submit_mulligan`, `attacker_confirm_conquer`, `battlefield_conquer_*` are defined at
   file lines 53 800–61 700 (outside this slice).
3. `tablet-chain-panel` (31 700+), showdown prompt (40 700+), and mulligan UI (27 900+) must come from the other agent’s ranges; this slice documents only their data/strings referenced here.
4. The keyboard shortcut *registry* (labels `S`, `A`, `T`, Enter, Shift/⌘ modifier glyphs) for chain entries is here; global hotkey dispatch is elsewhere (`sim.duplicateShortcut`, `sim.emoteShortcut` labels only render here).
5. `nU.T` / `nU.o` numeric chat length limits and `ox.B` / `ox.l` screenshot byte/edge caps were not resolved (external modules).
