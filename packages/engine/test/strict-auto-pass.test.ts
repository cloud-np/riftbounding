/**
 * Auto-pass through the engine (docs/rules/auto-pass.md): defaults seeded at game start, the
 * "hold priority" gesture flag, and determinism — automatic actions happen inside the recorded
 * action, so rewind restores them and a repro replays them exactly.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import type { DeckSections, EngineTimeline, Room } from "@rift/protocol";
import { DEFAULT_AUTO_PASS } from "@rift/rules";
import {
  applyGameAction,
  createBotPickerRandom,
  createInitialGameState,
  createInitialTimeline,
  createStrictRepro,
  pickStrictBotAction,
  replayStrictRepro,
  translateGesture,
} from "../src";
import { createEngineRulesHost } from "../src/strict/host";
import { strictGestureRoom } from "./strict-gestures-fixture";

const DECKS = path.resolve(__dirname, "../../rules/test/fixtures/decks.json");
const decks = JSON.parse(fs.readFileSync(DECKS, "utf8")) as {
  deckA: { raw: string; sections: DeckSections };
  deckB: { raw: string; sections: DeckSections };
};

let now = 1_770_000_000_000;

function strictBotInGame(): Room {
  const room = createInitialGameState({
    roomCode: "AUTOPASS",
    createdAt: 1,
    phase: "mulligan",
    shuffleDecks: true,
    rngSeed: 0xa070,
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
  return next;
}

function act(room: Room, timeline: EngineTimeline, actor: string, payload: { type: string; [key: string]: unknown }) {
  const result = applyGameAction(room, actor, payload, { now: now++, rng: () => 0.5, mode: "multiplayer", timeline });
  if (!result.ok) throw new Error(`${payload.type}: ${result.error}`);
  return { room: result.state, timeline: result.timeline ?? timeline };
}

/** Let the bot act until it is the human's decision again (bounded). */
function driveBot(room: Room, timeline: EngineTimeline) {
  let state = { room, timeline };
  for (let step = 0; step < 64; step += 1) {
    const intent = pickStrictBotAction(state.room, "p2", createBotPickerRandom(state.room));
    if (!intent) break;
    state = act(state.room, state.timeline, "p2", intent as unknown as { type: string });
  }
  return state;
}

describe("strict auto-pass through the engine", () => {
  it("seeds the information-safe defaults for every seat when the game starts", () => {
    const room = strictBotInGame();
    expect(room.rules?.autoPass).toEqual({
      p1: { ...DEFAULT_AUTO_PASS },
      p2: { ...DEFAULT_AUTO_PASS },
    });
  });

  it("a hold gesture keeps Priority (hold reaches the rules intent)", () => {
    const fixture = strictGestureRoom();
    const host = createEngineRulesHost(fixture.ctx);
    const gesture = { type: "chain_add", from: "hand", cardId: fixture.ids.meditation };
    const plain = translateGesture(fixture.room, "p1", gesture, host);
    expect(plain).toEqual({ kind: "intent", intent: { type: "rules_play", cardId: fixture.ids.meditation } });
    expect(translateGesture(fixture.room, "p1", { ...gesture, hold: true }, host)).toEqual({
      kind: "intent",
      intent: { type: "rules_play", cardId: fixture.ids.meditation, hold: true },
    });
    // A move is not a play: hold has no meaning there and is not forwarded.
    const unitMove = { type: "move_card", from: "battlefieldA", to: "base", cardId: fixture.ids.caitlyn, hold: true };
    const moved = translateGesture(fixture.room, "p1", unitMove, host);
    if (moved.kind === "intent") expect(moved.intent).not.toHaveProperty("hold");
  });

  it("automatic actions are recorded inside the action: rewind restores them and the repro replays them", () => {
    let state = { room: strictBotInGame(), timeline: createInitialTimeline() };
    // The human opts into the leaky modes and "pass until end of turn": their turn ends at once.
    state = act(state.room, state.timeline, "p1", {
      type: "rules_set_auto_pass",
      prefs: { responses: "no_response", endTurn: "no_action", passUntil: { kind: "end_of_turn", turn: 1 } },
    });
    expect(state.room.rules?.turn.player).toBe("p2");
    expect(state.room.log.some((entry) => entry.key === "rules.auto.endTurn")).toBe(true);
    state = driveBot(state.room, state.timeline);
    const beforeHuman = structuredClone(state.room);
    state = act(state.room, state.timeline, "p1", { type: "rules_set_auto_pass", prefs: { ownItems: false } });
    state = driveBot(state.room, state.timeline);

    const repro = createStrictRepro(state.room, state.timeline, { exportedAt: now });
    const replay = replayStrictRepro(repro);
    expect(replay.ok).toBe(true);
    if (replay.ok) {
      expect(replay.hash).toBe(repro.finalHash);
      expect(replay.room.rules).toEqual(state.room.rules);
    }

    const rewound = act(state.room, state.timeline, "p1", { type: "rewind_last_action" });
    expect(rewound.room.rules).toEqual(beforeHuman.rules);
    expect(rewound.room.rules?.autoPass?.p1?.ownItems).toBe(true);
  });
});
