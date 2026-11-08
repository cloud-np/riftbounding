# `@rift/engine` — porting checklist

Port of the original client transition function and helpers:

| original | what | port |
|---|---|---|
| `35qz5rkx7yexy.js:22719-24260` | handler map `cU` (66 gameplay handlers) | `src/actions/*` |
| `35qz5rkx7yexy.js:24296-24361` | optimistic set `cV` (65 actions) | `GAMEPLAY_ACTION_TYPES` / protocol `OPTIMISTIC_ACTIONS` |
| `35qz5rkx7yexy.js:24413-24548` | transition entry (`cY`) + `dq.Z`/`cg.M`/`cL.M`/chain cap/`dq.z`/`dq.S`/`cx.h` | `src/engine.ts` |
| `14u_g6w741h2k.js:110-574` | `437381` card/board primitives, token/duplicate factories, deck-peek clone | `src/state/board.ts`, `src/actions/*` |
| `14u_g6w741h2k.js:617-868` | `78176` zones, peeks, seeded shuffle | `src/state/board.ts`, `src/actions/deckPeek.ts` |
| `14u_g6w741h2k.js:869-1491` | `357603` settings/entity/turn-order/realized-change helpers | `src/state/selectors.ts`, `src/rules/realized.ts` |
| `14u_g6w741h2k.js:41-109` | `822434` battlefield presence | `src/state/board.ts` / selectors |
| `14u_g6w741h2k.js:1558-1665` | `856018` conquer result / final-battlefield check | `src/rules/victory.ts` |
| `14u_g6w741h2k.js:575-615` | `524640` Orianna | `src/actions/cardHelpers.ts` |
| `25vik2nxxo51i.js:7960-8458` | `371460` Dockside/Kharox | `src/actions/cardHelpers.ts` |
| `25vik2nxxo51i.js:9152-9964` | `487939` conquer/showdown + `408727` extra turns + `70094` hold/turn | `src/rules/chain.ts`, `src/rules/turn.ts` |
| `25vik2nxxo51i.js:18089-18397` | `329899` banish links | `src/actions/cardHelpers.ts` |
| `25vik2nxxo51i.js:18788+` | `613138` sealed helpers | `src/actions/setup.ts` (`sealedExtraDrawCountFromSections`) |
| `25vik2nxxo51i.js:9965-10026` | `320083` Tianna / Ivern | `src/rules/victory.ts` |
| `35_5a-hj_uv52.js:1122-1207` | `51407` end beginning phase / end turn | `src/rules/turn.ts` |
| `35_5a-hj_uv52.js:1208-1717` | `888811` auto-pay planner + expansion | `src/rules/autopay.ts` |
| `35_5a-hj_uv52.js:1755-1858` | `107126` Neeko normalize | `src/rules/neeko.ts` |
| `35_5a-hj_uv52.js:1875-2126` | `662731` coordination arrows | `src/actions/arrows.ts` |
| `1kx2ucot0m321.js:2428-2758` | `509396` variant table / entity / turn order / victory | `src/state/variant.ts` |
| `1kx2ucot0m321.js:1838-1983` | `375934` move legality / hidden / exhaustion / tokens | `src/rules/movement.ts` |
| `1kx2ucot0m321.js:2033-2090` | `91500` victory score / Aspirant's Climb | `src/rules/victory.ts` |
| `1kx2ucot0m321.js:1680-1837` | `988474` / `138558` battlefield ↔ player helpers | `src/rules/victory.ts`, `src/actions/chain.ts` |
| `1w8d13szpogkp.js:150-209` | `618260` rune-conservation invariant | `src/rules/realized.ts` |
| `0cvaqmu9022vp.js:930-983` | `780855` zone predicates | `src/state/board.ts` |
| `0cvaqmu9022vp.js:1601-1708` | `552379` labels / Empowered slot | `src/rules/payment-sources.ts`, `src/actions/counters.ts` |
| `0cvaqmu9022vp.js:2037-2151` | `558217` keyword/text helpers | `src/catalog.ts` |
| `42xlz6r9r64m2.js:816-936` | `143307` token art/type/default exhaustion | `src/catalog.ts` |
| `2i0ajg8a836h8.js:4-104` | `356081` batch/auto-pay validators | `src/rules/batch.ts` |
| `1s-b1v6u63dg2.js` (module 26865) | card catalog + lookup/normalization | re-exported through `src/catalog.ts` from `@rift/cards` |
| `3z6_mkb37q-85.js:439-557` | `286700` counter/equipment helpers | `src/actions/counters.ts` |
| `3qdm834_7p_n6.js:1899-1923` | `965166` zone list / setup version | `src/state/init.ts` |
| `35qz5rkx7yexy.js:36620-36760, 38600-39010` | setup gating / state machine | `src/actions/setup.ts` |
| `35qz5rkx7yexy.js:34560-34880, 26880-27230` | lobby callbacks / room projection | `src/actions/lobby.ts`, `src/state/init.ts` |

## Action checklist (99 wire actions)

`ported` = exact port, exercised by the differential test-suite where an original handler
exists. `partial` = server-only flow (no server source published); implemented from the
client contract, specs and log catalogue. `n/a` = not a top-level original reducer action.

### Lobby / room shell (room_shell_action) — 11
| action | status | original |
|---|---|---|
| add_solo_opponent | partial | spec C1; client gates 36620+ |
| set_lobby_ready | partial | spec C1 |
| switch_lobby_seat | partial | spec C1 |
| randomize_lobby_teams | partial | spec C1 |
| set_lobby_play_mode | partial | spec C1 |
| set_lobby_deck_rules | partial | spec C1 |
| set_lobby_game_variant | partial | spec C1 |
| set_lobby_match_format | partial | spec C1 |
| start_lobby_match | partial | spec C1 |
| submit_deck | partial | spec C1; parser mirrors 957839 sections |
| submit_sealed_draft | partial | spec C1 |

### Setup (room_shell_action) — 10
| action | status | original |
|---|---|---|
| submit_sideboard | partial | spec C2; validation delegated to @rift/cards/server |
| request_sideboard_skip | partial | spec C2 |
| respond_sideboard_skip | partial | spec C2 (accept/decline/cancel) |
| select_battlefield | partial | spec C2, 36620-36760, auto-select rule |
| auto_start_test_setup | partial | spec C2 |
| confirm_solo_setup | partial | spec C2 |
| roll_initiative | partial | spec C2; d20 via `ctx.rng` |
| choose_first_player | partial | spec C2 |
| choose_single_player_turn_order | partial | spec C2 |
| submit_mulligan | partial | spec C2; playback mirrors server fields |

### Game result (room_shell_action) — 4
| action | status | original |
|---|---|---|
| request_game_result_confirmation | partial | spec C3 |
| cancel_game_result_confirmation | partial | spec C3 |
| report_game_result | partial | spec C3 |
| request_bo3_rematch | partial | spec C3 |

### Turn structure — 7
| action | status | original |
|---|---|---|
| end_turn | ported | 35qz:22756 → 51407.x (35_5a:1156) |
| end_beginning_phase | ported | 35qz:22755 → 51407.v (35_5a:1144) |
| set_extra_turn | ported | 35qz:22757 → 408727.m (25vik:9216) |
| set_show_legend_xp_counter | ported | 35qz:22739 |
| set_stop_at_beginning_phase | ported | 35qz:22742 |
| set_skip_draw_phase | ported | 35qz:22749 |
| set_auto_score_from_hold | ported | 35qz:22752 |

### Card movement — 23
| action | status | original |
|---|---|---|
| move_card | ported | 35qz:23819 → 60594.u |
| move_cards_to_trash_batch | ported | 35qz:23832 |
| move_off_board_cards_batch | ported | 35qz:23853 |
| transfer_card_control | ported | 35qz:23926 → 60594.g |
| equip_card | ported | 35qz:23586 |
| send_to_deck | ported | 35qz:23973 → 60594.o |
| send_to_rune_deck | ported | 35qz:22924 |
| toggle_exhausted | ported | 35qz:22891 → dO |
| set_rune_exhausted | n/a | rune_batch op only (35qz:23100); direct handler added for completeness |
| draw_cards | ported | 35qz:22950 |
| draw_rune | ported | 35qz:22899 → dW |
| take_top_from_deck | ported | 35qz:23540 → 60594.B |
| take_card_from_deck | ported | 35qz:23571 → 60594.B |
| recycle_all_trash_to_deck | ported | 35qz:23899 |
| send_rune_to_deck_bottom | ported | 35qz:22902 → dG |
| recycle_rune_for_floating_energy | ported | 35qz:22910 → dK |
| shuffle_deck | ported | 35qz:23395 |
| create_token | ported | 35qz:23144 |
| duplicate_card | ported | 35qz:23238 |
| unlink_banished_card | ported | 35qz:23567 → 329899.$ |
| dockside_banish_unit | ported | 35qz:23568 → 371460.Y |
| dockside_play_banished | ported | 35qz:23569 → 371460.m |
| kharox_play_from_trash | ported | 35qz:23570 → 371460.n |

### Deck peek / reveal — 11
| action | status | original |
|---|---|---|
| peek_deck_top | ported | 35qz:23281 |
| peek_deck_bottom | ported | 35qz:23325 |
| clear_deck_peek | ported | 35qz:23360 |
| dismiss_deck_peek | ported | 35qz:23345 |
| recycle_deck_peek_card | ported | 35qz:23421 → 78176.n |
| put_deck_peek_card_on_top | ported | 35qz:23435 → 78176.L |
| set_deck_peek_card_reveal | ported | 35qz:23358 → cN (22594) |
| set_deck_peek_cards_reveal | ported | 35qz:23359 → cN |
| set_hand_reveal | ported | 35qz:22827 |
| set_card_revealed_to_opponent | ported | 35qz:23449 |
| set_card_hidden | ported | 35qz:23477 |

### Payment / resources / counters — 15
| action | status | original |
|---|---|---|
| payment_batch | ported | 35qz:22993; autoPay 888811.M |
| rune_batch | ported | 35qz:23089 |
| floating_resource_batch | ported | 35qz:22771 |
| adjust_floating_resource | ported | 35qz:22799 → dV |
| clear_floating_resources | ported | 35qz:22820 → dH |
| adjust_legend_xp | ported | 35qz:22807 |
| set_score | ported | 35qz:22758 |
| adjust_score | ported | 35qz:22764 |
| adjust_card_might | ported | 35qz:23619 |
| adjust_card_counter | ported | 35qz:23641 + 286700.f |
| clear_card_counter | ported | 35qz:23671 |
| set_card_label | ported | 35qz:23782 + 552379 |
| set_battlefield_brush | ported | 35qz:23217 + 320083.k |
| animate_orianna_gear | ported | 35qz:23687 + 524640 |
| choose_neeko_legend | ported | 35qz:23743 + 107126 |

### Chain / showdown — 10
| action | status | original |
|---|---|---|
| chain_add | ported | 35qz:23988 |
| chain_resolve | ported | 35qz:24173 |
| chain_set_repeat | ported | 35qz:24120 |
| chain_set_flow | ported | 35qz:24139 |
| chain_set_resolve_vote | ported | 35qz:24158 |
| battlefield_conquer_pass_focus | ported | 35qz:24255 → cM (22625) |
| battlefield_conquer_pass_response | ported | 35qz:24256 → cM |
| battlefield_conquer_set_optional_pass | ported | 35qz:24257 → cM |
| battlefield_conquer_dismiss | ported | 35qz:24258 → cM |
| battlefield_conquer_confirm | ported | 35qz:24259 → cM → 487939.m |

### Dice / rewind — 4
| action | status | original |
|---|---|---|
| roll_die | ported | 35qz:22720; sides 748036 |
| rewind_last_action | ported (server-only) | protocol v5; `EngineTimeline` accepted/returned, persisted by realtime |
| forward_last_rewind | ported (server-only) | protocol v5 forward window (5 min) |
| respond_rewind_confirmation | ported (server-only) | protocol v5 approve/decline/cancel |

### Coordination arrows — 4
| action | status | original |
|---|---|---|
| target_arrow_add | ported | 35qz:24358; 662731.G |
| target_arrow_remove | ported | 662731.G |
| target_arrow_remove_from_source | ported | 662731.G |
| target_arrow_clear_all | ported | 662731.G |

## Public API

```ts
createInitialGameState(config: GameSetupConfig): Room
applyGameAction(state, actorPlayerId, action, ctx: ActionContext): EngineResult
createInitialTimeline(): EngineTimeline
getLegalActions(state, playerId): string[]   // coarse helper
```

`ActionContext = { now, rng, mode, idFactory?, timeline? }`. Everything deterministic: no
`Date.now`, no `Math.random` inside the library. `idFactory` is an optional extension used by the
differential tests to reproduce the client's `<kind>_q<actionId>_<n>` ids. `timeline` is the
server-owned rewind v5 history: when supplied, the successful result carries `timeline` and
rewind/forward actions work; when omitted, history is not recorded and rewind actions are
rejected with `rewind_unavailable` (the browser never rewinds optimistically).

`createInitialGameState` starts in `sideboarding` (sealed / bo3 game 2+), or the variant's
first setup phase (`initiative_roll`/`first_player_choice` for FFA4/2v2, `battlefield_pick`
for duel/FFA3). It seeds boards with the original `sz()` rules, sets `hostPlayerId`, and
shuffles main/rune decks deterministically from `roomCode|playerId` unless a `rng` is
supplied; `shuffleDecks:false` disables the shuffle. The card catalog and deck-list parser
are imported from `@rift/cards` (a port of modules 26865 / 957839), not duplicated here.

## Deliberate deviations / open issues

1. **Duel victory detection.** The original *client mirror* (`dq.S`) skips the score check
   for duel (`if (p(e)) return`), leaving duel `gameOutcome` to the authoritative server.
   This port applies the spec E3 strict-lead victory check to every variant. Differential
   tests normalise `gameOutcome` for duel; FFA/2v2 victory is compared byte-for-byte.
2. **Server-only room shell/setup/result/rewind.** The published bundles contain no server
   code. These actions are implemented from the client gating, specs, log catalogue and
   observable room fields. They are covered by scenario tests but not differential tests.
3. **Rewind storage (fixed in B12).** Protocol v5 timeline is an explicit, JSON-serializable
   `EngineTimeline` (entries hold the before-snapshot, actor, meaningful flag and timestamp;
   plus cursor / pending confirmation / forward state). `applyGameAction` accepts it on
   `ActionContext.timeline` and returns the updated value on success; the realtime server keeps
   it in `MatchRoomSerialized.timeline` so Durable Object eviction/restart preserves rewind.
   It is deliberately **not** part of `Room`, so snapshot redaction/diff can never send it to
   clients. Callers that omit `ctx.timeline` (the browser's optimistic apply) do not accumulate
   history. `createInitialTimeline()` returns an empty timeline. Entries carry a monotonic `seq`;
   the realtime worker persists each snapshot in its own chunked Durable Object key
   (`TimelinePersistence`) and the engine bounds the retained history at
   `MAX_REWIND_ENTRIES` (4096 recent meaningful actions).
4. **Logs.** Every entry carries the canonical English `text` plus `key`/`params` for
   `@rift/i18n`. Text is generated from the exact `game-log-en.json` templates for the
   entries this engine emits. The original server also emits some incidental/annotation log
   lines that are not state-relevant; those are omitted or approximated.
5. **Card images.** Setup/token instances carry the catalog's relative image path
   (`/cards/…`, `/tokens/…`) from `@rift/cards`. The original bundle resolves these through
   its CDN helper (`https://assets.riftatlas-workers.com/...`). `@rift/cards` owns URL
   building; the engine's `imageUrl` is deliberately builder-neutral.
6. **`updatedAt`** is advanced to `ctx.now` on every successful change (the server owns
   this outside the handler map).
7. **Auto-pay operation order** is exactly `888811.w`; resource accounting still follows
   the client mirror (e.g. `recycle_rune_for_floating_energy` inside a payment batch does
   not grant floating power, matching the observed client handler).
8. **Single-player turn order** reproduces `408727.H` exactly, including its special
   `single_player` branch (the seat passed in keeps the turn; `solo_lab` is the two-sided
   mode).
9. **Sealed/sideboard validation** is delegated to `@rift/cards` / the server; this engine
   parses and stores decklists but does not reject illegal 40-card lists.
10. **Log text language**: English canonical only (as in the original server). `@rift/i18n`
    renders `key`/`params` or parses `text`.

## Parity fixes

Found by `test/oracle.fuzz.deep.test.ts` (50 seeds × 300 actions × duel/FFA3/FFA4/2v2, all 70
executable transition actions) and fixed against the original bundle.

| # | divergence | original | fix |
|---|---|---|---|
| 1 | Kharox/Dockside playing a `When you play me` card from trash/banished did not auto-add it to the chain | `371460.g` sets `autoChainZone` via `375934.I` with the play-zone set; `371460.y` calls `487939.y` | export `autoChainZone(from,to,hidden,card,zones)`; `moveFromOtherPlayer` now sets it and the deck path uses the `{deck}` zone set |
| 2 | Auto-chained `When you play me` entries omitted `passesShowdownFocusOnResolution:false` when the chain was empty and a conquer assist was pending | `487939.y`: `(chain.length !== 0 \|\| !pending) && undefined` (yields `false`) | set `false` in exactly that case |
| 3 | `draw_cards` to a battlefield/base left a stale deck-peek session | `35qz:22950` non-hand branch resets the peek when the session zone is `deck` after the batch | reset after `applyMoveEvents` |
| 4 | `send_to_deck` did not close a main-deck peek session, and kept `attachedToCardId` on the moved card | `60594.o` calls `437381.x` on the clone and `437381.Z`/`78176.Z` when the destination is deck | delete `attachedToCardId`; reset deck peek |
| 5 | `send_to_rune_deck` reset a rune-deck peek for **both** top and bottom | `35qz:22924` resets only on `position:"top"` | match |
| 6 | Score clamp inverted for duel/FFA | `357603.Q`: `max(duel ? -99 : 0, min(99,score))` | corrected `clampScore`; `clampScoreForVictory` now reproduces `$` as called by `487939.C` |
| 7 | `battlefieldScoredThisTurnByPlayer` kept previous-turn zones when marking a new turn | `856018.a`: discard a snapshot whose `turnNumber` differs | reset before marking |
| 8 | FFA players at even/odd seats were treated as allies in conquer assist selection | `509396.n`: non-team variants always return `opponent` | `playerRelation` now delegates to `seatRelationship` |
| 9 | Baron Nashor token could move to `base`/normal battlefields | `60441.T` allows only `battlefieldToken,trash,hand,banished` while the pit is inactive | `baronDestinationAllowed` used by `moveCard` + `takeCardFromDeck` |
| 10 | `transfer_card_control` ran the full move-event pipeline (presence cleanup/showdown) | `35qz:23926` only calls `487939.Z` then `487939.Y` | handler now calls `afterChainResolved` + conquer trigger |
| 11 | `cleanupPostBeginningPresence` ran only for realized changes | `cY`: `cx.h` runs for every changed handler result | always run after settle |
| 12 | Arrow cleanup ran before Neeko normalisation, keeping arrows pointing at restored legends | `cY`: `cO.c` runs last (after `cg.M`, settle and `cx.h`) | moved cleanup after those steps |
| 13 | `clear_deck_peek` pruned the live board before validating, so a stale peek became a state change | `35qz:23360` prunes a clone and returns the original room on reject | clone/restore on the early-return path |
| 14 | `set_card_label` cleared `empowerTriggerUsed` even when an `Empowered` label was still present | `dX` uses `552379.b` (find existing Empowered slot), not `autopay.empoweredSlot` | import/use `findEmpoweredSlot` |
| 15 | `chain_resolve` to `deck_top`/`deck_bottom` left a stale deck peek | `35qz:24173` resets when `deckPeekZone === "deck"` | reset after insert |
| 16 | No-op handlers still ran Neeko normalisation / settle / presence / arrow cleanup, which could mutate stale state | `cY`: `p === room` returns before `cg.M`/`dq.S`/`cx.h`/`cO.c` | early-return when the handler produced no state change |

**Oracle harness note.** `.recon/oracle/load.mjs` `applyDirect()` calls its settle helper with the
post-action room as both `previousRoom` and `nextRoom`, so `dq.z` is always false and `dq.S` is
skipped for the five `cU`-only actions (`roll_die`, `end_turn`, `animate_orianna_gear`,
`choose_neeko_legend`, `chain_set_resolve_vote`). The deep fuzz replays the missing
`dq.z → dq.S → cx.h` steps using the original module exports after `applyDirect`, so it compares
against the real transition pipeline rather than that harness limitation.

## Verification

```bash
pnpm --filter @rift/engine typecheck
pnpm --filter @rift/engine test
pnpm --filter @rift/protocol typecheck
```

The test suite includes:
- `test/init.test.ts` — board seeding vs the original `sz()` fixture.
- `test/setup.test.ts` — full setup flows (duel, solo, sideboard skip/submit).
- `test/oracle.diff.test.ts` — optimistic `cY` parity + long scripted `cU` sequence.
- `test/oracle.actions.test.ts` — 40+ independent action scenarios against the original.
- `test/oracle.movement.test.ts` — move legality/exhaustion/token table.
- `test/oracle.showdown.test.ts` — conquer assist focus/pass/confirm flows.
- `test/oracle.conquer.test.ts` — conquer-and-draw, pass response, dismiss.
- `test/oracle.multiplayer.test.ts` — FFA hold scoring, turn order, victory, 3-player transfer.
- `test/oracle.fuzz.test.ts` — 5 seeds × 120 pseudo-random actions through both engines.
- `test/oracle.fuzz.deep.test.ts` — **B12 depth fuzz**: 70 transition actions (65 `cV` + 5
  `cU`-only + 4 arrows), guaranteed per-action coverage, 10 seeds × 200 actions on
  duel/FFA3/FFA4/2v2 in CI (`RIFT_FUZZ_SEEDS` / `RIFT_FUZZ_STEPS` / `RIFT_FUZZ_VARIANTS` to
  scale), plus a rewind/forward snapshot test with JSON round-trips of `EngineTimeline`.
  Helpers: `test/helpers/oracle-fuzz-fixtures.ts`, `test/helpers/oracle-fuzz-actions.ts`.
- `test/autopay.test.ts` — planner/operation/batch parity across a cost matrix and real
  `[Empower]` ability costs.
- `test/log.test.ts` — every sentence template checked byte-for-byte against `game-log-en.json`.
- `test/scoring.test.ts` — hold scoring, Tianna, Aspirant's Climb, duel victory.
- `test/action-coverage.test.ts` — all 99 wire action types have a handler.
- `test/lobby-turn-rewind.test.ts` — lobby shell, end-turn cleanup, extra turns, rewind/forward.
