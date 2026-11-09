# Board gestures → strict rules intents (R4-gestures)

Owner: **R4-gestures**. Contract: the player acts by manipulating the board exactly as in the
sandbox; `@rift/engine` translates each gesture into the one `rules_*` intent it means and applies
it through `applyRulesIntent`, so `@rift/rules` remains the only authority. A gesture that means
nothing in strict rules is rejected with the precise reason instead of being silently ignored.

Implementation: `packages/engine/src/strict/gestures.ts`
(`translateGesture(room, actor, action, host)` → `intent | reject | passthrough`), wired into the
strict gate of `applyGameAction` (`packages/engine/src/engine.ts`) and re-exported from
`@rift/engine` for client previews. Sandbox rooms (`rulesMode` absent/`"sandbox"`) never reach the
translator and are byte-for-byte unchanged.

## Routing

| action type | strict routing |
|---|---|
| `rules_*` (incl. `rules_concede`) | unchanged: `applyRulesIntent` (before the gesture gate) |
| lobby / setup / mulligan / result actions | unchanged: their own handlers |
| cosmetic/meta (`roll_die`, target arrows, board settings, card labels) | `passthrough` → `gate()` allows |
| §6.4 manual board actions for the manual player | `passthrough` → `gate()` allows |
| every other gameplay action | `translateGesture`: `intent` applied like a `rules_*` action, or `reject` |

The translation is pure and deterministic: it reads the room through the rules view
(`legalIntents`, `explainIllegal`, `activatedAbilitiesOf`, `requiredChoices`) and never mutates it.

## Mapping table

`from`/`to` are board/zone ids from the wire (`"hand"`, `"base"`, `"battlefieldA"`,
`"battlefieldB"`, `"battlefieldC"`, `"battlefieldToken"`, …). `bf` = any active battlefield zone.
`targetCardId` is the additive targeting field (alias `targetObjectId`); see the client contract.

| gesture (wire action) | payload | strict intent |
|---|---|---|
| hand card dropped on Base | `move_card { from:"hand", to:"base", cardId }` | `rules_play { cardId, location:"base" }` |
| hand card dropped on a battlefield | `move_card { from:"hand", to:"battlefieldA", cardId }` | `rules_play { cardId, location:"battlefieldA" }` |
| chosen champion played | `move_card { from:"champion", to:"base", cardId }` | `rules_play { cardId, location:"base" }` |
| card played from trash/banishment (effect permission, Flow) | `move_card { from:"trash"\|"banished", to:"base"\|bf, cardId }` | `rules_play { cardId, location }` |
| spell dragged out to play / dropped on the chain | `chain_add { from, cardId }` | `rules_play { cardId }` |
| Hide (facedown) drop | `move_card { …, asHidden:true }` | `rules_play { cardId, hide:true, location }` |
| **hand card dropped on a board object** whose play has a target spec that accepts it | `move_card`/`chain_add { …, cardId, targetCardId }` | `rules_play { cardId, choices:{ <spec.key>:[targetId] } }` (no location for spells) |
| hand permanent (unit/gear) dropped on a card at a battlefield, no target spec | `move_card { …, cardId, targetCardId }` | `rules_play { cardId, location:<target's battlefield> }` |
| **board object dropped on another object** with one legal ability whose target spec accepts it | `move_card`/`toggle_exhausted`/`equip_card` { …, cardId/equipmentCardId, targetCardId/unitCardId } | `rules_activate { objectId, ability, choices:{ <spec.key>:[targetId] } }` |
| board unit dropped on a card at a battlefield and no ability targets it | `move_card { from:"base"\|bf, to:bf2, cardId, targetCardId }` | `rules_move { unitIds:[cardId], to:<target's battlefield> }` |
| unit(s) dragged Base → battlefield | `move_card { from:"base", to:bf, cardId }` | `rules_move { unitIds:[cardId], to }` |
| unit(s) dragged battlefield → Base | `move_card { from:bf, to:"base", cardId }` | `rules_move { unitIds:[cardId], to:"base" }` |
| units dragged battlefield → battlefield | `move_card { from:bf, to:bf2, cardId }` | `rules_move` (Ganking is checked by 144.4.c) |
| several units dragged together | `move_card { …, cardId, cardIds:[…] }` (or `unitIds`) | `rules_move { unitIds, to }` |
| multi-card off-board move | `move_off_board_cards_batch { from:"base"\|bf, to:"base"\|bf, cardIds }` | `rules_move { unitIds:cardIds, to }` |
| use/exhaust/tap a card, legend, rune or gear | `toggle_exhausted { zone, cardId, expectedExhausted:false }` | `rules_activate { objectId, ability }` for the single legal ability |
| use with an explicit ability | `toggle_exhausted { …, ability:"rune:exhaust" }` | `rules_activate { objectId, ability }` |
| gear on the board dropped on a unit | `equip_card { equipmentCardId, unitCardId }` | `rules_activate { objectId:gear, ability:"equip:<n>", choices:{ "target:0":[unitCardId] } }` |
| Quick-Draw gear dropped from hand on a unit | `equip_card { …, asAttachment:true }` | `rules_play { cardId, location:"base" }`; the `quick-draw` trigger then prompts for the unit |
| **click/drop on an open prompt's option** (single-selection `choose-target` / `choose-card` / `choose-battlefield`) | `toggle_exhausted` / `move_card` / `chain_add` / `equip_card` naming the option | `rules_choose { promptId, answer:{ optionIds:[optionId] } }` |
| **Approve** the opponent's chain item (A) | `chain_set_resolve_vote { entryId, approved }` | `rules_pass` (338.1.b; the item resolves when the pass round completes) |
| **Resolve** the chain (S) | `chain_resolve { entryId, to }` | `rules_pass` (338.1.b); never resolves directly |
| pass a showdown/combat response (sandbox conquer controls) | `battlefield_conquer_pass_focus` / `battlefield_conquer_pass_response` | `rules_pass` (347.2 focus; 338.1.b priority) |
| sandbox advance-step control | `end_beginning_phase { observed }` | `rules_pass` (closest strict meaning; `nothing_to_pass` when there is no chain/showdown) |
| end turn (sandbox button/shortcut) | `end_turn {}` | `rules_end_turn {}` |

Payment is intentionally omitted from every translated intent, so the engine's automatic payment
plan runs exactly as for a hand-written intent. For targeting gestures, `choices[<ChoiceSpec.key>]`
holds `string[]` option ids; only the FIRST required target spec (rule order mode → targets → X)
whose legal options include the dropped object is bound. Every other choice is left unanswered so
the engine opens its normal prompt (forced choices are auto-bound by 411.2). `hold` is omitted.

A mode choice (355.3) is never guessed: a drop on a card for a card whose modes hide their targets
is rejected with `ambiguous_gesture` and `detail: "mode: <ids>"`; the client must pick the mode
first. Multi-selection target specs (`min > 1` or `max > 1`) are not completed by one drop; the
bound single option is validated by the rules layer and rejected if the spec needs more.

### Rejections

| case | result |
|---|---|
| mapped intent is illegal | the `explainIllegal` Verdict of that exact intent: `code` + `rule` (+ `detail`) |
| spell dropped on an object its target specs all refuse | the targeted play's verdict (`illegal_target` 355.9 / `no_legal_targets` 355.8) |
| card with no target spec dropped on a non-battlefield object | `illegal_target` (355.9), `detail: "card <id> does not target <id>"` |
| board object with no targeting ability dropped on an object (not a unit→battlefield move) | `illegal_target` (355.9), `detail: "<id> has no activated ability that targets <id>"` |
| several legal abilities accept the dropped object | `ambiguous_gesture` (403.3), `detail: "abilities: <ref>, <ref>"`; nothing is applied |
| tap matches several legal activated abilities (e.g. a Rune: `rune:exhaust`, `rune:recycle`) | `ambiguous_gesture` (403.3), candidate refs in `detail` |
| click during a prompt that is not one of its options | `invalid_choice` (411.2), prompt stays open |
| click during a prompt that needs more than one selection | `invalid_choice` (411.2) with an "accumulate clicks and send rules_choose on confirm" detail |
| a non-object prompt (yes-no / mode / number / damage assignment) | `prompt_pending` (411.2); answer it with `rules_choose` |
| Approve/Resolve when the actor does not hold priority | `not_your_priority` (338.1.b) |
| advance step when nothing can be passed | `nothing_to_pass` (338.1.b) |
| free-form manipulation (draws, runes, counters, might, score/XP, shuffles, control transfers, arbitrary zone moves, `create_token`, payments, reorder) | `strict_mode_action` (`contract:§4`) with a detail naming the action |
| a non-Quick-Draw gear dropped from hand on a unit | `strict_mode_action`, rule 819.1.d (there is no attach-on-play; use Equip) |

Reason strings: `rules.reason.<code>` in `packages/i18n/data/i18n-{en,fr,ko,zh-CN}.json`.
`ambiguous_gesture` is the only new reason code (added to `IntReasonCode` in
`packages/protocol/src/rules/domains/int.ts`); the other rejections reuse existing codes
(`invalid_choice`, `illegal_target`, `prompt_pending`, `strict_mode_action`).

### §6.4 manual window exception

While `Room.rules.manual` is open, its player keeps the existing sandbox board actions
(`gate()`'s `MANUAL_ACTIONS`): `draw_cards`, `move_card`, `toggle_exhausted`, counters, runes,
deck peeks, … all pass through untouched. Other players do not get the exception. When the window
closes (`rules_manual_done`) the same gestures become strict intents/rejections again.

## Client contract (apps/play board; apps are not owned by this lane)

The board already sends the right payloads for most gestures through
`components/board/drag/drop-intents.ts` and `BoardInteractionProvider`; strict rooms no longer
need a "pick an action" list.

- **Play**: dropping a non-spell from hand on Base/a battlefield stays
  `move_card { from:"hand", to, cardId }`; dragging a spell out (or dropping it on anything that
  plays it) stays `chain_add { from, cardId }` (the `clientEntryId` is ignored by the strict
  intent). Do not send a separate "play" button action.
- **Targeting**: when the pointer is over a board card, add `targetCardId:<dropped-onto id>` to the
  same gesture: `move_card { from:"hand", to:<target's zone>, cardId, targetCardId }` for plays,
  `chain_add { from, cardId, targetCardId }` for spells, and
  `move_card { from:"base"|bf, to:<target's zone>, cardId, targetCardId }` / `toggle_exhausted
  { zone, cardId, expectedExhausted:false, targetCardId }` for board abilities. The engine binds
  the first accepting target spec; the rest prompt. `targetObjectId` is accepted as an alias.
- **Move**: dragging a unit Base ↔ battlefield / battlefield ↔ battlefield stays
  `move_card { from, to, cardId }`. For a multi-unit drag send
  `move_card { from, to, cardId:<primary>, cardIds:[allIds] }` (or `unitIds:[…]`). A unit dropped
  on a card at another battlefield moves to that battlefield when no ability targets it.
- **Use**: tapping/clicking a ready board card, rune, gear or legend is
  `toggle_exhausted { zone, cardId, expectedExhausted:false }`. A ready Gold token is the same
  gesture (its `kill+exhaust: add` ability runs). To disambiguate or to click one ability in a
  panel, add `ability:"<ref>"`; the refs come from `strictLegalIntents(...).activatable`.
- **Legend**: `BoardInteractionProvider.handleCardClick` currently returns without sending
  anything for `zone === "legend"` (unless it is a spell). Send
  `toggle_exhausted { zone:"legend", cardId, expectedExhausted:false }` (with `ability` when more
  than one activation is legal).
- **Equip**: a gear already on the board dropped on a unit stays
  `equip_card { equipmentCardId, unitCardId }` (optionally `ability:"equip:<n>"`). A Quick-Draw
  gear dropped from hand on a unit stays `equip_card { …, asAttachment:true }`: the engine plays
  it to Base and the `quick-draw` keyword trigger opens a `choose-target` prompt for the unit.
  Keep highlighting the dropped unit while that prompt is open (the client may answer it with the
  normal prompt-click gesture below or `StrictPromptDialog`). A non-Quick-Draw gear drop is
  rejected (819.1.d); send the plain play gesture / Equip instead.
- **Prompt clicks**: while a single-selection object prompt (`choose-target`, `choose-card`,
  `choose-battlefield`) is open for this client, a click/drop that names one of its options sends
  the payload above and the engine answers with `rules_choose { promptId, answer:{ optionIds:[id] } }`.
  The simplest click is `toggle_exhausted { zone, cardId, expectedExhausted:false }`; a drop can
  use `move_card`/`chain_add`/`equip_card`. For a prompt with `min`/`max` > 1, accumulate the
  clicks client-side and send ONE `rules_choose` with all selected option ids on confirm (the
  engine only validates each `rules_choose`); a single click is rejected with `invalid_choice` and
  the prompt stays open. A click on a non-option is also rejected with `invalid_choice`.
- **End turn**: `end_turn {}` and `rules_end_turn {}` both work in strict rooms now.
- **Chain controls**: Approve (A, `chain_set_resolve_vote`), Resolve (S, `chain_resolve`), the
  showdown pass controls (`battlefield_conquer_pass_focus` / `pass_response`) and the sandbox
  advance-step button (`end_beginning_phase`) are translated to `rules_pass`; the rules engine
  decides when the item resolves. Without priority they reject with `not_your_priority`
  (338.1.b), with nothing to pass `nothing_to_pass` (338.1.b).
- **Top-right NEXT**: `RoomActionBar`'s Next is a room-shell/HTTP action
  (`create_next_game`, `RoomActionBar.tsx:77-79` → `riftbound:next-game`), not an engine gameplay
  action, so it never reaches `translateGesture`; in a live strict game the server rejects it with
  `game_result_required`. The client lane should hide/disable it during strict in-game.
- **Drop highlight**: `engineCanDrop` dry-runs `applyGameAction` on the real room, so in strict
  rooms the drag highlight follows strict legality for `move_card`/`chain_add`; for the exact
  rejection text use the new `translateGesture` export from `@rift/engine` (or
  `strictExplainIllegal` for a hand-written intent).
- **Obsolete client pickers**: the strict panel's per-play / per-activate / per-move buttons are no
  longer required to play; keep them only as an accessibility/fallback surface. The panel's
  prompt dialog (`StrictPromptDialog`) and Pass/End turn/Concede buttons remain necessary. An
  ability picker is still needed for `ambiguous_gesture` (or send `ability` directly); the panel's
  existing activation buttons already do that.

## Not implemented here (lead / rules-side follow-ups)

0. **Strict rejections render as the connection banner (client bug).** A gameplay rejection
   (`mutationClass: "reject_invalid"`) still gets a `userMessage` from
   `decideServerErrorOutcome` (`apps/play/src/runtime/matchRuntime.ts:3186`), and
   `handleServerError` stores it in `lastError` (`matchRuntime.ts:2022`). `GameScreen.tsx:665`
   then chooses the blocking connection banner (Retry at `:799`, Return to lobby at `:807`)
   instead of the action toast (`GameScreen.tsx:812`). The client lane should keep `lastError`
   null for `reject_invalid` / `reject_retryable` and route them to `actionError` only.
1. **Protocol typing for the target field.** `GameplayAction` is a closed union; the runtime keeps
   the extra field (the realtime message carries `action: unknown`), but the typed client cannot
   send it. Add optional `targetCardId?: string` (and optional `ability?: string` on
   `toggle_exhausted` / `equip_card`) to the matching interfaces in
   `packages/protocol/src/actions.ts`, and note it in `packages/protocol/CHANGES.md` together with
   `ambiguous_gesture`. Not edited by this lane because that file is outside its ownership.
2. **Native choose-ability prompt.** The rules layer has no public API to open a prompt from the
   engine side, so several targetable abilities produce `ambiguous_gesture` instead of a prompt.
   A rules-side change would add a `PromptKind` (e.g. `"choose-ability"`), a prompt reason/handler
   that executes the chosen `rules_activate`, and a way for the strict play/activate flow to open
   it.
3. **Quick-Draw pre-binding.** `rules_play` choices only feed the card's spell ability; a keyword
   trigger's choices are made when the trigger is placed (403.2). The drop therefore plays the
   gear and lets the normal `quick-draw` prompt choose the unit. Carrying the dropped unit into
   the trigger would need a rules-side "trigger choice pre-binding" change.
4. **Legend gesture** (apps/play): send the tap gesture for `zone === "legend"` (see above).
5. **Chain slot / main-deck drops** (apps/play): dropping a card on the chain now means "play it",
   and dropping on the main deck stays rejected (`strict_mode_action`). Hide those drop targets in
   strict rooms if the visual affordance is confusing; behaviour is already correct.

## Tests

- `packages/engine/test/strict-gestures-unit.test.ts` — pure `translateGesture` cases: every old
  mapping row, targeting plays, target-spec binding, board ability targeting, Equip-by-drag,
  ambiguity, prompt clicks (option, non-option, multi-selection, non-object prompt), Quick-Draw,
  multiple target specs, cosmetics, manual window, sandbox passthrough.
- `packages/engine/test/strict-gestures.test.ts` — end-to-end through `applyGameAction`: legal
  gestures equal the state of the equivalent `rules_*` intent (with the same `choices`), illegal
  gestures keep the room unchanged and return code/rule, prompt clicks equal `rules_choose`, the
  Quick-Draw trigger prompts and attaches only through the rules layer, the manual window keeps
  free board actions, and sandbox rooms keep their original behaviour.
