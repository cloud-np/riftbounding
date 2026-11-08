/**
 * Official examples in the cleanup / combat range that are not covered next to their rule tests
 * (`test/rules/combat/*`): 142.4.b (lethal damage, cleanup 323.4) and 324.1 (Combat Cleanup).
 */
import { describe, expect, it } from "vitest";
import { COMBAT_CLEANUP_INSERTS, dealDamage, runCleanup, runCombatCleanup } from "../../src";
import { scenario } from "../scenarios/dsl";
import { boardOf, placeUnit, stepOf } from "../rules/combat/helpers";

describe("official examples — cleanups and combat [R142][R324]", () => {
  it("[EX:142.4.b][R323.4] a 5-Might unit with 3 damage whose Might becomes 3 has lethal damage and dies in the cleanup", () => {
    const s = scenario({ extraCards: { p1: ["Petty Officer"] } });
    const unit = placeUnit(s, "p1", "Petty Officer", "base", "officer");
    dealDamage(s.room, unit.id, 3, stepOf(s));
    runCleanup(s.room, stepOf(s));
    expect(boardOf(s, "p1").base.some((card) => card.id === unit.id)).toBe(true);
    // "Frigid Touch": the unit's Might becomes 3 (modelled as -2 this turn).
    s.room.rules!.objects[unit.id] = { ...s.room.rules!.objects[unit.id], temporaryMight: -2 };
    runCleanup(s.room, stepOf(s));
    expect(boardOf(s, "p1").trash.some((card) => card.id === unit.id)).toBe(true);
  });

  it("[EX:142.4.b] a 0-Might unit needs at least 1 damage marked to have lethal damage", () => {
    const s = scenario();
    const unit = placeUnit(s, "p1", "Clockwork Keeper", "base", "zero");
    s.room.rules!.objects[unit.id] = { temporaryMight: -2 };
    runCleanup(s.room, stepOf(s));
    expect(boardOf(s, "p1").base.some((card) => card.id === unit.id)).toBe(true);
    dealDamage(s.room, unit.id, 1, stepOf(s));
    runCleanup(s.room, stepOf(s));
    expect(boardOf(s, "p1").trash.some((card) => card.id === unit.id)).toBe(true);
  });

  it("[EX:324.1][R468.1.a] the Combat Cleanup inserts 3c heal and 3d recall after 3a; lethal damage still dies first", () => {
    expect([...COMBAT_CLEANUP_INSERTS]).toEqual(["heal-all-units", "recall-attackers"]);
    const s = scenario();
    const attacker = placeUnit(s, "p1", "Stellacorn Herder", "battlefieldA", "atk");
    const defender = placeUnit(s, "p2", "Clockwork Keeper", "battlefieldA", "def");
    const bystander = placeUnit(s, "p2", "Stellacorn Herder", "base", "elsewhere");
    s.room.rules!.combat = { battlefield: "battlefieldA", attacker: "p1", defender: "p2", step: "resolution" };
    s.room.rules!.history.combatProgress = { battlefield: "battlefieldA", stage: "cleanup" };
    s.room.rules!.objects[attacker.id] = { designation: "attacker", damage: 1 };
    s.room.rules!.objects[defender.id] = { designation: "defender", damage: 2 };
    s.room.rules!.objects[bystander.id] = { damage: 2 };
    const step = stepOf(s);
    runCombatCleanup(s.room, step);
    // 3a: the defender (2 damage, 2 Might) dies before 3c heals every other unit, wherever it is.
    expect(boardOf(s, "p2").trash.some((card) => card.id === defender.id)).toBe(true);
    expect(s.room.rules?.objects[attacker.id]?.damage).toBeUndefined();
    expect(s.room.rules?.objects[bystander.id]?.damage).toBeUndefined();
    // 3d: no Defenders remain, so the Attacker is not recalled.
    expect(boardOf(s, "p1").battlefieldA.some((card) => card.id === attacker.id)).toBe(true);
    const types = step.events.map((event) => event.type);
    expect(types.indexOf("kill")).toBeLessThan(types.indexOf("heal"));
  });
});
