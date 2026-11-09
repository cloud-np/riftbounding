/**
 * Strict rewind/forward + repro replay from real bot-room state.
 *
 * The room is a strict Practice-vs-Bot room: a seeded RNG, a server-driven `isBot` seat and the
 * normal strict rules layer. The test drives several accepted actions, rewinds, deep-compares the
 * restored `Room.rules`/board/RNG state, repeats the same human action and asserts the bot's
 * response is identical. It then exports a repro and replays it through `applyGameAction`.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import type { DeckSections, Room, StrictReproFile } from "@rift/protocol";
import {
  applyGameAction,
  createBotPickerRandom,
  createInitialGameState,
  createInitialTimeline,
  createStrictRepro,
  pickStrictBotAction,
  replayStrictRepro,
} from "../src";

const DECKS = path.resolve(__dirname, "../../rules/test/fixtures/decks.json");

interface DecksFile {
  deckA: { raw: string; sections: DeckSections };
  deckB: { raw: string; sections: DeckSections };
}

const decks = JSON.parse(fs.readFileSync(DECKS, "utf8")) as DecksFile;

let now = 1_760_000_000_000;

function strictBotInGame(): Room {
  const room = createInitialGameState({
    roomCode: "REWIND1",
    createdAt: 1,
    phase: "mulligan",
    shuffleDecks: true,
    rngSeed: 0x5eed1234,
    hostPlayerId: "p1",
    players: [
      { id: "p1", name: "Alice", submittedDeck: decks.deckA, decklistRaw: decks.deckA.raw },
      { id: "p2", name: "Practice Bot", submittedDeck: decks.deckB, decklistRaw: decks.deckB.raw },
    ],
  });
  room.firstPlayerId = "p1";
  room.players[1]!.isBot = true;
  for (const player of room.players) player.selectedBattlefield = "Bandle Tree";
  room.rulesMode = "strict";
  let next = room;
  for (const actor of ["p1", "p2"]) {
    const result = applyGameAction(next, actor, { type: "submit_mulligan", cardIds: [] }, {
      now: now++,
      rng: () => 0.5,
      mode: "multiplayer",
    });
    if (!result.ok) throw new Error(result.error);
    next = result.state;
  }
  expect(next.phase).toBe("in_game");
  expect(next.rules).toBeTruthy();
  expect(next.players[1]?.isBot).toBe(true);
  return next;
}

function action<T extends { type: string }>(
  room: Room,
  timeline: ReturnType<typeof createInitialTimeline> | undefined,
  actor: string,
  payload: T,
) {
  const result = applyGameAction(room, actor, payload, {
    now: now++,
    rng: () => 0.5,
    mode: "multiplayer",
    ...(timeline ? { timeline } : {}),
  });
  if (!result.ok) throw new Error(`${payload.type}: ${result.error}`);
  return result;
}

function comparable(room: Room) {
  return {
    rules: room.rules,
    players: room.players,
    chainEntries: room.chainEntries,
    turnNumber: room.turnNumber,
    activeTurnPlayerId: room.activeTurnPlayerId,
    activeTurnStep: room.activeTurnStep,
    rngSeed: room.rngSeed,
    rngCursor: room.rngCursor,
    actionCount: room.actionCount,
    gameOutcome: room.gameOutcome,
  };
}

describe("strict Practice-vs-Bot rewind", () => {
  it("restores the exact snapshot, then repeats the human action and bot response", () => {
    let room = strictBotInGame();
    let timeline = createInitialTimeline();

    // Human ends turn; the bot ends its own turn; the human ends the next turn. These are real
    // accepted actions with full `Room.rules` snapshots (no recomputation).
    let result = action(room, timeline, "p1", { type: "rules_end_turn" });
    room = result.state;
    timeline = result.timeline!;
    result = action(room, timeline, "p2", { type: "rules_end_turn" });
    room = result.state;
    timeline = result.timeline!;

    const beforeHuman = structuredClone(room);
    const humanAction = { type: "rules_end_turn" };
    result = action(room, timeline, "p1", humanAction);
    const afterHuman = structuredClone(result.state);
    room = result.state;
    timeline = result.timeline!;

    // The bot answers the repeated state deterministically (state seed + action index).
    const botIntent = pickStrictBotAction(room, "p2", createBotPickerRandom(room));
    expect(botIntent).not.toBeNull();
    const botRandom = createBotPickerRandom(room);
    result = action(room, timeline, "p2", botIntent!);
    const afterBot = structuredClone(result.state);
    room = result.state;
    timeline = result.timeline!;

    // A few more actions, so the rewind has to skip real bot history.
    const later = action(room, timeline, "p2", { type: "rules_end_turn" });
    room = later.state;
    timeline = later.timeline!;
    expect(timeline.entries.length).toBeGreaterThan(4);

    const rewound = action(room, timeline, "p1", { type: "rewind_last_action" });
    const target = rewound.timeline!.entries[rewound.timeline!.cursor];
    expect(target?.actorId).toBe("p1");
    expect(rewound.state.rewindStep).toBe(rewound.timeline!.cursor + 1);
    expect(rewound.state.botPause).toBe(true);
    // Exact restore, including chain/prompts/priority/focus/combat/control and hidden records.
    expect(comparable(rewound.state)).toEqual(comparable(beforeHuman));

    // Repeat the same human action: identical state and identical bot pick.
    const repeatedHuman = action(rewound.state, rewound.timeline, "p1", humanAction);
    expect(comparable(repeatedHuman.state)).toEqual(comparable(afterHuman));
    expect(createBotPickerRandom(repeatedHuman.state)()).toBe(botRandom());
    const repeatedBotIntent = pickStrictBotAction(
      repeatedHuman.state,
      "p2",
      createBotPickerRandom(repeatedHuman.state),
    );
    expect(repeatedBotIntent).toEqual(botIntent);
    const repeatedBot = action(repeatedHuman.state, repeatedHuman.timeline, "p2", repeatedBotIntent!);
    expect(comparable(repeatedBot.state)).toEqual(comparable(afterBot));

    // Incidental (non-rewind-target) actions are also replayed, so the repro is byte-exact.
    const rolled = action(repeatedBot.state, repeatedBot.timeline, "p1", {
      type: "roll_die",
      sides: 20,
    });
    const finalRoom = rolled.state;
    const finalTimeline = rolled.timeline!;

    // Export the real history and replay it through the engine.
    const repro = createStrictRepro(finalRoom, finalTimeline, { exportedAt: now });
    expect(repro.actions.length).toBe(finalTimeline.cursor);
    expect(repro.actions.some((entry) => entry.actorId === "p2")).toBe(true);
    expect(repro.actions.some((entry) => entry.action.type === "roll_die")).toBe(true);
    const replay = replayStrictRepro(repro);
    expect(replay.ok).toBe(true);
    if (replay.ok) {
      expect(replay.hash).toBe(repro.finalHash);
      expect(replay.room.players).toEqual(finalRoom.players);
      expect(replay.room.rules).toEqual(finalRoom.rules);
      expect(replay.room.lastDieRoll).toEqual(finalRoom.lastDieRoll);
    }

    // First divergent step is reported, not just a final mismatch.
    const broken: StrictReproFile = {
      ...repro,
      actions: repro.actions.map((entry, index) =>
        index === 1 ? { ...entry, action: { ...entry.action, type: "rules_pass" } } : entry,
      ),
    };
    const failed = replayStrictRepro(broken);
    expect(failed.ok).toBe(false);
    if (!failed.ok) expect(failed.step).toBe(1);
  });

  it("seeds strict-room random sources from the room, not the caller RNG", () => {
    const base = strictBotInGame();
    const left = structuredClone(base);
    const right = structuredClone(base);
    const rollLeft = applyGameAction(left, "p1", { type: "roll_die", sides: 20 }, {
      now: now++,
      rng: () => 0.01,
      mode: "multiplayer",
    });
    const rollRight = applyGameAction(right, "p1", { type: "roll_die", sides: 20 }, {
      now: now++,
      rng: () => 0.99,
      mode: "multiplayer",
    });
    expect(rollLeft.ok).toBe(true);
    expect(rollRight.ok).toBe(true);
    if (!rollLeft.ok || !rollRight.ok) return;
    expect(rollLeft.state.lastDieRoll?.result).toBe(rollRight.state.lastDieRoll?.result);
    expect(rollLeft.state.rngCursor).toBe(rollRight.state.rngCursor);
    expect(rollLeft.state.rngCursor).toBeGreaterThan(base.rngCursor ?? 0);
  });

  it("rejects strict rewind in human-vs-human rooms", () => {
    const room = strictBotInGame();
    room.players[1]!.isBot = false;
    room.roomMode = "multiplayer";
    const timeline = createInitialTimeline();
    const result = applyGameAction(room, "p1", { type: "rewind_last_action" }, {
      now: now++,
      rng: () => 0.5,
      mode: "multiplayer",
      timeline,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorCode).toBe("strict_mode_action");
  });
});
