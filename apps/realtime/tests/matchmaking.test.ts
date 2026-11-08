import { describe, expect, it } from "vitest";
import {
  MatchmakingCore,
  matchmakingQueueRoomName,
  SEARCH_ID_PATTERN,
} from "../src/core/MatchmakingCore";
import type { MatchmakingDeps } from "../src/core/MatchmakingCore";
import type { Identity, MatchedRoomRequest } from "../src/core/types";
import type { CoreTransport } from "../src/core/types";

type Sent = { connectionId: string; message: Record<string, unknown> };

class FakeTransport implements CoreTransport {
  sent: Sent[] = [];
  send(connectionId: string, message: Record<string, unknown>): void {
    this.sent.push({ connectionId, message });
  }
  close(): void {}
  messagesFor(connectionId: string, type?: string): Record<string, unknown>[] {
    return this.sent
      .filter((entry) => entry.connectionId === connectionId)
      .map((entry) => entry.message)
      .filter((message) => !type || message.type === type);
  }
  latest(connectionId: string, type: string): Record<string, unknown> | undefined {
    return this.messagesFor(connectionId, type).at(-1);
  }
}

const identities: Record<string, Identity> = {
  "alice-token": { sub: "alice", name: "Alice", expiresAt: null },
  "bob-token": { sub: "bob", name: "Bob", expiresAt: null },
  "carol-token": { sub: "carol", name: "Carol", expiresAt: null },
  "dave-token": { sub: "dave", name: "Dave", expiresAt: null },
};

function makeCore() {
  let now = 1_000;
  let counter = 0;
  const transport = new FakeTransport();
  const requests: MatchedRoomRequest[] = [];
  const deps: MatchmakingDeps = {
    clock: { now: () => ++now, rng: () => 0.5 },
    transport,
    verifyToken: async (token) => identities[token] ?? null,
    createMatchedRoom: async (request) => {
      requests.push(structuredClone(request));
      counter += 1;
      return {
        roomCode: `MATCH${counter}`,
        playerIds: request.players.map((player) => player.playerId),
      };
    },
  };
  const core = new MatchmakingCore(deps);
  core.addConnection("conn-alice");
  core.addConnection("conn-bob");
  core.addConnection("conn-carol");
  core.addConnection("conn-dave");
  return { core, transport, requests };
}

function startMessage(token: string, searchId: string, name: string, gameVariant?: string) {
  return {
    type: "start",
    searchId,
    playerName: name,
    playMode: "constructed",
    matchmakingPool: "standard",
    matchFormat: "bo1",
    ...(gameVariant ? { gameVariant } : {}),
    authToken: token,
  };
}

const VARIANT_PLAYERS = [
  ["conn-alice", "alice-token", "Alice", "search:alice1"],
  ["conn-bob", "bob-token", "Bob", "search:bob1"],
  ["conn-carol", "carol-token", "Carol", "search:carol1"],
  ["conn-dave", "dave-token", "Dave", "search:dave1"],
] as const;

describe("matchmaking queue names", () => {
  it("mirrors enam-v2-<mode>-<pool>-<format>", () => {
    expect(
      matchmakingQueueRoomName({
        playMode: "constructed",
        matchmakingPool: "standard",
        matchFormat: "bo1",
      }),
    ).toBe("enam-v2-constructed-all-bo1");
    expect(
      matchmakingQueueRoomName({
        playMode: "sealed",
        matchmakingPool: "vendetta-prerift-v1",
        matchFormat: "bo3",
      }),
    ).toBe("enam-v2-sealed-vendetta-prerift-v1-bo3");
    expect(
      matchmakingQueueRoomName({
        playMode: "constructed",
        matchmakingPool: "standard",
        matchFormat: "bo1",
        gameVariant: "free_for_all_3",
      }),
    ).toBe("enam-v2-constructed-all-multiplayer");
    expect(SEARCH_ID_PATTERN.test("search:abcdefgh")).toBe(true);
  });
});

describe("quick-match parties", () => {
  const partyId = "party:test-table-1";
  const join = (token: string, name: string, create = false) => ({
    type: "party_join",
    partyId,
    playerName: name,
    ...(create ? { create: { gameVariant: "free_for_all_3" } } : {}),
    authToken: token,
  });
  const partySearch = (token: string, name: string, searchId: string) => ({
    type: "start",
    searchId,
    playerName: name,
    playMode: "constructed",
    matchmakingPool: "standard",
    matchFormat: "bo1",
    gameVariant: "free_for_all_3",
    party: { id: partyId, round: 1, gameVariant: "free_for_all_3" },
    authToken: token,
  });

  it("gathers members, broadcasts party_state and forms one table from the party round", async () => {
    const { core, transport, requests } = makeCore();
    await core.handleMessage("conn-alice", join("alice-token", "Alice", true));
    await core.handleMessage("conn-bob", join("bob-token", "Bob"));
    await core.handleMessage("conn-carol", join("carol-token", "Carol"));

    const state = transport.latest("conn-bob", "party_state") as {
      party?: { members?: Array<Record<string, unknown>>; status?: string };
    };
    expect(state?.party?.status).toBe("gathering");
    expect(state?.party?.members).toHaveLength(3);
    expect(state?.party?.members?.find((member) => member.you)).toMatchObject({
      name: "Bob",
    });
    expect(state?.party?.members?.find((member) => member.leader)).toMatchObject({
      name: "Alice",
    });

    for (const [connection, token] of [
      ["conn-alice", "alice-token"],
      ["conn-bob", "bob-token"],
      ["conn-carol", "carol-token"],
    ] as const) {
      await core.handleMessage(connection, {
        type: "party_update",
        partyId,
        ready: true,
        authToken: token,
      });
    }
    await core.handleMessage("conn-alice", {
      type: "party_start",
      partyId,
      authToken: "alice-token",
    });
    const searching = transport.latest("conn-carol", "party_state") as {
      party?: { status?: string; searchRound?: number };
    };
    expect(searching?.party?.status).toBe("searching");
    expect(searching?.party?.searchRound).toBe(1);

    await core.handleMessage("conn-alice", partySearch("alice-token", "Alice", "search:alice1"));
    await core.handleMessage("conn-bob", partySearch("bob-token", "Bob", "search:bob1"));
    // Two of three seats are not enough: the party table waits for the last member.
    expect(requests).toHaveLength(0);
    await core.handleMessage("conn-carol", partySearch("carol-token", "Carol", "search:carol1"));
    expect(requests).toHaveLength(1);
    expect(requests[0]?.gameVariant).toBe("free_for_all_3");
    expect(requests[0]?.players.map((player) => player.playerId)).toEqual([
      "alice",
      "bob",
      "carol",
    ]);
    expect(transport.latest("conn-carol", "matched")?.roomCode).toBe("MATCH1");
  });

  it("requires the leader and a ready, full party; leader leave closes the party", async () => {
    const { core, transport } = makeCore();
    await core.handleMessage("conn-alice", join("alice-token", "Alice", true));
    await core.handleMessage("conn-bob", join("bob-token", "Bob"));
    await core.handleMessage("conn-carol", join("carol-token", "Carol"));

    await core.handleMessage("conn-bob", {
      type: "party_update",
      partyId,
      ready: true,
      gameVariant: "free_for_all_4",
      authToken: "bob-token",
    });
    expect(transport.latest("conn-bob", "error")).toMatchObject({
      code: "party_access_denied",
      partyId,
    });
    await core.handleMessage("conn-alice", {
      type: "party_start",
      partyId,
      authToken: "alice-token",
    });
    expect(transport.latest("conn-alice", "error")).toMatchObject({ code: "party_not_ready" });

    await core.handleMessage("conn-alice", {
      type: "party_leave",
      partyId,
      authToken: "alice-token",
    });
    expect(transport.latest("conn-bob", "party_closed")).toMatchObject({
      partyId,
      reason: "disbanded",
    });
  });
});

describe("MatchmakingCore", () => {
  it("pairs two compatible duel searches FIFO and sends matched to both", async () => {
    const { core, transport, requests } = makeCore();
    await core.handleMessage("conn-alice", startMessage("alice-token", "search:alice1", "Alice"));
    expect(transport.latest("conn-alice", "searching")?.searchId).toBe("search:alice1");
    expect(requests).toHaveLength(0);

    await core.handleMessage("conn-bob", startMessage("bob-token", "search:bob1", "Bob"));
    expect(requests).toHaveLength(1);
    expect(requests[0]?.players.map((player) => player.playerId)).toEqual(["alice", "bob"]);
    expect(transport.latest("conn-alice", "matched")).toMatchObject({
      type: "matched",
      roomCode: "MATCH1",
      playerId: "alice",
      playerName: "Alice",
      playMode: "constructed",
    });
    expect(transport.latest("conn-bob", "matched")).toMatchObject({
      roomCode: "MATCH1",
      playerId: "bob",
    });
  });

  it("carries constructedDeckRegistration from each search into the matched room", async () => {
    const { core, requests } = makeCore();
    const registration = {
      decklistRaw: "Legend:\n1 Ahri, Nine-Tailed Fox",
      matchmakingPool: "standard",
      savedDeckId: "deck_atlas",
      savedDeckName: "Atlas Standard",
      savedDeckRevision: 2,
      savedDeckLegalityVersion: "standard-2026-10-24",
      savedDeckStatus: "ready",
      savedDeckOwnerUserId: "alice",
      deckRulesMode: "standard",
      matchFormat: "bo1",
    };
    await core.handleMessage("conn-alice", {
      ...startMessage("alice-token", "search:alice1", "Alice"),
      constructedDeckRegistration: registration,
    });
    await core.handleMessage("conn-bob", {
      ...startMessage("bob-token", "search:bob1", "Bob"),
      constructedDeckRegistration: { ...registration, savedDeckOwnerUserId: "bob" },
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]?.players[0]).toMatchObject({
      constructedDeckRegistration: registration,
    });
    expect(requests[0]?.players[1]).toMatchObject({
      constructedDeckRegistration: { savedDeckOwnerUserId: "bob" },
    });
  });

  it("reports a conflict when the account already has an active search", async () => {
    const { core, transport } = makeCore();
    await core.handleMessage("conn-alice", startMessage("alice-token", "search:alice1", "Alice"));
    await core.handleMessage("conn-alice", startMessage("alice-token", "search:alice2", "Alice"));
    const conflict = transport.latest("conn-alice", "error");
    expect(conflict?.code).toBe("matchmaking_search_conflict");
    expect(conflict?.activeSearchId).toBe("search:alice1");
  });

  it("resumes a search and re-sends matched on resolve", async () => {
    const { core, transport } = makeCore();
    await core.handleMessage("conn-alice", startMessage("alice-token", "search:alice1", "Alice"));
    await core.handleMessage("conn-bob", startMessage("bob-token", "search:bob1", "Bob"));
    transport.sent = [];
    await core.handleMessage("conn-alice", {
      ...startMessage("alice-token", "search:alice1", "Alice"),
      type: "resolve",
    });
    expect(transport.latest("conn-alice", "matched")?.roomCode).toBe("MATCH1");
    await core.handleMessage("conn-alice", {
      ...startMessage("alice-token", "search:missing1", "Alice"),
      type: "resolve",
    });
    expect(transport.latest("conn-alice", "error")?.code).toBe("matchmaking_search_expired");
  });

  it("supports ping/pong and HTTP cancel_exact / reset_exact", async () => {
    const { core, transport } = makeCore();
    await core.handleMessage("conn-alice", startMessage("alice-token", "search:alice1", "Alice"));
    await core.handleMessage("conn-alice", {
      type: "ping",
      searchId: "search:alice1",
      sentAt: 42,
    });
    expect(transport.latest("conn-alice", "pong")).toMatchObject({
      searchId: "search:alice1",
      sentAt: 42,
    });

    const cancelled = await core.handleHttp(
      "cancel_exact",
      { action: "cancel_exact", searchId: "search:alice1" },
      identities["alice-token"]!,
    );
    expect(cancelled.body).toMatchObject({
      ok: true,
      searchId: "search:alice1",
      status: "cancelled",
    });
    expect(transport.latest("conn-alice", "cancelled")).toBeTruthy();

    const expired = await core.handleHttp(
      "cancel_exact",
      { action: "cancel_exact", searchId: "search:missing" },
      identities["alice-token"]!,
    );
    expect(expired.body.status).toBe("expired");
  });

  it("returns matched from the HTTP poll after a dropped socket", async () => {
    const { core, transport } = makeCore();
    await core.handleMessage("conn-alice", startMessage("alice-token", "search:alice1", "Alice"));
    await core.handleMessage("conn-bob", startMessage("bob-token", "search:bob1", "Bob"));
    core.removeConnection("conn-alice");
    const polled = await core.handleHttp(
      "reset_exact",
      { action: "reset_exact", searchId: "search:alice1", leaveMatchedRoom: true },
      identities["alice-token"]!,
    );
    expect(polled.body).toMatchObject({
      ok: true,
      status: "matched",
      roomCode: "MATCH1",
      playerId: "alice",
      playerName: "Alice",
      playMode: "constructed",
      matchmakingPool: "standard",
      matchFormat: "bo1",
    });
    expect(transport.messagesFor("conn-alice", "matched")).toHaveLength(1);
  });

  it("expires waiting searches on the alarm", async () => {
    const { core, transport } = makeCore();
    await core.handleMessage("conn-alice", startMessage("alice-token", "search:alice1", "Alice"));
    const searching = transport.latest("conn-alice", "searching");
    expect(typeof searching?.expiresAt).toBe("number");
    core.expire((searching?.expiresAt as number) + 1);
    expect(transport.latest("conn-alice", "expired")).toBeTruthy();
  });

  it("rejects invalid auth tokens", async () => {
    const { core, transport } = makeCore();
    await core.handleMessage("conn-alice", startMessage("bad-token", "search:alice1", "Alice"));
    expect(transport.latest("conn-alice", "error")?.code).toBe("invalid_auth_token");
  });

  for (const [variant, required] of [
    ["free_for_all_3", 3],
    ["free_for_all_4", 4],
    ["teams_2v2", 4],
  ] as const) {
    it(`fills a ${variant} table with ${required} players before starting`, async () => {
      const { core, transport, requests } = makeCore();
      for (let index = 0; index < required - 1; index += 1) {
        const [connection, token, name, searchId] = VARIANT_PLAYERS[index]!;
        await core.handleMessage(connection, startMessage(token, searchId, name, variant));
        expect(requests).toHaveLength(0);
        expect(transport.latest(connection, "searching")?.gameVariant).toBe(variant);
      }
      const [connection, token, name, searchId] = VARIANT_PLAYERS[required - 1]!;
      await core.handleMessage(connection, startMessage(token, searchId, name, variant));

      expect(requests).toHaveLength(1);
      expect(requests[0]?.gameVariant).toBe(variant);
      expect(requests[0]?.matchFormat).toBe("bo1");
      expect(requests[0]?.players).toHaveLength(required);
      for (let index = 0; index < required; index += 1) {
        const [playerConnection] = VARIANT_PLAYERS[index]!;
        expect(transport.latest(playerConnection, "matched")?.roomCode).toBe("MATCH1");
      }
    });
  }

  it("does not mix variants in the shared multiplayer queue", async () => {
    const { core, requests } = makeCore();
    await core.handleMessage(
      "conn-alice",
      startMessage("alice-token", "search:alice1", "Alice", "free_for_all_3"),
    );
    await core.handleMessage(
      "conn-bob",
      startMessage("bob-token", "search:bob1", "Bob", "free_for_all_4"),
    );
    await core.handleMessage(
      "conn-carol",
      startMessage("carol-token", "search:carol1", "Carol", "teams_2v2"),
    );
    expect(requests).toHaveLength(0);
  });
});
