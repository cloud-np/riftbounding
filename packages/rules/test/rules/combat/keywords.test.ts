/**
 * Combat keywords — Assault 807, Shield 814, Tank 815, Backline 826; 424.1.b, 143.2.c.
 */
import { describe, expect, it } from "vitest";
import {
  combatContribution,
  combatKeywordProfile,
  combatMight,
  effectiveMight,
  registerCombatContributionFilter,
} from "../../../src";
import { scenario } from "../../scenarios/dsl";
import { passUntilSettled, placeUnit, setControl, boardOf } from "./helpers";

describe("Assault and Shield [R807][R814]", () => {
  it("[R807.1.c][R807.1.d][R807.1.d.1] Assault adds +X Might only while the unit is an attacker", () => {
    const s = scenario({ extraCards: { p1: ["Petty Officer"] } });
    const unit = placeUnit(s, "p1", "Petty Officer", "battlefieldA", "officer");
    expect(combatKeywordProfile(s.room, unit.id, s.host).assault).toBe(1);
    expect(combatMight(s.room, unit.id, s.host)).toBe(5);
    s.room.rules!.objects[unit.id] = { designation: "attacker" };
    // Tripwire: if the layers start including Assault in effectiveMight, combatMight must drop
    // its own bonus (see TODO in combat/keywords.ts).
    expect(effectiveMight(s.room, unit.id, s.host)).toBe(5);
    expect(combatMight(s.room, unit.id, s.host)).toBe(6);
    s.room.rules!.objects[unit.id] = { designation: "defender" };
    expect(combatMight(s.room, unit.id, s.host)).toBe(5);
  });

  it("[EX:807.2] Petty Officer granted [Assault 3] has Assault 4", () => {
    const s = scenario({ extraCards: { p1: ["Petty Officer"] } });
    const unit = placeUnit(s, "p1", "Petty Officer", "battlefieldA", "officer");
    s.room.rules!.objects[unit.id] = { grantedKeywords: ["Assault 3"], designation: "attacker" };
    expect(combatKeywordProfile(s.room, unit.id, s.host).assault).toBe(4);
    expect(combatMight(s.room, unit.id, s.host)).toBe(9);
  });

  it("[R814.1.c][R814.1.b.3] Stalwart Poro's printed [Shield] (text only) gives +1 while defending", () => {
    const s = scenario({ extraCards: { p2: ["Stalwart Poro"] } });
    const unit = placeUnit(s, "p2", "Stalwart Poro", "battlefieldA", "poro");
    expect(combatKeywordProfile(s.room, unit.id, s.host)).toMatchObject({ shield: 1, assault: 0 });
    s.room.rules!.objects[unit.id] = { designation: "defender" };
    expect(combatMight(s.room, unit.id, s.host)).toBe(3);
  });

  it("[EX:814.2] Stalwart Poro granted [Shield 3] and [Tank] has Shield 4 and Tank", () => {
    const s = scenario({ extraCards: { p2: ["Stalwart Poro"] } });
    const unit = placeUnit(s, "p2", "Stalwart Poro", "battlefieldA", "poro");
    s.room.rules!.objects[unit.id] = { grantedKeywords: ["Shield 3", "Tank"], designation: "defender" };
    expect(combatKeywordProfile(s.room, unit.id, s.host)).toMatchObject({ shield: 4, tank: true });
    expect(combatMight(s.room, unit.id, s.host)).toBe(6);
  });

  it("[R814.1.b.2] a printed Shield value is read from the keyword line ([SHIELD 3])", () => {
    const s = scenario({ extraCards: { p2: ["Volibear, Imposing"] } });
    const unit = placeUnit(s, "p2", "Volibear, Imposing", "battlefieldA", "voli");
    expect(combatKeywordProfile(s.room, unit.id, s.host)).toMatchObject({ shield: 3, tank: true, backline: false });
  });

  it("[R807.1.c][R467.2.a] an attacker's Assault counts toward the summed Might in combat", () => {
    const s = scenario({ battlefields: { p2: "Bandle Tree" }, extraCards: { p1: ["Daring Poro"] } });
    placeUnit(s, "p2", "Stellacorn Herder", "battlefieldA", "defender");
    setControl(s.room, "battlefieldA", "p2");
    placeUnit(s, "p1", "Daring Poro", "base", "poro");
    s.as("p1").move("Daring Poro", "battlefieldA").expectOk();
    const events = passUntilSettled(s);
    // Daring Poro 2 + Assault 1 = 3 kills the 3-Might defender.
    expect(events.find((event) => event.type === "damage_assigned" && event.playerId === "p1")?.amount).toBe(3);
    expect(boardOf(s, "p2").trash.some((card) => card.id === "defender")).toBe(true);
  });

  it("[R814.1.c][R323.4] a defender's Shield raises its lethal threshold during combat", () => {
    const s = scenario({ battlefields: { p2: "Bandle Tree" }, extraCards: { p2: ["Stalwart Poro"] } });
    placeUnit(s, "p2", "Stalwart Poro", "battlefieldA", "poro");
    setControl(s.room, "battlefieldA", "p2");
    placeUnit(s, "p1", "Clockwork Keeper", "base", "keeper");
    s.as("p1").move("Clockwork Keeper", "battlefieldA").expectOk();
    const events = passUntilSettled(s);
    // 2 damage into a 3-Might (2 + Shield 1) defender is not lethal; the Keeper takes 3 and dies.
    expect(events.find((event) => event.type === "damage_assigned" && event.playerId === "p2")?.amount).toBe(3);
    expect(boardOf(s, "p2").battlefieldA.some((card) => card.id === "poro")).toBe(true);
    expect(boardOf(s, "p1").trash.some((card) => card.id === "keeper")).toBe(true);
  });
});

describe("Tank and Backline detection [R815][R826][R467.2.c.6]", () => {
  it("[R815.1.b] Tank from the catalog keyword; [R826.3] Backline from its printed keyword line", () => {
    const s = scenario({ extraCards: { p2: ["Lecturing Yordle", "LeBlanc, Everywhere at Once"] } });
    const yordle = placeUnit(s, "p2", "Lecturing Yordle", "battlefieldA");
    const leblanc = placeUnit(s, "p2", "LeBlanc, Everywhere at Once", "battlefieldA");
    expect(combatKeywordProfile(s.room, yordle.id, s.host)).toMatchObject({ tank: true, backline: false });
    expect(combatKeywordProfile(s.room, leblanc.id, s.host)).toMatchObject({ tank: false, backline: true });
  });

  it("[C:Caitlyn, Patrolling][R826.3] 'I must be assigned combat damage last.' is Backline's ability", () => {
    const s = scenario();
    const caitlyn = placeUnit(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    expect(combatKeywordProfile(s.room, caitlyn.id, s.host)).toMatchObject({ tank: false, backline: true });
  });

  it("[R815.2][R826.5] multiple instances are redundant", () => {
    const s = scenario({ extraCards: { p2: ["Lecturing Yordle"] } });
    const yordle = placeUnit(s, "p2", "Lecturing Yordle", "battlefieldA");
    s.room.rules!.objects[yordle.id] = { grantedKeywords: ["Tank", "TANK"] };
    expect(combatKeywordProfile(s.room, yordle.id, s.host).tank).toBe(true);
  });
});

describe("contribution to combat damage [R424.1.b][R143.2.c]", () => {
  it("[R424.1.b] a Stunned unit contributes no Might", () => {
    const s = scenario();
    const unit = placeUnit(s, "p1", "Stellacorn Herder", "battlefieldA");
    expect(combatContribution(s.room, unit.id, s.host)).toBe(3);
    s.room.rules!.objects[unit.id] = { stunned: true };
    expect(combatContribution(s.room, unit.id, s.host)).toBe(0);
  });

  it("[R143.2.c] negative Might is treated as 0 when summing combat damage", () => {
    const s = scenario();
    const unit = placeUnit(s, "p1", "Clockwork Keeper", "battlefieldA");
    s.room.rules!.objects[unit.id] = { temporaryMight: -5 };
    expect(combatContribution(s.room, unit.id, s.host)).toBe(0);
  });

  it("[C:Galio, Indefatigable] printed 'I don't deal combat damage.' contributes nothing", () => {
    const s = scenario({ extraCards: { p1: ["Galio, Indefatigable"] } });
    const galio = placeUnit(s, "p1", "Galio, Indefatigable", "battlefieldA");
    expect(combatMight(s.room, galio.id, s.host)).toBe(6);
    expect(combatContribution(s.room, galio.id, s.host)).toBe(0);
  });

  it("[R424.1.b] registered contribution filters (card text seam) exclude a unit", () => {
    const s = scenario();
    const unit = placeUnit(s, "p1", "Stellacorn Herder", "battlefieldA", "filtered");
    const off = registerCombatContributionFilter((_room, unitId) => unitId !== "filtered");
    expect(combatContribution(s.room, unit.id, s.host)).toBe(0);
    off();
    expect(combatContribution(s.room, unit.id, s.host)).toBe(3);
  });
});
