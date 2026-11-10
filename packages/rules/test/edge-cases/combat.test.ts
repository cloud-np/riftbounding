/**
 * Edge cases: combat with several units, damage assignment order and the combat result —
 * docs/rules/edge-cases-audit.md.
 */
import { describe, expect, it } from "vitest";
import type { CombatDamageAssignmentData } from "@rift/protocol";
import { combatKeywordProfile } from "../../src";
import { boardOf, controllerOf, damageData, passUntilSettled } from "../rules/combat/helpers";
import { duel, placeUnit, setControl } from "./helpers";

/** p2 controls battlefieldA with `defenders`; p1 moves `attackers` in from base with one Standard Move. */
function attack(attackers: string[], defenders: string[]) {
  const s = duel();
  defenders.forEach((name, index) => placeUnit(s, "p2", name, "battlefieldA", `def-${index}`));
  setControl(s.room, "battlefieldA", "p2");
  const ids = attackers.map((name, index) => placeUnit(s, "p1", name, "base", `atk-${index}`).id);
  s.as("p1").apply({ type: "rules_move", unitIds: ids, to: "battlefieldA" }).expectOk();
  return s;
}

describe("several attackers and defenders [R144.3][R467.2]", () => {
  it("[R144.3][R144.3.a][R467.2.a][R467.2.b][R468.3.d][R468.5.b] two attackers moved together trade with one defender; everyone dies and the battlefield is Uncontrolled", () => {
    const s = attack(["Treasure Hunter", "Clockwork Keeper"], ["Stellacorn Herder"]);
    // Treasure Hunter's "When I move" trigger resolves first; the Combat begins in the Cleanup after.
    const events = passUntilSettled(s);
    expect(events.find((event) => event.type === "combat_begin")).toBeTruthy();
    // 467.2.a: the attackers' summed Might (1 + 2) kills the 3 Might defender; 467.2.b: the
    // defender's 3 is exactly lethal for both attackers (1 + 2).
    const assigned = events.filter((event) => event.type === "damage_assigned").map((event) => [event.playerId, event.amount]);
    expect(assigned).toEqual([
      ["p1", 3],
      ["p2", 3],
    ]);
    expect(boardOf(s, "p1").trash.map((card) => card.id).sort()).toEqual(["atk-0", "atk-1"]);
    expect(boardOf(s, "p2").trash.some((card) => card.id === "def-0")).toBe(true);
    expect(controllerOf(s.room, "battlefieldA")).toBe(null);
    s.expectScore("p1", 0);
  });

  it("[R467.2.c.3][R467.2.c.6][R826][C:Caitlyn, Patrolling] \"I must be assigned combat damage last\" is honoured in a live combat", () => {
    // Attacker 2 Might vs Caitlyn (3), Treasure Hunter (1) and Clockwork Keeper (2): Caitlyn can
    // only take damage once the other defenders have lethal damage assigned.
    const s = attack(["Clockwork Keeper"], ["Caitlyn, Patrolling", "Treasure Hunter", "Clockwork Keeper"]);
    passUntilSettled(s, { stopAtPrompt: true });
    const prompt = s.room.rules?.prompt;
    expect(prompt?.kind).toBe("damage-assignment");
    expect(prompt?.playerId).toBe("p1");
    const data = damageData(s.room) as CombatDamageAssignmentData;
    expect(data.targets.find((target) => target.objectId === "def-0")?.tier).toBe(2);
    // Two damage on Caitlyn is illegal while the 1 and 2 Might defenders lack lethal damage.
    s.as("p1").choose({ assignments: [{ targetId: "def-0", amount: 2 }] }).expectError("invalid_choice");
    expect(s.lastError()?.rule).toBe("467.2.c.6");
    // Killing the Clockwork Keeper is legal.
    s.as("p1").choose({ assignments: [{ targetId: "def-2", amount: 2 }] }).expectOk();
    passUntilSettled(s);
    expect(boardOf(s, "p2").trash.some((card) => card.id === "def-2")).toBe(true);
    expect(boardOf(s, "p2").battlefieldA.some((card) => card.id === "def-0")).toBe(true);
  });

  it("[R467.2.c.4][R826] with damage left over after every unit has lethal damage, the excess may go to the Backline unit", () => {
    // 7 Might vs Caitlyn (3) + Treasure Hunter (1): lethal for both is 4, excess 3 goes anywhere.
    const s = attack(["Astral Heron"], ["Caitlyn, Patrolling", "Treasure Hunter"]);
    passUntilSettled(s, { stopAtPrompt: true });
    expect(s.room.rules?.prompt?.kind).toBe("damage-assignment");
    s.as("p1")
      .choose({
        assignments: [
          { targetId: "def-0", amount: 6 },
          { targetId: "def-1", amount: 1 },
        ],
      })
      .expectOk();
    passUntilSettled(s);
    expect(boardOf(s, "p2").trash.map((card) => card.id).sort()).toEqual(["def-0", "def-1"]);
    expect(controllerOf(s.room, "battlefieldA")).toBe("p1");
    s.expectScore("p1", 1);
  });

  it("[R826.3][C:Soraka, Wanderer] Soraka's printed \"assigned combat damage last\" is the same Backline requirement", () => {
    const s = duel({ p2: ["Soraka, Wanderer"] });
    const soraka = placeUnit(s, "p2", "Soraka, Wanderer", "battlefieldA");
    expect(combatKeywordProfile(s.room, soraka.id, s.host)).toMatchObject({ backline: true, tank: false });
  });
});
