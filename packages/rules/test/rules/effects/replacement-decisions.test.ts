/**
 * R3-engine: replacement decisions — optional ("may") replacements (371.2) and the order of
 * several replacements applying to one event (372 / 373 / 374).
 */
import { describe, expect, it } from "vitest";
import type { CardScript, Effect } from "@rift/protocol";
import { registerCardScript } from "../../../src";
import { scenario } from "../../scenarios/dsl";
import { boardOf, fund, place, run, zoneOf } from "./helpers";

type S = ReturnType<typeof scenario>;

function withCards(p1: string[], p2: string[] = []): S {
  const s = scenario({ extraCards: { p1, p2 } });
  for (const [player, names] of [["p1", p1], ["p2", p2]] as const) {
    const wanted: Record<string, number> = {};
    for (const name of names) wanted[name] = (wanted[name] ?? 0) + 1;
    for (const [name, count] of Object.entries(wanted)) {
      const inHand = boardOf(s, player).hand.filter((card) => card.name === name).length;
      for (let index = inHand; index < count; index += 1) s.moveDeckCardToHand(player, name);
    }
  }
  return s;
}

/** A test permanent: "[Once each turn,] if a friendly unit would die, you may recall it instead." */
function optionalRecall(name: string, oncePerTurn: boolean): CardScript {
  return {
    name,
    text: "test: (Once each turn,) if a friendly unit would die, you may recall it instead.",
    status: "implemented",
    abilities: [
      {
        kind: "replacement",
        matches: { type: "kill", subject: { cardType: "unit", controller: "self" } },
        replace: { op: "may", effect: { op: "recall", target: { targetRef: "event" } } },
        ...(oncePerTurn ? { limit: { kind: "once-per-turn" as const } } : {}),
      },
    ],
  };
}

const killObj = (id: string): Effect => ({ op: "kill", target: { targetRef: `obj:${id}` } });

/** Unlicensed Armory's delayed replacement for `unitId` (created by its activated ability). */
const armoryReplacement = (unitId: string): Effect => ({
  op: "replace",
  matches: { type: "kill", subject: { targetRef: `obj:${unitId}` } },
  replace: {
    op: "cost_then",
    optional: true,
    cost: { power: { Fury: 1 } },
    effect: {
      op: "seq",
      effects: [
        { op: "heal", amount: 99, target: { targetRef: "event" } },
        { op: "exhaust", target: { targetRef: "event" } },
        { op: "recall", target: { targetRef: "event" } },
      ],
    },
  },
});

describe("optional replacements [R371.2]", () => {
  it("[R371.2][R371.2.a][R371.2.b] the controller may decline; a declined \"once each turn\" replacement is still available", () => {
    registerCardScript(optionalRecall("Blade of the Exile", true));
    const s = scenario();
    place(s, "p1", "Blade of the Exile", "base");
    const a = place(s, "p1", "Treasure Hunter", "battlefieldA");
    const b = place(s, "p1", "Stellacorn Herder", "battlefieldA");
    const c = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");

    expect(run(s, killObj(a.id), { controller: "p2" }).status).toBe("await");
    expect(s.room.rules!.prompt).toMatchObject({ kind: "yes-no", playerId: "p1", rule: "371.2.a" });
    expect(zoneOf(s, a.id)).toBe("battlefieldA"); // 370.1.c: held, not yet dead
    s.as("p1").choose({ optionIds: ["no"] }).expectOk();
    expect(zoneOf(s, a.id)).toBe("trash");

    // 371.2.b: it was not applied, so it can still be applied this turn.
    expect(run(s, killObj(b.id), { controller: "p2" }).status).toBe("await");
    s.as("p1").choose({ optionIds: ["yes"] }).expectOk();
    expect(zoneOf(s, b.id)).toBe("base");
    expect(s.events().some((event) => event.type === "replaced")).toBe(true);

    // 371.1: now it has been applied this turn — the next death is not offered.
    expect(run(s, killObj(c.id), { controller: "p2" }).status).toBe("resolved");
    expect(zoneOf(s, c.id)).toBe("trash");
  });

  it("[R371.2.a][R321][C:Unlicensed Armory][C:Void Seeker] a death in a cleanup waits for the decision; paying recalls the unit", () => {
    const s = withCards(["Void Seeker", "Void Seeker"]);
    const unit = place(s, "p1", "Treasure Hunter", "battlefieldA");
    run(s, armoryReplacement(unit.id));
    s.room.rules!.pools.p1!.power = { Fury: 1 };
    fund(s, "p1", "Void Seeker");
    s.as("p1").play("Void Seeker", { choices: { "target:0": unit.id } }).expectOk();
    s.as("p2").pass().expectOk();
    const prompt = s.expectPrompt("yes-no", "p1").room.rules!.prompt!;
    expect(prompt.data).toMatchObject({ reason: "effects.replacement" });
    expect(zoneOf(s, unit.id)).toBe("battlefieldA");
    s.as("p1").choose({ optionIds: ["yes"] }).expectOk();
    expect(zoneOf(s, unit.id)).toBe("base");
    expect(s.room.rules!.objects[unit.id]?.damage).toBeUndefined();
    expect(s.host.isExhausted(s.room, unit.id)).toBe(true);
    expect(s.room.rules!.pools.p1!.power.Fury ?? 0).toBe(0);
    expect(s.room.rules!.prompt).toBeNull();
  });

  it("[R371.2][C:Unlicensed Armory] an optional cost that cannot be paid is not offered; declining lets the unit die", () => {
    const s = withCards(["Void Seeker"]);
    const unit = place(s, "p1", "Treasure Hunter", "battlefieldA");
    run(s, armoryReplacement(unit.id));
    // No [Fury] available: the replacement cannot be applied, the unit simply dies.
    expect(run(s, killObj(unit.id), { controller: "p2" }).status).toBe("resolved");
    expect(zoneOf(s, unit.id)).toBe("trash");

    const other = place(s, "p1", "Stellacorn Herder", "battlefieldA");
    run(s, armoryReplacement(other.id));
    s.room.rules!.pools.p1!.power = { Fury: 1 };
    expect(run(s, killObj(other.id), { controller: "p2" }).status).toBe("await");
    s.as("p1").choose({ optionIds: ["no"] }).expectOk();
    expect(zoneOf(s, other.id)).toBe("trash");
    expect(s.room.rules!.pools.p1!.power.Fury).toBe(1);
  });

  it("[R373][R371.2.a] two units dying in one cleanup are decided one at a time", () => {
    registerCardScript(optionalRecall("Blade of the Exile", false));
    const s = withCards(["Singularity"]);
    place(s, "p1", "Blade of the Exile", "base");
    const a = place(s, "p1", "Treasure Hunter", "battlefieldA");
    const b = place(s, "p1", "Stellacorn Herder", "battlefieldA");
    fund(s, "p1", "Singularity");
    s.as("p1").play("Singularity", { choices: { "target:0": [a.id, b.id] } }).expectOk();
    s.as("p2").pass().expectOk();
    const first = s.expectPrompt("yes-no", "p1").room.rules!.prompt!;
    expect((first.data!.queue as unknown[]).length).toBe(2);
    s.as("p1").choose({ optionIds: ["yes"] }).expectOk();
    expect(zoneOf(s, a.id)).toBe("base");
    s.expectPrompt("yes-no", "p1");
    s.as("p1").choose({ optionIds: ["no"] }).expectOk();
    expect(zoneOf(s, b.id)).toBe("trash");
    expect(s.room.rules!.prompt).toBeNull();
  });
});

describe("ordering replacements [R372]", () => {
  it("[R372][R374][C:Smite][C:Zhonya's Hourglass] the controller of the dying unit chooses which replacement applies", () => {
    for (const pick of ["zhonya", "smite"] as const) {
      const s = withCards(["Zhonya's Hourglass"]);
      const unit = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
      const zhonya = place(s, "p1", "Zhonya's Hourglass", "base");
      // Smite (p2): "If it would die this turn, banish it instead."
      run(s, { op: "replace", matches: { type: "kill", subject: { targetRef: `obj:${unit.id}` } }, replace: { op: "banish", target: { targetRef: "event" } } }, { controller: "p2" });
      expect(run(s, killObj(unit.id), { controller: "p2" }).status).toBe("await");
      const prompt = s.room.rules!.prompt!;
      expect(prompt).toMatchObject({ kind: "choose-mode", playerId: "p1", rule: "372", min: 1, max: 1 });
      expect(prompt.options).toHaveLength(2);
      const zhonyaOption = prompt.options!.find((option) => option.objectId === zhonya.id)!;
      const smiteOption = prompt.options!.find((option) => option.objectId !== zhonya.id)!;
      s.as("p1").choose({ optionIds: [pick === "zhonya" ? zhonyaOption.id : smiteOption.id] }).expectOk();
      if (pick === "zhonya") {
        expect(zoneOf(s, unit.id)).toBe("base");
        expect(zoneOf(s, zhonya.id)).toBe("trash");
      } else {
        expect(zoneOf(s, unit.id)).toBe("banished");
        expect(zoneOf(s, zhonya.id)).toBe("base");
      }
    }
  });

  it("[R372][R370.2][EX:370.2] with two Zhonya's Hourglasses the player picks which one is used", () => {
    const s = withCards(["Zhonya's Hourglass", "Zhonya's Hourglass"]);
    const unit = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    const first = place(s, "p1", "Zhonya's Hourglass", "base");
    const second = place(s, "p1", "Zhonya's Hourglass", "base");
    expect(run(s, killObj(unit.id), { controller: "p2" }).status).toBe("await");
    const prompt = s.room.rules!.prompt!;
    expect(prompt.options!.map((option) => option.objectId)).toEqual([first.id, second.id]);
    s.as("p1").choose({ optionIds: [prompt.options![1]!.id] }).expectOk();
    expect(zoneOf(s, second.id)).toBe("trash");
    expect(zoneOf(s, first.id)).toBe("base");
    expect(zoneOf(s, unit.id)).toBe("base");
    // The other Hourglass was not applied to the replaced death (370.2 / 370.1.a.1).
    expect(s.events().filter((event) => event.type === "replaced")).toHaveLength(1);
  });
});
