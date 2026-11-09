# Strict rewind / forward, determinism and repro (R5)

Owner: strict rewind lane. The owner request: **"Have a way to rewind so we can replay exact
interaction to test again."** This document covers the design, the behaviour contract, the
randomness audit, the repro file format and the commands.

## 1. Design choice: exact snapshots, not log replay

The engine already has a protocol-v5 rewind timeline (`packages/engine/src/rules/rewind.ts`):
every meaningful action stores a **complete deep clone of the `Room` immediately before it**
(`EngineTimelineEntry.before`). That snapshot already contains `Room.rules` — chain, prompts,
priority/focus, showdown/combat, stored battlefield control, hidden records, per-turn records,
pools, tasks, triggers, effects — as well as the board, log and the seeded RNG cursor.

Strict rewind therefore **reuses the existing snapshot timeline** and only fixes its two gaps:

1. `rules_*` intents (and gestures translated to them) were not recorded at all;
2. strict bot rooms were rejected by the rewind gate.

A snapshot restore is exact by construction. `restoreRulesState` (which rebuilds only turn fields
from the board) is **not** used: it is known to drop chain/control/combat/prompt state. A log +
deterministic replay would also work, but it would need every intermediate decision (prompts,
payment plans, bot picks) in the log and would still have to replay the whole game to reach a
rewind point; the existing timeline already has the exact snapshot, so snapshots are the cleaner
fit and need no new recomputation semantics.

Strict bot/solo history starts once `Room.rules` is live (setup is part of the initial snapshot)
and records **every changed action**, including incidental ones such as dice/arrows, so a repro
can replay them. Rewind targets still only meaningful actions. Human-vs-human strict rooms record
nothing.

`EngineTimelineEntry.action` (additive) stores the accepted payload so the same snapshots can also
produce a repro file. The timeline remains server-only and is never placed on `Room` or sent to
clients.

## 2. Memory bound

| Room | Bound | Notes |
| --- | ---: | --- |
| Sandbox | `MAX_REWIND_ENTRIES = 4096` | unchanged |
| Strict | `MAX_STRICT_REWIND_ENTRIES = 256` | strict snapshots carry `Room.rules`, so they are much heavier; 256 meaningful actions still covers a long practice game |

When the cap is exceeded the oldest entries are dropped. A repro exported after pruning is marked
`truncated: true` and starts at the earliest retained snapshot. Durable Object persistence keeps
each snapshot in its own chunked key (`TimelinePersistence`), so a long game does not create one
oversized storage value.

## 3. Rewind behaviour rules

- **Allowed:** sandbox rooms (unchanged), strict `solo_lab`, and strict rooms with an active
  `isBot` seat (Practice vs Bot). `rewindAllowedForRoom` is the single gate used by the engine and
  the client visibility helper.
- **Rejected:** strict human-vs-human multiplayer rooms return `strict_mode_action`. No strict
  history is recorded there, so no memory is spent.
- **Target:** `rewind_last_action` targets the actor's last **meaningful** recorded action (the
  same protocol-v5 `c9` semantics as sandbox). In a bot room that is the human's last action;
  bot actions after it are discarded.
- **Forward:** `forward_last_rewind` restores the pre-rewind room for the same actor until the
  5-minute forward window closes (unchanged).
- **Bot pause:** a live rewind sets `Room.botPause = true`. The server does not wake the bot until
  the human submits the next accepted action (which clears the flag). This prevents the bot from
  instantly replaying the turn the human just rewound. The flag is part of the room snapshot and
  survives a Durable Object restart. A repro import at an arbitrary step does **not** set it, so
  if the chosen step is a bot decision the bot may act immediately.
- **Toast:** the rewind/forward log entry plus `Room.rewindStep` drive the client notice
  “Rewound to turn N, step M” (step = 1-based timeline action index). A later meaningful action
  clears `rewindStep`.
- **Sandbox:** byte-for-byte unchanged (`rewindStep`/`botPause` are only set for strict rooms; the
  existing confirmation flow is untouched).

## 4. Randomness audit (strict bot rooms)

Every random source in a strict bot room is now seeded from state. `Room.rngSeed` is derived from
`roomCode|createdAt`; `Room.rngCursor` is the next draw position; both are stored on the room and
therefore in every rewind snapshot. `applyGameAction` overrides `ActionContext.rng` with
`createStrictRandom(rngSeed, rngCursor)` and writes the advanced cursor back on every accepted
action. `packages/rules/src` stays pure (no `Math.random`/`Date`).

| Source | File:line | Seeding |
| --- | --- | --- |
| Deck/rune shuffles at game start | `packages/engine/src/state/init.ts:244-266` | `config.rngSeed` → `createStrictRandom(seed, 0)` |
| Board deck shuffles | `packages/engine/src/actions/setup.ts:75-77` | `context.rng` (room-seeded override) |
| Lobby/deck shuffles | `packages/engine/src/actions/lobby.ts:60,122,190` | `context.rng` (room-seeded override) |
| Random battlefield / initiative / first player / recycled cards | `packages/engine/src/actions/setup.ts:376,411,555,633,679` | `context.rng` (room-seeded override) |
| Movement shuffle / recycle / shuffle-deck | `packages/engine/src/actions/movement.ts:147,440-447,487,517` | `context.rng` (room-seeded override) |
| Dice / cosmetic rolls | `packages/engine/src/actions/dice.ts:16` | `context.rng` (room-seeded override) |
| Rules host shuffle | `packages/engine/src/strict/host.ts:409,424-428,555` | `RulesContext.rng` → `context.rng` |
| Effect `shuffle` op | `packages/rules/src/effects/ops/look.ts:75-81` | `host.shuffle` → `RulesContext.rng` |
| Effect recycle Fisher-Yates | `packages/rules/src/effects/ops/recycle.ts:58` | `host.rng` → `RulesContext.rng` |
| New object ids | `packages/engine/src/state/ids.ts:10-18` | `makeIdFactory(ctx)` → `ctx.rng` |
| Bot action picker | `packages/engine/src/strict/bot.ts` + `packages/engine/src/strict/rng.ts` | `mulberry32(hash(rngSeed, actionCount))`; action index is stored on the room |
| Deck-peek shuffle | `packages/engine/src/actions/deckPeek.ts:151` | already deterministic `seedKey` (not RNG) |
| Server clock fallback | `apps/realtime/src/parties.ts:95` | only used by sandbox/unseeded strict rooms; bot/solo rooms never reach it |

Repeating the same human action from a rewound snapshot restores `rngSeed`, `rngCursor` and
`actionCount`, so the bot picker asks the same question and the rules engine draws the same
numbers.

## 5. Repro file format (version 1)

```jsonc
{
  "format": "rift-strict-repro",
  "version": 1,
  "exportedAt": 1760000000000,
  "roomCode": "BOT123",
  "rulesMode": "strict",
  "roomMode": "multiplayer",
  "gameSeed": 1592594228,
  "initial": { /* complete Room snapshot before actions[0], incl. rules + rng cursor */ },
  "initialHash": "1a2b3c4d",
  "decklists": { "alice": "Legend:\n…", "bot": "Legend:\n…" },
  "actions": [
    { "index": 0, "at": 1760000000000, "actorId": "alice", "action": { "type": "rules_end_turn" } },
    { "index": 1, "at": 1760000000001, "actorId": "bot", "action": { "type": "rules_play", "...": "..." } }
  ],
  "stepHashes": ["1a2b3c4d", "5e6f7a8b"],
  "finalHash": "5e6f7a8b",
  "finalActionCount": 2,
  "truncated": false
}
```

- `initial` is the full pre-action `Room`; decklists are also copied for readability.
- `actions` includes bot actions (actor + exact payload).
- `stepHashes[i]` is the canonical room hash after action `i`; the replay harness reports the
  first divergent step, not just a final mismatch.
- The canonical hash ignores rewind presentation metadata (`updatedAt`, forward window,
  `rewindStep`, `botPause`, log ids and “Rewound”/“Forwarded” log rows), so a branch created after
  a rewind is still replayable. Rules, board, hidden records, RNG position and action logs are
  covered.

## 6. Commands

```bash
# Export from the UI (Practice vs Bot / solo_lab): the download icon in the room action bar.

# Replay a file through the real engine (fails on the first rejection/hash mismatch):
pnpm --filter @rift/engine replay path/to/rift-repro-BOT123-step-42.json
```

Test helper:

```ts
import { createStrictRepro, replayStrictRepro } from "@rift/engine";
const repro = createStrictRepro(room, timeline);
const result = replayStrictRepro(repro); // { ok, room, timeline, steps, hash } | { ok:false, step, failure }
```

## 7. UI and import

- **Rewind / forward controls** (`RoomActionBar`) are shown in strict `solo_lab` and
  Practice-vs-Bot rooms while the game is live, and remain hidden in strict human-vs-human rooms.
  Sandbox behaviour is unchanged.
- **Export repro** is the download button in the same action bar (`export_repro` room HTTP
  action). It is available in strict bot/solo rooms, including production Practice vs Bot.
- **Load repro** is dev-only (`NODE_ENV !== "production"`): the `StrictRulesPanel` shows a file
  input, a step number and **Load repro**. The `load_repro` HTTP action replays the file to the
  chosen step (or the end) and allocates a **new `solo_lab` room** with the file's initial state
  and player/card ids; the caller's auth subject is mapped to their seat and the client follows
  `nextRoomCode` like any linked room. The new room's timeline contains the replayed prefix, so
  rewind/forward keep working.
- **Toast:** after a rewind/forward the game screen shows “Rewound to turn N, step M” (i18n keys
  `rules.ui.rewoundTo` / `rules.ui.forwardedTo` in en/fr/ko/zh-CN).

## 8. Tests

- `packages/engine/test/strict-rewind.test.ts`: real seeded bot room, several accepted actions,
  rewind deep-equals the stored snapshot (rules/board/RNG/action index), repeat human action gives
  the same state and bot pick, export → replay final hash, first divergent step, strict
  human-vs-human rejection.
- `apps/realtime/tests/bot-room.test.ts`: end-to-end Practice-vs-Bot rewind, bot hold, export
  `export_repro` → replay, `load_repro` → new `solo_lab` room at a chosen step.
- `apps/play/src/components/board/header/__tests__/room-actions.test.ts`: rewind/repro visibility
  in bot/solo vs human-vs-human.
- Existing sandbox rewind tests (`packages/engine/test/lobby-turn-rewind.test.ts`,
  `oracle.fuzz.deep.test.ts`) stay green, proving sandbox rewind is unchanged.

## 9. Limitations

- History is bounded (256 strict meaningful actions); an export after pruning is `truncated`.
- Repro import is a development tool and expects a file exported by this engine version.
- The canonical hash excludes rewind presentation metadata/log rows (documented above).
- A repro import keeps the file's player/card ids so the action log stays exact; auth is mapped by
  seat, not by id.
