# Strict auto-pass and auto-resolve

Owner request: **"allow for auto approve so both users don't have to wait long chains or
loops."** In strict games a player should not sit through long chains, trigger loops or forced
confirmations clicking Pass over and over. This document is the design, every setting with its
default, the hidden-information analysis, loop handling and the measured interaction counts.

Code: `packages/rules/src/auto/` (`prefs.ts`, `forced.ts`, `respond.ts`, `signature.ts`,
`run.ts`), the intent `packages/rules/src/intents/set-auto-pass.ts`, the wire types
`packages/protocol/src/rules/auto-pass.ts`, the engine seed in `packages/engine/src/engine.ts`,
redaction in `packages/sync/src/redact-rules.ts`, and the board UI in
`apps/play/src/components/board/strict/{StrictAutoPassPanel.tsx,strict-auto-pass.ts}`.

## 1. Measured before / after

`pnpm --filter @rift/rules interactions` plays the headless self-play games (both seats are the
random bot, each on its own redacted view) and classifies every bot decision before it is applied
— every decision is a click a person would have had to make — then counts the automatic actions
the rules layer took instead. Seeds 1–50, default caps (80 turns / 4 000 actions).

### Who must click what (baseline games, no automatic actions)

Per game. "Pass-only" means passing was the only legal action (the bot passes only then).

| decision | fixture decks | catalog decks | taken over by |
| --- | ---: | ---: | --- |
| **all decisions (clicks)** | **203.22** (6.51 / turn) | **220.24** (5.61 / turn) | |
| pass on one's own chain item, pass-only | 11.68 | 5.42 | `ownItems` (default) |
| respond on one's own chain item | 15.18 | 4.12 | — (real decision; hold / full control) |
| response window, pass-only, provable from public info | 0.04 | 0.08 | `responses: safe` (default) |
| response window, pass-only, hand not empty | 34.90 | 24.96 | `responses: no_response` (leaks, opt-in) |
| response window, responded | 8.18 | 7.46 | — (real decision) |
| End turn with nothing else legal, provable | 0.22 | 0.22 | `endTurn: safe` (default) |
| End turn with nothing else legal, hand not empty | 30.60 | 38.90 | `endTurn: no_action` (leaks, opt-in) |
| prompt with exactly one legal answer | 0.00 | 0.00 | `forcedPrompts` |
| prompt with a real choice | 6.32 | 5.94 | "yes to all" for repeats |
| Main Phase play / move / activation | 93.96 | 129.86 | — (real decision) |
| §6.4 manual window Done | 2.14 | 3.28 | — |

### Before / after on the same games

Taking the baseline games above and removing what each preference set would have done
automatically (a counterfactual on identical game trajectories, so the bot's random choices do not
skew the comparison):

| per game | before | default (information-safe) | everything on (leaky options too) |
| --- | ---: | ---: | ---: |
| fixture decks: decisions | 203.22 | 191.28 (−5.9 %) | 125.78 (−38.1 %) |
| catalog decks: decisions | 220.24 | 214.52 (−2.6 %) | 150.66 (−31.6 %) |

### Live runs with the preferences on

The same seeds played with the preferences seeded for both seats. The games themselves change
(the bot's random stream is consumed differently, and with `endTurn: no_action` the bot no longer
recycles every rune before ending its turn, so it plays stronger and games get shorter), so these
are a sanity check rather than the headline comparison:

| per game | none | default | all |
| --- | ---: | ---: | ---: |
| fixture: decisions / turns | 203.22 / 31.82 | 185.30 / 30.62 | 122.18 / 22.06 |
| fixture: decisions per turn | 6.51 | 6.19 | 5.57 |
| fixture: longest run of consecutive Pass clicks (avg) | 4.14 | 2.82 | 0.00 |
| fixture: automatic actions (own item / pass / end turn) | 0 | 11.76 / 0.12 / 0.34 | 17.54 / 54.16 / 20.20 |
| catalog: decisions / turns | 220.24 / 40.14 | 212.70 / 39.64 | 106.96 / 22.06 |
| catalog: longest run of consecutive Pass clicks (avg) | 2.94 | 2.14 | 0.00 |
| catalog: automatic actions (own item / pass / end turn) | 0 | 5.38 / 0.08 / 0.28 | 13.66 / 39.00 / 20.24 |

With everything on, no pass-only window and no forced End turn is left: every remaining click
is a real decision. No game got stuck or crashed in any mode (§ 7).

What the numbers say:

- **Prompts with exactly one legal answer already never reach a player**: the process of play
  binds forced choices (355 / 403.2), forced cost objects (357.2), a single legal combat damage
  assignment (467.2.c) and a Burn Out opponent in a duel (432.2.c) without a prompt. The forced
  prompt auto-resolver is a safety net for prompt shapes that still open with one answer
  (and the "only option" case of the leaky `all` mode).
- **The information-safe defaults remove the passes on one's own items** (about one click in
  seventeen, and they shorten Pass runs by a third). What they cannot remove are the response
  windows and End turns where the player holds cards but has nothing legal: doing those
  instantly is exactly the hand-information leak discussed in § 4, so they stay opt-in.
- **Everything on** removes 31–38 % of all clicks. The one-shot overrides ("pass until end of
  turn", "until the opponent acts") are a person's choice and are not simulated; they remove every
  Priority/Focus click for the rest of the turn without any leak.

## 2. Design

### Where it runs

`applyRulesIntent` and `initializeStrictRules` call `advanceWithAuto` instead of `advance`
(`src/auto/run.ts`):

1. `advance` (334, HOT FEPR) runs to the next decision, exactly as before.
2. If the deciding player — the Prompt holder (411.2), else the Priority/Focus holder
   (312/313) — has preferences that call for an automatic decision, it is taken **through the
   handler a manual intent uses**, after **the same verdict**: `rules_choose` →
   `chooseVerdict` + `applyPromptAnswer`, `rules_pass` → `passVerdict` + `handlePass`,
   `rules_end_turn` → `endTurnVerdict` + `handleEndTurn`. It then advances again.
3. Repeat until nobody's preferences apply, the game ends, or `AUTO_ACTION_CAP` (64) automatic
   actions were taken in this transition.

Invariants:

- **Rules correctness.** An automatic action is always one the player could legally have sent;
  a rejected verdict simply means no automatic action.
- **Only the decider, only by opt-in.** Nothing is ever done for a player who does not hold the
  decision; a seat with no `autoPass` entry gets nothing (beyond owner decision 3 below). Every
  real game gets the defaults at strict game start (engine), so the defaults are "opted in" by
  the product, and each player can change them.
- **Determinism.** Decisions read only the room. Preferences live in `RulesState.autoPass`, so
  they are part of every rewind snapshot; automatic actions happen inside the accepted action, so
  strict rewind restores them and a repro replays them byte for byte
  (`packages/engine/test/strict-auto-pass.test.ts`).
- **No new rejections.** If an automatic action runs into a bounded-loop guard (322 / 317.2.f /
  the 500-step `advance` guard), it is rolled back and the decision is left to the player: the
  player's own intent is never rejected because of something done automatically.
- **Visible.** Every transition with automatic actions adds one public log line per player and
  kind (`rules.auto.*`, e.g. "Bob auto-passed (×3)"); the board shows them as a fading notice.

### Owner decision 3 and holding Priority

Decision 3 (a play/activation passes Priority automatically unless `hold`) is unchanged. On top:

- `hold: true` on the intent (board: **Ctrl/⌘ while dropping**, forwarded by the gesture
  translator) also suppresses every automatic pass for the actor in that transition.
- **Full control** (`hold` preference) holds every play/activation (decision 3 included) and
  disables every automatic pass for that player. Forced prompts still follow `forcedPrompts`.

## 3. Settings (`RulesState.autoPass[playerId]`)

Changed with `rules_set_auto_pass { prefs }` (any time in game, no Priority needed; only the
actor's own entry). A seat without an entry that sends its first update starts from
`MANUAL_AUTO_PASS` (everything off), so only what it set becomes automatic.

| Setting | Values | Default | Leaks hand info? | Effect |
| --- | --- | --- | --- | --- |
| `ownItems` | `true` / `false` | `true` | no | Pass when the player's own item is on top of the chain (their triggers 337.4, and Priority returning to them over their own item, 340.4). |
| `responses` | `stop` / `safe` / `no_response` | `safe` | `no_response` only | Response windows (an opponent's item on top, or showdown Focus with an empty chain). `safe`: pass only when public information proves there is no legal response (empty hand, no facedown card, no legal play/Hide/activation). `no_response`: pass whenever there is no legal response. |
| `forcedPrompts` | `off` / `safe` / `all` | `safe` | `all` only | Answer a prompt that has exactly one legal answer. `safe`: only when that follows from public information. |
| `endTurn` | `manual` / `safe` / `no_action` | `safe` | `no_action` only | End the player's own turn at a Neutral Open Main Phase with nothing to do. `safe`: only with public proof. At most one turn ends automatically per transition. |
| `hold` | `true` / `false` | `false` | no | Full control (see § 2). |
| `passUntil` | `{ kind: "end_of_turn" \| "opponent_action", turn }` or absent | absent | no | One-shot override. `end_of_turn`: pass every Priority/Focus window until this turn ends; on one's own turn it also ends the turn at Neutral Open. `opponent_action`: pass every window until an opponent takes a Discretionary Action (411.1: play, activate, Standard Move) or the turn ends. The server always records the current turn. |
| `standing` | remembered answers | none | no | "Yes to all" (see § 5). |

"Nothing to do" and "no response" ignore the Basic Runes' `[Reaction]` abilities (164.2.a/b):
they only Add resources, which change nothing on their own (the pool empties, 317.2.d). Every
other ability counts. Consequence: a player who wants to recycle a rune at the end of an empty
turn must keep `endTurn` on `manual` (or use full control).

**Hotkeys / UI** (`StrictAutoPassPanel`, bottom left of the strict board; the response banner;
the prompt dialog):

| Control | Where | Sends |
| --- | --- | --- |
| Pass | banner button / `W` | `rules_pass` |
| Pass until end of turn (toggle) | banner button, panel button / `Shift+W` | `rules_set_auto_pass { passUntil }` |
| Pass until the opponent acts (toggle) | panel button | `rules_set_auto_pass { passUntil }` |
| Hold priority for one play | Ctrl/⌘ while dropping a card | the gesture with `hold: true` |
| Full control, own items, response / prompt / end-turn modes | panel (Auto-pass) | `rules_set_auto_pass { … }` |
| Same answer for identical prompts this turn | prompt dialog checkbox (yes/no, order) | `rules_choose { …, applyToSimilar: true }` |
| Default order | order prompt button | `rules_choose { answer: { optionIds: [] } }` |

Options that can leak are marked ⚠ and the panel shows the warning text while one is on.

## 4. Hidden information

The response banner deliberately never reveals whether the holder can respond (Pass = W, same
banner either way). Automatic actions must not undo that.

- **The leak.** A pass that happens *instantly* exactly when the player has no legal response
  tells the opponent "no response here". With cards in hand that is hand information (no
  Reaction, nothing affordable). The same holds for an instant End turn ("nothing playable") and
  for an instant answer to a prompt whose single option came from a hidden filter ("only one card
  in hand qualifies").
- **Unconditional settings leak nothing**: `ownItems`, `passUntil`, `hold` and remembered
  answers never depend on the player's cards, so the timing carries no information.
- **`safe` = public proof.** A response window is skipped only when the player holds nothing
  hidden that could be a response — an empty hand and no facedown card (base, battlefields,
  banishment, Champion zone) — and has no legal response. Every remaining source of a response
  (activated abilities of board objects, plays from the trash / face-up banishment / Champion
  zone, pools, timing, targets) is public, so the opponent could compute the same answer: the
  pass reveals nothing. `test/auto/auto-pass-registry.test.ts` fails if a card script ever grants
  plays from another hidden zone (the deck), which would break that proof. The same proof gates
  `endTurn: "safe"`.
- **Forced prompts `safe`**: every option must be a public object, a player, a battlefield or a
  value — or the options are *all* the cards of a hidden zone whose size is public (the whole
  hand, every facedown card at a battlefield). "Choose one card of your hand" with one card in
  hand is safe; "choose a spell in your hand" with one qualifying card of three is not.
- **Preferences are private.** `RulesState.autoPass` is redacted to the viewer's own seats
  (`@rift/sync`), and the public log line for a response-window pass is the same generic
  "auto-passed" whatever the mode, so the opponent cannot read which mode produced it.
- **Residual leak of the opt-in modes.** With `responses: "no_response"` the *pattern* still
  leaks: windows that close instantly had no response, windows that stop had one. Masking with
  timing (holding every automatic pass for the length of a normal pass) does not remove it — a
  window that closes after exactly the mask length is still distinguishable from a person
  thinking — so it was not implemented; the option is explicit opt-in with a warning instead.
  Digital card games commonly accept this leak by default (see open decisions).

## 5. "Yes to all" and loops

**Repeated identical prompts.** `rules_choose { applyToSimilar: true }` stores
`{ signature, answer, turn }` in the player's `standing` list. Eligible prompts: yes/no
(`play.trigger` "you may", `play.optional_cost`, a resolution-time "may", an optional
replacement) and trigger order (`effects.order_triggers`, replayed as the default detection
order because trigger ids differ). The signature is `reason|promptKey|kind|source|options`
without card ids, so two copies of the same trigger share it and another card's prompt does not.
A later identical prompt this turn is answered automatically (after `chooseVerdict`); the
answers expire when the turn ends. Trigger-order prompts whose triggers are identical (same
controller, ability, source and event) are forced and resolved by `forcedPrompts`; the dialog
also has a one-click **Default order**.

**Loops.** The 2026-10-09 corpus has no rule for infinite or mandatory loops (no equivalent of a
"draw by loop" rule). The loop-like rules are 322 (repeat Cleanups until one makes no change)
and 317.2.f (restart the Expiration Step after FEPR), which the engine already bounds and turns
into `loop_guard`. Automatic actions add their own bounds:

- at most `AUTO_ACTION_CAP` = 64 automatic actions per transition; then a public
  "Automatic actions paused after 64 in a row" line and control returns to a person, whose next
  action resumes automation (so a trigger loop that both players auto-pass advances in visible
  chunks instead of spinning a Durable Object);
- each `advance` keeps its own 500-step guard; an automatic action that hits a guard is rolled
  back (§ 2);
- at most one turn ends automatically per transition.

## 6. Wire / protocol (additive; `packages/protocol/CHANGES.md`)

- `RulesState.autoPass?: Record<string, AutoPassPrefs>`;
- intent `rules_set_auto_pass { prefs: AutoPassPrefsUpdate }`;
- `rules_choose.applyToSimilar?: boolean`;
- gestures may carry `hold: true` (forwarded to `rules_play` / `rules_activate`);
- log keys `rules.auto.{pass,ownItem,passUntil,endTurn,choose,repeat,paused}`;
- engine: strict games start with `DEFAULT_AUTO_PASS` for every seat
  (`initializeStrictRules(room, ctx, host, { autoPass })`).

## 7. Tests

- `packages/rules/test/auto/auto-pass.test.ts` — wire shape, no-Priority preference changes,
  own items (340.4 and triggers), hold and full control, safe vs leaky response modes and the
  legal-response guarantee, pass until end of turn / opponent action (expiry, own-turn end turn,
  one turn per transition), end-turn modes, forced prompts (public vs hidden, only the prompted
  player, real handler), identical trigger order, "yes to all" lifetime, the 64-action cap,
  determinism.
- `packages/rules/test/auto/auto-pass-registry.test.ts` — the hidden-zone guardrail.
- `packages/rules/test/bot/selfplay.test.ts` — seeds with every option on (no stuck/crash,
  deterministic). Sweeps: `SELFPLAY_AUTOPASS=none|default|all pnpm --filter @rift/rules selfplay`.
- `packages/engine/test/strict-auto-pass.test.ts` — defaults at game start, hold gesture,
  rewind and repro replay with automatic actions.
- `packages/sync/src/redact-rules.test.ts` — preferences redacted per seat.
- `apps/realtime/tests/bot-room.test.ts` — Practice vs Bot defaults, redacted view, pass until
  end of turn hands the bot its turn without error frames.
- `apps/play/src/components/board/strict/__tests__/strict-auto-pass.test.tsx` — panel, leak
  warning, pass-until intents, notices, prompt shortcuts, banner button.

Self-play sweeps (seeds 1–50, 80 turns / 4 000 actions):

| deck | `SELFPLAY_AUTOPASS` | wins | turn caps | stuck | crashes | avg turns |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| fixture | `none` | 50 | 0 | 0 | 0 | 31.82 (per-seed identical to the commit before auto-pass) |
| fixture | `default` | 50 | 0 | 0 | 0 | 30.62 |
| fixture | `all` | 50 | 0 | 0 | 0 | 22.06 |
| catalog | `all` | 50 | 0 | 0 | 0 | 22.06 |
| catalog | `none` / `default` (interaction runs) | 49 | 1 | 0 | 0 | 40.14 / 39.64 |

## 8. Open decisions for the owner

1. **Default for response windows.** The default is information-safe (`safe`), which rarely
   fires in practice because hands are rarely empty. MTG Arena and LoR skip windows with no
   playable response by default and accept the leak. Flip `DEFAULT_AUTO_PASS.responses` (and
   `endTurn`) to the leaky modes if speed matters more than this hand information.
2. **`ownItems` on by default.** A player can no longer respond to their own trigger without
   turning it off or using full control / Ctrl-drop. Consistent with decision 3; confirm.
3. **Rune abilities are not "something to do".** Auto end turn ignores Basic Rune exhaust /
   recycle; confirm (a recycle-for-a-trigger line needs `endTurn: manual`).
4. **Persisting preferences across games.** Preferences are per game (seeded with defaults at
   game start); a client-side "remember my settings" that sends them at game start is not
   implemented.
5. **Log lines in other locales.** The `rules.auto.*` log text is English in the match log (like
   other strict log text); the on-board notices are translated (`rules.ui.autoPass.notice.*`).
