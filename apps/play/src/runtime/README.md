# `apps/play/src/runtime` — play client runtime (task B11)

Framework-light TypeScript runtime for the play simulator: config, guest auth, HTTP room API,
PartySocket match connection, external stores, optimistic intents, matchmaking, settings, sounds
and a thin React hooks layer.

Import everything from `@/runtime` (`apps/play/src/runtime/index.ts`). Do not import the individual
modules from UI code except for type-only imports.

> Fidelity note: every wire string, localStorage key, timing, close code and error name below is
> ported from the original bundles (`.recon/pretty/playapp/1w8d13szpogkp.js`, `35qz5rkx7yexy.js`,
> `0cvaqmu9022vp.js`, `2goht72gp0rq8.js`, `2i0ajg8a836h8.js`). When in doubt, the bundle wins —
> see the header comment of each module for the exact source ranges.

---

## Quick start (integrator)

```ts
import {
  createRoom,
  joinRoom,
  newOperationId,
  getAuthToken,
  MatchRuntime,
  MatchmakingClient,
  matchmakingQueueRoom,
  settingsStore,
  soundEngine,
  deriveActionSound,
} from "@/runtime";

// 1. guest token (persisted in localStorage; POST {realtime}/api/auth/token)
const token = await getAuthToken();

// 2. host a room (coordinator) then join (match room) — exact request/response shapes
const created = await createRoom({
  operationId: newOperationId(),
  playerName: "Kai",
  playMode: "constructed",
  matchFormat: "bo1",
  gameMode: undefined,
  gameVariant: "duel",
  decklist,
  authToken: token,
});
const joined = await joinRoom({
  roomCode: created.roomCode,
  playerName: "Kai",
  playMode: "constructed",
  matchFormat: "bo1",
  decklist,
  authToken: token,
});

// 3. realtime gameplay runtime (party "match", room = gameInstanceId)
const runtime = new MatchRuntime({
  session: {
    roomCode: joined.roomCode,
    playerId: joined.playerId!,
    playerName: "Kai",
    viewerRole: "player",
    playMode: "constructed",
    deckRulesMode: "standard",
  },
  realtimeSession: { gameInstanceId },
});
runtime.start();
```

`gameInstanceId` comes from the room shell (`room_shell_sync.sessionDoc` → the runtime’s
`roomShellSessionDoc`) or from the room membership resolution; the socket room is the instance id,
the room code travels in the query string (`?playerId&roomCode`) exactly like the original.

## Hooks (UI layer)

| hook                                          | returns                                                                                                                                      |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `useIdentity()`                               | `{ identity: {subject, name, kind}, hasToken, loading, error, ensureToken(opts?), setDisplayName(name) }` — fetches/persists the guest token |
| `usePlayerName()`                             | `[name, setName]` (localStorage `riftbound_simulator_player_name`)                                                                           |
| `useMatchRuntime(input \| null)`              | creates + starts a `MatchRuntime` for a session, disposes on unmount                                                                         |
| `useRoomShell(runtime)`                       | `{ sessionDoc, sequence, phase }` from `room_shell_sync`                                                                                     |
| `useGameState(runtime, selector, isEqual?)`   | selected slice of the projected room (optimistic while an intent is pending, else authoritative)                                             |
| `useConnectionStatus(runtime)`                | `{ connectionState, sessionPhase, connectionStalled, connectionRecovery, lastError, retryConnection, reconnectNow }`                         |
| `useDispatchIntent(runtime)`                  | `dispatch(action, actorPlayerId?, {clientActionId?, onCommit?}) => Promise<"committed" \| "noop">` (+ `.pending`)                            |
| `useDispatchShellAction(runtime)`             | `(action, actorPlayerId?) => Promise<void>` for lobby/setup `room_shell_action`s                                                             |
| `useChat(runtime)`                            | `{ entries, canSend, authorId, send(text, clientEntryId?, judgeCallId?), publishTyping(bool), spectatorRoster }`                             |
| `usePresence(runtime)`                        | `{ hoveredCardIdByPlayerId, cardPingByPlayerId, boardEmoteByPlayerId, chatTypingByPlayerId }`                                                |
| `useMatchmaking(client)`                      | `{ status, search, error, lastError, start(attempt, {resume?}), cancel(), stop() }`                                                          |
| `useSettings()`                               | `{ sfxVolume, setSfxVolume, playMode, setPlayMode, playerName, setPlayerName, volumeScale }`                                                 |
| `useStoreSelector(store, selector, isEqual?)` | generic `useSyncExternalStore` subscription for any runtime store                                                                            |

Store shapes:

```ts
// MatchRuntimeState (runtime.store)
{
  connectionState: "idle" | "connecting" | "open" | "closed" | "error";
  sessionPhase: "disconnected" | "connecting_shell" | "joining_gameplay" | "resyncing"
              | "live" | "bootstrap_required" | "superseded";
  mutationPhase: "idle" | "pending";
  authoritativeProjectedRoom: Room | null;   // authoritative gameplay room
  optimisticRoom: Room | null;               // authoritative + pending intent (when any)
  pendingIntent: { clientActionId, action, actorPlayerId, clientBaseSequence, branchEpoch } | null;
  authoritativeSequence: number | null;
  roomShellSessionDoc: RoomSessionDoc | null; roomShellSequence: number | null;
  matchLogEntries: GameplayLogEntry[];       // same array as the room's log (patched)
  actionClockSnapshot: ActionClock | null;   // hydrated with receivedAt
  lastAuthoritativeReset / lastAuthoritativeHistoryNavigation: rewind/forward tokens
  rewindConfirmation, spectatorRoster, chatEntries, chatAccess,
  connectedPlayerIds, presenceStatusByPlayerId, lastError, connectionStalled,
  connectionRecovery: "none" | "retry" | "unavailable",
  gameplayReady / gameplayTransportReady / gameplayMutationBlocked / gameplayActionPending,
  recoveredCommittedClientActionIds, unsettledClientActionId,
}
```

The board should render `optimisticRoom ?? authoritativeProjectedRoom` and use
`gameplayTransportReady` / `gameplayMutationBlocked` for affordance gating, mirroring the original
(`cY` optimistic projection + `eh` readiness check).

## Sounds

```ts
import {
  soundEngine,
  deriveActionSound,
  deriveTurnStartSound,
  deriveBaronPitSound,
} from "@/runtime";

soundEngine.preloadAll(); // after first user gesture is fine (autoplay unlock)
const key = deriveActionSound(action, { actorPlayerId, boardBefore, roomBefore, victoryScore });
if (key) soundEngine.play(key);
const turnKey = deriveTurnStartSound(prevRoom, nextRoom); // turn_start | time_warp
```

- files: `sounds/20260716/<name>.webm` under `NEXT_PUBLIC_STATIC_ASSET_BASE`
  (default `/riftbound/static`, i.e. `apps/play/public/riftbound/static/sounds/20260716/…`)
- volume: `localStorage["riftbound_simulator_sfx_volume:v2"]` 0–200 (steps of 5, default 100,
  v1 squared-value migration), `soundEngine.play(key, { cooldownMs, cooldownKey, volumeScale })`
- exact per-key gains/cooldowns/variants: `SOUND_CATALOG`

## Config

| env                                      | default             | meaning                                                                                                                                                                              |
| ---------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_REALTIME_HOST`              | `localhost:1999`    | realtime host (ws/http scheme auto: `ws` for localhost/private ranges, else `wss`)                                                                                                   |
| `NEXT_PUBLIC_AUTH_BASE`                  | realtime HTTP base  | base for `POST /api/auth/token`                                                                                                                                                      |
| `NEXT_PUBLIC_STATIC_ASSET_BASE`          | `/riftbound/static` | static UI asset base (sounds etc.)                                                                                                                                                   |
| `NEXT_PUBLIC_ACCOUNT_AUTH_DIRECT_ORIGIN` | unset               | optional direct auth origin (original `https://auth.riftatlas.com`); when set, tried first with `credentials: "include"`, falling back same-origin with `x-account-auth-fallback: 1` |

## HTTP room API (`roomApi.ts`)

All POSTs are `content-type: text/plain;charset=UTF-8`, 12s timeout (membership resolution 8s),
and throw `RoomApiError { status, code, retryable, authRecovery?, continuationRoomCode? }` with the
original error strings/codes (`room_api_request_timeout`, `room_api_unreachable`,
`invalid_room_api_response`, …).

- `createRoom(...)` → `/parties/coordinator/global-enam-v1` `create_room`
- `joinRoom / switchToSpectator / takeSeat / resolveRoomMembership / createNextGame /
roomSeriesAction / leaveRoom / abandonMatch / claimDisconnectWin / returnToLobby / socialTarget`
  → `/parties/match/<CODE>` (room codes uppercased)
- `matchmakingCancelExact(...)` → `/parties/matchmaking/<queueRoom>` `cancel_exact` / `reset_exact`
- helpers: `newOperationId()`, `isValidOperationId`, `matchmakingQueueRoom`, `isConstructedMatchmakingPool`

## Match connection (`matchRuntime.ts`)

- party `"match"`, room `gameInstanceId`, query `{playerId, roomCode}`, `maxRetries: 0`,
  `connectionTimeout: 10000`
- join: `join_shell` → `room_shell_sync`; when the phase is active gameplay
  (`sideboarding|battlefield_pick|initiative_roll|first_player_choice|mulligan|in_game`) →
  `join_game`, and `resume_game` with `clientSequence` + `unsettledAction` on reconnect/resync
- join answer must arrive within 20s or the client closes `4010 "Realtime join was not answered"`
- liveness: `ping` after 20s idle, 8s timeout → `close(4009, "Realtime liveness probe timed out")`
- close codes: `4001`/`control_superseded` → `sessionPhase: "superseded"` (no reconnect);
  `4004`/`4007` (spectator/broadcast) → startup recovery; `4007` → skip token cache;
  `4008` → counted close streak (3 closes within 30s → terminal "This room is unavailable…");
  `4009` → outcome-unknown for the in-flight gameplay action; `4010` → join timeout;
  `4014` → terminal (no reconnect)
- reconnection backoff `min(15000, 1000·2^(n-1)) + floor(250·random)`, startup retries at 1s up to
  5 attempts; stalled after 3 failures spanning 15s (`connectionStalled`, `connectionRecovery`)
- authoritative sequencing: `authoritative_snapshot` (accept if `sequence >= current` or a resync
  was requested), `authoritative_patch_commit` (requires `baseSequence === current && sequence ===
current + 1`, applied atomically via `@rift/sync` adapter with the local reference port), any
  failure → `resume_game` resync; a patch that changes rune pool sizes is rejected client-side
  (`RUNE_COUNT_CHANGED_MESSAGE`)
- gameplay actions: single in-flight `action_intent` with `clientActionId` + `clientBaseSequence`,
  5s ack timeout with up to 2 resends, then `GameplayActionOutcomeUnknownError` + resync; shell
  actions 8s; `GameplayActionPendingError`, `GameplayActionStaleStateError` (with `retryReady`),
  `GameplayTransportUnavailableError`, `GameplayForwardUnavailableError`, `AutoPayUnavailableError`
- optimistic intents: action types in `OPTIMISTIC_ACTIONS` are applied locally through the engine
  adapter while pending; the authoritative patch/snapshot always wins (rollback = drop intent)

## Matchmaking (`matchmaking.ts`)

- queue room `enam-v2-<playMode>-<pool|all>-<format|multiplayer>`; socket party `"matchmaking"`,
  id `matchmaking:<uuid>`, `minReconnectionDelay 1000`, `maxReconnectionDelay 3000`,
  `reconnectionDelayGrowFactor 3`, `minUptime 0`, `maxRetries 2`; 12s connect/response timeouts
- client `start`/`resolve`/`ping` messages and server `searching|matched|expired|cancelled|pong|error`
  handling with statuses `idle|preparing|connecting|searching|reconnecting|cancelling|matched|
expired|conflict|disconnected`
- persisted bookkeeping: `riftbound_matchmaking_search_continuation_v1` (attempt +
  `cancellationRequested`, 1.3h TTL) and `riftbound_matchmaking_conflict_recovery_v1`
  (`matchmaking_search_conflict`)
- HTTP fallback `cancel_exact`/`reset_exact` (also the exact-result poll after a dropped socket)

## Adapters (concurrent packages)

`adapters/sync.ts` and `adapters/engine.ts` are the only places the runtime touches
`@rift/sync` / `@rift/engine`:

- sync: if `@rift/sync` exports `applyRuntimePatch` / `runeCountsPreserved` /
  `runeMultisetsPreserved` / `isHistoryNavigationAction` / `resetToken` they are used, otherwise the
  local reference ports in `patch.ts` are used. **TODO(B11→sync owner): verify signature parity.**
- engine: `applyGameActionOptimistic` calls `@rift/engine`'s `applyGameAction`; until that export
  exists the optimistic apply returns `{ ok: false, error: ENGINE_NOT_READY }` and the runtime
  simply waits for the authoritative patch (no broken local state). **TODO(B11→engine owner):
  confirm `state` is the projected `Room` and that the `sound` field uses the `SOUND_CATALOG` keys.**

## Deviations from the original (documented)

- **Auth refresh queue**: the original buffers outbound frames while `auth_session` says the token
  is within 60s of expiry and replays them after an `auth_refresh` handshake. The clone fetches a
  fresh token before every join/resume and otherwise ignores `auth_session` (the self-hosted worker
  issues long-lived dev JWTs). Behaviour visible to the server: identical join/resume frames.
- **4014**: the social transport documents 4014 as terminal (`shouldReconnectOnClose: code !==
4014`); the gameplay runtime does not special-case it in the original. Task B11 requires handling
  it, so the clone treats 4014 as terminal (error state, no reconnect) for the match socket too.
- **Optimistic apply**: when `@rift/engine` is unavailable, intents that the original would apply
  locally simply wait for the authoritative patch; no local state is fabricated.
- **Rewind classifier**: the full meaningful/incidental/boundary classification (`c9`/`cJ`) lives in
  the engine/sync work; the runtime only records rewind/forward reset tokens for the UI burst
  animation (`lastAuthoritativeHistoryNavigation`).
- **Counters/metrics**: `MatchRuntime.metrics()` exposes the useful subset (reconnects, startup
  attempts, close streak, last sequence, pending kind) rather than the original module-level metric
  object.

## Tests

`__tests__/*.test.mts` (excluded from `tsc` via the `.mts` extension because apps/play has no
vitest dependency — the workspace rule forbids adding one):

```bash
pnpm --filter play typecheck
cd apps/play/src/runtime && node <repo-root>/node_modules/.pnpm/vitest@<version>/node_modules/vitest/vitest.mjs run
```

Covered: patch apply (all op kinds + errors), rune conservation, authoritative decision
(snapshot/patch/noop/gap/rune rejection/invalid), server-error outcomes, message parsing/auth
mapping, liveness probe timings, close-code constants, matchmaking queue names + protocol walk,
presence reducer, settings keys/migration, sound catalog gains/cooldowns/muting, `deriveActionSound`
trigger table.
