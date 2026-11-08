import { describe, expect, it } from "vitest";
import type { ChainEntry, Room, RoomPlayer } from "@rift/protocol";

import {
  chainPriority,
  chainResolveDestination,
  hasFlowKeyword,
  hasRepeatKeyword,
  isTimeWarpCard,
  readChainEntryDrag,
  writeChainEntryDrag,
} from "../chain-utils";

function player(id: string, seat: number): RoomPlayer {
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
  };
}

function entry(overrides: Partial<ChainEntry> = {}): ChainEntry {
  return {
    id: "chain_1",
    card: {
      id: "card-1",
      name: "Rebuke",
      source: "mainDeck",
      exhausted: false,
      createdAt: 0,
      keywords: ["Repeat", "Flow"],
      text: "Take a turn after this one. Banish this.",
    },
    addedAt: 0,
    fromZone: "hand",
    byPlayerId: "p0",
    byPlayerName: "P0",
    ...overrides,
  };
}

function room(entries: ChainEntry[], votes: string[] = []): Room {
  return {
    roomCode: "AB12CD",
    createdAt: 0,
    updatedAt: 0,
    phase: "in_game",
    players: [player("p0", 0), player("p1", 1)],
    log: [],
    chainEntries: entries,
    chainResolveVotes: votes,
  } as Room;
}

describe("chain utils", () => {
  it("derives priority participants and votes", () => {
    const priority = chainPriority(room([entry()], ["p1"]), "p0", "multiplayer");
    expect(priority.owner?.id).toBe("p0");
    expect(priority.participants.map((p) => p.id)).toEqual(["p1"]);
    expect(priority.allApproved).toBe(true);
    expect(priority.canResolve).toBe(true);
    expect(priority.viewerIsOwner).toBe(true);
  });

  it("only lets a non-owner participant approve", () => {
    const priority = chainPriority(room([entry()]), "p1", "multiplayer");
    expect(priority.canApprove).toBe(true);
    expect(priority.canResolve).toBe(false);
    const approved = chainPriority(room([entry()], ["p1"]), "p1", "multiplayer");
    expect(approved.canApprove).toBe(false);
    expect(approved.viewerApproved).toBe(true);
  });

  it("allows the owner to resolve immediately in solo lab", () => {
    const priority = chainPriority(room([entry()]), "p0", "solo_lab");
    expect(priority.allApproved).toBe(false);
    expect(priority.canResolve).toBe(true);
  });

  it("detects Repeat, Flow and Time Warp", () => {
    const value = entry();
    expect(hasRepeatKeyword(value)).toBe(true);
    expect(hasFlowKeyword(value)).toBe(true);
    expect(isTimeWarpCard(value)).toBe(true);
    expect(chainResolveDestination(value)).toBe("trash");
    expect(chainResolveDestination({ ...value, flowEnabled: true })).toBe("banished");
  });

  it("round-trips the custom drag MIME", () => {
    const writes = new Map<string, string>();
    const dataTransfer = {
      setData: (type: string, value: string) => writes.set(type, value),
      getData: (type: string) => writes.get(type) ?? "",
      effectAllowed: "",
    } as unknown as DataTransfer;
    writeChainEntryDrag(dataTransfer, entry());
    expect(writes.get("application/x-riftbound-chain-entry")).toBeTruthy();
    expect(readChainEntryDrag(dataTransfer)).toEqual({ entryId: "chain_1", cardId: "card-1" });
  });
});
