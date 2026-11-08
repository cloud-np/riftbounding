/**
 * Local-game factory for the dev harness.
 *
 * Two sources:
 *  - `?fixture=hero|autopay|conquer|ffa|mobile` → deep clone of the board fixture room.
 *  - no fixture → a real `@rift/engine` `createInitialGameState` solo-lab duel that starts in
 *    `battlefield_pick` (first setup phase) with two legal 40-card decks.
 */
import type { Room, RoomPlayer } from "@rift/protocol";
import { createInitialGameState } from "@rift/engine";

import { getBoardFixture, type BoardFixture } from "@/fixtures";
import type { GameBoardLayoutHints } from "@/components/board/layout/GameBoardView";

import { buildSoloLabDecks } from "./decks";

export const DEV_SEED_DEFAULT = 1337;
export const DEV_CREATED_AT = 1_766_000_000_000;
export const DEV_PLAYER_IDS = ["dev-seat-0", "dev-seat-1"] as const;
export const DEV_PLAYER_NAMES = ["Kai", "Ari"] as const;

export interface HarnessState {
  room: Room;
  /** Viewer requested by the URL (or the fixture default) before any switcher change. */
  initialViewerId: string;
  /** Viewer resolved from the URL against the room's players. */
  viewerId: string;
  fixture: BoardFixture | null;
  baseHints: GameBoardLayoutHints;
  seed: number;
}

export function parseSeed(value: string | number | null | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value) >>> 0;
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  return Number.isFinite(parsed) ? parsed >>> 0 : DEV_SEED_DEFAULT;
}

/** Resolve `viewer` as a player id, seat number or display name (case-insensitive). */
export function resolveViewerId(
  players: RoomPlayer[],
  requested: string | null | undefined,
  fallback: string,
): string {
  const value = requested?.trim();
  if (value) {
    const byId = players.find((player) => player.id === value);
    if (byId) return byId.id;
    const bySeat = /^\d+$/.test(value)
      ? players.find((player) => player.seat === Number(value))
      : undefined;
    if (bySeat) return bySeat.id;
    const byName = players.find((player) => player.name.toLowerCase() === value.toLowerCase());
    if (byName) return byName.id;
  }
  return players.some((player) => player.id === fallback) ? fallback : (players[0]?.id ?? fallback);
}

/** Mulberry32 — deterministic, fast, good enough for engine RNG calls. */
export function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function createSoloLabRoom(seed: number): Room {
  const decks = buildSoloLabDecks();
  return createInitialGameState({
    roomCode: "DEVLAB",
    createdAt: DEV_CREATED_AT,
    players: [
      {
        id: DEV_PLAYER_IDS[0],
        seat: 0,
        name: DEV_PLAYER_NAMES[0],
        joinedAt: DEV_CREATED_AT,
        deck: { raw: "", sections: decks[0] },
      },
      {
        id: DEV_PLAYER_IDS[1],
        seat: 1,
        name: DEV_PLAYER_NAMES[1],
        joinedAt: DEV_CREATED_AT + 1000,
        deck: { raw: "", sections: decks[1] },
      },
    ],
    hostPlayerId: DEV_PLAYER_IDS[0],
    gameVariant: "duel",
    roomMode: "solo_lab",
    playMode: "constructed",
    deckRulesMode: "unrestricted",
    matchFormat: "bo1",
    gameNumber: 1,
    shuffleDecks: true,
    rng: createSeededRng(seed ^ 0xa5a5a5a5),
  });
}

export interface CreateHarnessStateOptions {
  fixtureId?: string | null;
  seed?: string | number | null;
  viewer?: string | null;
}

export function createHarnessState(options: CreateHarnessStateOptions = {}): HarnessState {
  const seed = parseSeed(options.seed);
  const fixtureId = options.fixtureId?.trim();
  if (fixtureId) {
    const fixture = getBoardFixture(fixtureId);
    const room = structuredClone(fixture.room);
    return {
      room,
      initialViewerId: fixture.viewerId,
      viewerId: resolveViewerId(room.players, options.viewer, fixture.viewerId),
      fixture,
      baseHints: fixture.hints,
      seed,
    };
  }
  const room = createSoloLabRoom(seed);
  return {
    room,
    initialViewerId: DEV_PLAYER_IDS[0],
    viewerId: resolveViewerId(room.players, options.viewer, DEV_PLAYER_IDS[0]),
    fixture: null,
    baseHints: {},
    seed,
  };
}

/** Board-mode value exposed to wave-2 slots. */
export function boardMode(state: Room): "multiplayer" | "solo_lab" | "single_player" {
  if (state.roomMode === "solo_lab") return "solo_lab";
  if (state.roomMode === "single_player") return "single_player";
  return "multiplayer";
}
