/**
 * Equipped Might reaches the host unit through the real Equip flow, and combat reads it —
 * the client's might badge must show the same number (it reads `effectiveMight`).
 */
import { describe, expect, it } from "vitest";
import { effectiveMight } from "../../src";
import { boardOf, passUntilSettled } from "../rules/combat/helpers";
import { withCards, put, settle } from "../cards/sfd/helpers";
import { setControl } from "./helpers";

const ALL_POWER = ["Body", "Calm", "Chaos", "Fury", "Mind", "Order", "any"] as const;

describe("equipment Might [R718.4][R818]", () => {
  it("[C:Doran's Shield] Equip adds +1 Might to the unit and combat damage uses it", () => {
    const s = withCards(["Doran's Shield"]);
    const unit = put(s, "p1", "Caitlyn, Patrolling", "base", { id: "atk" });
    const shield = put(s, "p1", "Doran's Shield", "base");
    put(s, "p2", "Stellacorn Herder", "battlefieldA", { id: "def" });
    setControl(s.room, "battlefieldA", "p2");

    expect(effectiveMight(s.room, unit.id, s.host)).toBe(3);
    s.room.rules!.pools.p1 = { energy: 9, power: Object.fromEntries(ALL_POWER.map((key) => [key, 9])) };
    s.as("p1")
      .apply({ type: "rules_activate", objectId: shield.id, ability: "equip:0", choices: { "target:0": unit.id } } as never)
      .expectOk();
    settle(s);
    expect(effectiveMight(s.room, unit.id, s.host)).toBe(4);

    s.as("p1").apply({ type: "rules_move", unitIds: [unit.id], to: "battlefieldA" }).expectOk();
    const events = passUntilSettled(s);
    const assigned = events.filter((event) => event.type === "damage_assigned").map((event) => [event.playerId, event.amount]);
    // Attacker deals its full effective Might (3 + 1); the 3 Might defender deals 3.
    expect(assigned).toContainEqual(["p1", 4]);
    expect(assigned).toContainEqual(["p2", 3]);
    expect(boardOf(s, "p2").trash.some((card) => card.id === "def")).toBe(true);
  });
});
