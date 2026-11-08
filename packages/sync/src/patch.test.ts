import { describe, expect, it } from "vitest";
import type {
  CardInstance,
  GameplayLogEntry,
  RawActionClock,
  Room,
  RuntimePatch,
  RuntimePatchOperation,
} from "@rift/protocol";
import {
  applyRuntimePatch,
  applyRuntimePatchGuarded,
  emptyPatch,
  isResetAction,
  runeCountsPreserved,
  runeMultisetsPreserved,
  runePoolSizesPreserved,
  type RuntimePatchState,
} from "./patch";
import { deepEqual, diffRuntimeState, diffRoom } from "./diff";
import { makeCard, makeLog, makeRoom, makeRng, mutateRoom } from "./test-helpers";

function stateOf(room: Room, extra: Partial<RuntimePatchState> = {}): RuntimePatchState {
  return {
    room,
    sequence: extra.sequence ?? 3,
    gameplayLogEntries: extra.gameplayLogEntries ?? [],
    ...(extra.actionClock ? { actionClock: extra.actionClock } : {}),
    ...(extra.session ? { session: extra.session } : {}),
  };
}

function applyOperations(
  state: RuntimePatchState,
  operations: RuntimePatchOperation[],
): RuntimePatchState {
  return applyRuntimePatch(state, { operations });
}

describe("applyRuntimePatch", () => {
  it("returns the same state for an empty patch", () => {
    const room = makeRoom(makeRng(1));
    const state = stateOf(room);
    expect(applyRuntimePatch(state, emptyPatch())).toBe(state);
  });

  it("applies every room/chain/session/player/board/zone/card/log/clock operation", () => {
    const rng = makeRng(2);
    const room = makeRoom(rng);
    const player = room.players[0]!;
    const board = player.board!;
    const card = makeCard(rng, { id: "card_explicit" });
    const secondCard = makeCard(rng, { id: "card_explicit_2" });
    const logEntry: GameplayLogEntry = { id: "log_explicit", at: 1, text: "Hello" };
    const clock: RawActionClock = {
      scopeKey: "scope",
      totals: { [player.id]: 12 },
      activeTargets: [{ playerId: player.id, reason: "turn" }],
      runningSince: 5,
      serverNow: 9,
    };

    const operations: RuntimePatchOperation[] = [
      { op: "set_room_fields", fields: { turnNumber: 9, nested: { a: [1, 2] } } },
      { op: "unset_room_fields", fields: ["updatedAt"] },
      { op: "chain_insert", index: 0, entries: [] },
      { op: "chain_replace", entries: [] },
      { op: "chain_remove", entryIds: [] },
      { op: "set_session_fields", fields: { phase: "in_game" } },
      { op: "unset_session_fields", fields: ["missing"] },
      { op: "set_player_fields", playerId: player.id, fields: { name: "Explicit" } },
      { op: "unset_player_fields", playerId: player.id, fields: ["leftAt"] },
      { op: "set_board_fields", playerId: player.id, fields: { score: 7 } },
      { op: "unset_board_fields", playerId: player.id, fields: ["recycledDeckBottomCount"] },
      { op: "zone_insert", playerId: player.id, zone: "hand", index: 0, cards: [card] },
      {
        op: "zone_move",
        from: { playerId: player.id, zone: "hand" },
        to: { playerId: player.id, zone: "base", index: 0 },
        cardId: card.id,
      },
      {
        op: "zone_move",
        from: { playerId: player.id, zone: "base" },
        to: { playerId: player.id, zone: "trash", index: 0 },
        cardId: card.id,
        card: { ...card, exhausted: true },
      },
      { op: "zone_replace", playerId: player.id, zone: "base", cards: [] },
      { op: "zone_insert", playerId: player.id, zone: "base", index: 0, cards: [secondCard] },
      { op: "zone_reorder", playerId: player.id, zone: "base", cardIds: [secondCard.id] },
      { op: "zone_replace", playerId: player.id, zone: "battlefieldA", cards: [] },
      {
        op: "patch_card_fields",
        playerId: player.id,
        zone: "trash",
        cardId: card.id,
        fields: { might: 99 },
      },
      {
        op: "unset_card_fields",
        playerId: player.id,
        zone: "trash",
        cardId: card.id,
        fields: ["cardCode"],
      },
      { op: "zone_remove", playerId: player.id, zone: "trash", cardIds: [card.id] },
      { op: "log_insert", index: 0, entries: [logEntry] },
      { op: "log_remove", entryIds: [] },
      { op: "log_replace", entries: [logEntry] },
      { op: "set_action_clock", actionClock: clock },
      { op: "clear_action_clock" },
    ];
    const next = applyOperations(stateOf(room), operations);
    expect(next.room.players[0]?.name).toBe("Explicit");
    expect(next.room.turnNumber).toBe(9);
    expect(next.room.updatedAt).toBeUndefined();
    expect(next.room.players[0]?.board?.score).toBe(7);
    expect(next.room.players[0]?.board?.hand.length).toBe(board.hand.length);
    expect(next.room.players[0]?.board?.trash.length).toBe(board.trash.length);
    expect(next.room.players[0]?.board?.base[0]?.id).toBe(secondCard.id);
    expect(next.gameplayLogEntries).toEqual([logEntry]);
    expect(next.actionClock).toBeUndefined();
    expect(next.session).toEqual({ phase: "in_game" });
  });

  it("preserves input immutability", () => {
    const rng = makeRng(3);
    const room = makeRoom(rng);
    const state = stateOf(room, { gameplayLogEntries: makeLog(rng, 2) });
    const before = structuredClone(state);
    const card = makeCard(rng);
    applyRuntimePatch(state, {
      operations: [
        { op: "zone_insert", playerId: room.players[0]!.id, zone: "hand", index: 0, cards: [card] },
        { op: "set_room_fields", fields: { turnNumber: 77 } },
      ],
    });
    expect(deepEqual(state, before)).toBe(true);
  });

  it("throws the original error messages for malformed operations", () => {
    const room = makeRoom(makeRng(4));
    const state = stateOf(room);
    const playerId = room.players[0]!.id;
    const cases: Array<[RuntimePatchOperation, string]> = [
      [
        { op: "set_player_fields", playerId: "nope", fields: {} },
        "Cannot apply runtime patch for unknown player nope.",
      ],
      [
        { op: "zone_insert", playerId, zone: "hand", index: -1, cards: [] },
        "Cannot insert runtime cards at index -1.",
      ],
      [
        { op: "zone_remove", playerId, zone: "hand", cardIds: ["missing"] },
        "Cannot remove missing runtime card missing.",
      ],
      [
        { op: "patch_card_fields", playerId, zone: "hand", cardId: "missing", fields: {} },
        "Cannot patch missing runtime card missing.",
      ],
      [
        { op: "zone_reorder", playerId, zone: "hand", cardIds: ["a", "b"] },
        "Cannot reorder runtime zone with different card count.",
      ],
    ];
    for (const [operation, message] of cases) {
      expect(() => applyRuntimePatch(state, { operations: [operation] })).toThrow(message);
    }
    expect(() =>
      applyRuntimePatch(state, {
        operations: [
          { op: "zone_replace", playerId, zone: "hand", cards: [] },
          { op: "zone_insert", playerId, zone: "hand", index: 0, cards: [makeCard(makeRng(4))] },
          { op: "zone_reorder", playerId, zone: "hand", cardIds: ["missing"] },
        ],
      }),
    ).toThrow("Cannot reorder missing or repeated runtime card missing.");
    expect(() =>
      applyRuntimePatch(state, {
        operations: [{ op: "totally_unknown" } as unknown as RuntimePatchOperation],
      }),
    ).toThrow("Unknown runtime patch operation");
  });

  it("rejects invalid patch payloads", () => {
    const state = stateOf(makeRoom(makeRng(5)));
    expect(() => applyRuntimePatch(state, null as unknown as RuntimePatch)).toThrow(
      "Runtime patch payload is invalid.",
    );
    expect(() =>
      applyRuntimePatch(state, { operations: "nope" } as unknown as RuntimePatch),
    ).toThrow("Runtime patch payload is invalid.");
  });
});

describe("rune invariants", () => {
  it("checks rune-pool sizes and multisets", () => {
    const rng = makeRng(6);
    const room = makeRoom(rng);
    const player = room.players[0]!;
    const board = player.board!;
    const same = structuredClone(room);
    expect(runePoolSizesPreserved(room, same)).toBe(true);
    expect(runeCountsPreserved(room, same)).toBe(true);
    expect(runeMultisetsPreserved(room, same)).toBe(true);

    const moved = structuredClone(room);
    const movedBoard = moved.players[0]!.board!;
    const rune = movedBoard.runeDeck[0];
    if (rune) {
      movedBoard.runeDeck.splice(0, 1);
      movedBoard.runeArea.push(rune);
      expect(runePoolSizesPreserved(room, moved)).toBe(true);
      expect(runeCountsPreserved(room, moved)).toBe(true);
      expect(runeMultisetsPreserved(room, moved)).toBe(true);
    }

    const removed = structuredClone(room);
    removed.players[0]!.board!.runeArea.pop();
    if (board.runeArea.length > 0) {
      expect(runePoolSizesPreserved(room, removed)).toBe(false);
      expect(runeCountsPreserved(room, removed)).toBe(false);
      expect(runeMultisetsPreserved(room, removed)).toBe(false);
    }

    // Same pool sizes but different ids: the size guard passes, the multiset guard does not.
    const swapped = structuredClone(room);
    const swappedBoard = swapped.players[0]!.board!;
    if (swappedBoard.runeDeck.length > 0) {
      swappedBoard.runeDeck[0]!.id = "swapped_rune_id";
      expect(runeCountsPreserved(room, swapped)).toBe(true);
      expect(runeMultisetsPreserved(room, swapped)).toBe(false);
    }
  });

  it("guarded apply returns null when rune pool size changes", () => {
    const room = makeRoom(makeRng(7));
    const player = room.players[0]!;
    const card = makeCard(makeRng(8), { id: "new_rune" });
    const patch: RuntimePatch = {
      operations: [
        { op: "zone_insert", playerId: player.id, zone: "runeArea", index: 0, cards: [card] },
      ],
    };
    expect(applyRuntimePatchGuarded(stateOf(room), patch)).toBeNull();
  });
});

describe("isResetAction", () => {
  it("classifies rewind/forward snapshots", () => {
    expect(isResetAction({ type: "rewind_last_action" })).toBe("rewind");
    expect(isResetAction({ type: "forward_last_rewind" })).toBe("forward");
    expect(isResetAction({ type: "end_turn" })).toBeNull();
    expect(isResetAction(undefined)).toBeNull();
  });
});

describe("diff → apply round trip", () => {
  it("reconstructs the next state for 300 random mutations", () => {
    const rng = makeRng(0x5eed);
    for (let iteration = 0; iteration < 300; iteration += 1) {
      const room = makeRoom(rng, 2 + Math.floor(rng() * 2));
      const previous: RuntimePatchState = {
        room,
        sequence: iteration,
        gameplayLogEntries: makeLog(rng, Math.floor(rng() * 4)),
        ...(rng() < 0.4
          ? {
              actionClock: {
                scopeKey: `scope_${iteration % 3}`,
                totals: Object.fromEntries(
                  room.players.map((p) => [p.id, Math.floor(rng() * 10_000)]),
                ),
                activeTargets: room.players[0]
                  ? [{ playerId: room.players[0].id, reason: "turn" as const }]
                  : [],
                runningSince: rng() < 0.5 ? null : Math.floor(rng() * 10_000),
                serverNow: Math.floor(rng() * 10_000),
              },
            }
          : {}),
        ...(rng() < 0.2 ? { session: { phase: "in_game", revision: Math.floor(rng() * 4) } } : {}),
      };
      let nextRoom = structuredClone(room);
      const mutations = 1 + Math.floor(rng() * 4);
      for (let index = 0; index < mutations; index += 1) {
        nextRoom = mutateRoom(rng, nextRoom);
      }
      const nextLog =
        rng() < 0.5 ? makeLog(rng, Math.floor(rng() * 4)) : previous.gameplayLogEntries;
      const nextClock = rng() < 0.3 ? undefined : previous.actionClock;
      const nextSession = rng() < 0.5 ? undefined : previous.session;
      const next: RuntimePatchState = {
        room: nextRoom,
        sequence: iteration + 1,
        gameplayLogEntries: nextLog,
        ...(nextClock ? { actionClock: nextClock } : {}),
        ...(nextSession ? { session: nextSession } : {}),
      };
      const before = structuredClone(previous);
      const patch = diffRuntimeState(previous, next);
      const applied = applyRuntimePatch(previous, patch);
      expect(deepEqual(applied.room, next.room), `room mismatch at iteration ${iteration}`).toBe(
        true,
      );
      expect(
        deepEqual(applied.gameplayLogEntries, next.gameplayLogEntries),
        `log mismatch at iteration ${iteration}`,
      ).toBe(true);
      expect(
        deepEqual(applied.actionClock, next.actionClock),
        `clock mismatch at ${iteration}`,
      ).toBe(true);
      const appliedSession =
        applied.session && Object.keys(applied.session).length > 0 ? applied.session : undefined;
      expect(deepEqual(appliedSession, next.session), `session mismatch at ${iteration}`).toBe(
        true,
      );
      expect(deepEqual(previous, before), `input mutated at iteration ${iteration}`).toBe(true);
    }
  });

  it("diffs rooms alone", () => {
    const rng = makeRng(9);
    const room = makeRoom(rng);
    const next = structuredClone(room);
    const player = next.players[0]!;
    const card = makeCard(rng);
    player.board!.hand.push(card);
    next.updatedAt += 1;
    const applied = applyRuntimePatch(
      { room, sequence: 0, gameplayLogEntries: [] },
      diffRoom(room, next),
    );
    expect(deepEqual(applied.room, next)).toBe(true);
  });
});
