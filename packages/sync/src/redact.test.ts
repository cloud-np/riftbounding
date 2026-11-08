import { describe, expect, it } from "vitest";
import type { CardInstance, Room } from "@rift/protocol";
import {
  HIDDEN_ZONE_ID_PREFIX,
  hiddenZoneCardId,
  isHiddenZoneCardId,
  redactRoomForViewer,
  snapshotForViewer,
  viewerForSpectator,
} from "./redact";
import { makeCard, makeRoom, makeRng } from "./test-helpers";

function deterministicRoom(): Room {
  const rng = makeRng(42);
  const room = makeRoom(rng, 2);
  const alice = room.players[0]!;
  const bob = room.players[1]!;
  const aliceBoard = alice.board!;
  const bobBoard = bob.board!;
  alice.id = "alice";
  bob.id = "bob";
  alice.name = "Alice";
  bob.name = "Bob";
  aliceBoard.hand = [makeCard(rng, { id: "alice_hand_0", name: "Alice Secret" })];
  aliceBoard.handRevealToOpponent = false;
  aliceBoard.handRevealedToPlayerIds = [];
  aliceBoard.deck = [
    makeCard(rng, { id: "alice_deck_0", name: "Top Secret" }),
    makeCard(rng, { id: "alice_deck_1", name: "Second Secret" }),
  ];
  aliceBoard.deckPeek = { cardIds: ["alice_deck_0"], revealedCardIds: ["alice_deck_0"] };
  bobBoard.hand = [
    makeCard(rng, { id: "bob_hand_0", name: "Bob Secret" }),
    makeCard(rng, { id: "bob_hand_1", name: "Bob Revealed", revealedToOpponent: true }),
    makeCard(rng, { id: "bob_hand_2", name: "Bob Targeted", revealedToPlayerIds: ["alice"] }),
  ];
  bobBoard.handRevealToOpponent = false;
  bobBoard.handRevealedToPlayerIds = [];
  bobBoard.deck = [makeCard(rng, { id: "bob_deck_0", name: "Bob Deck Secret" })];
  bobBoard.runeDeck = [
    makeCard(rng, { id: "bob_rune_0", name: "Bob Rune Secret", source: "rune" }),
  ];
  bobBoard.base = [
    makeCard(rng, { id: "bob_hidden_base", name: "Face Down", hidden: true }),
    makeCard(rng, { id: "bob_visible_base", name: "Visible Unit" }),
  ];
  bobBoard.deckPeek = { cardIds: ["bob_deck_0"], revealedCardIds: [] };
  return room;
}

function cardIds(cards: CardInstance[]): string[] {
  return cards.map((card) => card.id);
}

describe("hidden zone ids", () => {
  it("matches the client's placeholder id scheme", () => {
    const id = hiddenZoneCardId({ playerId: "p1", zone: "hand", index: 2 });
    expect(id).toBe(`${HIDDEN_ZONE_ID_PREFIX}:p1:hand:2`);
    expect(isHiddenZoneCardId(id)).toBe(true);
    expect(isHiddenZoneCardId("card_1")).toBe(false);
  });
});

describe("redactRoomForViewer", () => {
  it("shows a player their own board but hides the opponent's hand, deck order and peeks", () => {
    const room = deterministicRoom();
    const view = redactRoomForViewer(room, { playerId: "alice", viewerRole: "player" });
    const alice = view.players.find((player) => player.id === "alice")!;
    const bob = view.players.find((player) => player.id === "bob")!;

    expect(cardIds(alice.board!.hand)).toEqual(["alice_hand_0"]);
    expect(alice.board!.deck[0]?.name).toBe("Top Secret");
    expect(alice.board!.deckPeek.cardIds).toEqual(["alice_deck_0"]);

    expect(cardIds(bob.board!.hand)).toEqual([
      hiddenZoneCardId({ playerId: "bob", zone: "hand", index: 0 }),
      "bob_hand_1",
      "bob_hand_2",
    ]);
    expect(bob.board!.hand[0]).toMatchObject({
      name: "",
      source: "mainDeck",
      exhausted: false,
      createdAt: 0,
      isPlaceholder: true,
    });
    expect(cardIds(bob.board!.deck)).toEqual([
      hiddenZoneCardId({ playerId: "bob", zone: "deck", index: 0 }),
    ]);
    expect(cardIds(bob.board!.runeDeck)).toEqual([
      hiddenZoneCardId({ playerId: "bob", zone: "runeDeck", index: 0 }),
    ]);
    // face-down cards are placeholders, face-up cards stay visible
    expect(cardIds(bob.board!.base)).toEqual([
      hiddenZoneCardId({ playerId: "bob", zone: "base", index: 0 }),
      "bob_visible_base",
    ]);
    // private peek cleared for the opponent
    expect(bob.board!.deckPeek).toEqual({ cardIds: [], revealedCardIds: [] });

    // hidden info does not leak into the source room
    expect(room.players[1]!.board!.hand[0]!.name).toBe("Bob Secret");
  });

  it("reveals a fully revealed hand", () => {
    const room = deterministicRoom();
    room.players[1]!.board!.handRevealToOpponent = true;
    const view = redactRoomForViewer(room, { playerId: "alice", viewerRole: "player" });
    expect(cardIds(view.players[1]!.board!.hand)).toEqual([
      "bob_hand_0",
      "bob_hand_1",
      "bob_hand_2",
    ]);
  });

  it("honours handRevealedToPlayerIds and per-card reveals", () => {
    const room = deterministicRoom();
    room.players[1]!.board!.handRevealedToPlayerIds = ["alice"];
    const view = redactRoomForViewer(room, { playerId: "alice", viewerRole: "player" });
    expect(cardIds(view.players[1]!.board!.hand)).toEqual([
      "bob_hand_0",
      "bob_hand_1",
      "bob_hand_2",
    ]);
    const other = redactRoomForViewer(room, { playerId: "carol", viewerRole: "player" });
    expect(other.players[1]!.board!.hand[0]?.isPlaceholder).toBe(true);
  });

  it("lets spectators with grants see that player's private information", () => {
    const room = deterministicRoom();
    const spectator = {
      authSubject: "sub-1",
      displayName: "Spec",
      joinedAt: 1,
      updatedAt: 2,
      grantedPrivatePlayerIds: ["bob"],
    };
    const view = redactRoomForViewer(room, viewerForSpectator(spectator));
    expect(cardIds(view.players[1]!.board!.hand)).toEqual([
      "bob_hand_0",
      "bob_hand_1",
      "bob_hand_2",
    ]);
    expect(view.players[1]!.board!.deck[0]?.name).toBe("Bob Deck Secret");
    expect(view.players[1]!.board!.deckPeek.cardIds).toEqual(["bob_deck_0"]);
    // Alice did not grant: still hidden from the spectator.
    expect(view.players[0]!.board!.hand[0]?.isPlaceholder).toBe(true);
  });

  it("hides individual hands for plain spectators", () => {
    const room = deterministicRoom();
    const view = redactRoomForViewer(room, { viewerRole: "spectator" });
    expect(view.players[0]!.board!.hand[0]?.isPlaceholder).toBe(true);
    expect(view.players[1]!.board!.hand[1]?.id).toBe("bob_hand_1");
    expect(view.players[1]!.board!.hand[2]?.isPlaceholder).toBe(true);
  });

  it("shows every controlled board in solo modes", () => {
    const room = deterministicRoom();
    const view = redactRoomForViewer(room, {
      playerId: "alice",
      viewerRole: "player",
      controlledPlayerIds: ["alice", "bob"],
    });
    expect(cardIds(view.players[1]!.board!.hand)).toEqual([
      "bob_hand_0",
      "bob_hand_1",
      "bob_hand_2",
    ]);
  });

  it("redacts hidden chain cards", () => {
    const room = deterministicRoom();
    room.chainEntries = [
      {
        id: "chain_1",
        card: makeCard(makeRng(1), { id: "chain_card", hidden: true, name: "Sneaky" }),
        addedAt: 1,
        fromZone: "hand",
        byPlayerId: "bob",
        byPlayerName: "Bob",
      },
    ];
    const view = redactRoomForViewer(room, { playerId: "alice", viewerRole: "player" });
    expect(view.chainEntries[0]?.card.id).toBe(
      hiddenZoneCardId({ playerId: "bob", zone: "chain", index: 0 }),
    );
    const ownerView = redactRoomForViewer(room, { playerId: "bob", viewerRole: "player" });
    expect(ownerView.chainEntries[0]?.card.name).toBe("Sneaky");
  });

  it("preserves rune-pool counts so the client's patch guard accepts redacted deltas", () => {
    const room = deterministicRoom();
    const view = redactRoomForViewer(room, { playerId: "alice", viewerRole: "player" });
    for (const player of room.players) {
      const redacted = view.players.find((candidate) => candidate.id === player.id)!;
      expect(redacted.board!.runeDeck.length).toBe(player.board!.runeDeck.length);
      expect(redacted.board!.runeArea.length).toBe(player.board!.runeArea.length);
      expect(redacted.board!.hand.length).toBe(player.board!.hand.length);
    }
  });
});

describe("snapshotForViewer", () => {
  it("returns a redacted snapshot plus the public log and clock", () => {
    const room = deterministicRoom();
    const clock = {
      scopeKey: "s",
      totals: {},
      activeTargets: [],
      runningSince: null,
      serverNow: 1,
    };
    const snapshot = snapshotForViewer(
      { room, gameplayLogEntries: [{ id: "l", at: 1, text: "Hello" }], actionClock: clock },
      { playerId: "alice", viewerRole: "player" },
    );
    expect(snapshot.snapshot.players[1]!.board!.hand[0]?.isPlaceholder).toBe(true);
    expect(snapshot.gameplayLog).toHaveLength(1);
    expect(snapshot.actionClock).toEqual(clock);
  });
});
