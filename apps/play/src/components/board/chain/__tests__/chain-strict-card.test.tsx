/**
 * R4 bot-room chain UI: a strict chain item that came from the bot's public card (a card play or
 * a triggered ability of that card) must render the card's art/name. Hidden (facedown) cards keep
 * their card back.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { CardInstance, ChainEntry, PlayerBoard, Room, RoomPlayer, RulesState } from "@rift/protocol";

import { ChainSlot } from "../ChainSlot";

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

function chainCard(overrides: Partial<CardInstance> = {}): CardInstance {
  return {
    id: "chain_1",
    name: "Rebuke",
    source: "mainDeck",
    exhausted: false,
    createdAt: 0,
    ...overrides,
  };
}

function chainEntry(overrides: Partial<ChainEntry> = {}): ChainEntry {
  return {
    id: "chain_1",
    card: chainCard(),
    addedAt: 0,
    fromZone: "hand",
    byPlayerId: "bot",
    byPlayerName: "Practice Bot",
    ...overrides,
  };
}

function room(entries: ChainEntry[], botBoard = board()): Room {
  return {
    roomCode: "BOT1",
    createdAt: 0,
    updatedAt: 0,
    phase: "in_game",
    roomMode: "multiplayer",
    rulesMode: "strict",
    rules: { chain: [] } as unknown as RulesState,
    players: [
      { ...player("alice", 0), board: board() },
      { ...player("bot", 1, true), board: botBoard },
    ],
    log: [],
    chainEntries: entries,
    chainResolveVotes: [],
  } as Room;
}

function render(input: Room): string {
  return renderToStaticMarkup(
    createElement(ChainSlot, {
      state: input,
      viewerId: "alice",
      controlledPlayerIds: ["alice"],
      dispatch: () => undefined,
      mode: "multiplayer",
    }),
  );
}

describe("strict chain card display (R4 bot-room)", () => {
  it("resolves a bot card's public art from its name when the item carries no card code", () => {
    const html = render(room([chainEntry()]));
    expect(html).toContain("data-card-art-source");
    expect(html).toContain("OGN-172.webp");
    expect(html).not.toContain("placeholder.svg");
  });

  it("uses the source card's definition for a triggered/activated chain item", () => {
    const source = chainCard({
      id: "setup-bot-mainDeck-3-ogn-172",
      cardCode: "OGN-172",
      imageUrl: "/cards/OGN-172.webp",
      type: "spell",
    });
    const botBoard = { ...board(), base: [source] };
    const item = chainEntry({
      card: chainCard({ id: "chain_ability", name: "Equip" }),
      sourceCardId: source.id,
    });
    const html = render(room([item], botBoard));
    expect(html).toContain("OGN-172.webp");
    expect(html).not.toContain("placeholder.svg");
  });

  it("keeps an unrevealed facedown chain card hidden (card back, no art)", () => {
    const html = render(
      room([chainEntry({ card: chainCard({ hidden: true, name: "" }) })]),
    );
    expect(html).toContain("data-rift-image-kind=\"card-back\"");
    expect(html).not.toContain("OGN-172.webp");
    expect(html).not.toContain("data-card-art-source");
  });

  it("renders the redacted chain placeholder as a card back, not art", () => {
    const html = render(
      room([
        chainEntry({
          card: chainCard({ name: "", isPlaceholder: true, id: "__hidden_zone__:bot:chain:0" }),
        }),
      ]),
    );
    expect(html).toContain("data-rift-image-kind=\"card-back\"");
    expect(html).not.toContain("data-card-art-source");
  });
});
