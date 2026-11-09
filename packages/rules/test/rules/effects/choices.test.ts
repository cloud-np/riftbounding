import { beforeAll, describe, expect, it } from "vitest";
import type { Ability } from "@rift/protocol";
import { lookupAbility, requiredChoices, validateChoices } from "../../../src";
import { scenario } from "../../scenarios/dsl";
import { fund, place, registerAll, spell } from "./helpers";

const KILL_UNIT_AT_BATTLEFIELD: Ability = {
  kind: "spell",
  effect: { op: "kill", target: { chosen: true, cardType: "unit", zone: "battlefield" } },
};

beforeAll(() =>
  registerAll([
    spell("Rebuke", { op: "kill", target: { chosen: true, cardType: "unit", zone: "battlefield" } }),
    {
      name: "Caitlyn, Patrolling",
      text: "test: I can't be chosen by enemy spells and abilities.",
      status: "implemented",
      abilities: [
        { kind: "passive", modifier: { kind: "restriction", restriction: "be-targeted:enemy", target: { targetRef: "self" } } },
      ],
    },
  ]),
);

describe("play-time choices [R355][R355.7][R355.8]", () => {
  it("[R355.5][EX:355.5.a] \"a unit at a battlefield\" is a choice; \"all\" criteria are not", () => {
    const s = scenario();
    const enemy = place(s, "p2", "Treasure Hunter", "battlefieldA");
    place(s, "p2", "Stellacorn Herder", "base");
    const specs = requiredChoices(s.room, s.host, KILL_UNIT_AT_BATTLEFIELD, { controller: "p1", choices: {} });
    expect(specs).toHaveLength(1);
    expect(specs[0]).toMatchObject({ key: "target:0", kind: "choose-target", min: 1, max: 1, targeted: true, rule: "355.7" });
    expect(specs[0]!.options.map((option) => option.id)).toEqual([enemy.id]);
    // EX[66]: "Kill all gear" is not a choice.
    const all: Ability = { kind: "spell", effect: { op: "kill", target: { cardType: "gear", all: true } } };
    expect(requiredChoices(s.room, s.host, all, { controller: "p1", choices: {} })).toEqual([]);
  });

  it("[R355.3] modes come first; targets inside a mode are asked after the mode is bound", () => {
    const s = scenario();
    const enemy = place(s, "p2", "Treasure Hunter", "battlefieldA");
    const modal: Ability = {
      kind: "spell",
      effect: {
        op: "choose_mode",
        modes: [
          { id: "kill", effect: { op: "kill", target: { chosen: true, targetRef: "t", cardType: "unit" } } },
          { id: "draw", effect: { op: "draw", amount: 1 } },
        ],
      },
    };
    const first = requiredChoices(s.room, s.host, modal, { controller: "p1", choices: {} });
    expect(first.map((spec) => spec.key)).toEqual(["mode"]);
    expect(first[0]!.options.map((option) => option.id)).toEqual(["kill", "draw"]);
    const second = requiredChoices(s.room, s.host, modal, { controller: "p1", choices: { mode: "kill" } });
    expect(second.map((spec) => spec.key)).toEqual(["t"]);
    expect(second[0]!.options.map((option) => option.id)).toEqual([enemy.id]);
    expect(requiredChoices(s.room, s.host, modal, { controller: "p1", choices: { mode: "draw" } })).toEqual([]);
  });

  it("[R355.13] \"up to N\" allows zero targets; [R355.12] targets under \"may\" are chosen on play", () => {
    const s = scenario();
    place(s, "p2", "Treasure Hunter", "battlefieldA");
    place(s, "p2", "Stellacorn Herder", "battlefieldA");
    const upTo: Ability = {
      kind: "spell",
      effect: { op: "may", effect: { op: "stun", target: { chosen: true, cardType: "unit", maxCount: 2 } } },
    };
    const [spec] = requiredChoices(s.room, s.host, upTo, { controller: "p1", choices: {} });
    expect(spec).toMatchObject({ min: 0, max: 2 });
    expect(validateChoices(s.room, s.host, upTo, { controller: "p1", choices: {} }).ok).toBe(true);
  });

  it("[R355.4] move destinations, [R355.7] chosen players and X are play-time choices", () => {
    const s = scenario();
    const unit = place(s, "p1", "Treasure Hunter", "base");
    const ability: Ability = {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          { op: "move", target: { targetRef: "obj:" + unit.id }, to: { kind: "chosen", ref: "dest" } },
          { op: "draw", amount: { kind: "x" }, player: { kind: "chosen", ref: "opponent" } },
        ],
      },
    };
    const specs = requiredChoices(s.room, s.host, ability, { controller: "p1", choices: {} });
    expect(specs.map((spec) => spec.key)).toEqual(["dest", "opponent", "x"]);
    expect(specs[0]!.options.map((option) => option.id)).toEqual(["base", "battlefieldA", "battlefieldB"]);
    expect(specs[1]!.options.map((option) => option.id)).toEqual(["p2"]);
    expect(specs[2]!.kind).toBe("choose-number");
  });

  it("[R355.9.c] a spell cannot choose itself", () => {
    const s = scenario({ p1: { hand: ["Rebuke"] } });
    // 355.8: the test Rebuke ("kill a unit at a battlefield") needs a legal target to be played.
    place(s, "p2", "Treasure Hunter", "battlefieldA");
    fund(s, "p1", "Rebuke");
    s.as("p1").play("Rebuke", { hold: true }).expectOk();
    const item = s.room.rules!.chain[0]!;
    const counter: Ability = { kind: "spell", effect: { op: "counter", target: { chosen: true, cardType: "spell" } } };
    const own = requiredChoices(s.room, s.host, counter, { controller: "p1", itemId: item.id, choices: {} });
    expect(own[0]!.options).toEqual([]);
    const other = requiredChoices(s.room, s.host, counter, { controller: "p1", itemId: "another-item", choices: {} });
    expect(other[0]!.options.map((option) => option.id)).toEqual([item.id]);
  });

  it("[R355.9.a.2] an item that is still Pending on the chain is not a spell to choose", () => {
    const s = scenario({ p1: { hand: ["Rebuke"] } });
    place(s, "p2", "Treasure Hunter", "battlefieldA");
    fund(s, "p1", "Rebuke");
    s.as("p1").play("Rebuke", { hold: true }).expectOk();
    const item = s.room.rules!.chain[0]!;
    const counter: Ability = { kind: "spell", effect: { op: "counter", target: { chosen: true, cardType: "spell" } } };
    const ctx = { controller: "p2", itemId: "another-item", choices: {} };
    expect(requiredChoices(s.room, s.host, counter, ctx)[0]!.options.map((option) => option.id)).toEqual([item.id]);
    item.status = "pending";
    expect(requiredChoices(s.room, s.host, counter, ctx)[0]!.options).toEqual([]);
  });

  it("[R355.8][R358.1][EX:358.1] validateChoices: complete, legal choices only", () => {
    const s = scenario();
    const enemy = place(s, "p2", "Treasure Hunter", "battlefieldA");
    const inBase = place(s, "p2", "Stellacorn Herder", "base");
    const ctx = (choices: Record<string, unknown>) => ({ controller: "p1", choices: choices as never });
    expect(validateChoices(s.room, s.host, KILL_UNIT_AT_BATTLEFIELD, ctx({}))).toMatchObject({
      ok: false,
      code: "invalid_choice",
      rule: "355.8",
    });
    expect(validateChoices(s.room, s.host, KILL_UNIT_AT_BATTLEFIELD, ctx({ "target:0": inBase.id }))).toMatchObject({
      ok: false,
      code: "illegal_target",
      rule: "355.9",
    });
    expect(validateChoices(s.room, s.host, KILL_UNIT_AT_BATTLEFIELD, ctx({ "target:0": enemy.id })).ok).toBe(true);
  });

  it("[R403.3][R355.8] with no legal option the ability cannot be played or activated", () => {
    const s = scenario();
    expect(validateChoices(s.room, s.host, KILL_UNIT_AT_BATTLEFIELD, { controller: "p1", choices: {} })).toMatchObject({
      ok: false,
      code: "no_legal_targets",
      rule: "355.8",
    });
  });

  it("[R377.2.b][EX:377.2.b] \"use this ability only while …\" is checked when activating", () => {
    const s = scenario();
    const unit = place(s, "p1", "Treasure Hunter", "base");
    const ability: Ability = {
      kind: "activated",
      cost: {},
      effect: { op: "requires", condition: { kind: "custom", id: "self-at-battlefield" }, effect: { op: "draw", amount: 1 } },
    };
    const ctx = { controller: "p1", sourceObjectId: unit.id, choices: {} };
    expect(validateChoices(s.room, s.host, ability, ctx)).toMatchObject({ ok: false, code: "illegal_action", rule: "377.2.b" });
    s.host.moveCard(s.room, "p1", "base", "battlefieldA", unit.id);
    expect(validateChoices(s.room, s.host, ability, ctx).ok).toBe(true);
  });

  it("[R757.1][R758][EX:757.1] an untargetable unit is not a legal choice for enemy spells", () => {
    const s = scenario();
    const caitlyn = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    const other = place(s, "p2", "Treasure Hunter", "battlefieldA");
    const enemySpecs = requiredChoices(s.room, s.host, KILL_UNIT_AT_BATTLEFIELD, { controller: "p1", choices: {} });
    expect(enemySpecs[0]!.options.map((option) => option.id)).toEqual([other.id]);
    expect(
      validateChoices(s.room, s.host, KILL_UNIT_AT_BATTLEFIELD, { controller: "p1", choices: { "target:0": caitlyn.id } }),
    ).toMatchObject({ ok: false, code: "illegal_target" });
    // Its own controller may still choose it.
    const ownSpecs = requiredChoices(s.room, s.host, KILL_UNIT_AT_BATTLEFIELD, { controller: "p2", choices: {} });
    expect(ownSpecs[0]!.options.map((option) => option.id).sort()).toEqual([caitlyn.id, other.id].sort());
  });

  it("[R355.7] chosen selectors are keyed target:<n> in document order at registration", () => {
    registerAll([
      spell("Defy", {
        op: "seq",
        effects: [
          { op: "stun", target: { chosen: true, cardType: "unit" } },
          { op: "ready", target: { chosen: true, cardType: "unit", controller: "self" } },
        ],
      }),
    ]);
    const ability = lookupAbility("Defy", "spell")!.ability;
    const s = scenario();
    place(s, "p1", "Treasure Hunter", "base");
    expect(requiredChoices(s.room, s.host, ability, { controller: "p1", choices: {} }).map((spec) => spec.key)).toEqual([
      "target:0",
      "target:1",
    ]);
  });
});
