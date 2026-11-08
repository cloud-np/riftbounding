/**
 * R2-combat properties — 467.2.c assignment legality and the Steps of Combat (466–468).
 */
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import type { CombatDamageTarget } from "@rift/protocol";
import { enumerateAssignments, EXCLUSIVE_TIERS, validateAssignment } from "../../src";
import { scenario } from "../scenarios/dsl";
import { passUntilSettled, placeUnit, setControl } from "../rules/combat/helpers";
import { assertInvariants } from "./generators";

/**
 * Independent reference model of 467.2.c: every legal vector is produced by assigning, in some
 * order that respects tiers (467.2.c.6/c.7, after picking each unit's 467.2.c.8 requirement),
 * lethal damage to each unit that can be dealt damage before moving on (467.2.c.3), the
 * remainder to the last one (467.2.c.4); once every such unit has its lethal value, the excess may
 * go to any unit (467.2.c.4 "unless no further units remain", 467.2.c.10).
 */
function referenceLegal(targets: CombatDamageTarget[], total: number): Set<string> {
  const legal = new Set<string>();
  const killable = targets.filter((target) => target.lethal !== null);
  const lethalSum = killable.reduce((sum, target) => sum + (target.lethal ?? 0), 0);
  const key = (amounts: Map<string, number>) => targets.map((target) => amounts.get(target.objectId) ?? 0).join(",");
  if (total >= lethalSum) {
    // Distribute the excess over all targets in every way.
    const excess = total - lethalSum;
    const spread = (index: number, left: number, amounts: Map<string, number>) => {
      if (index === targets.length - 1) {
        const id = targets[index]!.objectId;
        const next = new Map(amounts).set(id, (amounts.get(id) ?? 0) + left);
        legal.add(key(next));
        return;
      }
      for (let give = 0; give <= left; give += 1) {
        const id = targets[index]!.objectId;
        spread(index + 1, left - give, new Map(amounts).set(id, (amounts.get(id) ?? 0) + give));
      }
    };
    const base = new Map(killable.map((target) => [target.objectId, target.lethal ?? 0]));
    if (targets.length > 0) spread(0, excess, base);
    return legal;
  }
  const combos: Array<Record<string, number>> = [{}];
  for (const target of targets) {
    if (!target.exclusiveChoices) continue;
    const next: Array<Record<string, number>> = [];
    for (const combo of combos) {
      for (const choice of target.exclusiveChoices) next.push({ ...combo, [target.objectId]: EXCLUSIVE_TIERS[choice]! });
    }
    combos.splice(0, combos.length, ...next);
  }
  const permute = (items: CombatDamageTarget[]): CombatDamageTarget[][] =>
    items.length <= 1 ? [items] : items.flatMap((item, index) => permute([...items.slice(0, index), ...items.slice(index + 1)]).map((rest) => [item, ...rest]));
  for (const tiers of combos) {
    const tierOf = (target: CombatDamageTarget) => tiers[target.objectId] ?? target.tier;
    for (const order of permute(killable)) {
      let sorted = true;
      for (let index = 1; index < order.length; index += 1) {
        if (tierOf(order[index - 1]!) > tierOf(order[index]!)) sorted = false;
      }
      if (!sorted) continue;
      const amounts = new Map<string, number>();
      let left = total;
      for (const target of order) {
        if (left <= 0) break;
        const give = Math.min(left, target.lethal ?? 0);
        amounts.set(target.objectId, give);
        left -= give;
      }
      legal.add(key(amounts));
    }
  }
  return legal;
}

const targetArb = fc
  .array(
    fc.record({
      lethal: fc.option(fc.integer({ min: 0, max: 4 }), { nil: null, freq: 5 }),
      tier: fc.constantFrom(0, 1, 1, 2),
      exclusive: fc.boolean(),
    }),
    { minLength: 1, maxLength: 4 },
  )
  .map((rows) =>
    rows.map((row, index): CombatDamageTarget => ({
      objectId: `t${index}`,
      lethal: row.lethal,
      tier: row.exclusive && index === 0 ? 0 : row.tier,
      ...(row.exclusive && index === 0 ? { exclusiveChoices: ["tank", "backline"] } : {}),
    })),
  );

function allVectors(count: number, total: number): number[][] {
  if (count === 1) return [[total]];
  const out: number[][] = [];
  for (let first = 0; first <= total; first += 1) {
    for (const rest of allVectors(count - 1, total - first)) out.push([first, ...rest]);
  }
  return out;
}

describe("467.2.c assignment properties [R467.2.c]", () => {
  it("[R467.2.c.3][R467.2.c.4][R467.2.c.6][R467.2.c.8][R467.2.c.10] validateAssignment matches an independent reference model", () => {
    fc.assert(
      fc.property(targetArb, fc.integer({ min: 0, max: 6 }), (targets, total) => {
        const reference = referenceLegal(targets, total);
        for (const vector of allVectors(targets.length, total)) {
          const answer = vector.map((amount, index) => ({ targetId: `t${index}`, amount }));
          const verdict = validateAssignment(targets, total, answer);
          expect(verdict.ok, `${JSON.stringify(targets)} total ${total} vector ${vector}`).toBe(reference.has(vector.join(",")));
        }
      }),
      { numRuns: 300 },
    );
  });

  it("[R467.2.c] every enumerated assignment is legal, and a unique one is found exactly when the model has one", () => {
    fc.assert(
      fc.property(targetArb, fc.integer({ min: 0, max: 6 }), (targets, total) => {
        const reference = referenceLegal(targets, total);
        const listed = enumerateAssignments(targets, total, 2);
        for (const assignment of listed) expect(validateAssignment(targets, total, assignment).ok).toBe(true);
        expect(listed.length).toBe(Math.min(2, reference.size));
      }),
      { numRuns: 300 },
    );
  });
});

const UNITS = ["Treasure Hunter", "Clockwork Keeper", "Stellacorn Herder", "Caitlyn, Patrolling", "Astral Heron"];
const EXTRA = ["Lecturing Yordle", "Stalwart Poro", "Daring Poro", "LeBlanc, Everywhere at Once"];

describe("Steps of Combat properties [R466][R467][R468]", () => {
  it(
    "[R467][R468.7] random combats always end with combat null, no designations and the invariants intact",
    () => {
      fc.assert(
        fc.property(
          fc.array(fc.constantFrom(...UNITS, ...EXTRA), { minLength: 1, maxLength: 3 }),
          fc.constantFrom(...UNITS, ...EXTRA),
          fc.boolean(),
          (defenders, attacker, stunAttacker) => {
            const s = scenario({ battlefields: { p2: "Bandle Tree" }, extraCards: { p1: EXTRA, p2: [...EXTRA, ...EXTRA, ...EXTRA] } });
            defenders.forEach((name, index) => placeUnit(s, "p2", name, "battlefieldA", `d${index}`));
            setControl(s.room, "battlefieldA", "p2");
            placeUnit(s, "p1", attacker, "base", "a0");
            s.as("p1").move(attacker, "battlefieldA").expectOk();
            if (stunAttacker) s.room.rules!.objects.a0 = { ...(s.room.rules!.objects.a0 ?? {}), stunned: true };
            passUntilSettled(s, { maxSteps: 40 });
            expect(s.room.rules?.combat).toBe(null);
            expect(s.room.rules?.history.combatProgress).toBeUndefined();
            for (const object of Object.values(s.room.rules?.objects ?? {})) expect(object.designation).toBeUndefined();
            expect(assertInvariants(s.room)).toBe(null);
            // 468.5: only the attacker can newly gain control of the battlefield.
            const controller = s.room.rules?.objects.battlefieldA?.controller;
            expect([null, "p1", "p2"]).toContain(controller);
          },
        ),
        { numRuns: 40 },
      );
    },
    120_000,
  );
});
