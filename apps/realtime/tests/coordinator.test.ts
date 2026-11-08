import { describe, expect, it } from "vitest";
import { CoordinatorCore, OPERATION_ID_PATTERN } from "../src/core/CoordinatorCore";
import type { CoordinatorDeps } from "../src/core/CoordinatorCore";
import type { MatchRoomSeed } from "../src/core/types";
import type { Identity } from "../src/core/types";

const alice: Identity = { sub: "alice", name: "Alice", expiresAt: null };
const bob: Identity = { sub: "bob", name: "Bob", expiresAt: null };

function deps(): CoordinatorDeps & { seeds: MatchRoomSeed[] } {
  let now = 1_000;
  let counter = 0;
  const seeds: MatchRoomSeed[] = [];
  return {
    clock: { now: () => ++now, rng: () => 0.5 },
    seeds,
    createMatchRoom: async (seed) => {
      seeds.push(structuredClone(seed));
      counter += 1;
      seed.roomCode = `ROOM${counter}`;
      return { roomCode: seed.roomCode, phase: "lobby" };
    },
  };
}

describe("CoordinatorCore.createRoom", () => {
  it("allocates a room and echoes the operation/player ids", async () => {
    const d = deps();
    const core = new CoordinatorCore(d);
    const response = await core.createRoom(
      {
        action: "create_room",
        operationId: "operation:12345",
        playerName: "Alice",
        playMode: "constructed",
        matchFormat: "bo1",
        roomMode: "multiplayer",
        gameVariant: "duel",
        decklist: "Legend: 1 Ahri",
      },
      alice,
    );
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      ok: true,
      operationId: "operation:12345",
      roomCode: "ROOM1",
      playerId: "alice",
      phase: "lobby",
    });
    expect(d.seeds[0]?.players[0]).toMatchObject({
      playerId: "alice",
      name: "Alice",
      seat: 0,
      authSubject: "alice",
    });
    expect(d.seeds[0]?.players[0]?.controlledPlayerIds).toEqual(["alice"]);
  });

  it("accepts constructedDeckRegistration and uses its decklistRaw for the host seat", async () => {
    const d = deps();
    const core = new CoordinatorCore(d);
    const registration = {
      decklistRaw: "Legend:\n1 Ahri, Nine-Tailed Fox",
      matchmakingPool: "standard",
      savedDeckId: "deck_atlas",
      savedDeckName: "Atlas Standard",
      savedDeckRevision: 3,
      savedDeckLegalityVersion: "standard-2026-10-24",
      savedDeckStatus: "ready",
      savedDeckOwnerUserId: "alice",
      deckRulesMode: "standard",
      matchFormat: "bo1",
    };
    const response = await core.createRoom(
      {
        action: "create_room",
        operationId: "operation:registration",
        playerName: "Alice",
        playMode: "constructed",
        matchFormat: "bo1",
        roomMode: "multiplayer",
        gameVariant: "duel",
        constructedDeckRegistration: registration,
      },
      alice,
    );
    expect(response.status).toBe(200);
    expect(d.seeds[0]?.players[0]).toMatchObject({
      decklist: registration.decklistRaw,
      constructedDeckRegistration: registration,
    });
  });

  it("is idempotent per operation id and rejects another account's operation", async () => {
    const d = deps();
    const core = new CoordinatorCore(d);
    const body = {
      action: "create_room",
      operationId: "operation:12345",
      playerName: "Alice",
      playMode: "constructed",
      matchFormat: "bo1",
    };
    const first = await core.createRoom(body, alice);
    const second = await core.createRoom(body, alice);
    expect(second.body).toEqual(first.body);
    expect(d.seeds).toHaveLength(1);
    const conflict = await core.createRoom(body, bob);
    expect(conflict.status).toBe(409);
    expect(conflict.body.error).toBe("create_operation_conflict");
  });

  it("validates the operation id and match settings", async () => {
    const core = new CoordinatorCore(deps());
    const invalid = await core.createRoom({ action: "create_room", operationId: "short" }, alice);
    expect(invalid.body.error).toBe("invalid_operation_id");
    expect(OPERATION_ID_PATTERN.test("operation:12345")).toBe(true);

    const sealed = await core.createRoom(
      {
        action: "create_room",
        operationId: "operation:sealed1",
        playerName: "Alice",
        playMode: "sealed",
        matchFormat: "bo1",
      },
      alice,
    );
    expect(sealed.body.error).toBe("invalid_room_request");
  });

  it("creates a controlled opponent seat for solo modes with duel BO1", async () => {
    const d = deps();
    const core = new CoordinatorCore(d);
    const response = await core.createRoom(
      {
        action: "create_room",
        operationId: "operation:solo1",
        playerName: "Alice",
        playMode: "constructed",
        matchFormat: "bo3",
        roomMode: "solo_lab",
        gameVariant: "teams_2v2",
      },
      alice,
    );
    expect(response.body.controlledPlayerIds).toBeDefined();
    expect((response.body.controlledPlayerIds as string[])[0]).toBe("alice");
    const seed = d.seeds[0]!;
    expect(seed.roomMode).toBe("solo_lab");
    expect(seed.gameVariant).toBe("duel");
    expect(seed.matchFormat).toBe("bo1");
    expect(seed.players).toHaveLength(2);
    expect(seed.players[1]?.isSoloOpponent).toBe(true);
    expect(seed.players[1]?.authSubject).toBeNull();
  });

  it("creates an auto-started quick-match room with both players", async () => {
    const d = deps();
    const core = new CoordinatorCore(d);
    const matched = await core.createMatchedRoom({
      playMode: "constructed",
      deckRulesMode: "standard",
      matchFormat: "bo1",
      gameVariant: "duel",
      players: [
        { playerId: "alice", name: "Alice", authSubject: "alice", decklist: "" },
        { playerId: "bob", name: "Bob", authSubject: "bob", decklist: "" },
      ],
    });
    expect(matched.roomCode).toBe("ROOM1");
    expect(matched.playerIds).toEqual(["alice", "bob"]);
    expect(d.seeds[0]?.autoStart).toBe(true);
    expect(d.seeds[0]?.players.map((player) => player.playerId)).toEqual(["alice", "bob"]);
  });

  it("seats a full 2v2 table and assigns alternating teams", async () => {
    const d = deps();
    const core = new CoordinatorCore(d);
    const matched = await core.createMatchedRoom({
      playMode: "constructed",
      deckRulesMode: "standard",
      matchFormat: "bo1",
      gameVariant: "teams_2v2",
      players: [
        { playerId: "alice", name: "Alice", authSubject: "alice" },
        { playerId: "bob", name: "Bob", authSubject: "bob" },
        { playerId: "carol", name: "Carol", authSubject: "carol" },
        { playerId: "dave", name: "Dave", authSubject: "dave" },
      ],
    });
    expect(matched.playerIds).toEqual(["alice", "bob", "carol", "dave"]);
    expect(d.seeds[0]?.players.map((player) => player.seat)).toEqual([0, 1, 2, 3]);
    expect(d.seeds[0]?.teamIdByPlayerId).toEqual({
      alice: "team:0",
      bob: "team:1",
      carol: "team:0",
      dave: "team:1",
    });
  });

  it("seats a three-player free-for-all", async () => {
    const d = deps();
    const core = new CoordinatorCore(d);
    await core.createMatchedRoom({
      playMode: "constructed",
      deckRulesMode: "standard",
      matchFormat: "bo1",
      gameVariant: "free_for_all_3",
      players: [
        { playerId: "alice", name: "Alice", authSubject: "alice" },
        { playerId: "bob", name: "Bob", authSubject: "bob" },
        { playerId: "carol", name: "Carol", authSubject: "carol" },
      ],
    });
    expect(d.seeds[0]?.gameVariant).toBe("free_for_all_3");
    expect(d.seeds[0]?.players).toHaveLength(3);
    expect(d.seeds[0]?.teamIdByPlayerId).toBeUndefined();
  });
});
