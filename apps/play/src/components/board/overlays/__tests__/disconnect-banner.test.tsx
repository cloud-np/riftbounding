/**
 * R4 bot-room presence: the server-driven seat has no transport, but it is always present.
 * The player-left banner (and its Play Both Sides / Claim Win actions) must never treat a bot as
 * a disconnected opponent.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { PlayerBoard, Room, RoomPlayer } from "@rift/protocol";

import { DisconnectBanner } from "../DisconnectBanner";

function board(): PlayerBoard {
  return {
    score: 0,
    floatingEnergy: 0,
    floatingPower: 0,
    deck: [],
    hand: [],
    handRevealToOpponent: false,
    base: [],
    trash: [],
    banished: [],
    battlefieldA: [],
    battlefieldB: [],
    battlefieldC: [],
    battlefieldToken: [],
    champion: [],
    legend: [],
    runeDeck: [],
    runeArea: [],
    deckPeek: { cardIds: [], revealedCardIds: [] },
  };
}

function player(id: string, seat: number, isBot = false): RoomPlayer {
  return {
    id,
    seat,
    name: isBot ? "Practice Bot" : "Alice",
    joinedAt: 0,
    ...(isBot ? { isBot: true } : {}),
    board: board(),
  };
}

function room(players: RoomPlayer[]): Room {
  return {
    roomCode: "BOT1",
    createdAt: 0,
    updatedAt: 0,
    phase: "in_game",
    roomMode: "multiplayer",
    players,
    log: [],
    chainEntries: [],
    chainResolveVotes: [],
  } as Room;
}

function render(input: Room, connectedPlayerIds?: string[]): string {
  return renderToStaticMarkup(
    createElement(DisconnectBanner, {
      room: input,
      viewerId: "alice",
      connectedPlayerIds,
      mode: "multiplayer",
      onClaimWin: () => undefined,
    }),
  );
}

describe("DisconnectBanner with a bot seat (R4 bot-room)", () => {
  it("never shows the player-left flow for a bot that has no client connection", () => {
    const html = render(room([player("alice", 0), player("bot", 1, true)]), ["alice"]);
    expect(html).toBe("");
  });

  it("never shows it even if a bot seat carried a leftAt timestamp", () => {
    const bot = { ...player("bot", 1, true), leftAt: 5, leftReason: "manual" as const };
    const html = render(room([player("alice", 0), bot]), []);
    expect(html).toBe("");
  });

  it("still shows the flow for a disconnected human opponent", () => {
    const html = render(room([player("alice", 0), player("bob", 1)]), ["alice"]);
    expect(html).toContain('data-testid="opponent-left-overlay"');
    expect(html).toContain('data-testid="opponent-left-claim-win"');
  });
});
