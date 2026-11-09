/**
 * R4 bot-room redaction: the practice bot must compute its actions from its own redacted view,
 * exactly like a connected client. Each side only sees its own hand.
 */
import { describe, expect, it } from "vitest";
import type { Room } from "@rift/protocol";

import { redactRoomForViewer, snapshotForViewer } from "./redact";
import { makeCard, makeRoom, makeRng } from "./test-helpers";

function botRoom(): Room {
  const rng = makeRng(7);
  const room = makeRoom(rng, 2);
  room.roomMode = "single_player";
  room.rulesMode = "strict";
  const human = room.players[0]!;
  const bot = room.players[1]!;
  human.id = "alice";
  human.name = "Alice";
  bot.id = "bot";
  bot.name = "Practice Bot";
  bot.isBot = true;
  human.board!.handRevealToOpponent = false;
  human.board!.handRevealedToPlayerIds = [];
  bot.board!.handRevealToOpponent = false;
  bot.board!.handRevealedToPlayerIds = [];
  human.board!.hand = [makeCard(rng, { id: "alice_hand_0", name: "Alice Secret" })];
  bot.board!.hand = [makeCard(rng, { id: "bot_hand_0", name: "Bot Secret" })];
  human.board!.deck = [makeCard(rng, { id: "alice_deck_0", name: "Alice Deck Secret" })];
  bot.board!.deck = [makeCard(rng, { id: "bot_deck_0", name: "Bot Deck Secret" })];
  return room;
}

const hidden = (id: string) => id.startsWith("__hidden_zone__");

describe("practice-bot view redaction (R4 bot-room)", () => {
  it("hides the bot's hand and deck from the human, and keeps the bot flag public", () => {
    const view = redactRoomForViewer(botRoom(), {
      playerId: "alice",
      viewerRole: "player",
      controlledPlayerIds: ["alice"],
    });
    const human = view.players.find((player) => player.id === "alice")!;
    const bot = view.players.find((player) => player.id === "bot")!;
    expect(human.board!.hand.map((card) => card.id)).toEqual(["alice_hand_0"]);
    expect(bot.board!.hand.every((card) => hidden(card.id))).toBe(true);
    expect(bot.board!.deck.every((card) => hidden(card.id))).toBe(true);
    expect(bot.isBot).toBe(true);
  });

  it("hides the human's hand from the bot's view but keeps the bot's own hand", () => {
    const view = redactRoomForViewer(botRoom(), { playerId: "bot", viewerRole: "player" });
    const human = view.players.find((player) => player.id === "alice")!;
    const bot = view.players.find((player) => player.id === "bot")!;
    expect(human.board!.hand.every((card) => hidden(card.id))).toBe(true);
    expect(human.board!.deck.every((card) => hidden(card.id))).toBe(true);
    expect(bot.board!.hand.map((card) => card.id)).toEqual(["bot_hand_0"]);
    expect(bot.board!.deck.map((card) => card.id)).toEqual(["bot_deck_0"]);
  });

  it("applies the same bot-view redaction to snapshots", () => {
    const payload = snapshotForViewer(
      { room: botRoom(), gameplayLogEntries: [] },
      { playerId: "bot", viewerRole: "player" },
    );
    const human = payload.snapshot.players.find((player) => player.id === "alice")!;
    const bot = payload.snapshot.players.find((player) => player.id === "bot")!;
    expect(human.board!.hand.every((card) => hidden(card.id))).toBe(true);
    expect(bot.board!.hand[0]?.name).toBe("Bot Secret");
  });
});
