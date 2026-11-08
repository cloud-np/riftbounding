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
