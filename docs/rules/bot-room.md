# Practice vs Bot (R4 bot-room)

A lobby shortcut that opens a `single_player` room whose second seat is driven by the server-side
practice bot. The room is always `rulesMode: "strict"`; the human plays through the normal strict
UI (`StrictRulesPanel` / `StrictPromptDialog`) while the server answers for the bot.

## Wire / state additions (additive)

- `RoomPlayer.isBot?: boolean` (`packages/protocol/src/game-state.ts`): public room metadata for
  the server-driven seat. Recorded in `packages/protocol/CHANGES.md` (`## R4 bot-room`).
- `create_room` accepts `opponent: "bot"` (single-player/solo-lab) and an optional `rulesMode`.
  With `opponent: "bot"` the coordinator:
  - forces `roomMode: "single_player"`, `rulesMode: "strict"`;
  - creates seat 1 named `Practice Bot` with `isBot: true` / `isSoloOpponent: true`;
  - leaves the bot seat **out of** the host's `controlledPlayerIds`.
- `MatchSeatSeed.isBot` carries the marker through room allocation and linked rooms.

Sandbox rooms never set `isBot`, and no sandbox code path changes.

## Server flow

1. `CoordinatorCore.createRoom` allocates the strict bot seed. The returning client's
   `controlledPlayerIds` contains the human only.
2. When the host presses **Start Match**, `MatchRoomCore.initializeGame` builds the game and
   mirrors `isBot` onto the live `Room.players` (the engine setup contract has no bot field).
3. Bot rooms automate setup through the existing `auto_start_test_setup` helper as the host: it
   picks battlefields, the first player (the human) and completes both mulligans, then the strict
   layer initialises (`beginGame` → `initializeStrictRules`). The human therefore never sees or
   controls the bot's hand. Once the game is `in_game`, the *live* `Room.roomMode` becomes
   `"multiplayer"` (the session doc stays `single_player`): the engine then alternates turns
   between the two seats, and the board derives `controlledPlayerIds` from the session instead of
   granting the human the bot seat.
4. After every accepted action (`performGameAction`, setup shell actions, game start and
   next-game reset) `MatchRoomCore.driveBotSeats()` wakes:
   - it scans `Room.players[*].isBot`;
   - the bot's intent is computed **only** on
     `redactRoomForViewer(room, { playerId: botId, viewerRole: "player" })` via
     `pickStrictBotAction(redactedView, botId, rng)` (engine binding of
     `pickRandomAction` from `@rift/rules`);
   - the intent is applied to the authoritative room through `applyGameAction` and broadcast as a
     normal per-viewer `authoritative_patch_commit` (no `clientActionId`).
5. The human's next action is processed through the ordinary `action_intent` path; the bot is
   just another seat with a different actor.

## Guards

- Hard cap of `BOT_ACTION_CAP = 64` bot actions per wake (`apps/realtime/src/core/bot-driver.ts`).
- Stop on `gameOutcome`, non-`in_game` phase, a rejected intent, a rune-multiset violation, or an
  accepted intent that does not change the room (no progress).
- A rejected bot intent is logged as
  `[bot-room <code>] action <botId> code=<code> rule=<rule> intent=<type>` and is **never** sent
  to a client as an `error` frame.
- The bot never acts on the authoritative room directly: all legality comes from its redacted
  view, so hidden cards cannot leak into its choices.
- Presence: a bot seat has no transport, but `connectedPlayerIds()` and
  `playerHasConnection()` treat it as always connected (`RoomPlayer.isBot`). It never triggers
  the player-left banner / Play Both Sides / Claim Win, and a disconnect-win claim against it is
  rejected. The client also skips bot seats in the player-left flow and hides their action
  clock (the server resolves bot turns instantly, so a per-player timer would freeze at 00:00).

## UI

- Lobby → **Practice vs Bot** (`SidePanel`, next to Solo Room). The handler sends
  `opponent: "bot"`, `roomMode: "single_player"`, `rulesMode: "strict"`.
- `LobbyContainer.handleGameStarted` filters bot seats out of the local `controlledPlayerIds`
  (`controlledPlayerIdsForSession` in `roomMapping.ts`), so the client never sends actions for the
  bot and redaction treats it as an opponent.
- `RoomShell` shows a **Bot** badge on the seat (`RoomSeat.isBot`). The seat has no Ready/Load Deck
  controls. The human's **Start Match** is enabled by their own deck.
- Everything else is the normal strict UI; no new board surface.
- Chain: a strict chain item projected from `rules.chain` (a card play or its triggered/activated
  ability) renders the public source card's art/name via `chainDisplayEntry` + catalog-name
  fallback; a hidden/facedown chain card stays a card back.

## Local walkthrough

```bash
pnpm install
pnpm --filter realtime dev   # wrangler on http://localhost:1999
pnpm --filter play dev       # Next.js on http://localhost:3000
```

1. Open `http://localhost:3000` and sign in (`atlas` / `1234`) or **Continue as guest**.
2. Pick/load a legal deck (the bot uses the same deck).
3. In the lobby's **Private Play** panel click **Practice vs Bot**.
4. The room opens already strict with a `Practice Bot` seat. Click **Start Match**; setup runs
   automatically (battlefields, first player, mulligans).
5. Play normally with board gestures (drag to play/move/equip, click to use, prompt clicks);
   the dev-only `StrictRulesPanel` keeps Pass/End turn/Concede, and `StrictPromptHost` answers
   non-object prompts. Press **End Turn**; the bot takes its turn and the turn returns to you.

## Tests

- `apps/realtime/tests/bot-room.test.ts`: coordinator seed, auto setup, human end turn → bot acts
  → turn returns, no bot error frames, per-side hand redaction.
- `packages/sync/src/bot-redaction.test.ts`: human view hides the bot's hand/deck; bot view hides
  the human's hand but shows its own.
- `apps/play/src/components/lobby/integration/__tests__/botRoom.test.ts` and
  `apps/play/src/components/lobby/__tests__/botRoomButton.test.tsx`: seat/bot mapping, controlled
  seat filtering and the lobby button.

## Known limits

- The bot is intentionally dumb: `pickRandomAction` picks uniformly among the legal progress
  actions (prompt → manual done → play/activate/move → end turn → pass), not a heuristic.
- Setup is automatic in bot rooms: there is no battlefield/mulligan choice.
- Rewind in `single_player` strict rooms remains rejected (see `progress.md`), including practice
  vs bot.
