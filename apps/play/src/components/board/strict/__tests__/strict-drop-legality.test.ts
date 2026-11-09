/**
 * Strict drag performance guard: legality is computed once per drag source, then hover is O(1).
 */
import { describe, expect, it } from "vitest";

import type { CardInstance } from "@rift/protocol";

import {
  cachedStrictDragLegality,
  computeStrictDragLegality,
  strictDropAllowed,
  strictDropLegalityStats,
  strictDropTargetCard,
} from "../strict-drop-legality";
import { sandboxInGame, strictGestureRoom } from "../../../../../../../packages/engine/test/strict-gestures-fixture";

describe("strict drag legality cache", () => {
  it("does one legality computation per drag and answers many hovers from the cache", () => {
    const { room } = strictGestureRoom();
    const rebuke = room.players[0]!.board!.hand.find((card) => card.name === "Rebuke")!;
    strictDropLegalityStats.computeCount = 0;
    const legality = cachedStrictDragLegality(room, "p1", {
      cardId: rebuke.id,
      zone: "hand",
    });
    expect(strictDropLegalityStats.computeCount).toBe(1);
    expect(legality.targetIds.size).toBeGreaterThan(0);

    const targetIds = [...legality.targetIds];
    for (let index = 0; index < 100; index += 1) {
      for (const targetId of targetIds) {
        strictDropAllowed(legality, { zone: "battlefieldA", targetId });
      }
      strictDropAllowed(legality, { zone: "battlefieldB", targetId: "not-a-target" });
    }
    expect(strictDropLegalityStats.computeCount).toBe(1);
    // Repeated calls on the same room revision share the same snapshot.
    expect(
      cachedStrictDragLegality(room, "p1", { cardId: rebuke.id, zone: "hand" }),
    ).toBe(legality);
    expect(strictDropLegalityStats.computeCount).toBe(1);
  });

  it("carries targetCardId only for a deliberate target drop", () => {
    const { room, ids } = strictGestureRoom();
    const cards = new Map<string, CardInstance>();
    for (const player of room.players) {
      for (const value of Object.values(player.board ?? {})) {
        if (!Array.isArray(value)) continue;
        for (const card of value as CardInstance[]) cards.set(card.id, card);
      }
    }
    const spellLegality = cachedStrictDragLegality(room, "p1", {
      cardId: ids.rebuke,
      zone: "hand",
    });
    const targetId = [...spellLegality.targetIds].find((id) => cards.has(id));
    expect(targetId).toBeTruthy();
    const target = cards.get(targetId!)!;
    // Deliberate targeting (hovering a cached legal target) carries the id.
    expect(strictDropTargetCard(target, spellLegality, { strict: true })).toBe(target);
    // Hide never targets, and sandbox keeps its old behaviour.
    expect(strictDropTargetCard(target, spellLegality, { strict: true, hide: true })).toBeNull();
    expect(strictDropTargetCard(target, spellLegality, { strict: false })).toBe(target);
    expect(strictDropTargetCard(target, null, { strict: true })).toBeNull();

    // Move-out recommendation: a plain unit move battlefield → Base that lands over a base
    // card must not carry that card as a target.
    const moveLegality = cachedStrictDragLegality(room, "p1", {
      cardId: ids.hunter,
      zone: "battlefieldA",
    });
    const baseCard = cards.get(ids.keeperBase)!;
    expect(strictDropTargetCard(baseCard, moveLegality, { strict: true })).toBeNull();
  });

  it("does not compute strict sets in a sandbox room", () => {
    const room = sandboxInGame({
      now: 1,
      rng: () => 0.5,
      mode: "multiplayer",
    });
    const legality = computeStrictDragLegality(room, "p1", {
      cardId: room.players[0]!.board!.hand[0]?.id ?? "missing",
      zone: "hand",
    });
    expect(legality.zones.size).toBe(0);
    expect(legality.targetIds.size).toBe(0);
    expect(legality.hideZones.size).toBe(0);
  });
});
