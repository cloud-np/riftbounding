/**
 * Combat resolution kills — NEW-5 (rules 323.4, 429).
 *
 * A killed Unit is placed in its OWNER's Trash from wherever its controller has it, and the
 * strict object state is deleted only after the move succeeds.
 */
import { describe, expect, it } from "vitest";
import type { RulesHost, RulesStepContext } from "../../src";
import { dealDamage, runCombatResolution } from "../../src";
import { scenario } from "../scenarios/dsl";
import { boardOf, putCardAt, stepOf } from "../scenarios/cleanup-helpers";

describe("combat resolution kills [R323.4][R429]", () => {
  it("[R323.4][R429] a Unit owned by P1 but controlled by P2 is killed into P1's Trash", () => {
    const s = scenario();
    const card = putCardAt(s, "p1", "Treasure Hunter", "battlefieldA", "combat-owned-p1");
    card.ownerPlayerId = "p1";
    expect(s.host.setController(s.room, card.id, "p2")).toBe(true);
    expect(s.host.findCard(s.room, card.id)?.playerId).toBe("p2");

    s.room.rules!.combat = {
      battlefield: "battlefieldA",
      attacker: "p2",
      defender: "p1",
      step: "resolution",
    };
    dealDamage(s.room, card.id, 1, stepOf(s));

    const step = stepOf(s);
    expect(runCombatResolution(s.room, step)).toBe(true);

    // 323.4: "placed in their owners' Trash" — the owner is P1, not the controller P2.
    expect(boardOf(s, "p1").trash.some((entry) => entry.id === card.id)).toBe(true);
    expect(boardOf(s, "p2").trash.some((entry) => entry.id === card.id)).toBe(false);
    expect(boardOf(s, "p2").battlefieldA.some((entry) => entry.id === card.id)).toBe(false);
    expect(s.room.rules?.objects[card.id]).toBeUndefined();
    const kill = step.events.find((event) => event.type === "kill" && event.cardId === card.id);
    expect(kill?.zone).toBe("battlefieldA");
    expect(s.room.rules?.combat).toBe(null);
  });

  it("[R429] a failed kill move leaves the Unit and its rules object intact", () => {
    const s = scenario();
    const card = putCardAt(s, "p1", "Treasure Hunter", "battlefieldA", "combat-fail-p1");
    s.room.rules!.combat = {
      battlefield: "battlefieldA",
      attacker: "p1",
      defender: "p2",
      step: "resolution",
    };
    dealDamage(s.room, card.id, 1, stepOf(s));

    // Simulate a host-level move failure: the object must not be deleted (NEW-5).
    const failingHost: RulesHost = { ...s.host, moveCard: () => false };
    const step: RulesStepContext = { ctx: s.ctx, host: failingHost, events: [] };
    runCombatResolution(s.room, step);

    expect(boardOf(s, "p1").battlefieldA.some((entry) => entry.id === card.id)).toBe(true);
    // NEW-5: the rules object survives the failed kill. The Combat Cleanup then heals every Unit
    // at its inserted step 3c (468.1.a.1), so the surviving Unit's damage is healed, not kept.
    expect(s.room.rules?.objects[card.id]).toBeDefined();
    expect(s.room.rules?.objects[card.id]?.damage).toBeUndefined();
    expect(step.events.some((event) => event.type === "heal" && event.cardId === card.id)).toBe(true);
    expect(step.events.some((event) => event.type === "kill")).toBe(false);
  });
});
