/**
 * 467.2.c damage assignment — every official example of 467.2.c.3–467.2.c.10.
 *
 * `previewDamage` (R2-effects, 467.2.c.4/.4.a/.5) and `restrictionFor` (R2-effects, 467.2.c.10)
 * are stubs in this branch, so this file mocks them with the contract's semantics to exercise the
 * seam: the mock plays the replacement/prevention effect named by each example.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CombatDamageTarget } from "@rift/protocol";
import {
  applyRulesIntent,
  damageTargets,
  enumerateAssignments,
  explainIllegal,
  lethalAssignment,
  registerActionInterceptor,
  validateAssignment,
} from "../../../src";
import { scenario, type RulesScenario } from "../../scenarios/dsl";
import { boardOf, damageData, passUntilSettled, placeUnit, setControl } from "./helpers";

const mocks = vi.hoisted(() => ({
  preview: new Map<string, (amount: number) => number>(),
  immune: new Set<string>(),
}));

vi.mock("../../../src/replacements/preview", () => ({
  previewDamage: (_room: unknown, _host: unknown, query: { targetId: string; amount: number }) =>
    mocks.preview.get(query.targetId)?.(query.amount) ?? query.amount,
}));

vi.mock("../../../src/layers/restrictions", () => ({
  restrictionFor: (_room: unknown, _host: unknown, query: { kind: string; objectId?: string }) =>
    query.kind === "be-dealt-damage" && query.objectId && mocks.immune.has(query.objectId)
      ? { rule: "467.2.c.10", note: "test: can't be dealt damage" }
      : null,
}));

const unsubscribe: Array<() => void> = [];
beforeEach(() => {
  mocks.preview.clear();
  mocks.immune.clear();
});
afterEach(() => {
  while (unsubscribe.length > 0) unsubscribe.pop()!();
});

function amounts(record: Record<string, number>) {
  return Object.entries(record).map(([targetId, amount]) => ({ targetId, amount }));
}

/** p2 units at battlefieldA (ids u0, u1, …) for target computation. */
function defenders(names: string[], extra: string[] = []): { s: RulesScenario; ids: string[] } {
  const s = scenario({ extraCards: { p2: extra } });
  const ids = names.map((name, index) => placeUnit(s, "p2", name, "battlefieldA", `u${index}`).id);
  return { s, ids };
}

function targetsOf(s: RulesScenario, ids: string[], total: number): CombatDamageTarget[] {
  return damageTargets(s.room, s.host, ids, total);
}

describe("lethal assignment and ordering [R467.2.c.3][R467.2.c.4]", () => {
  it("[EX:467.2.c.3] 5 damage among four 3-Might units: lethal in full before moving on", () => {
    const { s, ids } = defenders(
      ["Stellacorn Herder", "Stellacorn Herder", "Stellacorn Herder", "Stellacorn Herder"],
      ["Stellacorn Herder"],
    );
    const targets = targetsOf(s, ids, 5);
    expect(targets.map((target) => target.lethal)).toEqual([3, 3, 3, 3]);
    const split = validateAssignment(targets, 5, amounts({ u0: 2, u1: 1, u2: 1, u3: 1 }));
    expect(split).toMatchObject({ ok: false, rule: "467.2.c.3" });
    expect(validateAssignment(targets, 5, amounts({ u0: 3, u1: 2 })).ok).toBe(true);
    expect(validateAssignment(targets, 5, amounts({ u2: 2, u3: 3 })).ok).toBe(true);
    expect(enumerateAssignments(targets, 5, 2)).toHaveLength(2);
  });

  it("[EX:467.2.c.4] with 1 damage already marked on each, no unit may take more than 2", () => {
    const { s, ids } = defenders(
      ["Stellacorn Herder", "Stellacorn Herder", "Stellacorn Herder", "Stellacorn Herder"],
      ["Stellacorn Herder"],
    );
    for (const id of ids) s.room.rules!.objects[id] = { damage: 1 };
    const targets = targetsOf(s, ids, 5);
    expect(targets.map((target) => target.lethal)).toEqual([2, 2, 2, 2]);
    expect(validateAssignment(targets, 5, amounts({ u0: 3, u1: 2 }))).toMatchObject({ ok: false, rule: "467.2.c.4" });
    expect(validateAssignment(targets, 5, amounts({ u0: 2, u1: 2, u2: 1 })).ok).toBe(true);
  });

  it("[R142.4.b][R418.1.e] lethal damage is non-zero: a 0-Might unit needs 1", () => {
    const { s, ids } = defenders(["Clockwork Keeper"]);
    s.room.rules!.objects[ids[0]!] = { temporaryMight: -5 };
    expect(lethalAssignment(s.room, s.host, ids[0]!, 3)).toBe(1);
  });
});

describe("replacement effects apply to the assignment [R467.2.c.4.a][R467.2.c.5]", () => {
  it("[EX:467.2.c.4.a] a doubled 3-Might unit may only be assigned 1 or 2 (2 doubles to lethal 4)", () => {
    const { s, ids } = defenders(["Stellacorn Herder", "Stellacorn Herder"]);
    mocks.preview.set("u0", (amount) => amount * 2);
    const targets = targetsOf(s, ids, 3);
    expect(targets[0]?.lethal).toBe(2);
    expect(validateAssignment(targets, 3, amounts({ u0: 3 }))).toMatchObject({ ok: false, rule: "467.2.c.4" });
    expect(validateAssignment(targets, 3, amounts({ u0: 2, u1: 1 })).ok).toBe(true);
    expect(validateAssignment(targets, 3, amounts({ u1: 3 })).ok).toBe(true);
    expect(validateAssignment(targets, 3, amounts({ u0: 1, u1: 2 }))).toMatchObject({ ok: false, rule: "467.2.c.3" });
  });

  it("[EX:467.2.c.5] 'prevent the first 3 damage I would take each combat' makes 5 lethal for a 2-Might unit", () => {
    const { s, ids } = defenders(["Clockwork Keeper"]);
    mocks.preview.set("u0", (amount) => Math.max(0, amount - 3));
    expect(lethalAssignment(s.room, s.host, ids[0]!, 3)).toBe(5);
  });

  it("[EX:467.2.c.5] doubling happens at assignment: 1 assigned to the doubled 2-Might unit is lethal and is dealt as 2", () => {
    const s = scenario({ battlefields: { p2: "Bandle Tree" } });
    placeUnit(s, "p2", "Clockwork Keeper", "battlefieldA", "plain");
    placeUnit(s, "p2", "Clockwork Keeper", "battlefieldA", "doubled");
    setControl(s.room, "battlefieldA", "p2");
    placeUnit(s, "p1", "Stellacorn Herder", "base", "attacker");
    mocks.preview.set("doubled", (amount) => amount * 2);
    // The same replacement applies once when the assigned damage is dealt (367–375).
    unsubscribe.push(
      registerActionInterceptor((_room, _step, proposal) =>
        proposal.type === "deal_damage" && proposal.cardId === "doubled"
          ? { ...proposal, amount: (proposal.amount ?? 0) * 2 }
          : proposal,
      ),
    );
    s.as("p1").move("Stellacorn Herder", "battlefieldA").expectOk();
    const events = passUntilSettled(s);
    const assigned = events.find((event) => event.type === "damage_assigned" && event.playerId === "p1");
    expect(assigned?.data?.assignments).toEqual([
      { targetId: "plain", amount: 2 },
      { targetId: "doubled", amount: 1 },
    ]);
    const dealt = events.find((event) => event.type === "damage" && event.cardId === "doubled");
    expect(dealt?.amount).toBe(2);
    expect(boardOf(s, "p2").trash.map((card) => card.id).sort()).toEqual(["doubled", "plain"]);
  });

  it("[EX:467.2.c.5] prevent 2 + Lotus Trap: the controller's order decides whether 2 or 4 damage is dealt", () => {
    for (const order of ["prevent-first", "double-first"] as const) {
      const s = scenario({ battlefields: { p2: "Bandle Tree" } });
      placeUnit(s, "p2", "Clockwork Keeper", "battlefieldA", "target");
      setControl(s.room, "battlefieldA", "p2");
      placeUnit(s, "p1", "Stellacorn Herder", "base", "attacker");
      const replace = (amount: number) =>
        order === "prevent-first" ? Math.max(0, amount - 2) * 2 : Math.max(0, amount * 2 - 2);
      mocks.preview.set("target", replace);
      const off = registerActionInterceptor((_room, _step, proposal) =>
        proposal.type === "deal_damage" && proposal.cardId === "target"
          ? { ...proposal, amount: replace(proposal.amount ?? 0) }
          : proposal,
      );
      s.as("p1").move("Stellacorn Herder", "battlefieldA").expectOk();
      const events = passUntilSettled(s);
      off();
      // The only defending unit takes all 3 (467.2.c.4 "unless no further units remain").
      expect(events.find((event) => event.type === "damage_assigned" && event.playerId === "p1")?.amount).toBe(3);
      const dealt = events.find((event) => event.type === "damage" && event.cardId === "target");
      expect(dealt?.amount).toBe(order === "prevent-first" ? 2 : 4);
    }
  });
});

describe("assignment requirements [R467.2.c.6–R467.2.c.9][R815][R826]", () => {
  it("[EX:467.2.c.6] Tank first, then the unit with no abilities, then Backline", () => {
    const { s, ids } = defenders(
      ["Lecturing Yordle", "LeBlanc, Everywhere at Once", "Clockwork Keeper"],
      ["Lecturing Yordle", "LeBlanc, Everywhere at Once"],
    );
    const targets = targetsOf(s, ids, 6);
    expect(targets.map((target) => [target.lethal, target.tier])).toEqual([
      [2, 0],
      [4, 2],
      [2, 1],
    ]);
    expect(validateAssignment(targets, 6, amounts({ u0: 2, u2: 2, u1: 2 })).ok).toBe(true);
    expect(validateAssignment(targets, 6, amounts({ u0: 2, u1: 4 }))).toMatchObject({ ok: false, rule: "467.2.c.6" });
    expect(validateAssignment(targets, 6, amounts({ u2: 2, u1: 4 }))).toMatchObject({ ok: false, rule: "467.2.c.6" });
    // Exactly one legal assignment → it is the one the engine makes automatically.
    expect(enumerateAssignments(targets, 6, 2)).toEqual([
      [
        { targetId: "u0", amount: 2 },
        { targetId: "u1", amount: 2 },
        { targetId: "u2", amount: 2 },
      ],
    ]);
  });

  it("[EX:467.2.c.7][R815.1.c.2] two Tanks may be assigned in either order, both before the unit with no abilities", () => {
    const { s, ids } = defenders(
      ["Lecturing Yordle", "Lecturing Yordle", "Clockwork Keeper"],
      ["Lecturing Yordle", "Lecturing Yordle"],
    );
    const targets = targetsOf(s, ids, 3);
    expect(validateAssignment(targets, 3, amounts({ u0: 2, u1: 1 })).ok).toBe(true);
    expect(validateAssignment(targets, 3, amounts({ u0: 1, u1: 2 })).ok).toBe(true);
    expect(validateAssignment(targets, 3, amounts({ u0: 2, u2: 1 }))).toMatchObject({ ok: false, rule: "467.2.c.6" });
    expect(enumerateAssignments(targets, 3, 3)).toHaveLength(2);
  });

  it("[EX:467.2.c.8] Caitlyn, Patrolling given Tank: first (Tank) or last (Backline), never in between", () => {
    const { s, ids } = defenders(["Caitlyn, Patrolling", "Clockwork Keeper", "Clockwork Keeper"]);
    s.room.rules!.objects.u0 = { grantedKeywords: ["Tank"] };
    const targets = targetsOf(s, ids, 4);
    expect(targets[0]).toMatchObject({ lethal: 3, tier: 0, exclusiveChoices: ["tank", "backline"] });
    expect(validateAssignment(targets, 4, amounts({ u0: 3, u1: 1 })).ok).toBe(true); // Tank
    expect(validateAssignment(targets, 4, amounts({ u1: 2, u2: 2 })).ok).toBe(true); // Backline
    // In between the two other units fulfils neither requirement.
    expect(validateAssignment(targets, 4, amounts({ u1: 2, u0: 2 })).ok).toBe(false);
    // An explicit choice is honoured (optional answer field).
    expect(validateAssignment(targets, 4, amounts({ u1: 2, u2: 2 }), { u0: "tank" })).toMatchObject({
      ok: false,
      rule: "467.2.c.6",
    });
    expect(validateAssignment(targets, 4, amounts({ u1: 2, u2: 2 }), { u0: "backline" }).ok).toBe(true);
    expect(validateAssignment(targets, 4, amounts({ u1: 2, u2: 2 }), { u0: "deflect" })).toMatchObject({
      ok: false,
      rule: "467.2.c.8",
    });
  });

  it("[EX:467.2.c.9] two Tank-granted Caitlyns are dealt with individually; both Tank first is legal", () => {
    const { s, ids } = defenders(["Caitlyn, Patrolling", "Caitlyn, Patrolling", "Clockwork Keeper"]);
    s.room.rules!.objects.u0 = { grantedKeywords: ["Tank"] };
    s.room.rules!.objects.u1 = { grantedKeywords: ["Tank"] };
    const targets = targetsOf(s, ids, 6);
    expect(validateAssignment(targets, 6, amounts({ u0: 3, u1: 3 })).ok).toBe(true);
    expect(validateAssignment(targets, 6, amounts({ u0: 3, u2: 2, u1: 1 })).ok).toBe(true);
    expect(validateAssignment(targets, 6, amounts({ u0: 2, u1: 2, u2: 2 }))).toMatchObject({ ok: false, rule: "467.2.c.3" });
  });
});

describe("units that can't be dealt damage [R467.2.c.10]", () => {
  it("[EX:467.2.c.10] Kayn who can't take damage is ignored for lethal assignment", () => {
    const { s, ids } = defenders(["Kayn, Unleashed", "Clockwork Keeper"], ["Kayn, Unleashed"]);
    mocks.immune.add("u0");
    const targets = targetsOf(s, ids, 1);
    expect(targets[0]?.lethal).toBe(null);
    expect(validateAssignment(targets, 1, amounts({ u1: 1 })).ok).toBe(true);
    expect(validateAssignment(targets, 1, amounts({ u0: 1 }))).toMatchObject({ ok: false, rule: "467.2.c.10" });
    const big = targetsOf(s, ids, 3);
    expect(validateAssignment(big, 3, amounts({ u1: 2, u0: 1 })).ok).toBe(true);
    expect(validateAssignment(big, 3, amounts({ u0: 3 }))).toMatchObject({ ok: false, rule: "467.2.c.3" });
  });

  it("[EX:467.2.c.10] a unit protected by Counter Strike can still be dealt damage: not exempt", () => {
    const { s, ids } = defenders(["Clockwork Keeper", "Clockwork Keeper"]);
    // "The next time that unit would be dealt damage this turn, prevent it."
    mocks.preview.set("u0", () => 0);
    const targets = targetsOf(s, ids, 3);
    expect(targets[0]?.lethal).not.toBe(null);
    expect(targets[0]!.lethal!).toBeGreaterThan(3);
    // Mandatory assignment still applies: either unit may come first, but no overkill (467.2.c.4).
    expect(validateAssignment(targets, 3, amounts({ u0: 3 })).ok).toBe(true);
    expect(validateAssignment(targets, 3, amounts({ u1: 2, u0: 1 })).ok).toBe(true);
    expect(validateAssignment(targets, 3, amounts({ u1: 3 }))).toMatchObject({ ok: false, rule: "467.2.c.4" });
  });
});

describe("prompt answers with exclusive choices [R467.2.c.8][R411.2]", () => {
  it("[R467.2.c.8] the assigner answers with the requirement they apply", () => {
    const s = scenario({ battlefields: { p2: "Bandle Tree" } });
    placeUnit(s, "p2", "Caitlyn, Patrolling", "battlefieldA", "cait");
    placeUnit(s, "p2", "Clockwork Keeper", "battlefieldA", "keeper");
    s.room.rules!.objects.cait = { grantedKeywords: ["Tank"] };
    setControl(s.room, "battlefieldA", "p2");
    placeUnit(s, "p1", "Stellacorn Herder", "base", "attacker");
    s.as("p1").move("Stellacorn Herder", "battlefieldA").expectOk();
    // Stellacorn Herder's own move trigger (draw 1) resolves before the Combat opens (402.1,
    // 323.12); then both players pass in the Combat Showdown.
    passUntilSettled(s, { stopAtPrompt: true });
    s.expectPrompt("damage-assignment", "p1");
    expect(damageData(s.room)?.targets.find((target) => target.objectId === "cait")?.exclusiveChoices).toEqual([
      "tank",
      "backline",
    ]);
    // explainIllegal answers what the write path rejects (R2-combat's assignment verdict).
    const bad = { assignments: [{ targetId: "keeper", amount: 2 }, { targetId: "cait", amount: 1 }], exclusiveChoices: { cait: "tank" } };
    const intent = { type: "rules_choose", promptId: s.room.rules!.prompt!.id, answer: bad } as const;
    const explained = explainIllegal(s.room, "p1", intent, s.host);
    expect(explained).toMatchObject({ ok: false, code: "invalid_choice", rule: "467.2.c.6" });
    const applied = applyRulesIntent(s.room, "p1", intent, s.ctx, s.host);
    expect(applied).toMatchObject({ ok: false, code: "invalid_choice", rule: "467.2.c.6" });
    s.as("p1")
      .choose({ assignments: [{ targetId: "keeper", amount: 2 }, { targetId: "cait", amount: 1 }], exclusiveChoices: { cait: "backline" } })
      .expectOk();
    expect(boardOf(s, "p2").trash.some((card) => card.id === "keeper")).toBe(true);
  });
});
