import { describe, expect, it } from "vitest";
import type { RoomSessionDoc } from "@rift/protocol";

import { pendingRoomState, roomStateFromSessionDoc } from "../roomMapping";
import { createGameSession, gameHref, resolveGameSession } from "../session";

function doc(overrides: Partial<RoomSessionDoc> = {}): RoomSessionDoc {
  return {
    roomCode: "AB12CD",
    createdAt: 1000,
    phase: "lobby",
    roomMode: "multiplayer",
    gameVariant: "duel",
    playMode: "constructed",
    deckRulesMode: "standard",
    matchFormat: "bo1",
    gameNumber: 1,
    lobbyReadyPlayerIds: ["p1"],
    players: [
      {
        id: "p1",
        seat: 0,
        name: "atlas",
        joinedAt: 1000,
        decklistRaw: "Legend: 1 Kai'Sa",
        submittedDeck: { sections: {} as never, raw: "Legend: 1 Kai'Sa" },
      },
      { id: "p2", seat: 1, name: "Guest", joinedAt: 2000 },
    ],
    log: [],
    ...overrides,
  };
}

describe("roomStateFromSessionDoc", () => {
  it("maps seats, ready flags, host and deck readiness", () => {
    const room = roomStateFromSessionDoc({
      sessionDoc: doc(),
      myPlayerId: "p1",
      viewerRole: "player",
      chatEntries: [],
      spectators: [],
    });
    expect(room.code).toBe("AB12CD");
    expect(room.myId).toBe("p1");
    expect(room.mySeat).toBe(0);
    expect(room.hostId).toBe("p1");
    expect(room.viewerRole).toBe("player");
    expect(room.variant).toBe("duel");
    expect(room.seats[0]).toMatchObject({ id: "p1", ready: true, deckReady: true, isHost: true });
    expect(room.seats[1]).toMatchObject({ id: "p2", ready: false, deckReady: false, isHost: false });
    expect(room.started).toBe(false);
    expect(room.matchComplete).toBe(false);
  });

  it("maps spectators and chat entries with stable fallbacks", () => {
    const room = roomStateFromSessionDoc({
      sessionDoc: doc(),
      myPlayerId: "p1",
      viewerRole: "player",
      chatEntries: [
        { id: "c1", authorId: "p2", authorName: "Guest", text: "hi", at: 5 },
        { id: "c2", authorId: "p1", text: "yo" },
      ],
      spectators: [
        {
          authSubject: "spectator-subject",
          displayName: "Watcher",
          joinedAt: 1,
          updatedAt: 1,
          grantedPrivatePlayerIds: [],
        },
      ],
    });
    expect(room.chat).toHaveLength(2);
    expect(room.chat[0]).toMatchObject({ id: "c1", author: "Guest", text: "hi" });
    expect(room.chat[1]).toMatchObject({ author: "Player", at: expect.any(Number) });
    expect(room.spectators).toEqual([{ id: "spectator-subject", name: "Watcher" }]);
  });

  it("marks started / complete phases", () => {
    const started = roomStateFromSessionDoc({
      sessionDoc: doc({ phase: "in_game" }),
      myPlayerId: "p1",
      viewerRole: "player",
    });
    expect(started.started).toBe(true);
    const complete = roomStateFromSessionDoc({
      sessionDoc: doc({
        phase: "in_game",
        matchTermination: { status: "completed", winnerPlayerIds: ["p1"] },
      }),
      myPlayerId: "p1",
      viewerRole: "player",
    });
    expect(complete.matchComplete).toBe(true);
  });

  it("supports seat-less spectators", () => {
    const room = roomStateFromSessionDoc({
      sessionDoc: doc(),
      myPlayerId: "spectator-subject",
      viewerRole: "spectator",
    });
    expect(room.mySeat).toBeNull();
    expect(room.hostId).toBe("p1");
  });
});

describe("pendingRoomState", () => {
  it("shows the host immediately and solo opponents from controlled ids", () => {
    const room = pendingRoomState({
      roomCode: "AB12CD",
      myPlayerId: "p1",
      myPlayerName: "atlas",
      viewerRole: "player",
      roomMode: "single_player",
      deckReady: true,
      controlledPlayerIds: ["p1", "p2"],
    });
    expect(room.seats[0]).toMatchObject({ id: "p1", deckReady: true, isHost: true });
    expect(room.seats[1]).toMatchObject({ id: "p2", name: "Opponent" });
  });
});

describe("game session handoff", () => {
  it("builds a /game href carrying room, game instance, player and viewer", () => {
    const session = createGameSession({
      roomCode: "ab12cd",
      playerId: "player_1",
      playerName: "atlas",
      viewerRole: "spectator",
    });
    expect(session.roomCode).toBe("AB12CD");
    expect(session.gameInstanceId).toBe("AB12CD");
    expect(gameHref(session)).toBe(
      "/game?room=AB12CD&gameInstanceId=AB12CD&playerId=player_1&viewer=spectator",
    );
  });

  it("prefers explicit query params and otherwise falls back to the last session", () => {
    const stored = createGameSession({
      roomCode: "AB12CD",
      playerId: "p1",
      playerName: "atlas",
      playMode: "constructed",
    });
    const fromQuery = resolveGameSession(
      { room: "ZZ99YY", playerId: "p2", viewer: "spectator" },
      { active: stored, last: stored },
    );
    expect(fromQuery).toMatchObject({
      roomCode: "ZZ99YY",
      gameInstanceId: "ZZ99YY",
      playerId: "p2",
      viewerRole: "spectator",
    });
    expect(resolveGameSession({}, { active: null, last: stored })).toMatchObject({
      roomCode: "AB12CD",
      playerId: "p1",
    });
    expect(resolveGameSession({}, { active: null, last: null })).toBeNull();
  });
});
