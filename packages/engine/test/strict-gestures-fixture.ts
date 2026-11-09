/**
 * Shared strict/sandbox room fixture for the R4 gesture tests.
 *
 * Builds a real two-player room from the committed rules deck fixture and places the exact cards
 * the gesture rows need: a playable unit + spell in hand, a unit at a battlefield, a unit and a
 * Gear (Blade of the Exile, `equip`) at the Base, and Caitlyn (one scripted activated ability).
 */
import fs from "node:fs";
import path from "node:path";

import type { CardInstance, DeckSections, Room } from "@rift/protocol";
import { applyGameAction, createInitialGameState } from "../src";

const DECKS = path.resolve(__dirname, "../../rules/test/fixtures/decks.json");

interface DecksFile {
  deckA: { raw: string; sections: DeckSections };
  deckB: { raw: string; sections: DeckSections };
}

export const decks = JSON.parse(fs.readFileSync(DECKS, "utf8")) as DecksFile;

export interface FixtureContext {
  now: number;
  rng: () => number;
  mode: "multiplayer" | "solo_lab" | "single_player";
}

export function makeContext(seed = 987654321): FixtureContext {
  let state = seed >>> 0;
  return {
    now: 1_760_000_000_000,
    rng: () => {
      state = (1664525 * state + 0x3c6ef35f) >>> 0;
      return state / 0x100000000;
    },
    mode: "multiplayer",
  };
}

export type Board = NonNullable<Room["players"][number]["board"]>;

export function apply(room: Room, actor: string, action: Record<string, unknown> & { type: string }, ctx: FixtureContext): Room {
  const result = applyGameAction(room, actor, action, ctx);
  if (!result.ok) throw new Error(`${action.type}: ${result.error}`);
  return result.state;
}

export function takeFromDeck(board: Board, name: string, to: keyof Board): CardInstance {
  const index = board.deck.findIndex((card) => card.name === name);
  if (index < 0) throw new Error(`fixture deck has no ${name} left`);
  const [card] = board.deck.splice(index, 1);
  (board[to] as CardInstance[]).push(card!);
  return card!;
}

/** Base room at `mulligan` (strict or sandbox) with a fixed battlefield choice. */
export function makeMulliganRoom(rulesMode: "strict" | "sandbox"): Room {
  const room = createInitialGameState({
    roomCode: "GESTURE1",
    createdAt: 1,
    phase: "mulligan",
    shuffleDecks: false,
    hostPlayerId: "p1",
    players: [
      { id: "p1", name: "Alice", submittedDeck: decks.deckA, decklistRaw: decks.deckA.raw },
      { id: "p2", name: "Bob", submittedDeck: decks.deckB, decklistRaw: decks.deckB.raw },
    ],
  });
  room.firstPlayerId = "p1";
  if (rulesMode === "strict") room.rulesMode = "strict";
  for (const player of room.players) player.selectedBattlefield = "Bandle Tree";
  return room;
}

export function inGame(rulesMode: "strict" | "sandbox", ctx: FixtureContext): Room {
  let room = makeMulliganRoom(rulesMode);
  for (const actor of ["p1", "p2"]) {
    room = apply(room, actor, { type: "submit_mulligan", cardIds: [] }, ctx);
  }
  if (room.phase !== "in_game") throw new Error(`setup did not reach in_game (${room.phase})`);
  return room;
}

export interface StrictGestureFixture {
  room: Room;
  ctx: FixtureContext;
  ids: {
    keeperHand: string;
    meditation: string;
    rebuke: string;
    caitlyn: string;
    hunter: string;
    enemyHunter: string;
    keeperBase: string;
    blade: string;
    rune: string;
  };
}

/** Strict in-game room with the gesture cards arranged (mutates the board before returning). */
export function strictGestureRoom(): StrictGestureFixture {
  const ctx = makeContext();
  const room = inGame("strict", ctx);
  const board = room.players[0]!.board!;
  const keeperHand = takeFromDeck(board, "Clockwork Keeper", "hand");
  const meditation = takeFromDeck(board, "Meditation", "hand");
  const rebuke = takeFromDeck(board, "Rebuke", "hand");
  const caitlyn = takeFromDeck(board, "Caitlyn, Patrolling", "battlefieldA");
  const hunter = takeFromDeck(board, "Treasure Hunter", "battlefieldA");
  const enemyHunter = takeFromDeck(room.players[1]!.board!, "Treasure Hunter", "battlefieldB");
  const keeperBase = takeFromDeck(board, "Clockwork Keeper", "base");
  const blade = takeFromDeck(board, "Blade of the Exile", "base");
  const rune = board.runeArea[0]!;
  return {
    room,
    ctx,
    ids: {
      keeperHand: keeperHand.id,
      meditation: meditation.id,
      rebuke: rebuke.id,
      caitlyn: caitlyn.id,
      hunter: hunter.id,
      enemyHunter: enemyHunter.id,
      keeperBase: keeperBase.id,
      blade: blade.id,
      rune: rune.id,
    },
  };
}

/** Sandbox in-game room (no `rulesMode`, no `Room.rules`). */
export function sandboxInGame(ctx: FixtureContext): Room {
  return inGame("sandbox", ctx);
}

export function deepCopy<T>(value: T): T {
  return structuredClone(value);
}
