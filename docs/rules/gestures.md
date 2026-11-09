# Board gestures → strict rules intents (R4-gestures)

Owner: **R4-gestures**. Contract: the player acts by manipulating the board exactly as in the
sandbox; `@rift/engine` translates each gesture into the one `rules_*` intent it means and applies
it through `applyRulesIntent`, so `@rift/rules` remains the only authority. A gesture that means
nothing in strict rules is rejected with the precise reason instead of being silently ignored.

Implementation: `packages/engine/src/strict/gestures.ts`
(`translateGesture(room, actor, action, host)` → `intent | reject | passthrough`), wired into the
strict gate of `applyGameAction` (`packages/engine/src/engine.ts`). Sandbox rooms
(`rulesMode` absent/`"sandbox"`) never reach the translator and are byte-for-byte unchanged.

## Routing

| action type | strict routing |
|---|---|
| `rules_*` (incl. `rules_concede`) | unchanged: `applyRulesIntent` (before the gesture gate) |
| lobby / setup / mulligan / result actions | unchanged: their own handlers |
| cosmetic/meta (`roll_die`, target arrows, board settings, card labels) | `passthrough` → `gate()` allows |
| §6.4 manual board actions for the manual player | `passthrough` → `gate()` allows |
| every other gameplay action | `translateGesture`: `intent` applied like a `rules_*` action, or `reject` |

The translation is pure and deterministic: it reads the room through the rules view
(`legalIntents`, `whoMayAct`, `explainIllegal`, `activatedAbilitiesOf`) and never mutates it.

## Mapping table

`from`/`to` are board/zone ids from the wire (`"hand"`, `"base"`, `"battlefieldA"`,
`"battlefieldB"`, `"battlefieldC"`, `"battlefieldToken"`, …). `bf` = any active battlefield zone.

| gesture (wire action) | payload | strict intent |
|---|---|---|
| hand card dropped on Base | `move_card { from:"hand", to:"base", cardId }` | `rules_play { cardId, location:"base" }` |
| hand card dropped on a battlefield | `move_card { from:"hand", to:"battlefieldA", cardId }` | `rules_play { cardId, location:"battlefieldA" }` |
| chosen champion played | `move_card { from:"champion", to:"base", cardId }` | `rules_play { cardId, location:"base" }` |
| card played from trash/banishment (effect permission, Flow) | `move_card { from:"trash"\|"banished", to:"base"\|bf, cardId }` | `rules_play { cardId, location }` |
| spell dragged out to play / dropped on the chain | `chain_add { from, cardId }` | `rules_play { cardId }` |
| Hide (facedown) drop | `move_card { …, asHidden:true }` | `rules_play { cardId, hide:true, location }` |
| unit(s) dragged Base → battlefield | `move_card { from:"base", to:bf, cardId }` | `rules_move { unitIds:[cardId], to }` |
| unit(s) dragged battlefield → Base | `move_card { from:bf, to:"base", cardId }` | `rules_move { unitIds:[cardId], to:"base" }` |
| units dragged battlefield → battlefield | `move_card { from:bf, to:bf2, cardId }` | `rules_move` (Ganking is checked by 144.4.c) |
| several units dragged together | `move_card { …, cardId, cardIds:[…] }` (or `unitIds`) | `rules_move { unitIds, to }` |
| multi-card off-board move | `move_off_board_cards_batch { from:"base"\|bf, to:"base"\|bf, cardIds }` | `rules_move { unitIds:cardIds, to }` |
| use/exhaust/tap a card, legend, rune or gear | `toggle_exhausted { zone, cardId, expectedExhausted:false }` | `rules_activate { objectId, ability }` for the single legal ability |
| use with an explicit ability | `toggle_exhausted { …, ability:"rune:exhaust" }` | `rules_activate { objectId, ability }` |
| gear on the board dropped on a unit | `equip_card { equipmentCardId, unitCardId }` | `rules_activate { objectId:gear, ability:"equip:0", targets:[unitCardId] }` |
| end turn (sandbox button/shortcut) | `end_turn {}` | `rules_end_turn {}` |

Payment and choices are intentionally omitted from every translated intent, so the engine's
automatic payment plan and its normal prompts (targets, modes, X, triggered/optional decisions)
run exactly as for a hand-written intent. `hold` is omitted (default false).

### Rejections

| case | result |
|---|---|
| mapped intent is illegal | the `explainIllegal` Verdict of that exact intent: `code` + `rule` (+ `detail`) |
| tap matches several legal activated abilities (e.g. a Rune: `rune:exhaust`, `rune:recycle`; Blade of the Exile: `activated:0`, `equip:0`) | `ambiguous_gesture` (rule 403.3), `detail: "abilities: <ref>, <ref>"`; nothing is applied |
| a pending prompt for the actor | `prompt_pending` (411.2) |
| free-form manipulation (draws, runes, counters, might, score/XP, shuffles, control transfers, arbitrary zone moves, `chain_resolve`, `create_token`, payments, reorder) | `strict_mode_action` (`contract:§4`) with a detail naming the action; nothing is applied |
| a hand gear dropped on a unit (`equip_card asAttachment:true`) | `strict_mode_action`, rule 819.1.d (Quick-Draw's attach trigger is not implemented in `@rift/rules`; play the gear with `rules_play` instead) |

Reason strings: `rules.reason.<code>` in `packages/i18n/data/i18n-{en,fr,ko,zh-CN}.json`.
`ambiguous_gesture` is the only new reason code (added to `IntReasonCode` in
`packages/protocol/src/rules/domains/int.ts`).

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
- **Move**: dragging a unit Base ↔ battlefield / battlefield ↔ battlefield stays
  `move_card { from, to, cardId }`. For a multi-unit drag send
  `move_card { from, to, cardId:<primary>, cardIds:[allIds] }` (or `unitIds:[…]`).
- **Use**: tapping/clicking a ready board card, rune, gear or legend is
  `toggle_exhausted { zone, cardId, expectedExhausted:false }`. A ready Gold token is the same
  gesture (its `kill+exhaust: add` ability runs). To disambiguate or to click one ability in a
  panel, add `ability:"<ref>"`; the refs come from `strictLegalIntents(...).activatable`.
- **Legend**: `BoardInteractionProvider.handleCardClick` currently returns without sending
  anything for `zone === "legend"` (unless it is a spell). To make legend abilities usable by a
  gesture, send `toggle_exhausted { zone:"legend", cardId, expectedExhausted:false }` (with
  `ability` from the legal activations when more than one is legal).
- **Equip**: a gear already on the board dropped on a unit stays
  `equip_card { equipmentCardId, unitCardId }` (optionally `ability:"equip:<n>"`). A gear dropped
  from hand on a unit stays `equip_card { …, asAttachment:true }` and is rejected until the
  Quick-Draw attach trigger exists in `@rift/rules`; send the plain play gesture instead.
- **End turn**: `end_turn {}` and `rules_end_turn {}` both work in strict rooms now.
- **Drop highlight**: `engineCanDrop` dry-runs `applyGameAction` on the real room, so in strict
  rooms the drag highlight now follows strict legality for `move_card`/`chain_add` (it shows the
  `explainIllegal` result only as a boolean; `strictExplainIllegal` still gives the text).
- **Obsolete client pickers**: the strict panel's per-play / per-activate / per-move buttons are no
  longer required to play; keep them only as an accessibility/fallback surface. The panel's
  prompt dialog (`StrictPromptDialog`) and Pass/End turn/Concede buttons remain necessary. An
  ability picker is still needed for `ambiguous_gesture` (or send `ability` directly); the panel's
  existing activation buttons already do that.

## Not implemented here (lead / rules-side follow-ups)

1. **Native choose-ability prompt.** The rules layer has no public API to open a prompt from the
   engine side, so `translateGesture` cannot open a "choose one of these abilities" prompt and
   returns `ambiguous_gesture` instead. A rules-side change would add a `PromptKind` (e.g.
   `"choose-ability"`), a prompt reason/handler that executes the chosen `rules_activate`, and a
   way for the strict play/activate flow to open it. Then the ambiguity rejection can become a
   normal `Prompt`.
2. **Quick-Draw attachment** (`819.1.d`): the attach-on-play trigger is missing in `@rift/rules`,
   so the hand→unit `equip_card` gesture is rejected. Implement the trigger and translate that
   gesture to `rules_play` + a bound attach choice.
3. **Legend gesture** (apps/play): send the tap gesture for `zone === "legend"` (see above).
4. **`packages/engine/src/index.ts`**: optionally re-export `translateGesture` (and its result
   type) if the client should preview the exact intent before sending; the server does not need
   the export.
5. **`packages/protocol/CHANGES.md`**: note the additive `IntReasonCode` member
   `ambiguous_gesture` (one line) if that file is maintained per wave.
6. **Chain slot / main-deck drops** (apps/play): dropping a card on the chain now means "play it",
   and dropping on the main deck stays rejected (`strict_mode_action`). Hide those drop targets in
   strict rooms if the visual affordance is confusing; behaviour is already correct.

## Tests

- `packages/engine/test/strict-gestures-unit.test.ts` — one pure `translateGesture` case per
  mapping row, ambiguity, explanations, cosmetics, prompt guard, manual window, sandbox passthrough.
- `packages/engine/test/strict-gestures.test.ts` — end-to-end through `applyGameAction`: every
  legal gesture equals the state of the equivalent `rules_*` intent; every illegal gesture keeps
  the room unchanged and returns the code/rule; the manual window keeps free board actions; the
  same gestures in a sandbox room keep their original behaviour.
