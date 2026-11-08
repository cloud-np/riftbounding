import { describe, expect, it } from "vitest";

import type { RoomSessionDoc } from "@rift/protocol";

import type { GameSession } from "@/components/lobby/integration/session";
import { linkedRoomLastKnownPhase, linkedRoomSession, lobbyHref } from "../match-navigation";

const session: GameSession = {
  version: 1,
  roomCode: "OLD01",
  gameInstanceId: "OLD01",
  playerId: "p1",
  playerName: "Atlas",
  viewerRole: "player",
  playMode: "constructed",
  deckRulesMode: "standard",
  roomMode: "multiplayer",
  controlledPlayerIds: ["p1"],
  lastKnownPhase: "in_game",
  savedAt: 1,
};

function doc(overrides: Partial<RoomSessionDoc>): RoomSessionDoc {
  return {
    roomCode: "OLD01",
    createdAt: 0,
    phase: "in_game",
    players: [],
    log: [],
    ...overrides,
  };
}

describe("linked-room phase (original 35qz5rkx7yexy.js:38659)", () => {
  it("resumes a live BO3 series at sideboarding", () => {
    expect(
      linkedRoomLastKnownPhase(doc({ matchFormat: "bo3", winsByPlayerId: { p1: 1, p2: 0 } })),
    ).toBe("sideboarding");
  });

  it("uses battlefield_pick for BO1", () => {
    expect(linkedRoomLastKnownPhase(doc({ matchFormat: "bo1" }))).toBe("battlefield_pick");
  });

  it("uses battlefield_pick when the BO3 series is complete", () => {
    expect(
      linkedRoomLastKnownPhase(doc({ matchFormat: "bo3", winsByPlayerId: { p1: 2, p2: 1 } })),
    ).toBe("battlefield_pick");
    expect(
      linkedRoomLastKnownPhase(
        doc({
          matchFormat: "bo3",
          matchTermination: { status: "completed", reason: "concession", winnerPlayerIds: ["p1"] },
        }),
      ),
    ).toBe("battlefield_pick");
  });

  it("falls back to battlefield_pick without shell metadata", () => {
    expect(linkedRoomLastKnownPhase(null)).toBe("battlefield_pick");
  });
});

describe("linked-room session handoff", () => {
  it("keeps the seat identity and swaps room/game instance", () => {
    const next = linkedRoomSession(session, "new02", "sideboarding");
    expect(next.roomCode).toBe("NEW02");
    expect(next.gameInstanceId).toBe("NEW02");
    expect(next.lastKnownPhase).toBe("sideboarding");
    expect(next.playerId).toBe("p1");
    expect(next.controlledPlayerIds).toEqual(["p1"]);
  });

  it("trims and uppercases the linked room code", () => {
    expect(linkedRoomSession(session, " ab12 ", "battlefield_pick").roomCode).toBe("AB12");
  });
});

describe("return-to-lobby destination", () => {
  it("deep-links the shared lobby room so both players land together", () => {
    expect(lobbyHref("pz usu")).toBe("/?room=PZ%20USU");
    expect(lobbyHref("PZUSU")).toBe("/?room=PZUSU");
  });

  it("falls back to the plain lobby", () => {
    expect(lobbyHref()).toBe("/");
    expect(lobbyHref("   ")).toBe("/");
  });
});
