import { describe, expect, it } from "vitest";
import type { DeckSections, Room, RoomPlayer } from "@rift/protocol";

import {
  battlefieldContributorIds,
  battlefieldOptions,
  firstPlayerChoiceOptions,
  mergeDeckEntries,
  mulliganPendingPlayers,
  nextBattlefieldActorId,
  nextMulliganActorId,
  toggleMulliganSelection,
  transferEntry,
} from "../setup-state";

function player(id: string, seat: number, extra: Partial<RoomPlayer> = {}): RoomPlayer {
  return {
    id,
    seat,
    name: id.toUpperCase(),
    joinedAt: 0,
    board: {
      score: 0,
      floatingEnergy: 0,
      floatingPower: 0,
      deck: [],
      hand: [
        { id: `${id}-h1`, name: "Card 1", source: "mainDeck", exhausted: false, createdAt: 0 },
        { id: `${id}-h2`, name: "Card 2", source: "mainDeck", exhausted: false, createdAt: 0 },
        { id: `${id}-h3`, name: "Card 3", source: "mainDeck", exhausted: false, createdAt: 0 },
      ],
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
    phase: "mulligan",
    players,
    log: [],
    chainEntries: [],
    chainResolveVotes: [],
    ...extra,
  } as Room;
}

describe("setup state", () => {
  it("puts the opponent first in a two-player first-player choice", () => {
    const state = room([player("p0", 1), player("p1", 2)], {
      phase: "first_player_choice",
      roomMode: "multiplayer",
      matchFormat: "bo1",
    });
    const translate = (key: string) =>
      ({
        "sim.youStart": "You Start",
        "sim.opponentStarts": "Opponent Starts",
      })[key] ?? key;
    expect(firstPlayerChoiceOptions(state, "p0", translate).map((entry) => entry.player.id)).toEqual([
      "p1",
      "p0",
    ]);
    expect(firstPlayerChoiceOptions(state, "p0", translate).map((entry) => entry.label)).toEqual([
      "Opponent Starts",
      "You Start",
    ]);
  });

  it("caps mulligan selection at two cards and toggles off", () => {
    expect(toggleMulliganSelection([], "a")).toEqual(["a"]);
    expect(toggleMulliganSelection(["a"], "b")).toEqual(["a", "b"]);
    expect(toggleMulliganSelection(["a", "b"], "c")).toEqual(["a", "b"]);
    expect(toggleMulliganSelection(["a", "b"], "a")).toEqual(["b"]);
  });

  it("routes mulligans to the next pending controlled seat", () => {
    const state = room([player("p0", 0), player("p1", 1)], {
      mulliganDonePlayerIds: ["p0"],
    });
    expect(mulliganPendingPlayers(state).map((entry) => entry.id)).toEqual(["p1"]);
    expect(nextMulliganActorId(state, ["p0", "p1"])).toBe("p1");
    expect(nextMulliganActorId(state, ["p0"])).toBeNull();
  });

  it("filters battlefields already taken by another player", () => {
    const p0 = player("p0", 0, { selectedBattlefield: "Minefield" });
    const p1 = player("p1", 1, {
      battlefieldOptions: ["Minefield", "Grove of the God-Willow"],
    });
    const state = room([p0, p1], { phase: "battlefield_pick" });
    expect(battlefieldOptions(state, p1)).toEqual(["Grove of the God-Willow"]);
    expect(nextBattlefieldActorId(state, ["p0", "p1"])).toBe("p1");
  });

  it("excludes the first player from FFA4 battlefield contribution", () => {
    const players = [player("p0", 0), player("p1", 1), player("p2", 2), player("p3", 3)];
    const state = room(players, {
      phase: "battlefield_pick",
      gameVariant: "free_for_all_4",
      firstPlayerId: "p0",
    });
    expect(battlefieldContributorIds(state)).toEqual(["p1", "p2", "p3"]);
  });

  it("merges duplicate deck entries case-insensitively by code/name", () => {
    expect(
      mergeDeckEntries([
        { name: "Rebuke", count: 2, cardCode: "OGN-039" },
        { name: "Rebuke", count: 1, cardCode: "OGN-039" },
      ]),
    ).toEqual([{ name: "Rebuke", count: 3, cardCode: "OGN-039" }]);
  });

  it("moves one sideboard copy at a time in both directions", () => {
    const sections: DeckSections = {
      legend: [],
      champion: [],
      mainDeck: [
        { name: "Rebuke", count: 2, cardCode: "OGN-039" },
        { name: "Jhin", count: 1, cardCode: "UNL-022" },
      ],
      battlefields: [],
      runes: [],
      sideboard: [],
    };
    const toSide = transferEntry(sections.mainDeck, sections.sideboard, "OGN-039");
    expect(toSide.from).toEqual([
      { name: "Rebuke", count: 1, cardCode: "OGN-039" },
      { name: "Jhin", count: 1, cardCode: "UNL-022" },
    ]);
    expect(toSide.to).toEqual([{ name: "Rebuke", count: 1, cardCode: "OGN-039" }]);
    const back = transferEntry(toSide.to, toSide.from, "OGN-039");
    expect(back.to).toEqual([
      { name: "Rebuke", count: 2, cardCode: "OGN-039" },
      { name: "Jhin", count: 1, cardCode: "UNL-022" },
    ]);
  });
});
