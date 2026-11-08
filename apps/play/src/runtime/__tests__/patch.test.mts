import { describe, expect, it } from "vitest";
import type { CardInstance, GameplayLogEntry, PlayerBoard, Room } from "@rift/protocol";
import {
  applyRuntimePatch,
  cooldownUntil,
  isHistoryNavigationAction,
  resetToken,
  runeCountsPreserved,
  runeMultisetsPreserved,
  runePoolCounts,
} from "../patch";

function card(id: string, extra: Partial<CardInstance> = {}): CardInstance {
  return { id, name: id, source: "mainDeck", exhausted: false, createdAt: 0, ...extra };
}

function board(extra: Partial<PlayerBoard> = {}): PlayerBoard {
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
    battlefieldToken: [],
    champion: [],
    legend: [],
    runeDeck: [],
    runeArea: [],
    deckPeek: { cardIds: [], revealedCardIds: [] },
    ...extra,
  };
}

function room(
  players: Array<{ id: string; board?: PlayerBoard }> = [{ id: "p1", board: board() }],
): Room {
  return {
    roomCode: "AB12CD",
    createdAt: 0,
    updatedAt: 0,
    phase: "in_game",
    players: players.map((player, seat) => ({
      id: player.id,
      seat,
      name: player.id,
      joinedAt: 0,
      ...(player.board ? { board: player.board } : {}),
    })),
    log: [],
    chainEntries: [],
    chainResolveVotes: [],
  };
}

function logEntry(id: string): GameplayLogEntry {
  return { id, at: 0, text: `${id} happened` };
}

describe("applyRuntimePatch", () => {
  it("applies room/player/board field patches immutably", () => {
    const previous = room();
    const next = applyRuntimePatch(
      { room: previous, sequence: 1, gameplayLogEntries: [] },
      {
        operations: [
          { op: "set_room_fields", fields: { turnNumber: 3, activeTurnPlayerId: "p1" } },
          { op: "set_player_fields", playerId: "p1", fields: { name: "Kai" } },
          { op: "set_board_fields", playerId: "p1", fields: { score: 2, floatingEnergy: 1 } },
        ],
      },
    );
    expect(next.room).not.toBe(previous);
    expect(next.room.turnNumber).toBe(3);
    expect(next.room.activeTurnPlayerId).toBe("p1");
    expect(next.room.players[0]!.name).toBe("Kai");
    expect(next.room.players[0]!.board!.score).toBe(2);
    // untouched source objects stay intact
    expect(previous.turnNumber).toBeUndefined();
    expect(previous.players[0]!.name).toBe("p1");
    expect(previous.players[0]!.board!.score).toBe(0);
  });

  it("moves a card between zones with zone_move and preserves insertion order", () => {
    const previous = room([
      { id: "p1", board: board({ hand: [card("a"), card("b")], base: [card("x")] }) },
    ]);
    const next = applyRuntimePatch(
      { room: previous, sequence: 4, gameplayLogEntries: [] },
      {
        operations: [
          {
            op: "zone_move",
            from: { playerId: "p1", zone: "hand" },
            to: { playerId: "p1", zone: "base", index: 1 },
            cardId: "a",
          },
        ],
      },
    );
    expect(next.room.players[0]!.board!.hand.map((c) => c.id)).toEqual(["b"]);
    expect(next.room.players[0]!.board!.base.map((c) => c.id)).toEqual(["x", "a"]);
  });

  it("patches individual card fields", () => {
    const previous = room([{ id: "p1", board: board({ base: [card("a", { might: 3 })] }) }]);
    const next = applyRuntimePatch(
      { room: previous, sequence: 2, gameplayLogEntries: [] },
      {
        operations: [
          {
            op: "patch_card_fields",
            playerId: "p1",
            zone: "base",
            cardId: "a",
            fields: { might: 5, exhausted: true },
          },
          { op: "unset_card_fields", playerId: "p1", zone: "base", cardId: "a", fields: ["might"] },
        ],
      },
    );
    const patched = next.room.players[0]!.board!.base[0]!;
    expect(patched.exhausted).toBe(true);
    expect(patched.might).toBeUndefined();
    expect(previous.players[0]!.board!.base[0]!.might).toBe(3);
  });

  it("throws on reorder with a different card count (caller turns this into a resync)", () => {
    const previous = room([{ id: "p1", board: board({ base: [card("a"), card("b")] }) }]);
    expect(() =>
      applyRuntimePatch(
        { room: previous, sequence: 2, gameplayLogEntries: [] },
        { operations: [{ op: "zone_reorder", playerId: "p1", zone: "base", cardIds: ["a"] }] },
      ),
    ).toThrow(/different card count/);
  });

  it("reorders cards", () => {
    const previous = room([
      { id: "p1", board: board({ base: [card("a"), card("b"), card("c")] }) },
    ]);
    const next = applyRuntimePatch(
      { room: previous, sequence: 2, gameplayLogEntries: [] },
      {
        operations: [
          { op: "zone_reorder", playerId: "p1", zone: "base", cardIds: ["c", "a", "b"] },
        ],
      },
    );
    expect(next.room.players[0]!.board!.base.map((c) => c.id)).toEqual(["c", "a", "b"]);
  });

  it("supports chain and log operations", () => {
    const previous = room();
    const next = applyRuntimePatch(
      { room: previous, sequence: 1, gameplayLogEntries: [logEntry("l1")] },
      {
        operations: [
          { op: "chain_insert", index: 0, entries: [{ id: "chain_1_1", card: card("a") }] },
          { op: "log_insert", index: 1, entries: [logEntry("l2")] },
          { op: "log_remove", entryIds: ["l1"] },
        ],
      },
    );
    expect(next.room.chainEntries.map((entry) => (entry as { id: string }).id)).toEqual([
      "chain_1_1",
    ]);
    expect(next.gameplayLogEntries.map((entry) => entry.id)).toEqual(["l2"]);
  });

  it("rejects unknown operations", () => {
    const previous = room();
    expect(() =>
      applyRuntimePatch(
        { room: previous, sequence: 1, gameplayLogEntries: [] },
        { operations: [{ op: "not_a_real_op" } as never] },
      ),
    ).toThrow(/Unknown runtime patch operation/);
  });

  it("hydrates and clears the action clock", () => {
    const previous = room();
    const withClock = applyRuntimePatch(
      { room: previous, sequence: 1, gameplayLogEntries: [] },
      {
        operations: [
          {
            op: "set_action_clock",
            actionClock: {
              scopeKey: "s",
              totals: { p1: 5 },
              activeTargets: [],
              runningSince: null,
              serverNow: 0,
            },
          },
        ],
      },
    );
    expect(withClock.actionClock).toEqual({
      scopeKey: "s",
      totals: { p1: 5 },
      activeTargets: [],
      runningSince: null,
      serverNow: 0,
    });
    const cleared = applyRuntimePatch(withClock, { operations: [{ op: "clear_action_clock" }] });
    expect(cleared.actionClock).toBeUndefined();
  });

  it("returns the same state for an empty patch", () => {
    const state = { room: room(), sequence: 1, gameplayLogEntries: [] };
    expect(applyRuntimePatch(state, { operations: [] })).toBe(state);
  });
});

describe("rune conservation (618260)", () => {
  it("compares rune pool sizes per player", () => {
    const before = room([
      { id: "p1", board: board({ runeDeck: [card("r1"), card("r2")], runeArea: [card("r3")] }) },
    ]);
    const sameSize = room([
      { id: "p1", board: board({ runeDeck: [card("r1")], runeArea: [card("r2"), card("r3")] }) },
    ]);
    const smaller = room([
      { id: "p1", board: board({ runeDeck: [card("r1")], runeArea: [card("r3")] }) },
    ]);
    expect(runeCountsPreserved(before, sameSize)).toBe(true);
    expect(runeCountsPreserved(before, smaller)).toBe(false);
    expect(runePoolCounts(before)).toEqual({ p1: 3 });
  });

  it("compares rune multisets per player", () => {
    const before = room([{ id: "p1", board: board({ runeDeck: [card("r1"), card("r2")] }) }]);
    const swapped = room([{ id: "p1", board: board({ runeDeck: [card("r2"), card("r1")] }) }]);
    const replaced = room([{ id: "p1", board: board({ runeDeck: [card("r1"), card("r9")] }) }]);
    expect(runeMultisetsPreserved(before, swapped)).toBe(true);
    expect(runeMultisetsPreserved(before, replaced)).toBe(false);
  });
});

describe("reset tokens + cooldowns", () => {
  it("classifies rewind/forward actions", () => {
    expect(isHistoryNavigationAction({ type: "rewind_last_action" })).toBe("rewind");
    expect(isHistoryNavigationAction({ type: "forward_last_rewind" })).toBe("forward");
    expect(
      isHistoryNavigationAction({ type: "respond_rewind_confirmation", response: "approve" }),
    ).toBe("rewind");
    expect(
      isHistoryNavigationAction({ type: "respond_rewind_confirmation", response: "decline" }),
    ).toBeNull();
    expect(isHistoryNavigationAction({ type: "end_turn" })).toBeNull();
    expect(isHistoryNavigationAction(undefined)).toBeNull();
  });

  it("builds reset tokens", () => {
    expect(resetToken({ gameInstanceId: "gi", sequence: 7, token: "t" })).toEqual({
      gameInstanceId: "gi",
      kind: "snapshot",
      sequence: 7,
      token: "t",
    });
    expect(
      resetToken({
        action: { type: "rewind_last_action" },
        gameInstanceId: "gi",
        sequence: 7,
        token: "t",
      }).kind,
    ).toBe("rewind");
  });

  it("clamps cooldowns", () => {
    expect(cooldownUntil(5000, 1000)).toBe(6000);
    expect(cooldownUntil(0, 1000)).toBeNull();
    expect(cooldownUntil(undefined, 1000)).toBeNull();
    expect(cooldownUntil(1.5, 1000)).toBeNull();
  });
});
