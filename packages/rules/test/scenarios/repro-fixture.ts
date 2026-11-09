/**
 * Headless strict repro for tests and the `scenario make-repro` CLI command: a seeded
 * Practice-vs-Bot room driven by the engine's own bot picker through `applyGameAction`, with
 * the rewind timeline recording every action, exported with the engine's `createStrictRepro`.
 * This is the same file the "Export repro" button produces (docs/rules/rewind.md).
 */
import type { Room, StrictReproFile } from "@rift/protocol";
import {
  applyGameAction,
  createBotPickerRandom,
  createInitialGameState,
  createInitialTimeline,
  createStrictRepro,
  pickStrictBotAction,
} from "../../../engine/src/index";
import { whoMayAct } from "../../src";
import type { DecksFile } from "../fixtures/decks";
// JSON import (not loadFixtureDecks): the CLI runs under vite SSR, where `__dirname` is undefined.
import decksJson from "../fixtures/decks.json";

export interface BotReproOptions {
  /** Room seed (default 0x5eed1234). */
  seed?: number;
  /** Accepted actions to record after setup (default 60). */
  actions?: number;
  /**
   * Send every `rules_end_turn` of the first player as the sandbox `end_turn` board gesture, so
   * the repro also contains translated gestures (default true).
   */
  gestures?: boolean;
}

export function makeBotRepro(options: BotReproOptions = {}): StrictReproFile {
  const decks = decksJson as unknown as DecksFile;
  let now = 1_760_000_000_000;
  const room0 = createInitialGameState({
    roomCode: "SCENARIO-REPRO",
    createdAt: 1,
    phase: "mulligan",
    shuffleDecks: true,
    rngSeed: options.seed ?? 0x5eed1234,
    hostPlayerId: "p1",
    players: [
      { id: "p1", name: "P1", submittedDeck: decks.deckA, decklistRaw: decks.deckA.raw },
      { id: "p2", name: "P2", submittedDeck: decks.deckB, decklistRaw: decks.deckB.raw },
    ],
  });
  room0.firstPlayerId = "p1";
  room0.players[1]!.isBot = true;
  for (const player of room0.players) player.selectedBattlefield = "Bandle Tree";
  room0.rulesMode = "strict";
  let room: Room = room0;
  for (const actor of ["p1", "p2"]) {
    const result = applyGameAction(
      room,
      actor,
      { type: "submit_mulligan", cardIds: [] },
      { now: now++, rng: () => 0.5, mode: "multiplayer" },
    );
    if (!result.ok) throw new Error(`mulligan: ${result.error}`);
    room = result.state;
  }
  let timeline = createInitialTimeline();
  const limit = options.actions ?? 60;
  for (let index = 0; index < limit && !room.gameOutcome; index += 1) {
    const who = whoMayAct(room);
    if (who.kind === "none") break;
    const intent = pickStrictBotAction(room, who.player, createBotPickerRandom(room));
    if (!intent) break;
    const action =
      options.gestures !== false && intent.type === "rules_end_turn" && who.player === "p1"
        ? { type: "end_turn" }
        : (intent as unknown as Record<string, unknown> & { type: string });
    const result = applyGameAction(room, who.player, action, {
      now: now++,
      rng: () => 0.5,
      mode: "multiplayer",
      timeline,
    });
    if (!result.ok)
      throw new Error(`action ${index} ${action.type} by ${who.player}: ${result.error}`);
    room = result.state;
    if (result.timeline) timeline = result.timeline;
  }
  return createStrictRepro(room, timeline, { exportedAt: now });
}
