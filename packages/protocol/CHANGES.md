# @rift/protocol — changes by the engine port (B1, B12)

All changes are additive; existing wire names, fields and semantics are unchanged.

| file                | change                                                                                                                                                                                                                                                                            | why                                                                                                                                                                                                                                        |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/game-state.ts` | `CardInstance.neekoLegendControllerId?: string \| null`                                                                                                                                                                                                                           | Runtime field used by the original Neeko helpers (`514890`, `107126`, `choose_neeko_legend`); it was missing from the replay-derived type.                                                                                                 |
| `src/game-state.ts` | `GameplayLogEntry.key?: string`, `GameplayLogEntry.params?: Record<string, string \| number \| null \| undefined>`                                                                                                                                                                | Structured sentence data for `@rift/i18n`. The canonical English `text` is still emitted unchanged, so old consumers and the original parser keep working.                                                                                 |
| `src/game-state.ts` | `Room` mirrors: `lobbyReadyPlayerIds`, `hostPlayerId`, `seriesId`, `starterChooserPlayerId`, `usedBattlefieldsByPlayerId`, `pendingGameResult`, `rematchRequestedPlayerIds`, `nextRoomCode`, `returnLobbyRoomCode`, `previousRoomCode`, `manualStartRequired`, `matchTermination` | These live on the original room-shell session doc and are projected onto the client room. The engine returns a single `Room`, so the local room-shell actions need somewhere to store them. All optional.                                  |
| `src/game-state.ts` | `Room.rewindConfirmation?: RewindConfirmation`                                                                                                                                                                                                                                    | The original server sends this as a separate `rewind_confirmation_state` message. For local/offline play (and the pure engine API) it is stored on the room. Optional; the wire message shape is untouched.                                |
| `src/game-state.ts` | `EngineTimeline`, `EngineTimelineEntry`                                                                                                                                                                                                                                           | Serializable rewind v5 timeline (server-only). The original server keeps this outside the projected `Room`; the engine now accepts/returns it explicitly so Durable Objects can persist it. Never placed on `Room`, never sent to clients. |
| `src/game-state.ts` | `EngineTimelineEntry.seq?`, `EngineTimeline.nextSeq?`                                                                                                                                                                                                                             | Additive server-persistence ids. The realtime worker stores each snapshot in its own Durable Object key (`timeline:e:<seq>`) so a 1,000+ action history never becomes one oversized value. Protocol semantics are unchanged.               |
| `src/messages.ts`   | `AuthoritativeSnapshotMessage.action` is `{type: string; [key: string]: unknown}`                                                                                                                                                                                                 | Protocol v5 answers rewind/forward (and an approved `respond_rewind_confirmation`) with a snapshot carrying the full causing action, not just its type. Existing consumers that read `.type` still compile.                                |
| `src/actions.ts`    | `RespondSideboardSkipAction.response` now also accepts `"cancel"`                                                                                                                                                                                                                 | The requester may cancel (`35qz5rkx7yexy.js:37100+`); the original type only listed accept/decline.                                                                                                                                        |
| `src/actions.ts`    | `SubmitMulliganAction.boardSettings?: BoardSettings`                                                                                                                                                                                                                              | The client sends local board settings with the mulligan (`35qz5rkx7yexy.js:36779`).                                                                                                                                                        |
| `src/actions.ts`    | `SubmitSideboardAction` unchanged (kept `legend?` etc.)                                                                                                                                                                                                                           | —                                                                                                                                                                                                                                          |
| `src/game-state.ts` | `export type GameState = Room` and `export type GameLogEntry = GameplayLogEntry`                                                                                                                                                                                                  | The architecture contract talks about `GameState` / `GameLogEntry`; these aliases keep both names working.                                                                                                                                 |

`GameSetupConfig` (the input to `createInitialGameState`) intentionally lives in `@rift/engine`
because it is an engine input type, not a wire type.

## B20 server additions (no wire-name changes)

- **Rewind protocol v5:** the server now answers `rewind_last_action`, `forward_last_rewind` and an
  approved `respond_rewind_confirmation` with `authoritative_snapshot` carrying the causing action.
  `rewind_confirmation_state` is emitted whenever the pending request changes. Message names and
  payload fields are the original ones; only `AuthoritativeSnapshotMessage.action` gained optional
  extra fields (see the table above).
- **Matchmaking:** the original `start`/`resolve`/`searching`/`matched`/`expired`/`cancelled`
  protocol is unchanged. Duel fills 2 seats, `gameVariant:"free_for_all_3"` fills 3, and
  `free_for_all_4` / `teams_2v2` fill 4; non-duel searches are always BO1.
- **Series:** `request_game_result_confirmation`, `cancel_game_result_confirmation`,
  `report_game_result` and `request_bo3_rematch` keep their original names/payloads. The server
  accepts them through `room_shell_action` (original) and through `action_intent` (the board's
  game-over overlay transport), replying with an authoritative snapshot so both client paths settle.

## B25 — series metadata, linked rooms, five-character codes (additive)

| file                | change                                                                                                                                                                                 | why                                                                                                                                                       |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/game-state.ts` | `PendingGameResult` (`requestedByPlayerId?`, `winnerByReporterPlayerId`, `resolvedWinnerPlayerId?`); `Room.pendingGameResult` / `RoomSessionDoc.pendingGameResult` now use it          | Original BO3 confirmation state carried by `room_shell_sync` and projected onto the room (`matchMetadata`). The resolved marker drives automatic advance. |
| `src/game-state.ts` | `MatchTermination` (`status`, `reason?`, `endedAt?`, `winnerPlayerId?`, `winnerPlayerIds?`); both room/session use it                                                                  | The original overlay reads `matchTermination.winnerPlayerId` (`35qz5rkx7yexy.js:36554`); the legacy array is kept in sync.                                |
| `src/game-state.ts` | `Room` already mirrored `rematchRequestedPlayerIds`, `nextRoomCode`, `returnLobbyRoomCode`, `previousRoomCode`, `winsByPlayerId`; realtime now fills them on snapshots **and** patches | Board game-over overlay consumes them directly. No new field names.                                                                                       |

No wire message names or action payloads changed. The realtime server projects these session fields
onto the authoritative `Room` before per-viewer redaction and the play runtime merges the same
fields from `room_shell_sync`, matching the original client projection
(`35qz5rkx7yexy.js:26880-27230`, 27160-27200).

## B28 — saved-deck room registration (additive)

| file                | change                                                                                                                              | why                                                                                                                                                                                                 |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/game-state.ts` | `ConstructedDeckRegistration` (`decklistRaw`, `matchmakingPool`, `savedDeckId/Name/Revision/LegalityVersion/Status/OwnerUserId`, `deckRulesMode`, `matchFormat`) | Original lobby's room/quick-match registration (spec 05 §8.5). It was previously only reachable through `unknown` payloads. |
| `src/game-state.ts` | `RoomPlayer.constructedDeckRegistration?: ConstructedDeckRegistration`                                                               | Rooms retain the registration each seat sent on create/join/submit_deck; it is not used by the engine.                                                                                              |
| `src/messages.ts`   | `MatchmakingSearchRequest.constructedDeckRegistration?: ConstructedDeckRegistration` (was `unknown`)                                | Typed only; the field was already accepted by matchmaking.                                                                                                                                          |

No message type, action or existing field was removed or renamed. `constructedDeckRegistration`
remains optional, so guest/local-deck clients keep working unchanged.

## R1-CORE — strict rules layer (additive)

| file                | change                                                                                                                                                                                                                   | why                                                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `src/rules-state.ts` | New module: `RulesMode`, `RulesState` and its parts (`RuleRef`, `ReasonCode`, `Verdict`, `TurnState`, `ChainItem`, `Task`, `Prompt`/`PromptAnswer`, `PendingTrigger`, `ContinuousEffect`, `ObjectRulesState`, `GameEvent`, `RunePool`, the §6 `Effect`/`Ability`/`CardScript` DSL and the `rules_*` intent types). | The strict layer needs serializable wire types; exported from the package index.                                         |
| `src/game-state.ts` | `Room.rulesMode?: RulesMode` and `Room.rules?: RulesState`                                                                                                                                                               | Additive per-room toggle/state; absent means sandbox behaviour.                                                          |
| `src/actions.ts`    | `GameplayAction` includes `RulesWireAction`; `RoomShellAction` includes `SetLobbyRulesModeAction`                                                                                                                       | New wire actions: `rules_play`, `rules_activate`, `rules_move`, `rules_pass`, `rules_end_turn`, `rules_choose`, `rules_manual_done`, `set_lobby_rules_mode`. `OPTIMISTIC_ACTIONS` is unchanged. |

No existing field, action or wire message was renamed or removed. `@rift/engine` routes these
actions only when `Room.rulesMode === "strict"`; sandbox rooms reject `rules_*`. The original
99-action handler coverage is unchanged (`set_lobby_rules_mode` and `rules_*` are routed before
`ACTION_HANDLERS`).

## R1-FIX-C — expiration-repeat persistence (additive)

| file                | change                                                                                                                                                                                                 | why                                                                                                                                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/rules-state.ts` | `RulesState.turn.expirationFepr?: number` and `RulesState.turn.expirationPasses?: number` (both optional, plain JSON)                                                                                   | 317.2.f: FEPR work during the Expiration Step must force a restarted pass even when a trigger hands out priority and the item resolves in a later intent. `expirationPasses` bounds the repeat (N6). |

Both fields are absent on rooms from older snapshots and are cleared when `startNextTurn` replaces
the `rules.turn` object. No existing field, intent or message changed.

## R1-SPLIT-P — strict-rules wire-type split (layout only, no wire change)

`src/rules-state.ts` is now a re-export barrel; the definitions moved 1:1 into `src/rules/`:

| file | contents |
| --- | --- |
| `src/rules-state.ts` | `export * from "./rules"` (compatibility barrel) |
| `src/rules/index.ts` | barrel over core/effects/ability/cost/intents + the four domain hooks |
| `src/rules/core.ts` | `RulesState`, `ChainItem`, `Task`, `Prompt`, `PromptOption`, `PromptAnswer`, `PendingTrigger`, `ContinuousEffect`, `ObjectRulesState`, `RunePool`, `RulesHistory`, `ShowdownState`, `CombatState`, `StagedState`, `ManualWindow`, `GameEvent`, `Verdict`, `RuleRef`, `TurnState`, aliases, `WhoMayAct`, `LegalIntents` |
| `src/rules/effects.ts` | `Amount`, `Selector`, `Condition`, `EventMatcher`, `Limit`, `KeywordName`, `Effect`, `Trigger`, `Modifier` |
| `src/rules/ability.ts` | `Ability`, `CardScript` |
| `src/rules/cost.ts` | `Cost` |
| `src/rules/intents.ts` | `rules_*` intents, `SetLobbyRulesModeAction`, `RULES_ACTION_PREFIX`, `RulesWireAction` |
| `src/rules/domains/{play,combat,effects,int}.ts` | per-R2-agent extension hooks, composed by `core.ts`/`effects.ts` |

**Composition:** `ReasonCode`, `TaskKind`, `PromptKind` and `Effect` are `Core* | <Domain>*`
unions; `ObjectRulesState`, `RulesHistory`, `PromptAnswer`, `ChainItem`, `LegalIntents`,
`RulesPlayIntent` and `RulesActivateIntent` are `Core* & <Domain>*Fields` intersections. The
resulting unions contain exactly the R1 members (verified by a type-equality check); the raw
literals were moved into the domain they belong to (`insufficient_resources`/`illegal_target`/
`invalid_location`/unit+card lookup → play; `showdown_active`/`combat_active`/`combat`/
`damage-assignment` → combat; `invalid_choice`/`manual_window_*`/`not_implemented` → effects).

**Pre-added additive fields (all optional):** `PromptAnswer.assignments?: Array<{ targetId:
string; amount: number }>` (combat, 467.2.c), `PromptAnswer.orderedIds?: string[]` and
`PromptAnswer.modes?: string[]` (effects), `CombatState.step` widened with `"damage-assignment"`
(no consumer switches exhaustively on it — checked), and `Prompt.data.reason?: string` via the
new `PromptData` index-signature type. New `Core*` names (`CoreReasonCode`, `CoreTaskKind`, …)
are additive; no R1 export was removed or renamed.

## R1-PREP-E — `WhoMayAct` window/kind composition (additive)

| file | change | why |
| --- | --- | --- |
| `src/rules/core.ts` | `CoreWhoWindow` (`"main" \| "chain" \| "showdown" \| "prompt" \| "manual"`), `WhoWindow = CoreWhoWindow \| PlayWhoWindow \| CombatWhoWindow \| EffectsWhoWindow \| IntWhoWindow`; `CoreWhoKind`/`WhoKind`; `WhoMayAct` uses `WhoKind`/`WhoWindow` | R2-combat must add a `"combat"` window (and R2-int/others may add kinds) without editing the shared core. Today every domain member is `never`, so `WhoWindow`/`WhoKind` are exactly the R1 unions. |
| `src/rules/domains/{play,combat,effects,int}.ts` | `{Play,Combat,Effects,Int}WhoWindow` and `{…}WhoKind` hooks (all `never` in R1) | Same composition pattern as `ReasonCode`/`TaskKind`/`PromptKind`/`Effect`. |

No wire field, message or existing type member changed; a `WhoMayAct` value produced today is
byte-for-byte identical. R2-combat can widen `CombatWhoWindow` to `"combat"` in its own file.

## R2 — strict rules domains (additive)

Every R2 addition lives in its domain file (`src/rules/domains/{play,combat,effects}.ts`) and is
composed into the core unions/intersections; all fields are optional and no R1 name was renamed
or removed. Event `type` strings and `Prompt.data.reason` values are open strings, so the new ones
need no union change.

| domain | change | why |
| --- | --- | --- |
| play | `PlayReasonCode` += `invalid_payment`, `restricted`; `PlayPromptKind` = `choose-cost` | 357 explicit payment plans, restriction layer (421/475–479), 357.2 cost-object prompts |
| play | `PaymentPlanWire`; `PlayChoiceAliasFields` (`plan`, `optionalCosts`, `targets`, `x`, `modes`, `baseCost`) on `rules_play` and `rules_activate`; `PlayPlayIntentFields.hide` | 355 choices and 357 payment on the intent; Hide (422, 811) |
| play | `PlayChainItemFields`: `process?: PlayProcessState`, `optionalCosts?`, `totalCost?`, `playedFromFacedown?`; `PlayPermissionWire` | Pending items (354/402) waiting on a prompt, 358.5 undo, 356 totals, 811.1.d |
| play | `PlayProcessState.stage` widened with `"may"` / `"cost"`; `PlayProcessState.costAccepted?` (R2 integration) | the single 399–407 path for triggered abilities: 403.1 "you may" and 405.2 pay-or-decline decisions |
| play | `PlayObjectFields`: `hiddenTurn?`, `hiddenBy?`; `PlayHistoryFields`: `finalizedCardsThisTurn?`, `activationsThisTurn?`, `playHistoryTurn?` (reset by `startNextTurn`) | facedown plays (811.1.b), Legion (812/420.4.b), activation limits |
| play | `PlayLegalIntentsFields`: `playable?: PlayableCardDetail[]` (same order as `playableCardIds`), `hideable?` | clients can build a complete `rules_play` (locations, optional costs, cost, `fromFacedown`) |
| play | `ChainItem.paid` records what was actually paid (Energy, Domain Power, exhausted/killed/discarded ids, `additional.{exhaustedRunes,recycledRunes,optionalCosts,power}`); the intent's legacy `payment` is no longer copied | 357 audit trail |
| combat | `CombatObjectFields`: `controller?: string \| null` (battlefield objects), `assignedDamage?`, `assignedBy?`, `attackedThisCombat?`, `defendedThisCombat?` | stored battlefield control (188–190), 467.2.c assignments, 383.4.e.2.a once-per-combat designation events |
| combat | `CombatHistoryFields`: `combatProgress?: CombatProgress`, `scoringSnapshot?: ScoringStepSnapshot` (+ exported `CombatProgress`, `CombatProgressStage`, `ScoringStepSnapshot`) | resumable steps of combat (465–468); 471.1.a / 491.8.b.1 / 491.8.g.1 Scoring Step snapshot |
| combat | `CombatPromptAnswerFields.exclusiveChoices?: Record<string, string>`; `CombatDamageTarget` display fields `controllerId?`, `damage?`, `might?`; `CombatDamageAssignmentData.suggested?` | 467.2.c.8 Tank/Backline choices, assignment UI |
| combat | `CombatWhoWindow = "combat"` | `whoMayAct` during a combat |
| effects | `EffectsEffectOp` += `spend_buff`, `cost_then`, `requires`, `reflexive`, `delayed`, `continuous`, `remove_keyword`, `choose`, `add_counter`, `spend_counter`, `give_might`, `mark` | Effect DSL coverage (412–448, 387–393, 740.4.a, 377.2.b) |
| effects | interface merging: optional `Selector` fields (`where`, cost comparisons, `exhausted`, `mighty`, `token`, `excludeRefs`, `sameLocationAs`, …), `EventMatcher` (`subject`, `from`, `player`), `TokenSpec` (`tags`, `play`) | card scripts |
| effects | `EffectsObjectFields`: `empowered?`, `prevent?`, `keywordGrants?`, `mightMods?`, `paidAdditionalCost?`, `targetedBy?` | prevention 438, keyword grants 801.3, Might durations, 356.4.f.1, 359.3.e.4 |
| effects | `EffectsHistoryFields.effects` (`limits`, `marks`, `replacements`, `played`) | 383.3.e/386 limits, 370.2/371 replacement bookkeeping |
| effects | `EffectsChainItemFields`: `effect?`, `triggerEvent?`, `sourceName?`, `optional?`, `mayDecided?`, `targetSnapshot?`, `resolutionChoices?` | inline keyword/delayed triggers, 403.1, 359.3.e mistargeting |

**Prompt reasons** (`Prompt.data.reason`): `play.choice` (355 / 403.2 choices; carries `key`,
`targeted`, `choiceMax` — the prompt's `max` is capped at the number of legal options),
`play.cost` (357.2), `play.trigger` (403.1 / 405.2 yes/no; `data.stage` = `may` | `cost`),
`combat.damage_assignment` (467.2.c), `effects.resume` (355.18 resolution decisions; carries the
interpreter `continuation`, to be redacted for other viewers by R2-int), `effects.order_triggers`
(383.3.d). R2-effects' `effects.trigger_choice` did not survive the merge: triggered abilities use
`play.choice` / `play.trigger` through the single 399–407 path.

**Events** (`GameEvent.type`, new in R2):

- play: `cost_paid`, `recycle`, `discard`, `pay_points`, `spend_xp`, `hide`, `enters_ready`,
  `ability_activated`, `play_cancelled`; `card_played` is emitted when the card has finished the
  process (350.1), after its last prompt.
- combat: `attack` / `defend` — R2-combat is the single emitter: once per unit per combat
  (`cardId`, 383.4.e/f) and once per player when the Attacker/Defender is established
  (`data.player: true`, 466.2.c.3; R2-effects' `attack_declared`/`defend_declared` were folded
  into these); `damage_assigned` (`{assignments, auto}`), `combat_damage` (+ `dealt`),
  `combat_result` (`{winner, loser, noResult, recalled, units}`), `lose_control`, `lose_points`,
  `concede`, `banish`, `battlefield_replaced`, `player_removed`, `lose_game`; `contested` carries
  `rule: "190.3.a"` for single-player arrivals (`"323.8"` when opposing units are present).
- effects: `trigger`, `trigger_removed` / `trigger_declined` (`{itemId, rule, reason}`),
  `mistarget`, `replaced`, `prevented`, `skip`, `skip_created`, `become_mighty`, `might`, `stun`,
  `buff`, `spend_buff`, `empower`, `disempower`, `counter`, `banish`, `return_to_hand`, `recycle`,
  `discard`, `burn`, `predict`, `look`, `search`, `shuffle`, `reveal`, `attach`, `detach`, `swap`,
  `grant_keyword`, `remove_keyword`, `gain_xp`, `spend_xp`, `pay_points`, `counter_added`,
  `counter_spent`, `delayed_created`, `continuous_created`, `replacement_created`.

Semantics notes (no shape change): `ObjectRulesState` Might values may now be read back as
negative (143.2.c.1); a spell waiting on an `effects.resume` prompt stays on `RulesState.chain`
until its continuation finishes (340/359), so `spell_resolved` follows the instructions it ran.

## R2-int — sync, realtime, concede, i18n (additive)

| file | change | why |
| --- | --- | --- |
| `src/rules/intents.ts` | `RulesConcedeIntent` (`{ type: "rules_concede" }`) added to `RulesIntent` and `RulesWireAction` | 649–652: `concede()` existed but no wire action reached it; the protocol has no sandbox concede/surrender gameplay action (`abandon_match` is a room HTTP API action) |
| `src/messages.ts` | `ServerErrorMessage.rule?: string`, `ServerErrorMessage.detail?: string` | §5: a rejected `rules_*` intent reaches the sender with its ReasonCode (`code`) and rule separately; `@rift/sync` validates both as optional strings |
| `src/game-state.ts` | `RoomSessionDoc.rulesMode?: RulesMode` | the strict toggle lives on the room shell in the lobby (`set_lobby_rules_mode` is a `RoomShellAction`), so lobby clients need the current mode |

`src/rules/domains/int.ts` is unchanged (every hook stays `never` / empty): the strict UI needs no
extra wire state. Not a type change but a wire-content change: per-viewer snapshots and patches now
carry a redacted `Room.rules` (another seat's prompt is a shell, private card ids are rewritten to
`__hidden_zone__` placeholders, private object state and prompt answers are dropped; see
`docs/rules/int.md`), and another seat's `mulliganPlaybackByPlayerId` card ids are placeholders.
No existing field, action or message was renamed or removed; `OPTIMISTIC_ACTIONS` is unchanged.


## R3-engine — strict rules engine gaps (additive)

Every addition is optional or a new union member in `src/rules/domains/effects.ts`; no existing
name, field meaning or prompt contract changed. Event `type` strings and `Prompt.data.reason`
values are open strings.

| change | why |
| --- | --- |
| `EffectsEffectOp` += `deal_split` (`{ amount, target, source? }`) | 355.14 / 418 / 715.3 damage split among targets |
| `SelectorGroupRequirement` (`sameLocation?`, `sameController?`, `totalMight?: Comparison`); optional `Selector.group`, `Selector.anyNumber` | 355.11 group targeting requirements; 355.13 "any number of" |

Prompts: a split division is an `effects.resume` prompt of kind `damage-assignment` with
`data.ask = { answer: "split", total, targets, minEach }`, answered with the existing
`PromptAnswer.assignments`; 355.11.b / 355.14.h subset prompts are `choose-target` with
`data.ask.subsets` / `data.ask.exact`. A `play.choice` prompt carries `data.spec.group` /
`data.spec.split` / `data.spec.total` when the choice has them. New event: `group_subset`
(`{ key, dropped, rule: "355.11.b" }`, `targetIds` = kept).
