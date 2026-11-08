# 04 — Realtime & backend contract (play.riftatlas.com)

Evidence: `.recon/pretty/playapp/0cvaqmu9022vp.js` (PartySocket lib + host config + factory),
`35qz5rkx7yexy.js` (room HTTP API, matchmaking client, quick-match party), `1w8d13szpogkp.js` (game realtime runtime, heartbeat, join),
`2i0ajg8a836h8.js` (message schema/validator), `3-2i4k6s343ud.js` (account auth + social transport), `2yy55kmjttle9.js` (auth config),
`0cj_mgo_d57k9.js` (Convex client, URL), `.recon/browser/26-import-solo-network.json` (observed network), `.recon/api/version.play.riftatlas.com.json`.

## 1. Hosts

| service | endpoint | protocol |
|---|---|---|
| Realtime (PartyKit-compatible) | `realtime.riftatlas-workers.com` (`NEXT_PUBLIC_PARTYKIT_HOST`, falls back to hardcoded value) | `wss://…/parties/<party>/<room>?...`, and `https://…/parties/<party>/<room>` for JSON POST |
| Convex (persistent data) | `https://wary-sturgeon-712.convex.cloud` | Convex sync websocket + HTTP `/api/query|mutation|action` |
| Account/auth | issuer `https://clerk.riftatlas.com`; direct origin `https://auth.riftatlas.com`; app endpoints `/api/auth/*` (same-origin fallback) | REST + Clerk (`webOrigin https://riftatlas.com`, `simulatorOrigin https://play.riftatlas.com`) |
| Asset CDN | `https://assets.riftatlas-workers.com` | static |
| Staging variants | `web.staging.riftatlas-workers.com`, `play.staging.riftatlas-workers.com`, `auth.staging.riftatlas-workers.com`, `relieved-colt-39.clerk.accounts.dev` (issuer), Turnstile key `0x4AAAAAAFKIZOMjKbbwrKxK` (prod key `0x4AAAAAAFVVkwULdtgJlYx5`) | |

`NEXT_PUBLIC_PARTYKIT_HOST` resolution: raw host → `{http|https}://host` REST base (`R()` export) and `wss|ws://host/parties/<party>/<room>` for sockets (ws only for localhost/192.168./10./172.16-31).

## 2. PartySocket (vendored lib, `0cvaqmu9022vp.js`)

- URL builder: `protocol://host/parties/<party ?? "main">/<room><?query>`; `room`/`party` must not contain `/`; `id` auto = random UUID (kept for reconnect); `reconnect(code?, delay?)`, buffered message queue, `maxRetries` (default 10), `minReconnectionDelay`, `maxReconnectionDelay`, `reconnectionDelayGrowFactor`, `minUptime`, `connectionTimeout` (default 10s), `startClosed`, `disableNameValidation`, static `fetch()`.
- App factory (`f.b({room,id,host,query,protocols})`): `party` **`"match"`** (constant, `128…→"match"`), `maxRetries: 0`, `connectionTimeout: 10000`. `query` is used for the game socket: `{playerId, roomCode}`.

### 2.1 Socket inventory

| socket | party | room | query | options / lifecycle |
|---|---|---|---|---|
| Game/shell room | `match` | `gameInstanceId` (NOT the room code; roomCode travels in the query) | `?playerId=<id>&roomCode=<CODE>` | maxRetries 0, connectionTimeout 10s; join must be answered in 20s or client closes `4010 "Realtime join was not answered"`; liveness probe: `ping` every 20s idle, 8s timeout → `close(4009, "Realtime liveness probe timed out")` |
| Matchmaking queue | `matchmaking` | queue room name (`enam-v2-…`, §5) | — | id `matchmaking:<uuid>`; minReconnectionDelay 1s, maxReconnectionDelay 3s, growFactor 3, minUptime 0, maxRetries 2; 12s response timeout; 12s connect timeout |
| Quick-match party (pre-queue party/table) | `matchmaking` | `enam-v2-constructed-all-multiplayer` | — | id `party:<uuid>`; minReconnectionDelay 1s, maxReconnectionDelay 10s, growFactor 2, minUptime 0; heartbeat `party_update` every 600s |
| Social/friends | `account` | account friend code (`10-byte SHA-256` derivation, §7) | — | maxReconnectionDelay 15s; `shouldReconnectOnClose: code !== 4014`; on open sends `{type:"auth", token, roomCode}` and re-auths every 45s; focus/online/visibility re-connect + snapshot refresh |

Close codes: `4007` session superseded (server), `4008` counted in close-streak/retry budget, `4009` liveness timeout, `4010` join unanswered, `4014` social terminal (do not reconnect), plus `4001` (superseded), `4004`, `4005` special-cased in the game runtime.

## 3. Auth & guest model

- Token: `POST /api/auth/token` (`/api/auth/*` family: `get-session`, `token`, `sign-in`, `sign-up`, `sign-up-code`, `verify`, `session`, `sessions`, `revoke-other-sessions`, `change-password`, `add-password`, `link`, `unlink-account`, `list-accounts`, `delete-account`, `profile`, `player-name`, `nickname`; POSTs may carry `x-captcha-response` Turnstile header, always `accept-language` from route locale). Direct-origin attempt first (`https://auth.riftatlas.com/api/auth/<x>` with `credentials: include`), on network error retry same-origin with header `x-account-auth-fallback: 1`. Returns `{token}` = JWT (client only base64-decodes the payload; no signature check).
- The JWT is passed **inside realtime messages** as `authToken` (and as `Authorization: Bearer` for social HTTP). It is never a URL query param.
- Room sockets re-auth by `auth_refresh`/`join_*` messages; Convex auth via Clerk/`useAuth` + `setAuth(() => token)`.
- Guest vs signed-in (verified in DOM + catalog): **every play/spectate entry point is gated** — `Find Random Match`, `Host Room`, `Solo Room`, `Join / Spectate` all carry `title="Sign in to play or spectate."` and open the account dialog when signed out; `solo_lab`/`single_player` rooms are created via the same room API with a token, so **guests cannot enter the board at all**. Guests can only browse the lobby, import a local deck, use card browser/customize links, switch locale/theme. (Server-side, room API actions accept a local "bypass" identity only when `NEXT_PUBLIC_TCGATLAS_BROWSER_STAFF_FIXTURE=1`, and solo test rooms are rejected in production: `Solo Test Room is only available outside production.`)

## 4. Room/coordination HTTP API (JSON POST, `content-type: text/plain;charset=UTF-8`)

Base `https://realtime.riftatlas-workers.com`. Client sends `{action, …}`, expects `{ok:true, …}` (`ok:false` + `error`/`message`/`retryable`/`authRecovery` on failure); error `code`s are mapped to typed `RoomApiError {status, code, retryable, authRecovery, continuationRoomCode?}`.

### 4.1 Coordinator (`/parties/coordinator/global-enam-v1`)
`create_room` args: `{operationId (8–128 [A-Za-z0-9:_-]), playerName, playMode: "constructed"|"sealed", matchFormat: "bo1"|"bo3", roomMode?: "solo_lab"|"single_player"|"multiplayer", gameVariant: "duel"|"free_for_all_3"|"free_for_all_4"|"teams_2v2", decklist? (raw text), sealedRegistration?, authToken}`.
Response: `{ok, operationId, roomCode, playerId, controlledPlayerIds?, phase? ("lobby"|"sideboarding"|"battlefield_pick"|"initiative_roll"|"mulligan"|"first_player_choice"|"in_game")}`.

### 4.2 Match room (`/parties/match/<ROOM_CODE>`, code uppercased)
| action | args | response fields |
|---|---|---|
| `join_room` | `roomCode, playerName, playMode, matchFormat, gameVariant?, decklist?, sealedRegistration?, viewerRole?: "player"|"spectator", judgeCallId?, friendCode?, authToken` | `{ok, roomCode, role, playerId?/spectatorName?}` |
| `switch_to_spectator` | room args + authToken | `{ok, roomCode, spectatorName}` |
| `take_seat` | `roomCode, playerId?, seatIndex?, authToken` | `{ok, roomCode, playerId}` |
| `resolve_room_membership` | `roomCode, authToken` (8s timeout) | `{ok, roomCode, role: "player"|"spectator"|"absent", playerId?/playerName?/spectatorName?, playerIds[], redirectedFromRoomCode?}` |
| `create_next_game` / `room_series_action` | room args | BO3 progression |
| `leave_room` | room args (keepalive) | `{ok, seatKept?}` |
| `abandon_match` / `claim_disconnect_win` | room args | |
| `return_to_lobby` | room args | `{ok, roomCode, lobbyRoomCode}` |
| `social_target` | `{playerId}` | `{code}` |
| `broadcast_deck` (from board) | deck payload | |
Codes observed for recovery: `room_advanced` (+`continuationRoomCode`), `room_not_found`, `room_access_denied`, `room_membership_changed`, `create_operation_conflict|expired`, `invalid_operation_id|room_request|json|action`, `unsupported_action`, `auth_service_unavailable`, `auth_token_rejected`.

### 4.3 Matchmaking HTTP (`/parties/matchmaking/<queueRoom>`)
- `cancel_exact` / `reset_exact` with `{searchId, authToken, leaveMatchedRoom?, …}` → `{ok, searchId, status: "cancelled"|"expired"|"matched", roomCode?, playerId?, playerName?, playMode?, matchmakingPool?, matchFormat?}` — doubles as the exact-result poll after a dropped websocket.

## 5. Matchmaking websocket protocol (`party: matchmaking`)

Queue room name = `["enam-v2", playMode, playMode==="constructed" ? "all" : matchmakingPool, gameVariant!=="duel" ? "multiplayer" : matchFormat].join("-")`
→ e.g. `enam-v2-constructed-all-bo1`, `enam-v2-constructed-all-bo3`, `enam-v2-constructed-all-multiplayer`, `enam-v2-sealed-vendetta-prerift-v1-bo1`. Pools: constructed `standard|upcoming|origins` (deck-rule split `standard` vs `unrestricted` is a client registration field); sealed `unleashed-prerift-v1|vendetta-prerift-v1|radiance-prerift-v1|vendetta-sealed` (public sealed only for Vendetta Pre-Rift).

Client → server (JSON strings, `authToken` inside):
```jsonc
{ "type":"start" | "resolve",         // "resolve" when reconnecting to an existing search
  "searchId", "playerName", "playMode", "decklist"?, "sealedRegistration"?,
  "matchmakingPool", "matchFormat",
  "gameVariant"?,                      // omitted for duel
  "extensions"?: ["pools","tables"],   // capabilities
  "party"?: { "id":"party:<uuid>", "round":n, "gameVariant" },  // queue as a team/table
  "authToken" }
{ "type":"ping", "searchId", "sentAt" }   // liveness probe
```
Server → client:
```jsonc
{ "type":"searching", "searchId", "roomCode"?, "playerId"?, "expiresAt", "widenAt", "searchScope",
  "playMode", "matchmakingPool", "matchFormat", "gameVariant"?, "extensions":[…], "availableExtensions":[…],
  "recentOpponentCooldownUntil"?, "recentOpponentRetryAfterMs"? }
{ "type":"matched", "roomCode", "playerId", "playerName", "playMode" }
{ "type":"expired", "expiresAt" } | { "type":"cancelled" }
{ "type":"pong", "searchId", "sentAt" }
{ "type":"error", "code", "message", "retryable"?, "authRecovery"?, "searchId"?,
  "activeSearchId"?, "activeSearchExpiresAt"? }   // conflict recovery
{ "type":"party_state" | "party_closed" | "party_invitation" | "party_invitation_answer", … }  // quick-match party (filtered out of search handling)
```
Error codes: `matchmaking_search_conflict` (another search active — client persists `{activeSearchId, activeSearchExpiresAt, initiatingUserId, playMode, pool, format}` and offers resume), `matchmaking_assignment_expired`, `matchmaking_search_expired`, `cancel_unauthorized|failed`, `invalid_cancel|message` , `matchmaking_result_uncertain`, `invalid_auth_token` (refresh once and resend), `authentication_required`, `authentication_service_unavailable`, `matchmaking_failed`, plus UX messages (`theQuickMatchQueueIsFull`, `matchmakingIsWakingUp`, `matchmakingIsBusy`, `youAreStartingSearchesTooQuickly`…).
Search bookkeeping is persisted in localStorage (attempt + cancellationRequested + activeSearchId) so a reload can `resolve`/`cancel` exactly.

Quick-match party (same socket, room `enam-v2-constructed-all-multiplayer`): client messages `party_join {partyId, playerName, create:{gameVariant}?, authToken}`, `party_update {partyId, ready?, teamKeys?, gameVariant?}`, `party_leave`, `party_start`, `party_stop`; server pushes `party_state` (members, leader, status gathering/searching, table, round) and `party_closed`. URL params `?party=<partyId>&partyFrom=<friendCode>&partyTable=<variant>` auto-join and are stripped from the URL.

## 6. Game/room websocket protocol (`party: match`, room = gameInstanceId)

All frames are JSON strings. Envelope: at least `{type, gameInstanceId}`; join/auth messages add `authToken`, `playerId`, `viewerRole: "player"|"spectator"`, `broadcastView?: true`.

Client → server (validator in `2i0ajg8a836h8.js`, string fields ≤160 unless noted):
| type | fields |
|---|---|
| `join_shell` / `join_game` | `gameInstanceId, playerId?, roomCode, authToken, viewerRole?, broadcastView?` |
| `resume_game` | + `clientSequence?`, `unsettledAction? {clientActionId, actorPlayerId}` |
| `auth_refresh` | `clientRequestId, authToken(≤16384)`; server `auth_session {tokenRemainingMs, clientRequestId?}` |
| `activity_history_request` | `requestId, before: number\|null` → `activity_history_page {requestId, entries[≤50]}` |
| `chat_send` / `chat_sync` / `chat_append` | chat channel + text (room chat, lobby chat) |
| `judge_call_create` / `judge_call_private_create` / `judge_call_close` / `judge_call_sync`, `judge_feedback_submit` / `judge_feedback_result` | judge/community Q&A |
| `player_report_submit` / `player_report_result` | reports (reasons: harassment_abuse, cheating_exploiting, stalling_disruption, inappropriate_identity, other) |
| `room_shell_action` | `{action:{type:…}, actorPlayerId?, clientActionId?}` → `room_shell_action_ack {actionType, sequence, clientActionId?}` |
| `presence_update` | `hoveredCardId/hoveredAt, pingedCardId/pingedAt, pingIntent? ("general"|"trigger_ability"|"discard_target"), emoteId?/emoteAt, chatTyping?` |
| `action_intent` | `{action:{type:…}, actorPlayerId?, clientActionId?, clientBaseSequence}` (138 gameplay action types, see `api/game-action-types.txt`) |
| `ping` | `{sentAt}` |
| `customization_refresh` | `gameInstanceId` only |
| `spectator_view_grant_update` | spectator visibility grants → `spectator_view_grant_ack` |
| `claim_disconnect_win`-adjacent and rewind: `rewind_confirmation_state` handling; gameplay errors return `gameplay_action_noop_ack` for already-applied actions |
Server → client: `room_shell_sync {sessionDoc|null, sequence, gameplayRuntimeReset?}`, `authoritative_snapshot`, `authoritative_patch_commit`, `authoritative_resume_ack {sequence}`, `spectator_roster_sync {spectators[] {authSubject, displayName, joinedAt, updatedAt, grantedPrivatePlayerIds[]}}`, `presence_event`, `board_emote`, `card_ping`, `chat_message`/`chat_sync`, judge/report results, `customization_refresh` echoes, `pong`, `error {code, message, retryable?, authReason?, authRecovery?, mutationClass?, requestId?, authoritativeSequence?}`.
Server error codes seen: `room_not_found`, `runtime_persistence_failed` (with `mutationClass: reject_invalid|reject_retryable|resync_required`), `control_superseded` (another connection took the seat), `stale_action_state`, `activity_history_seated`, `connection_reauthorization_required`, `player_not_registered`, `seat_control_denied`, `spectator_session_denied`, `auth_service_unavailable`, `auth_token_rejected`. `authReason` ∈ {missing, not_configured, malformed_token, unsupported_token, invalid_claims, invalid_authorized_party, pending_session, expired_token, token_not_active, unknown_key, invalid_signature, verification_failed, token_provider_unavailable, token_provider_timeout}; `authRecovery` ∈ {retry_verification, refresh_token, reauthenticate} (mapped client-side to `realtimeCode: auth_required|auth_token_rejected|auth_service_unavailable` + `realtimeRetryable`).
Client-side reliability: single in-flight action (`clientActionId` + `clientBaseSequence`); ack timeout → `GameplayActionOutcomeUnknownError`; stale-state (`$` class) rejects with `retryReady`; rewind/fwd replay via `authoritative_snapshot` with kind `rewind|forward|snapshot`; metrics counters (reconnects, resyncs, ackTimeouts, heartbeatTimeouts, droppedActionQueues, snapshotCanceledIntents, lastRoundTripMs).

## 7. Social/friends transport (party `account`)

- Room = friend code: `SHA-256("riftatlas-social:" + accountKey)` first 10 bytes hex-uppercased → `/^[A-F0-9]{20}$/`. Users share this "friend code"; validation `Enter a valid 20-character friend code.`
- Socket messages: client `{type:"auth", token, roomCode}` (re-sent every 45s); server `ready`, `contact`, `invitation`, `invitation_removed`, `message {peer, message}`, `deck_post`, `invitation_response`; unknown → full snapshot refresh.
- HTTP POST `/parties/account/<CODE>` with `Authorization: Bearer <token>`: actions `snapshot {name?, playerName?, refreshMemberships?}`, `presence`, `identity {code}`, `request {code}` (friend request by code), `invite {roomCode, friendCode?, gameVariant?}`, `send {code, clientId, text}` (chat), `history {code, before}`, `read {code}`, `report {code, reason, evidence}`, `nickname {code, nickname}`, `respond_invite {invitationId, accept}`, `dismiss_invite {invitationId, forAll?}`, (room-scoped) `social_target` on `/parties/match/<code>`. Errors: `profile_required`, `too_many_friends`, `too_many_requests`, `rate_limited`, `request_unavailable`, `self_code`, `already_friends`, `already_requested`, `friendsLimit`… (all in `sim.social.*`).
- Friend presence also feeds the board UI ("friends" rail), invites (`invite as player/spectator`), replay/deck/replay-pool shares.

## 8. Convex contract

- Client: `ConvexReactClient("https://wary-sturgeon-712.convex.cloud")` + `ConvexProviderWithAuth` (Clerk/`useAuth`); every user-scoped query passes a boolean "skip" argument (`useQuery(ref, enabled)`); guests skip all.
- Function references are produced by Convex's `anyApi` **Proxy** (property chains), so names only exist at runtime; the discoveries below were recovered from inlined property chains in the bundles (`<api>.f.<module>.<fn>`):
  - `simulatorViewer:getSnapshot` (query, arg = enabled boolean) — returns viewer snapshot: `unseenBadgeUnlocks`, `effectiveCustomization` (playmat/sleeves/board line/points rail/emotes/token art), `membership {tier, tierTenure, …}`, profile/name state, saved-library summaries, etc. This one query powers most of the lobby sidebar/account UI.
  - `savedDecks:` `listSavedDeckSummaries`, `resolveSavedDeckForPlay`, `resolveSavedDeckForPlayFresh`, `createSavedDeck`, `renameSavedDeck`, `deleteSavedDeck`
  - `sealedDrafts:` `listSealedDraftSummaryPage`, `resolveSealedDraftForPlay`
  - `gameHistory:` `list`, `decks`, `remove`, `undoRemove`, `setDeckPrivacy`, `updateResult`, `extendReplayAccess {gameId}`
  - `communityDecks:` `listPublishedDeckPage`, `getPublishedDeckCodeFirst`, `getPublishedDeckViewerStates`, `getViewerLastPublicAuthorName`, `clonePublishedDeck`, `publishSavedDeck`, `unpublishSavedDeck`, `togglePublishedDeckLike`
  - `metafy:` `getMembershipStatus`, `acknowledgeBadgeUnlocks`
  - `feedback:` `submit`, `dismiss`, `submitBugReport`, `getBugReportDiscordDelivery`, `trackAdClick`
  - `judges:getRecentAnswerWait`; `playerReports:acknowledgeMyWarning`; `pricingCache:getCardPricing`; `clientSessionReports:submitAbruptEnd`
  - Site tree additionally uses community deck APIs (`communityDecks:listPublishedDeckPage` shared) — full site-side list in the site spec.
  → 35 function names recovered (`ui`-session list in `/tmp/opencode/convex-fns.txt` during recon; re-derivable with `grep -rhoE '<api-var>\.f\.<mod>\.<fn>'`); treat as a lower bound (any proxy chain not inlined statically is invisible, e.g. parts of friends which run on the social transport instead).
- Convex is used for *persistence* (decks library, game history, community decks, badges/membership, feedback), while **realtime gameplay is fully server-authoritative over PartyKit**. Replays also come from the realtime host: `GET https://realtime.riftatlas-workers.com/api/replays/<replayId>/metadata` + frames download with `authorization: Bearer` (`accept: application/vnd.riftatlas.replay+json;version=2`).

## 9. Self-hosted replacement plan (minimum to make the client fully work)

The client is server-authoritative: to make it *functionally* work you must reimplement (a) the HTTP room API, (b) three websocket parties (`match`, `matchmaking`, `account`), (c) the rules engine that turns `action_intent`s into `authoritative_snapshot`/`patch_commit`, and (d) the persistent store the client expects (Convex or a shim).

**9.1 Server skeleton** — PartyKit-compatible deploy (or any ws server matching `wss://host/parties/<party>/<room>?...`):
- `GET /parties/*` → 426 upgrade required; `POST /parties/<party>/<room>` → JSON action handler (all POSTs above).
- `parties/match/<gameInstanceId>`: keeps a room instance keyed by gameInstanceId; `join_shell`/`join_game`/`resume_game` bind a connection to a seat after validating `authToken` (your own JWT or HMAC token) against the room's `{roomCode, playerId, seat}`; `ping`→`pong`; forwards `presence_update`, chat, judge/report; gameplay `action_intent` → engine → `authoritative_snapshot`/`authoritative_patch_commit` broadcast with monotonically increasing `sequence`; `room_shell_sync` for lobby state; on reconnect sends `authoritative_resume_ack` + snapshot; enforces single-connection-per-seat (`control_superseded`) and close codes 4007/4009/4010 semantics.
- `parties/matchmaking/<queueRoom>`: parse `enam-v2-<mode>-<pool>-<format|multiplayer>`; per-queue matchmaking loop pairs compatible searches (searchScope widening, opponent cooldown), allocates a room by calling the coordinator, replies `searching`/`matched`/`expired`/`error`; support exact `cancel`/`resolve` via ack + HTTP `cancel_exact|reset_exact`; support `extensions:["pools","tables"]` and party (team/table) searches (room `enam-v2-constructed-all-multiplayer` carries `party_*`).
- `parties/account/<friendCode>`: socket + HTTP for friends/chat/invites (§7) with the same action names and message types; tokens via Bearer/`auth` message.
- `parties/coordinator/global-enam-v1` (`create_room`) allocates `roomCode` (input placeholder `AB12CD`, client maxlength 10, always uppercased; treat as opaque ≤10 alnum) + `gameInstanceId`, writes the initial `sessionDoc`.

**9.2 Persistent data (Convex shim)** — implement the 35 functions above with matching names (`module:function`) and arg shapes: `simulatorViewer:getSnapshot(enabled)`, `savedDecks:*` (raw decklist + revision + legalityVersion + status + privacy), `sealedDrafts:*` (seeded pool + build selections), `gameHistory:*` (match records + per-deck privacy + results), `communityDecks:*`, `metafy:*`, `feedback:*`, `judges/pricingCache/clientSessionReports`. If you keep Convex, point `NEXT_PUBLIC_CONVEX_URL` at your deployment; otherwise ship a compatible HTTP/ws endpoint (client posts to `/api/query|mutation|action` and syncs over `/api/sync`).

**9.3 Rules engine** — 138 action types (`api/game-action-types.txt`) grouped into: setup (`roll_initiative`, `choose_first_player`, `select_battlefield`, `submit_mulligan`, `submit_deck`, `submit_sealed_draft`, `submit_sideboard`), turn flow (`end_turn`, `draw_rune`, `channel_rune_deck`, `recycle_rune_for_floating_energy`…), board ops (`move_card`, `move_cards_to_trash_batch`, `create_token`, `equip_card`, `adjust_might`, `adjust_score`, `score_conquer`, `battlefield_conquer_confirm|dismiss|pass_focus|pass_response`), chain/showdown (`chain_add|resolve|set_repeat|set_flow|set_resolve_vote`), dice (`roll_die`), rewind (`rewind_last_action`, `forward_last_rewind`, `respond_rewind_confirmation`), plus `chat`. Phases: `lobby → sideboarding → battlefield_pick → initiative_roll → first_player_choice → mulligan → in_game`. Auto-pay and drag/drop are client intents that must be validated server-side (client error classes: gameplay_action_pending, stale_state, forward_unavailable, transport_unavailable, outcome_unknown, auto_pay_unavailable).

**9.4 Minimum viable demo order**: 1) `/api/auth/token` stub issuing a JWT; 2) coordinator create_room + match room join_shell/join_game + room_shell_sync so the lobby renders; 3) solo_lab engine (move/untap/score primitives) to render the board; 4) quick match loop; 5) social party; 6) Convex shim for decks/history. Asset/CDN paths can stay static (see asset manifest).

**9.5 Client config knobs for self-hosting**: `NEXT_PUBLIC_PARTYKIT_HOST` (defaults hardcoded to `realtime.riftatlas-workers.com`), Convex URL (hardcoded in bundle `32792`), Clerk issuer/direct-origin + Turnstile keys (validated against allow-lists — `auth*.riftatlas.com` regex, `NEXT_PUBLIC_ACCOUNT_AUTH_*` envs), `NEXT_PUBLIC_TCGATLAS_BROWSER_STAFF_FIXTURE` (dev bypass identity), staging flags. Version probe `GET /api/version` returns `{version, build}` (currently `ed4138aab7e3…`, build date 2026-10-19).
