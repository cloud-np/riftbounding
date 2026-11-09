/**
 * Edge cases: Start/End of Turn timing that players hit every game — docs/rules/edge-cases-audit.md.
 */
import { describe, expect, it } from "vitest";
import { effectiveMight } from "../../src";
import { controllerOf } from "../rules/combat/helpers";
import { boardOf, drive, duel, nextOwnTurn, placeUnit, setControl } from "./helpers";

describe("Beginning Phase order [R315.2][R816.1.b]", () => {
  it("[R816.1.b][R323.5][R315.2.b.2] a Temporary unit alone at a battlefield dies before scoring, so its controller no longer holds it", () => {
    const s = duel({ p1: ["Keeper of Masks"] });
    placeUnit(s, "p1", "Keeper of Masks", "battlefieldA", "temporary");
    setControl(s.room, "battlefieldA", "p1");
    s.as("p1").endTurn().expectOk();
    drive(s);
    // Still alive and in control through the opponent's turn (it is killed on ITS controller's turn).
    expect(controllerOf(s.room, "battlefieldA")).toBe("p1");
    s.as("p2").endTurn().expectOk();
    const events = [...s.events(), ...drive(s)];
    const types = events.map((event) => event.type);
    expect(boardOf(s, "p1").trash.some((card) => card.id === "temporary")).toBe(true);
    // 323.5: the Cleanup after the kill removes control before the Scoring Step holds anything.
    expect(types.indexOf("kill")).toBeLessThan(types.indexOf("hold_scoring"));
    expect(types).not.toContain("hold");
    s.expectScore("p1", 0);
  });

  it("[R315.2.b.2][R471.2][R473.2.b] a battlefield still occupied at the Scoring Step is held: +1 point and its hold ability", () => {
    const s = duel();
    placeUnit(s, "p1", "Clockwork Keeper", "battlefieldA", "holder");
    setControl(s.room, "battlefieldA", "p1");
    nextOwnTurn(s);
    s.expectScore("p1", 1);
    // Altar to Unity: "When you hold here, play a 1 Might Recruit unit token in your base."
    expect(boardOf(s, "p1").base.some((card) => card.name === "Recruit")).toBe(true);
  });
});

describe("Expiration Step [R317.2]", () => {
  it("[R424.1.a.2][R317.2.c] Stunned units lose the Stunned status at the end of the turn", () => {
    const s = duel();
    const unit = placeUnit(s, "p2", "Stellacorn Herder", "battlefieldA", "stunned");
    s.room.rules!.objects[unit.id] = { ...(s.room.rules!.objects[unit.id] ?? {}), stunned: true };
    s.as("p1").endTurn().expectOk();
    expect(s.room.rules!.objects[unit.id]?.stunned ?? false).toBe(false);
  });

  it("[R317.2.c][C:En Garde] \"+1 Might this turn\" expires at the end of the turn", () => {
    const s = duel();
    const unit = placeUnit(s, "p1", "Stellacorn Herder", "battlefieldA", "buffed");
    setControl(s.room, "battlefieldA", "p1");
    s.moveDeckCardToHand("p1", "En Garde");
    s.room.rules!.pools.p1 = { energy: 1, power: {} };
    s.as("p1").play("En Garde", { choices: { "target:0": [unit.id] } }).expectOk();
    drive(s);
    // +1, then another +1 because it is the only unit p1 controls there.
    expect(effectiveMight(s.room, unit.id, s.host)).toBe(5);
    s.as("p1").endTurn().expectOk();
    expect(effectiveMight(s.room, unit.id, s.host)).toBe(3);
  });

  it("[R317.2.b][R143.3.b.1] non-lethal damage is healed at the end of the turn; lethal damage kills first (3a before 3c)", () => {
    const s = duel();
    const hurt = placeUnit(s, "p2", "Stellacorn Herder", "battlefieldA", "hurt");
    const doomed = placeUnit(s, "p2", "Treasure Hunter", "battlefieldA", "doomed");
    s.room.rules!.objects[hurt.id] = { ...(s.room.rules!.objects[hurt.id] ?? {}), damage: 2 };
    s.room.rules!.objects[doomed.id] = { ...(s.room.rules!.objects[doomed.id] ?? {}), damage: 1 };
    s.as("p1").endTurn().expectOk();
    expect(s.room.rules!.objects[hurt.id]?.damage ?? 0).toBe(0);
    expect(boardOf(s, "p2").battlefieldA.some((card) => card.id === hurt.id)).toBe(true);
    expect(boardOf(s, "p2").trash.some((card) => card.id === doomed.id)).toBe(true);
  });

  it("[R317.2.d][R165] unspent Energy and Power are lost at the end of the turn", () => {
    const s = duel();
    s.room.rules!.pools.p1 = { energy: 3, power: { Calm: 1 } };
    s.as("p1").endTurn().expectOk();
    expect(s.room.rules!.pools.p1).toMatchObject({ energy: 0 });
    expect(Object.values(s.room.rules!.pools.p1!.power).every((value) => !value)).toBe(true);
  });
});
