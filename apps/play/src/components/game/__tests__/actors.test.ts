import { describe, expect, it } from "vitest";
import type { Room, RoomPlayer } from "@rift/protocol";

import { chooseIntentActor, seatedPlayerIds } from "../actors";

function player(id: string, seat: number, extra: Partial<RoomPlayer> = {}): RoomPlayer {
  return {
    id,
    seat,
    name: id,
    joinedAt: 0,
    board: {
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
      battlefieldToken: [],
      champion: [],
      legend: [],
      runeDeck: [],
      runeArea: [],
      deckPeek: { cardIds: [], revealedCardIds: [] },
    },
    ...extra,
  };
}

function room(players: RoomPlayer[], extra: Partial<Room> = {}): Room {
  return {
    roomCode: "AB12CD",
    createdAt: 0,
    updatedAt: 0,
    phase: "in_game",
    players,
    log: [],
    chainEntries: [],
    chainResolveVotes: [],
    ...extra,
  } as Room;
}

const both = ["p0", "p1"];

describe("chooseIntentActor", () => {
  it("uses the current viewer for normal gameplay actions in a controlled solo seat", () => {
    const state = room([player("p0", 0), player("p1", 1)]);
    expect(chooseIntentActor({ type: "draw_cards", count: 1 }, state, "p1", both)).toBe("p1");
    expect(chooseIntentActor({ type: "draw_cards", count: 1 }, state, "p0", both)).toBe("p0");
  });

  it("routes end-turn actions to the active player when controlled", () => {
    const state = room([player("p0", 0), player("p1", 1)], { activeTurnPlayerId: "p1" });
    expect(chooseIntentActor({ type: "end_turn" } as never, state, "p0", both)).toBe("p1");
  });

  it("routes setup actions to the seat that still needs to act", () => {
    const state = room([player("p0", 0, { selectedBattlefield: "Abandoned Hall" }), player("p1", 1)], {
      phase: "battlefield_pick",
    });
    expect(
      chooseIntentActor(
        { type: "select_battlefield", battlefield: "Altar of Blood" } as never,
        state,
        "p0",
        both,
      ),
    ).toBe("p1");
  });

  it("never sends an actor outside the controlled seats", () => {
    const state = room([player("p0", 0), player("p1", 1)], { activeTurnPlayerId: "p1" });
    expect(chooseIntentActor({ type: "end_turn" } as never, state, "p0", ["p0"])).toBe("p0");
    expect(chooseIntentActor({ type: "draw_cards", count: 1 }, state, "p0", ["p0"])).toBe("p0");
  });

  it("uses the host for the dev auto-setup action", () => {
    const state = room([player("p0", 0), player("p1", 1)], { hostPlayerId: "p0" });
    expect(chooseIntentActor({ type: "auto_start_test_setup" } as never, state, "p1", both)).toBe(
      "p0",
    );
  });
});

describe("seatedPlayerIds", () => {
  it("only includes players with a board who have not left", () => {
    const state = room([
      player("p0", 0),
      { ...player("p1", 1), leftAt: 1 },
      { id: "p2", seat: 2, name: "p2", joinedAt: 0 },
    ]);
    expect(seatedPlayerIds(state)).toEqual(["p0"]);
  });
});
