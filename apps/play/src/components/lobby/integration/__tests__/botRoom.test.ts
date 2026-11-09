import { describe, expect, it } from "vitest";
import type { RoomSessionDoc } from "@rift/protocol";

import { controlledPlayerIdsForSession, roomStateFromSessionDoc } from "../roomMapping";

function botDoc(overrides: Partial<RoomSessionDoc> = {}): RoomSessionDoc {
  return {
    roomCode: "BOT123",
    createdAt: 1_000,
    phase: "lobby",
    roomMode: "single_player",
    gameVariant: "duel",
    playMode: "constructed",
    deckRulesMode: "unrestricted",
    rulesMode: "strict",
    matchFormat: "bo1",
    gameNumber: 1,
    lobbyReadyPlayerIds: [],
    players: [
      {
        id: "alice",
        seat: 0,
        name: "Alice",
        joinedAt: 1_000,
        decklistRaw: "Legend: 1 Ahri",
      },
      {
        id: "bot",
        seat: 1,
        name: "Practice Bot",
        joinedAt: 1_000,
        decklistRaw: "Legend: 1 Ahri",
        isBot: true,
      },
    ],
    log: [],
    ...overrides,
  };
}

describe("practice-vs-bot room mapping (R4 bot-room)", () => {
  it("maps the public bot flag onto the lobby seat", () => {
    const room = roomStateFromSessionDoc({
      sessionDoc: botDoc(),
      myPlayerId: "alice",
      viewerRole: "player",
      chatEntries: [],
      spectators: [],
    });
    expect(room.seats[0]).toMatchObject({ id: "alice" });
    expect(room.seats[0]?.isBot).toBeUndefined();
    expect(room.seats[1]).toMatchObject({ id: "bot", name: "Practice Bot", isBot: true });
    expect(room.rulesMode).toBe("strict");
  });

  it("never includes the bot in the human's controlled seats", () => {
    expect(
      controlledPlayerIdsForSession({
        sessionDoc: botDoc(),
        roomMode: "single_player",
        controlledPlayerIds: ["alice"],
      }),
    ).toEqual(["alice"]);
    // Solo rooms without a bot keep controlling both human seats.
    expect(
      controlledPlayerIdsForSession({
        sessionDoc: botDoc({
          players: [
            { id: "alice", seat: 0, name: "Alice", joinedAt: 1_000 },
            { id: "opponent", seat: 1, name: "Opponent", joinedAt: 1_000 },
          ],
        }),
        roomMode: "single_player",
      }),
    ).toEqual(["alice", "opponent"]);
  });

  it("keeps the server-issued controlled ids for multiplayer rooms", () => {
    expect(
      controlledPlayerIdsForSession({
        sessionDoc: botDoc({ roomMode: "multiplayer", rulesMode: undefined }),
        roomMode: "multiplayer",
        controlledPlayerIds: ["alice"],
      }),
    ).toEqual(["alice"]);
  });
});
