# 01 — Rift Atlas / Riftbound simulator: protocol + engine spec

Specialist analyst #1 (game protocol & engine), 2026-10-22. Everything below is derived from the
client bundles only (server code unavailable). Line references are to files under `.recon/pretty/`.

Primary evidence files:

| file | what it is |
|---|---|
| `playapp/35qz5rkx7yexy.js` | game protocol + client mirror of the engine + lobby/setup + room HTTP API (module 69535) |
| `playapp/1w8d13szpogkp.js` | live realtime runtime: message handling, patch applier, action sender, action clock |
| `playapp/14u_g6w741h2k.js` | zones / board mutators / engine helper bag / token+card factory |
| `playapp/25vik2nxxo51i.js` | turn engine, chain, showdown/conquer, extra turns, deck-peek previews |
| `playapp/35_5a-hj_uv52.js` | turn phase transitions (51407), auto-pay (888811), Neeko normalize (107126), dice (748036) |
| `playapp/1kx2ucot0m321.js` | variant table (509396), movement legality (375934), action-clock math (229172) |
| `playapp/2i0ajg8a836h8.js` | wire message types + validators; batch-op validators |
| `playapp/0xawjzm3yjpr1.js` | board UI, payload call sites, rewind gating, interaction store |
| `playapp/0aed5y6vhcy22.js` | game-log formatter: English canonical templates + parser |
| `playapp/03azfb7rltdws.js` | replay-file decoder: strict canonical CARD/ROOM schema |
| `playapp/957839` → `3z6_mkb37q-85.js` | deck rules (construction, banning, domains) |
| `playapp/924892` → `0b7ie2g_9_ubz.js` | sideboard validation |

Type files: `types/game-state.ts`, `types/actions.ts`, `types/messages.ts`. Log catalog:
`game-log-en.json`.

---

## A. Is the simulator rules-enforced or a manual sandbox? — verdict: **hybrid, leaning manual**

The server is authoritative over a **finite set of named, typed actions** (no free-form card edits),
and the client ships a *mirror of the same transition function* that it applies optimistically
(`35qz5rkx7yexy.js:24420-24510`, handler map `cU` at `22719-24290`, optimistic set `cV` at
`24296-24368`). Actions are validated structurally (batch ops: `2i0ajg8a836h8.js:39-102`) and for a
few invariants (rune conservation `1w8d13szpogkp.js:180-215`; chain cap 20 `dz.U` `14u_g6w741h2k.js:700-703`;
sequence/patch integrity `1w8d13szpogkp.js:2548-2870`). **No card ability text is ever parsed to
resolve effects** (no effect interpreter anywhere). Instead, *manual operations* are expressed through
generic primitives (`move_card`, `toggle_exhausted`, `adjust_card_might`, counters, labels, tokens,
chain) and a small number of **hard-coded helper automations** for specific known cards/mechanics.

### Automated (engine performs it as part of an action)
| automated | where | notes |
|---|---|---|
| turn handoff: ready all cards, channel N runes, draw, hold scoring, advance turn order, floating-resource wipe | `487939.k`/`70094.k` (25vik2nxxo51i.js:9380-9480), `51407.x` (35_5a…:1155-1220) | run on `end_turn` / turn start; N = 2, or 3 for last player's first channel in FFA/2v2 (`509396.q`) |
| beginning-phase auto-completion unless `stopAtBeginningPhase` | `487939.k` → `70094.T` | `end_beginning_phase` exists only to stop early |
| hold scoring (battlefield with unit at beginning of turn scores) + per-turn/per-battlefield dedupe | `70094.p` (25vik…:9275-9330), `856018.M` | `autoScoreFromHold` per-player default true |
| game outcome detection (score ≥ variant victoryScore with strict lead, "cleanup" timing) | `437381.S` (14u…:1300-1356), `509396.g` (1kx…:2640-2665) | `reason: "score" \| "concession"` |
| battlefield conquer/showdown assist state machine (focus/response/pass, score or draw) | `487939` (25vik…:9152-9965), `320083.C` (Tianna) | 3 stages, optional passes in multiplayer |
| auto-chain of hidden-played cards with "when you play me" text | `375934.c/I`, `cb.c` + `487939.y` | adds the card to the chain automatically |
| `Hidden` reveal behaviour: forced move to base / exhaust on reveal | `375934.n` (1kx…:1935-1945) | `moveToBase`, `exhaustOnReveal` |
| `Flow`/`Repeat` toggles; flow = resolve to banished instead of trash | `375934.o`, `chain_set_flow/repeat` | |
| Time Warp extra-turn queueing from chain entries (card OGN-122) | `487939.m` (25vik…:9208-9240) | queue `pendingExtraTurns` |
| auto-pay: compute which runes/legendseals/conduits/gold tokens to exhaust/recycle from a card's cost (incl. power-domain matching, Risen Altar discount, ability-cost text parsing) | `888811` (35_5a…:1236-1750) | produces a `payment_batch`; still player-triggered |
| deck/sideboard validation (40-card main+champion, 12 runes, 3 battlefields, ≤10 sideboard, 3 copies / 1 if [Unique], domain identity, signatures ≤3, bannings) | `957839.v` (3z6…:1197-1580), `924892.k` | client-side; server presumably same shared code |
| card-specific rules hard-coded: Orianna gear→unit (`animate_orianna_gear`), Neeko legend copy (`choose_neeko_legend`), Dockside Lock-Up banish/play-back, Kharox trash play, Tianna blocks hold points, Empower label | `524640`, `107126`, `371460`, `320083`, `552379` | each is a **named action**, not text parsing |
| rune conservation invariant on every applied action | `618260` (1w8d…:180-215) | patch rejection → resync |
| rewind/forward timeline + approval | `35qz5rkx7yexy.js:24460-24760`, rewind protocol v5 | see §G |
| action clock (per-player turn timer accumulation) | `229172` (1kx…:2730-2830) | scopeKey, totals, activeTargets |
| log entry generation (English canonical, localized client-side) | `0aed5y6vhcy22.js` | see §F |

### Manual (players move/do it; engine only stores it)
- Every card movement: play to base/battlefield, kill to trash, banish, deck↔hand↔trash transfers,
  attaching gear, transferring control, deck peek/ordering/shuffling/recycle.
- Every might/counter/label change: `[Buff]` (+1 temporary might helper), Assault/Tank/Shield/Deflect/
  Ganking/Stunned/Temporary etc. are **free-text labels** in `customLabels` (UI manages 3 slots, each
  label trimmed to 24 chars by `437381` helper `s`; storage schema allows ≤16 strings ×512 chars,
  `03az…:1770`); white/red counters are generic integers; `Empowered` is a label.
- Ability/effect resolution: adding chain entries, setting Repeat/Flow, voting to resolve, resolving.
  A chain entry is just a card + bookkeeping; *nothing checks cost, target legality, or text.*
- Score/XP edits (`set_score`, `adjust_score`, `adjust_legend_xp`, `set_extra_turn` are explicit
  player actions by convention of the helpers).
- Combat: there is **no combat action**; “showdown” = conquer-assist prompts + chain. Attackers are
  chosen by visually moving units (`move_card` to a battlefield triggers the assist when unit presence
  changed: `487939.G/Y`, `14u 357603.D/N`).

Consequence for our reimplementation: to be *functional* we must implement (1) the action bus +
authoritative state + patches + rewind, (2) the turn/beginning/hold/conquer automations, (3) auto-pay,
(4) validation invariants, (5) the same helper actions for the handful of hard-coded cards. Card
effects themselves stay manual exactly like the original.

---

## B. GameState shape

There are **three state layers**:

1. `sessionDoc` (room shell; persisted series data) — `room_shell_sync` → see `types/game-state.ts
   RoomSessionDoc`; merged into the projected room client-side (`35qz5rkx7yexy.js:26880-27230`).
2. `room` (authoritative gameplay state) — payload of `authoritative_snapshot` / patched/target of
   patches. Canonical strict schema in the replay decoder `03azfb7rltdws.js:1745-1965`; live-only
   fields evidenced at `35qz5rkx7yexy.js:27100-27130`.
3. Local client state: realtime runtime store (`1w8d13szpogkp.js:481-500`), interaction store
   (`0xawjzm3yjpr1.js:47584-47690`), plus per-view UI.

### Room (authoritative gameplay state)

```
roomCode, createdAt, updatedAt
phase: "lobby" | "sideboarding" | "battlefield_pick" | "initiative_roll"
       | "first_player_choice" | "mulligan" | "in_game"
gameVariant?: "duel"|"free_for_all_3"|"free_for_all_4"|"teams_2v2"   // absent ⇒ duel
roomMode?: "multiplayer"|"single_player"|"solo_lab"
teamIdByPlayerId?: Record<playerId, teamId>
playMode?: "constructed"|"sealed"; deckRulesMode?: "standard"|"unrestricted"
matchFormat?: "bo1"|"bo3"; gameNumber?; seriesStartedAt?; winsByPlayerId?
gameHistoryStartedAt?; gameHistoryEndedAt?
firstPlayerId?; firstPlayerChooserId?; activeTurnPlayerId?; activeTurnStep?: "beginning"|"main"
turnNumber?; playerTurnCounts?: Record<playerId, n>
pendingExtraTurns?: [{sourceEntryId, playerId}]; extraTurnResumePlayerId?
initiativeRound?; initiativeRolls?: Record<playerId, d20>
lastDieRoll?: DieRoll; recentDieRolls?: DieRoll[]        // 5-second window, ≤16 (35qz…:22721-22745)
players: Player[2..4]
log: GameplayLogEntry[]                                  // ≤2000
chainEntries: ChainEntry[]                               // live cap 20 (dz.U), replay cap 128
chainResolveVotes: playerId[]
boardSettingsByPlayerId?: Record<playerId, {showLegendXpCounter, stopAtBeginningPhase, skipDrawPhase, autoScoreFromHold}>
battlefieldBrushByZone?: {battlefieldX?: true}           // Brush markers (Baron Pit regions)
sharedBattlefieldToken?: {kind:"baron_pit", zone:"battlefieldToken", title:"Baron Pit", active}
postBeginningBattlefieldUnitPresenceByPlayer / beginningBattlefieldUnitPresenceByPlayer
  : Record<playerId, {battlefieldA..Token: bool, turnNumber?}>
battlefieldScoredThisTurnByPlayer?: same shape             // hold/conquer dedupe per turn
battlefieldConquerAssistExcludedZones?: BattlefieldZone[]
pendingBattlefieldConquerAssist?: {zone, attackerPlayerId, defenderPlayerId,
  actualDefenderPlayerId?, stage:"attacker_focus"|"defender_response"|"attacker_confirm_conquer",
  optionalPassedPlayerIds?, attackerCanPassFocus?, defenderSideWasEmptyAtStart?, turnNumber?}
gameOutcome?: {winnerPlayerIds, reason:"score"|"concession", decidedAtTurnNumber}
bo3CompletedGames?: [{gameNumber, scoresByPlayerId, actionClockMsByPlayerId?, durationMs}] // ≤16
targetArrowsByPlayer?: Record<playerId, TargetArrow[≤20]>
setupOrderVersion?: 2 (== 965166.w; must match for battlefield_pick in non-series games)
singlePlayerTurnOrder?: "play_first"|"play_second"; soloSetupPending?: bool
sideboardDonePlayerIds?; sideboardSkipRequest?: {requesterPlayerId?, acceptedPlayerIds,
  declinedPlayerId?, championSelectionOnly?}
mulliganDonePlayerIds?; mulliganPlaybackByPlayerId?: Record<playerId, {draws:[{id,cardId,
  kind:"opening"|"refill", handCountBeforeDraw}], redrawCount?, hiddenRefillCardIds?}>
rewindProtocolVersion?: 5; rewindablePlayerIds?: []; forwardablePlayerIds?: []; forwardAvailableUntil?
broadcastDecksByPlayerId?                                 // broadcast/spectator decks
```

`Player` = `{id, seat(0..3), name, joinedAt, leftAt?, leftReason?: "manual"|"returned_to_lobby",
selectedBattlefield?, selectedBattlefieldCardCode?, board?, identity?}` + session-doc mirrors
(`decklistRaw`, `deck`, `submittedDeck`, `registeredDeck`, `sealed*`, `battlefieldOptions`,
`battlefieldOptionCount`, `isSealedSeat`) — `35qz5rkx7yexy.js:26900-26990`, `20847-20890`.

`PlayerBoard` (13 zones + counters) — see `types/game-state.ts PlayerBoard`. Note `deckPeek` is a
sub-object (`{cardIds, revealedCardIds, autoRevealNewCards?, revision?, zone?:"runeDeck"}`), and
`recycledDeckBottomCount` tracks bottom-preserved cards.

`CardInstance` — canonical fields from the replay validator `03azfb7rltdws.js:1745-1800`
(`id,name,source,exhausted,createdAt,ownerPlayerId?,isDuplicate?,hidden?,revealedToPlayerIds?,
revealedToOpponent?,oriannaAnimation?,neekoSourceCardId?,attachedToCardId?,banishedByCardId?,
banishedUntilEndingPlayerId?,empowerTriggerUsed?,cardCode?,hasWhenYouPlayMe?,type?,domains?,text?,
energyCost?,powerCost?,might?,temporaryMightBuff?,whiteCounter?,redCounter?,customLabels?≤16,rarity?,
set?,keywords?,subtypes?,isPlaceholder?`) plus `name`, plus `banishedByHiddenSourcePlayerId?`
(engine-only, 14u…:bottom of 437381) and `repeatEnabled/flowEnabled/passesShowdownFocusOnResolution`
inside chain entries (`03az…:1877`). Factory: `437381.X` builds tokens/duplicates; `sz()`
(`35qz…:20788-20835`) builds setup-phase cards from deck entries
(`id = "setup-<owner>-<source>-<index>-<slug>"`, `source ∈ mainDeck|champion|legend|rune`).

Room creation for a fresh game seeds boards only in phases `sideboarding|battlefield_pick|
initiative_roll|first_player_choice` (`35qz…:26930-27010`): deck = mainDeck entries, champion =
champion entries, legend = first legend entry, runeDeck = rune entries, everything else empty.

### Chain / “stack”

`ChainEntry` = `{id ("chain_<n>_<n>" or client), card, addedAt, fromZone, sourceCardId, byPlayerId,
byPlayerName, repeatEnabled?, flowEnabled?, passesShowdownFocusOnResolution?}` (`78176.w`,
`03az…:1862-1879`). Entries are a LIFO array (index 0 = top; `78176.g` unshifts). Cap 20 (live),
rejection message “The Chain is full.” (`78176.N/U`, `14u_g6w741h2k.js:700-703`). `chainResolveVotes` collects approvals from all
other players; when everyone voted, the owner sees the resolve affordance (`229172.l`).

### Action clock

`{scopeKey, totals: Record<playerId, ms>, activeTargets: [{playerId, reason:"turn"|"chain"|"showdown"}],
runningSince: number|null, serverNow}` (`229172.S/n`). Who is on the clock: conquer assist → defender
(or attacker at attacker stages); chain → players who haven't voted (else owner); otherwise active
turn player (`229172.l`).

### Log entry

`{id, at, text(English canonical), authorPlayerId?, turnNumber?, turnPlayerId?, actionKind?}` —
actionKind ∈ `turn|inspect|draw|deck|trash|resource|board|spell|battle|score|legend-xp|rewind|forward`
(`03az…:1826-1850`, classifier `0xawjzm3yjpr1.js:11093-11140`, renderer `11640-11950`). Log entries
are grouped into turn sections client-side using `turnNumber/turnPlayerId` and by matching
“ ended their turn.” / “mulligans are complete…” (`0xawjzm3yjpr1.js:11680-11710`).

---

## C. Actions

**Count correction:** `api/game-action-types.txt` mixes real actions with state names. Of 138 strings:

* **~99 wire actions** (this section),
* **16 client-local UI store actions** (never sent): `replace_state, set_armed_action, set_held_mode,
  set_target_selection, set_target_prompt_pos, set_target_hotkey_source_key, set_label_selection,
  set_label_dialog_state, set_label_wheel_state, set_label_prompt_pos, set_label_hotkey_active,
  set_label_wheel_open_source, set_pending_chain_resolve_entry_id, set_queued_targeted_spell_drop_arrow,
  set_auto_pay_preview_card_id, set_auto_pay_in_flight` (`0xawjzm3yjpr1.js:47584-47690`),
* **23 non-actions**: connection states `idle, loading, unavailable, missing, found, signed_out,
  reconnecting, auth_pending`, “log” channel, zones `hand, base, trash, champion`, variants
  `free_for_all_3/4, teams_2v2`, UI labels `look_top_card, look_top_rune, look_at_bottom,
  shuffle_unrecycled, on_top_recycle_rest, to_hand_recycle_rest` (deck-peek menu labels mapping to
  `peek_deck_top{count:1,zone}`/`peek_deck_bottom`/`shuffle_deck{preserveRecycledBottom:true}`/
  `clear_deck_peek`, see `0xaw…:38240-38270`, `61830-61995`), and the i18n key `chat`.

Transport & permission: gameplay actions go through `action_intent` (`35qz…:3967` with
`clientBaseSequence`, `clientActionId`, `actorPlayerId`); lobby/setup/result actions through
`room_shell_action` (`35qz…:3871`). The server checks the actor is the seat/member allowed to act;
client gating (for UX) exists for setup (`35qz…:36620-36760`: `confirm_solo_setup` needs
single_player+soloSetupPending; `submit_sideboard` needs phase & not done; `request_sideboard_skip`
needs no pending request & not declined & not championSelectionOnly; `respond_sideboard_skip`;
`select_battlefield` needs battlefield_pick & no selection; `choose_first_player` /
`choose_single_player_turn_order` need first_player_choice; `submit_mulligan` needs mulligan & not done).

`Optimistic` column = in client set `cV` (applied locally before the server patch). `Rewind` column =
classification used to decide if an action is “meaningful” for rewind bookkeeping (`c9`,
`35qz…:24822-24900`): M = meaningful (target), I = incidental, B = boundary (setup/game), N = navigation.

### C1. Lobby / room shell (room_shell_action; server-side tracked, all in `1|2|3` groups below)

| action | payload | sender | when | effect |
|---|---|---|---|---|
| `add_solo_opponent` | `{decklist?}` \| `{sealedRegistration?}` | host, single_player | soloSetupPending & phase sideboarding/battlefield_pick | fills opponent seat |
| `set_lobby_ready` | `{ready}` | self | phase lobby | toggles `lobbyReadyPlayerIds` |
| `switch_lobby_seat` | `{targetSeat}` | self | lobby | move seat |
| `randomize_lobby_teams` | `{}` | host | lobby, teams_2v2 | shuffles `teamIdByPlayerId` |
| `set_lobby_play_mode` | `{playMode}` | host | lobby | constructed↔sealed (sealed forces deckRules standard) |
| `set_lobby_deck_rules` | `{mode}` | host | lobby | standard↔unrestricted |
| `set_lobby_game_variant` | `{gameVariant}` | host | lobby | duel/ffa3/ffa4/2v2 |
| `set_lobby_match_format` | `{matchFormat}` | host | lobby | bo1↔bo3 |
| `start_lobby_match` | `{}` | host | lobby, all ready + registered | creates gameplay room |
| `submit_deck` | `{decklist:string}` | self | lobby (constructed) | validates & registers deck (log “submitted a deck…”) |
| `submit_sealed_draft` | `{draftId, sealedRegistration}` | self | lobby (sealed) | registers sealed pool/deck |

### C2. Setup (room_shell_action)

| action | payload | sender | when | effect |
|---|---|---|---|---|
| `submit_sideboard` | `{legend?(sealed), champion, mainDeck, sideboard, skipped?}` (entries `{name,cardCode?,count}`) | self | phase sideboarding | marks `sideboardDonePlayerIds`; validates vs submitted deck (924892) |
| `request_sideboard_skip` | `{}` | self | sideboarding, no pending request; **UI gates** to multiplayer, non-bo3, non-sealed | sets `sideboardSkipRequest` |
| `respond_sideboard_skip` | `{response:"accept"\|"decline"\|"cancel"}` | others/requester ("cancel" only by requester) | request pending, not declined, not championSelectionOnly | updates accepted/declined |
| `select_battlefield` | `{battlefield}` \| `{random:true}` | contributor | battlefield_pick, none selected | sets `selectedBattlefield(+CardCode)`, log “locked in a battlefield” |
| `auto_start_test_setup` | `{}` | host/test | setup phases | runs rest of setup automatically (test rooms) |
| `confirm_solo_setup` | `{}` | owner | single_player + soloSetupPending | clears `soloSetupPending` |
| `roll_initiative` | `{}` | each competitor | initiative_roll | writes `initiativeRolls[playerId]` (d20), log “rolled a d20” |
| `choose_first_player` | `{firstPlayerId}` | initiative winner | first_player_choice | sets `firstPlayerId`, log |
| `choose_single_player_turn_order` | `{turnOrder:"play_first"\|"play_second"}` | solo player | first_player_choice | equivalent, single_player |
| `submit_mulligan` | `{cardIds:[≤2]}` | each player | mulligan & not done | recycles selected cards, redraws, records playback, logs “finalized mulligan (x recycled, y redrawn)” |

### C3. Game result (room_shell_action; bo3)

| action | payload | sender | when | effect |
|---|---|---|---|---|
| `request_game_result_confirmation` | `{}` | self | bo3, room live, no pending result | opens winner-confirmation dialog |
| `report_game_result` | `{winnerPlayerId}` | self | bo3 | records `pendingGameResult.winnerByReporterPlayerId[self]`; both must agree |
| `cancel_game_result_confirmation` | `{}` | self | pending | withdraws report |
| `request_bo3_rematch` | `{}` | self | after series | fills `rematchRequestedPlayerIds` |

### C4. Turn structure (action_intent)

| action | payload | who | when | effect | Optimistic | Rewind |
|---|---|---|---|---|---|---|
| `end_turn` | `{observed:{turnNumber,activePlayerId,activeStep}}` | active player (or controller of a left player) | in_game | completes beginning if needed → clears all floating resources → settles outcome → turnNumber+1 → next turn (`51407.x`) | **no** (server-only) | M |
| `end_beginning_phase` | `{observed:…}` | active player | activeTurnStep==beginning | runs channel/draw/hold and sets step=main (`51407.v` → `70094.T`) | yes | M |
| `set_extra_turn` | `{entryId, enabled}` | chain owner whose entry is Time Warp (OGN-122) | top chain entry theirs | queue/cancel `pendingExtraTurns` (`408727.m`) | yes | M |
| `set_show_legend_xp_counter` / `set_stop_at_beginning_phase` / `set_skip_draw_phase` / `set_auto_score_from_hold` | `{visible\|enabled}` | self | in_game | per-player settings (`357603.o`) | yes | preference (never meaningful) |

### C5. Card movement (action_intent)

| action | payload | notes |
|---|---|---|
| `move_card` | `{from, to, cardId, toIndex?, asHidden?, forced?}` | core play/kill/attach-less move; triggers auto-chain + showdown/conquer assist (`60594.m`, `487939.y`); same-zone = reorder with same_zone_reorder / same_zone_side_effect classification |
| `move_cards_to_trash_batch` | `{from, cardIds[]}` | multi-kill |
| `move_off_board_cards_batch` | `{from, to, cardIds[]}` | batch move incl. to deck (shuffled) (`move_off_board_cards_batch` handler 35qz:23848) |
| `transfer_card_control` | `{zone, cardId, targetPlayerId?}` | hand/trash/banished/champion excluded (`cf.O`) |
| `equip_card` | `{equipmentCardId, unitCardId, asAttachment?}` | gear→unit; `asAttachment` for hand attach (Quick-Draw) |
| `send_to_deck` | `{from, cardId, position:"top"\|"bottom"}` | recycle into deck |
| `send_to_rune_deck` | `{from:"runeArea", cardId, position}` | rune back to rune deck |
| `toggle_exhausted` | `{zone, cardId, expectedExhausted}` | guard against stale state; champion never exhausted (`dO`) |
| `draw_cards` | `{count?, to?}` | default 1→hand; `to` any board zone (`cf.B`); stops at empty deck; tokens/duplicates burn |
| `draw_rune` | `{exhausted?}` | runeDeck top → runeArea |
| `take_top_from_deck` | `{to, sourceCardId?}` | also banishes with Dockside link |
| `take_card_from_deck` | `{cardId, to, toIndex?}` | pick from deck |
| `recycle_all_trash_to_deck` | `{}` | shuffles trash to deck bottom |
| `send_rune_to_deck_bottom` | `{cardId, paymentGroupOrigin?}` | |
| `recycle_rune_for_floating_energy` | `{cardId, paymentGroupOrigin?}` | grants +1 floating energy; **auto_pay_button does not grant floating power** (`dK`) |
| `shuffle_deck` | `{preserveRecycledBottom?}` | |
| `create_token` | `{zone, name, count?, exhausted?, clientCardIds?}` | name→catalog (token DB `143307`), default exhaustion by keyword (`cs.h`), merges same-name tokens |
| `duplicate_card` | `{zone, cardId, owner?:"self"\|"opponent", targetPlayerId?, clientCardId?}` | token-like copy (`isDuplicate`) |
| `unlink_banished_card` / `dockside_banish_unit` / `dockside_play_banished` / `kharox_play_from_trash` | `unlink_banished_card {zone, cardId, targetCardId}`; `dockside_banish_unit {zone, cardId, targetCardId}`; `dockside_play_banished {zone, cardId, banishedCardId, to}`; `kharox_play_from_trash {zone, cardId, targetPlayerId, trashCardId, to}` | card-specific helpers (`371460`: Dockside Lock-Up, Kharox) |

Legality of a move is enforced by `375934.V` (`canCardGoToZone`): hidden units only to battlefields;
`champion` zone only for `source:"champion"`; `runeArea` only for `source:"rune"`; spells cannot enter
base/battlefield; non-unit gear on a battlefield only when attached. Destination exhaustion rules
(`375934._`): base/battlefield → units exhaust; hand/trash/banished → ready; champion → ready; moving
out of a battlefield with a hidden unit readies it. Tokens/duplicates (`375934.F`) never land in
hand/trash/banished/champion: `move_card` sends them to trash instead, and `draw_cards` burns them.

### C6. Deck peek / reveal (action_intent)

`peek_deck_top {count≤12, zone?}`, `peek_deck_bottom {}`, `clear_deck_peek {zone?}` (recycles peeked
cards in random order, preserves recycledBottom count), `dismiss_deck_peek {zone?}`,
`recycle_deck_peek_card {cardId, zone?}`, `put_deck_peek_card_on_top {cardId, zone?}`,
`set_deck_peek_card_reveal {cardId, reveal, zone?, targetPlayerId?, audience?, autoRevealNewCards?}`,
`set_deck_peek_cards_reveal {cardIds[], reveal, zone?, autoRevealNewCards?}`,
`set_hand_reveal {reveal, targetPlayerId?, audience?:"all_other_players"|"teammates"|"opponents"}`,
`set_card_revealed_to_opponent {zone, cardId, revealed, targetPlayerId?, audience?}`,
`set_card_hidden {zone?="hand", cardId, hidden}`. All optimistic. `audience:"teammates"` only applies
in 2v2 (`357603.W`). Hidden flag toggling on hand/champion requires the Hidden keyword (`v.r`).

### C7. Payment / resources / counters (action_intent)

| action | payload | notes |
|---|---|---|
| `payment_batch` | `{operations≤128, paymentGroupOrigin?, autoPay?:{purpose:"play"\|"empower",zone,cardId}}` | validated per-op (`2i0ajg…:39-102`); autoPay is expanded server-side to ops (`888811.M`); empower adds `set_card_label "Empowered"` |
| `rune_batch` | `{operations≤128}` | draw_rune / set_rune_exhausted / send_rune_to_deck_bottom / recycle_rune_for_floating_energy |
| `floating_resource_batch` | `{operations}` | adjust/clear floating resources (merges client-side `cX`) |
| `adjust_floating_resource` | `{resource:"energy"\|"power", delta, paymentGroupOrigin?}` | |
| `clear_floating_resources` | `{}` | |
| `adjust_legend_xp` | `{delta}` | clamp 0..99 (`dq.b`) |
| `set_score` / `adjust_score` | `{score}` / `{delta}` | clamp −99..99, duel ≥0 (`357603.Q/$`) |
| `adjust_card_might` | `{zone, cardId, delta}` | `temporaryMightBuff` clamp 0..99; units only, not hidden |
| `adjust_card_counter` | `{zone, cardId, counter:"white"\|"red", delta, initializeAtUnitMight?}` | white+unit+initialize → start at unit might (`cc.f`) |
| `clear_card_counter` | `{zone, cardId, counter}` | |
| `set_card_label` | `{owner?:"self"\|"opponent", targetPlayerId?, zone, cardId, slot:0..2, label, countDelta?:±1 }` | UI slot cap 3 (`552379.F`), label trimmed to 24 chars (`437381.s`); label "Buff" applied by self to own unit ⇒ +1 temporary might; counted labels ("Shield 2") ±1 via countDelta |
| `set_battlefield_brush` | `{zone, active}` | requires Baron Pit token (`ca.k/824`); `active:false` clears |
| `animate_orianna_gear` | `{legendId, zone, cardId}` | convert gear to "Unit Gear" with might = energy cost, whiteCounter = might (`524640`) |
| `choose_neeko_legend` | `{neekoCardId, zone, legendId\|null}` | copy legend into `legend`, push original to `additionalLegends`; null returns it |
| `set_extra_turn` | see C4 | |

### C8. Chain / showdown (action_intent)

`chain_add {from, cardId, clientEntryId?, battlefieldZone?}` (`from:"battlefieldMarker"` plays the
marked battlefield itself), `chain_resolve {entryId, to?}` (owner only; `to` ∈ trash|banished|hand|
deck_top|deck_bottom; flow → banished default `375934.o`), `chain_set_repeat {entryId, enabled}`
(owner; [Repeat]), `chain_set_flow {entryId, enabled}` (owner; [Flow]),
`chain_set_resolve_vote {entryId, approved}` (any other player),
`battlefield_conquer_pass_focus {zone}`, `battlefield_conquer_pass_response {zone}`,
`battlefield_conquer_set_optional_pass {zone, passed}`, `battlefield_conquer_dismiss {zone}`,
`battlefield_conquer_confirm {zone}` (all handled by `cM` → `487939`; `attacker_confirm_conquer` is a
*stage*, not an action).

### C9. Dice & rewind (action_intent)

`roll_die {sides ∈ 4|6|8|10|12|20}` (server RNG; NOT optimistic; validation `748036`);
`rewind_last_action {}`, `forward_last_rewind {}`,
`respond_rewind_confirmation {requestId, response:"approve"|"decline"|"cancel"}` (approver →
approve/decline, requester → cancel; gate `0xaw…:54400-54420`). See §G for semantics.

### C10. Coordination arrows (action_intent; optimistic, never rewind-meaningful)

`target_arrow_add {sourceCardId, targetCardId, sourceAnchor, targetAnchor}`,
`target_arrow_remove {…}`, `target_arrow_remove_from_source {sourceCardId, sourceAnchor}`,
`target_arrow_clear_all {}` (`662731` module: ≤20 arrows per player; endpoints validated).

---

## D. Messages and lifecycle

### D1. Wire message types (complete set, `2i0ajg8a836h8.js:31-95`)

`join_shell, join_game, resume_game, auth_refresh, auth_session, activity_history_request,
activity_history_page, chat_send, chat_sync, chat_append, judge_call_create, judge_call_private_create,
judge_call_close, judge_call_sync, judge_feedback_submit, judge_feedback_result, player_report_submit,
player_report_result, room_shell_sync, room_shell_action, room_shell_action_ack, customization_refresh,
spectator_roster_sync, presence_update, action_intent, gameplay_action_noop_ack,
rewind_confirmation_state, spectator_view_grant_update, spectator_view_grant_ack,
authoritative_snapshot, authoritative_patch_commit, authoritative_resume_ack, presence_event, ping,
pong, error` → **36 types** (18 up, 18 down; `ping`/`pong` both directions).

Payload requirements per type are in `2i0ajg8a836h8.js:300-780` — reproduced in `types/messages.ts`.

Key flows:
* **Join**: `join_shell` (room shell only) / `join_game` (gameplay runtime) with `{roomCode,
  authToken, playerId?, viewerRole?, broadcastView?}`. `resume_game` adds `clientSequence` and
  `unsettledAction {clientActionId, actorPlayerId}` → server replies `authoritative_snapshot` (+
  `authoritative_resume_ack`, `room_shell_sync`).
* **Action**: client `action_intent {action, actorPlayerId, clientActionId, clientBaseSequence}` →
  server `authoritative_patch_commit {baseSequence, sequence, action, patch, clientActionId,
  actionClock?}` (== base+1), or `authoritative_snapshot` (resync/rewind/first), or
  `gameplay_action_noop_ack` (no state change), or `error`.
* **Shell**: `room_shell_action` → `room_shell_action_ack {actionType, sequence, clientActionId}`;
  state goes through `room_shell_sync {sessionDoc, sequence, gameplayRuntimeReset?}`.
* **Patch integrity client-side**: sequence gap → resync; ops applied atomically; rune-conservation
  violation → resync (`1w8d…:2548-2870`, `618260`).
* **Errors**: `{code, message, mutationClass?, retryable?, retryAfterMs?, authReason?, authRecovery?,
  authoritativeSequence?, clientActionId?, requestId?}`; codes include `stale_action_state`
  (4008, retryable when `clientBaseSequence < authoritativeSequence && local==authoritative`),
  `match` (4007 = control superseded), `room_not_found`, `bootstrap_required`, `bootstrap_failed`,
  `runtime_restore_failed`, `runtime_persistence_failed`, `forward_unavailable`,
  `auto_pay_unavailable`. Auth recovery protocol: `auth_refresh` ⇄ `auth_session`.
* **Presence**: `presence_update` (client, throttled) → `presence_event`
  `{presence_snapshot | player_presence | hover_state | card_ping | board_emote | chat_typing}`.
  Ping intents: `general|trigger_ability|discard_target`. Emotes: `thumbs_up, heart, laugh, wow,
  cry, angry, wave, clap, thinking, surprised, sad` (`3-2i4k6s343ud.js:3215-3300`).
* **Chat/judge/report** flows as typed above; `chat_append` carries `{entry}`; judge calls have
  public/private visibility and status `open|answered|closed|expired`.
* **Multi-tab/seat safety**: `control_superseded` when the same seat resumes elsewhere.

### D2. Room lifecycle (HTTP on the PartyKit host, `35qz5rkx7yexy.js:21750-22060`)

All POST, `content-type: text/plain`, JSON body, timeout 12s, errors `{ok:false, error, message,
retryable?, authRecovery?, continuationRoomCode?}`.

| endpoint | actions |
|---|---|
| `/parties/coordinator/global-enam-v1` | `create_room` → `{operationId, roomCode, playerId, controlledPlayerIds?}` |
| `/parties/match/:roomCode` | `join_room`, `switch_to_spectator`, `take_seat`, `resolve_room_membership`, `create_next_game`, `room_series_action`, `leave_room` (keepalive), `abandon_match`, `claim_disconnect_win`, `return_to_lobby` |
| `/parties/matchmaking/:queueRoom` | `cancel_exact` / `reset_exact` (cancel/resume search; response `{ok, searchId, status:"matched"\|"cancelled"\|"expired", roomCode?, playerId?, …}`) |

Matchmaking search payload (`uj` validator `35qz…:25082-25155`): `{searchId(/^[A-Za-z0-9:_-]{8,128}$/),
initiatingUserId, playerName, playMode, decklist|sealedRegistration, matchmakingPool, matchFormat,
gameVariant?, extensions?:["pools"|"tables"], party?{id,round}}`; client keeps local recovery state with
`expiresAt = now+10min`, `widenAt = now+90s`, `scope:"specific"`.

Reconnect: on socket close the client re-joins game runtime with `resume_game`; the server may answer
`room_advanced` + `continuationRoomCode` (follow the room), `room_not_found` (terminal),
or `resync_required`.

### D3. Game modes

| mode | how created | differences |
|---|---|---|
| `multiplayer` (default) | private room / quick match | normal seats; each player controls own seat; rewind needs approval (or solo_lab override) |
| `single_player` | solo room vs bot/deck seat | second seat is a fake opponent `add_solo_opponent`; opponent auto-passes roll/mulligan/battlefield when `soloSetupPending`; `choose_single_player_turn_order` replaces `choose_first_player`; `confirm_solo_setup` clears pending |
| `solo_lab` | test/lab room | one client controls all seats (`controlledPlayerIds`, `activePlayerId` in session), can act as any seat via `room_shell_action.actorPlayerId`/`action_intent` for gameplay, auto-runs setup steps (random battlefield, both mulligans, both sideboards), rewind immune to approvals (`rewindablePlayerIds = [self]`), both hands visible locally |
| `teams_2v2` (variant) | variant switch in lobby | shared score (team max), victoryScore 11, alternating turn order `P1, opp, teammate, last opp`, teammate reveal audience, battlefield contributors = all except first player, team dedupe rules |
| `free_for_all_3/4` | variant switch | 3–4 independent players, victoryScore 8, contributors exclude first player for FFA4, first player skips first draw, last player channels 3 runes first time |
| spectate / broadcast | `join_room` as spectator, `broadcastView:true` | viewerRole "spectator", spectator roster sync, per-player “reveal my hand to signed-in spectators” grants (`spectator_view_grant_update`), broadcast decks (`broadcastDecksByPlayerId`) |

---

## E. Phases, turn structure, victory

### E1. Room phase flow

```
lobby → (start_lobby_match)
   └─ bo3 game 2+: sideboarding → battlefield_pick → initiative_roll → first_player_choice → mulligan → in_game
   └─ bo1:        battlefield_pick → initiative_roll → first_player_choice → mulligan → in_game
```
(phase enum `03az…:1857`; ordering from the setup UI state machine `35qz…:38600-39010`, `33370-33400`,
`35320-35340`.)

* `sideboarding` (bo3/sealed): players submit sideboards (`submit_sideboard`), optional skip request.
  Auto-lock when all done; skip path restores submitted decks.
* `battlefield_pick`: contributors (`all` or `all_except_first_player`) lock one battlefield each
  (`select_battlefield`, optional random). Validity also requires `setupOrderVersion === 2`.
  The engine auto-selects the last remaining option when only one is left (log key
  `autoSelectedLastBattlefield`); solo_lab auto-picks a random battlefield when a seat stays empty
  (`35qz…:37745-37790`).
* `initiative_roll`: all competitors `roll_initiative` (d20). Client shows 3D dice (chunk
  `3vkoknf821dno.js`). Ties presumably restart the round (`initiativeRound` ++, `initiativeRolls`
  reset server-side; the client only animates `[roomCode, initiativeRound, firstPlayerChooserId,
  rolls]`, `35qz…:38608-38618`).
* `first_player_choice`: initiative winner (or the loser in bo3 game ≥2 — `previousLoserChooses`,
  `starterChooserPlayerId`) chooses who starts; single_player uses turn order; solo_lab auto-picks.
* `mulligan`: each player may recycle up to 2 of 4 cards (`submit_mulligan`); playback/animations via
  `mulliganPlaybackByPlayerId`; when all done → `in_game` (“Both/All mulligans are complete…”).
* `in_game`: gameplay.

### E2. In-game turn structure

Only **two steps** exist: `activeTurnStep: "beginning" | "main"`.

Turn start (`487939.k`/`70094.k`):
1. Ready everything in `legend, runeArea, base, battlefields` (`_` in 25vik…:9400).
2. `activeTurnPlayerId = player`, `activeTurnStep = "beginning"`, `playerTurnCounts[id]++`,
   clear conquer assist + snapshots.
3. If `stopAtBeginningPhase` → wait for `end_beginning_phase`.
   Else automatically run the beginning:
   * snapshot beginning presence; award **hold points** for battlefields where the player has a unit
     (once per battlefield per turn; blocked by Tianna Crowquard, skipped when `autoScoreFromHold=false`,
     clamped by victory rules);
   * settle `gameOutcome` if chain empty;
   * **channel runes**: 2, or 3 on the player's first turn if they are the last in turn order
     (FFA/2v2 only, `509396.q`) — plus sealed adjustments;
   * **draw**: 1 card (0 if `skipDrawPhase`, or if this player is turn-order-first in FFA/2v2 on their
     first turn — `firstPlayerSkipsFirstDraw`); burned if deck empty;
   * `activeTurnStep = "main"`.

Main: free-form manual play. `end_turn` → `51407.x`: guard `observed`, clear floating resources for
all players, settle outcome, `turnNumber++`, compute next player via `408727.H` (clockwise / alternate
teams; skip players who left; **extra turns** queued from Time Warp are consumed first, remembering
`extraTurnResumePlayerId`), start that player's turn.

### E3. Scoring / victory

* Point sources: **hold** (beginning of turn, unit present; marked once per battlefield per turn via
  `battlefieldScoredThisTurnByPlayer`; blocked by Tianna Crownguard, `320083.C`; disabled per-player by
  `autoScoreFromHold=false`; in 2v2 an ally's beginning-step presence at the battlefield blocks the
  teammate's hold point — `357603.N`, team rule `beginningStepAllyControlBlocksTeamScoring`) and
  **conquer** (conquer-assist confirm → `487939.m`):
  * `alreadyScoredThisTurn` → plain conquer (no reward);
  * else if `canGainPoint` and **not** (`currentPoints ≥ victoryScore − 1` and not-all-battlefields-
    would-be-scored) → `conquer_and_score` (+1 point);
  * else if `currentPoints ≥ victoryScore − 1` and not all battlefields would be scored →
    `conquer_and_draw` (draw 1 card instead of the point — the final point must come from conquering
    the last remaining battlefield);
  * `canGainPoint=false` (Tianna) → plain conquer.
  Algorithm: `856018.h/N` (`14u…:1553-1650`), `91500.s/N` (victoryScore−1, Aspirant's Climb adjusts
  the required score by +1 per copy `91500.N`).
* Victory: entity (player or team) `score >= victoryScore` (8 duel/FFA, 11 teams) **and strictly
  greater than all opponent entities** (`509396.g`), checked at cleanup moments
  (score changes, conquer assist end, hold scoring). Outcome `{winnerPlayerIds, reason:"score",
  decidedAtTurnNumber}`; concession/departure uses `reason:"concession"` (room `matchTermination`
  additionally tracks disconnect/conceded/left for the *match* wrapper).
* bo3: `winsByPlayerId`, `bo3CompletedGames[]`, `pendingGameResult`
  (`{winnerByReporterPlayerId: Record<playerId, winnerPlayerId>}` — both players must report the same
  winner), rematch requests (`rematchRequestedPlayerIds`).

---

## F. Game log

English is canonical: the server emits English sentence text in `gameplayLog[].text`; the client
**parses it back** into `{key, params, selects}` with 188 registrations and re-renders
using the locale catalog (`0aed5y6vhcy22.js`; localizer registration `3lkda0iwi2gi6.js:860-890`;
applied via module 143498). All 188 sentence keys + label/format dictionaries are extracted to
`game-log-en.json` (with `$selects`, pluralization and structured-entry notes). Highlights that reveal
engine events: `rolledDie`, `runeBatch`, `payment`, `conqueredAndScored/AndDrew`, `chainResolved`,
`passedFocusAt`, `endedShowdownResponses`, `dismissedShowdown`, `setExtraTurn`/`canceledTimeWarpTurn`,
`scoredAtTurnStart`, `finalizedMulligan`, `bothMulligansComplete`, `both/AllSideboardsLockedMulligan`,
`competitorWonInitiative`, `choseStarter*`, `departed*`, `rewound`, `restoredTimeline`,
`exhaustedRemovedGainedPower` (gold/Seal helpers), `usedGoldToken`, `madeUnitWithOrianna`,
`addedLegendWithNeeko`, `banishedTopCardWith` (Dockside), `killedToPlayFromBanished`,
`playedFromOpponentTrashWith` (Kharox), `shuffledKeepingRecycled`.

---

## G. Rules helpers present client-side

1. **Variant/rules table** (`1kx2ucot0m321.js:2428-2670`): all variant constants (victory scores,
   battlefield counts/contributors, first-draw skip, extra rune on first channel, team rules),
   turn-order computation (clockwise / alternate teams), entity grouping (player vs team),
   victory check, relationship "self/ally/opponent".
2. **Cost & auto-pay** (`35_5a-hj_uv52.js:1236-1750` e=888811): 
   * cost normalization from card fields or text (`x`, incl. ability-cost lines “costs [n] less if you
     control N or fewer runes”, “costs [n] less for each rune”);
   * plan builder `y`: sources = floating energy/power, gold tokens (`872901.E`),
     “Energy Conduit” cards (`I`, `energyConduitCardActions`), “Seal of …” cards (`x`,
     `powerSealCardActions`), “Honeyfruit” (`y`/`J`, upgrades to power at legendXp ≥ 6), legends whose
     text says “use only to play spells / gear…” (`j`, `powerLegendCardActions`), domain-matched
     rune-area runes (energy runes for energy, recycled runes for power with
     `powerRuneCardIdsGrantingFloatingEnergy`); returns exact card lists + `canAutoPay`;
   * plan → operations `w` (toggle_exhausted / adjust_floating_resource / send_rune_to_deck_bottom /
     recycle_rune_for_floating_energy);
   * cheapest-plan choice across “or” cost options `b`;
   * Risen Altar discount (`S` — battlefield name check, −1 energy or −1 power per requirement);
   * `M` builds the final `payment_batch` (+ `set_card_label "Empowered"` for empower purpose);
     autoPay spec validation `cr.L` (purpose “play” from hand/champion/banished, or “empower” from a
     battlefield/base zone).
3. **Keywords/mechanics helpers** (mostly client-side flags used by engine + UI):
   `Empower` (`558217.L`, regex + name list), `Equip`, `Flow`, `Hidden`, `Quick-Draw`, `Repeat`
   (`558217.x/$/r/y/h`), `Deploy` gear (`J`), “when you play me” (`n`), signature/legend logic
   (`509396.M` etc.), Unique detection for deck rules (`957839.v`), Assault/Tank/Shield/Deflect/
   Ganking/Stunned/Temporary as **labels** (`552379` counted-label set: buff, shield, assault, disarm,
   empowered, deflect; label wheel `25vik…:640-745` presets: buff, disarm, deflect, deathknell, shield,
   stunned, tank, empowered, ganking, assault, temporary; slot cap 3; count suffixes).
4. **Movement/deck/idle helpers** (`375934`, `78176`, `14u`): zone transitions & exhaustion rules,
   shuffle with seed or RNG, deck-peek sessions, recycled-bottom bookkeeping, previous-presence
   snapshots, hidden reveal behaviour.
5. **Conquer/showdown**: `487939` (start/refresh/end assist, stage transitions, scoring/draw,
   auto-chain), `320083` (Tianna blocks hold points), `14u 357603.z` (no-op detection).
6. **Deck construction validation** (`3z6_mkb37q-85.js:1197-1580`): mainDeck+champion = 40, ≤80 main,
   12 runes, exactly 3 battlefields (1 copy per name), ≤10 sideboard, ≤250 total, max 3 copies
   (1 if `[Unique]`), signature cards ≤3 and only for your legend’s subtype, all card domains ⊆ legend
   domains, banned cards per format (Standard, Constructed 2v2), tokens rejected, decklist text format
   (`Legend:/Champion:/MainDeck:/Battlefields:/Runes:/Sideboard:/Additional Legends:`, `N Name [CODE]`,
   ≤20000 chars). Sideboard validation (`924892.k`): same multiset restriction across
   champion+main+sideboard, champion must match legend subtype, sideboard ≤10, “skipped” flow requires
   champion chosen and sideboard unchanged.
7. **Rewind protocol v5** (client classification `35qz…:24460-24900`; UI gating `0xaw…:48020-48080`,
   `55990-56030`):
   * Actions are classified meaningful / incidental / boundary / navigation; only *meaningful*
     actions (gameplay state changes, target arrows being the exception — they are “coordination”
     and only target when they caused realized changes) are rewindable.
   * `rewindablePlayerIds` (those allowed to rewind), `forwardablePlayerIds` +
     `forwardAvailableUntil` (timestamp window) come from the server; in `solo_lab` the controller may
     rewind any rewindable seat.
   * `rewind_last_action {}` branches the timeline to before the actor's last meaningful action. If an
     opponent performed meaningful actions after it, a confirmation request is created
     (`rewind_confirmation_state`: `{requestId, requesterPlayerId, approverPlayerId, approverPlayerIds?,
     opponentMeaningfulActionCount, requestedAt, expiresAt}`); approvers respond with
     `respond_rewind_confirmation {requestId, response:"approve"|"decline"}`, requester may `cancel`.
     On expiry the request is dropped client-side.
   * `forward_last_rewind {}` restores the previous timeline while within `forwardAvailableUntil`.
   * Both produce `authoritative_snapshot` with `action.type` matching (`1w8d…:2900-2960`); client
     resets runtime (branch epoch) and logs “rewound” / “restored timeline”.
   * Rewind availability is not a server-enforced single-use: it is bounded by the server-provided
     id-lists + window + approval.
8. **Action clock** (`229172`): see §B; UI renders per-player totals (`D` formats mm:ss/h:mm:ss).
9. **Sealed helpers** (`613138`, `924892`): sealed pool sections, extra first-turn draw count derived
   from the sealed deck's sections (`c.f(a.deck?.sections)` in `487939.p`), sealed registration validation.

---

## H. Implementation checklist / unknowns

Must-have for a compatible reimplementation:
1. PartyKit-room equivalent: `join_game/resume_game`, `action_intent` → `authoritative_patch_commit`
   (with the 21 op kinds), `authoritative_snapshot`, `room_shell_*`, `presence_*`, `rewind_*`,
   `error`, plus the HTTP room API.
2. Engine transitions exactly as `cU` + modules 487939/70094/51407/408727/888811/107126/662731,
   including clawback cases (merge/compaction of `move_card`→`move_cards_to_trash_batch`,
   `draw_cards` merges, `payment_batch` merges — see `c$`, `cq`, `35qz…:24261-24295` and 30640-30800).
3. Authoritative RNG for dice/initiative/shuffles (client uses seeds only for local previews).
4. Log text generation matching `game-log-en.json` byte-for-byte (client re-parses it!).

Unknowns / need live-browser confirmation or the Riftbound rulebook:
* Exact server validation for manual actions (we only see the client mirror; server may be stricter).
* Whether some “hard-coded card” helpers exist server-side for cards we found only in client code
  (Orianna/Neeko/Dockside/Kharox/Tianna/Risen Altar/Akali) or whether the server additionally
  hard-codes others (cards whose helper we may have missed).
* Auto-pass timers / AFK handling and disconnect-win (`claim_disconnect_win`) server thresholds.
* `matchmakingPool` value set (only `standard|origins|…preRift` names observed) and the search
  endpoint body verbatim (we validated `uj` but the POST target is in the lobby chunk).
* Exact phase advance rules between `sideboarding → battlefield_pick` for bo3 w/ used battlefields
  (`usedBattlefieldsByPlayerId` semantics), and `setupOrderVersion` history.
* The precise conditions for `conquer_and_draw` in multiplayer (algorithm now decoded from
  `856018.h/N` + `91500.s/N`: draw instead of point when score ≥ victoryScore−1 but not all
  battlefields would be scored; verify `allActiveBattlefieldsWouldBeScored` in 3–4 player games).
* Pixel-level log/incidental classification list for rewind (`d9/d7/ce` are complete for batch ops,
  but server may classify a few more actions).
