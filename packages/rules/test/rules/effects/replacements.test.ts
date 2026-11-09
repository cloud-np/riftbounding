import { afterEach, describe, expect, it } from "vitest";
import type { CardScript } from "@rift/protocol";
import { previewDamage, preventValue } from "../../../src";
import { clearCardScripts, registerTestCardScript } from "../../../src/testing";
import { scenario } from "../../scenarios/dsl";
import { boardOf, eventTypes, place, run, spell, zoneOf } from "./helpers";

afterEach(() => clearCardScripts());

/** Zhonya's Hourglass: "If a friendly unit would die, kill this instead. Heal that unit, exhaust it, and recall it." */
const ZHONYA: CardScript = {
  name: "Blade of the Exile",
  text: "test: Zhonya's Hourglass",
  status: "implemented",
  abilities: [
    {
      kind: "replacement",
      matches: { type: "kill", subject: { cardType: "unit", controller: "self" } },
      replace: {
        op: "seq",
        effects: [
          { op: "kill", target: { targetRef: "self" } },
          { op: "heal", amount: 99, target: { targetRef: "event" } },
          { op: "exhaust", target: { targetRef: "event" } },
          { op: "recall", target: { targetRef: "event" } },
        ],
      },
    },
  ],
};

describe("replacement effects [R367–R375]", () => {
  it("[R369.1][R370.1.b][EX:369.1] Zhonya's Hourglass replaces a friendly unit's death", () => {
    registerTestCardScript(ZHONYA);
    const s = scenario();
    const unit = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    const zhonya = place(s, "p1", "Blade of the Exile", "base");
    s.room.rules!.objects[unit.id] = { damage: 2 };
    const { events } = run(s, { op: "kill", target: { targetRef: "obj:" + unit.id } }, { controller: "p2" });
    expect(zoneOf(s, unit.id)).toBe("base");
    expect(s.room.rules?.objects[unit.id]?.damage).toBeUndefined();
    expect(s.host.isExhausted(s.room, unit.id)).toBe(true);
    expect(zoneOf(s, zhonya.id)).toBe("trash");
    expect(eventTypes(events)).toContain("replaced");
    expect(events.some((event) => event.type === "kill" && event.cardId === unit.id)).toBe(false);
  });

  it("[R370.2][EX:370.2] a replacement applies at most once to an event and to what replaces it", () => {
    registerTestCardScript({
      name: "Blade of the Exile",
      text: "test: If a friendly unit would die, kill it instead (self-replacing).",
      status: "implemented",
      abilities: [
        {
          kind: "replacement",
          matches: { type: "kill", subject: { cardType: "unit", controller: "self" } },
          replace: { op: "kill", target: { targetRef: "event" } },
        },
      ],
    });
    const s = scenario();
    const unit = place(s, "p1", "Caitlyn, Patrolling", "base");
    place(s, "p1", "Blade of the Exile", "base");
    const { events } = run(s, { op: "kill", target: { targetRef: "obj:" + unit.id } });
    // Without 370.2 this would recurse forever; with it the replacing kill happens once.
    expect(zoneOf(s, unit.id)).toBe("trash");
    expect(events.filter((event) => event.type === "replaced")).toHaveLength(1);
  });

  it("[R371.1] a \"once each turn\" replacement applies to one event per turn", () => {
    registerTestCardScript({
      name: "Blade of the Exile",
      text: "test: Once each turn, if a friendly unit would die, recall it instead.",
      status: "implemented",
      abilities: [
        {
          kind: "replacement",
          matches: { type: "kill", subject: { cardType: "unit", controller: "self" } },
          replace: { op: "recall", target: { targetRef: "event" } },
          limit: { kind: "once-per-turn" },
        },
      ],
    });
    const s = scenario();
    const a = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    const b = place(s, "p1", "Treasure Hunter", "battlefieldA");
    place(s, "p1", "Blade of the Exile", "base");
    run(s, { op: "kill", target: { targetRef: "obj:" + a.id } });
    run(s, { op: "kill", target: { targetRef: "obj:" + b.id } });
    expect(zoneOf(s, a.id)).toBe("base");
    expect(zoneOf(s, b.id)).toBe("trash");
  });

  it("[R374] the controller of a replacement effect controls its instructions", () => {
    registerTestCardScript(ZHONYA);
    const s = scenario();
    const enemyUnit = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    place(s, "p1", "Blade of the Exile", "base");
    // P1's Zhonya only protects P1's (friendly) units.
    run(s, { op: "kill", target: { targetRef: "obj:" + enemyUnit.id } });
    expect(zoneOf(s, enemyUnit.id)).toBe("trash");
  });
});

describe("prevention [R438]", () => {
  it("[R438.2][R438.3][R438.3.a] prevention reduces damage and is used up", () => {
    const s = scenario();
    const unit = place(s, "p1", "Whiteflame Protector", "base");
    run(s, { op: "prevent", amount: 3, target: { targetRef: "obj:" + unit.id } });
    expect(preventValue(s.room, unit.id)).toBe(3);
    const { events } = run(s, { op: "deal", amount: 2, target: { targetRef: "obj:" + unit.id } }, { controller: "p2" });
    expect(s.room.rules?.objects[unit.id]?.damage).toBeUndefined();
    expect(eventTypes(events)).toContain("prevented");
    expect(preventValue(s.room, unit.id)).toBe(1);
    run(s, { op: "deal", amount: 4, target: { targetRef: "obj:" + unit.id } }, { controller: "p2" });
    expect(s.room.rules?.objects[unit.id]?.damage).toBe(3);
    expect(preventValue(s.room, unit.id)).toBe(0);
  });

  it("[R438.1.b.1.b][R438.3.c] \"prevent all\" never runs out", () => {
    const s = scenario();
    const unit = place(s, "p1", "Caitlyn, Patrolling", "base");
    run(s, { op: "prevent", amount: 9999, target: { targetRef: "obj:" + unit.id } });
    run(s, { op: "deal", amount: 50, target: { targetRef: "obj:" + unit.id } });
    run(s, { op: "deal", amount: 50, target: { targetRef: "obj:" + unit.id } });
    expect(s.room.rules?.objects[unit.id]?.damage).toBeUndefined();
    expect(preventValue(s.room, unit.id)).toBe("all");
  });

  it("[R438.4][R418.1.e.1][EX:418.1.e.1] fully prevented damage is not dealt: \"when I take damage\" does not trigger", () => {
    registerTestCardScript({
      name: "Caitlyn, Patrolling",
      text: "test: when I take damage, gain 1 XP",
      status: "implemented",
      abilities: [{ kind: "triggered", trigger: { kind: "event", event: { type: "damage", subject: { targetRef: "self" } } }, effect: { op: "gain_xp", amount: 1 } }],
    });
    registerTestCardScript(spell("Rebuke", { op: "deal", amount: 3, target: { chosen: true, cardType: "unit" } }));
    const s = scenario({ p1: { hand: ["Rebuke"], energy: 2 } });
    const unit = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    run(s, { op: "prevent", amount: 3, target: { targetRef: "obj:" + unit.id } }, { controller: "p2" });
    s.as("p1").play("Rebuke", { choices: { "target:0": unit.id } }).expectOk();
    s.as("p2").pass().expectOk();
    expect(s.room.rules?.chain).toHaveLength(0);
    expect(s.room.rules?.objects[unit.id]?.damage).toBeUndefined();
  });

  it("[R715.4.a][EX:715.4.a] prevention includes Bonus Damage in the amount it reduces", () => {
    registerTestCardScript(spell("Rebuke", { op: "deal", amount: 3, target: { chosen: true, cardType: "unit" } }));
    const s = scenario({ p1: { hand: ["Rebuke"], energy: 2 } });
    const unit = place(s, "p2", "Whiteflame Protector", "battlefieldA");
    s.room.rules!.effects.push({ id: "fx-b", controller: "p1", duration: "permanent", modifier: { kind: "custom", id: "bonus-damage", params: { amount: 1 } } });
    run(s, { op: "prevent", amount: 3, target: { targetRef: "obj:" + unit.id } }, { controller: "p2" });
    s.as("p1").play("Rebuke", { choices: { "target:0": unit.id } }).expectOk();
    s.as("p2").pass().expectOk();
    expect(s.room.rules?.objects[unit.id]?.damage).toBe(1);
  });

  it("[R438.5.a][R467.2.c.4.a][EX:438.5.a] previewDamage reflects prevention without using it", () => {
    const s = scenario();
    const unit = place(s, "p1", "Treasure Hunter", "battlefieldA");
    run(s, { op: "prevent", amount: 3, target: { targetRef: "obj:" + unit.id } });
    expect(previewDamage(s.room, s.host, { targetId: unit.id, amount: 5, combat: true })).toBe(2);
    expect(previewDamage(s.room, s.host, { targetId: unit.id, amount: 2, combat: true })).toBe(0);
    expect(preventValue(s.room, unit.id)).toBe(3);
  });

  it("[R467.2.c.10] previewDamage is 0 for a unit that can't be dealt damage", () => {
    registerTestCardScript({
      name: "Treasure Hunter",
      text: "test: I can't be dealt damage.",
      status: "implemented",
      abilities: [{ kind: "passive", modifier: { kind: "restriction", restriction: "be-dealt-damage", target: { targetRef: "self" } } }],
    });
    const s = scenario();
    const unit = place(s, "p1", "Treasure Hunter", "battlefieldA");
    expect(previewDamage(s.room, s.host, { targetId: unit.id, amount: 4 })).toBe(0);
    run(s, { op: "deal", amount: 4, target: { targetRef: "obj:" + unit.id } }, { controller: "p2" });
    expect(s.room.rules?.objects[unit.id]?.damage).toBeUndefined();
  });

  it("[R438.1.a][R369.2] a { prevent } replacement ability reduces matching damage (and the preview)", () => {
    registerTestCardScript({
      name: "Treasure Hunter",
      text: "test: Prevent 1 damage that would be dealt to me.",
      status: "implemented",
      abilities: [{ kind: "replacement", matches: { type: "deal_damage", subject: { targetRef: "self" } }, replace: { prevent: 1 } }],
    });
    const s = scenario();
    const unit = place(s, "p1", "Caitlyn, Patrolling", "base");
    const hunter = place(s, "p1", "Treasure Hunter", "base");
    expect(previewDamage(s.room, s.host, { targetId: hunter.id, amount: 3 })).toBe(2);
    expect(previewDamage(s.room, s.host, { targetId: unit.id, amount: 3 })).toBe(3);
    run(s, { op: "deal", amount: 3, target: { targetRef: "obj:" + hunter.id } }, { controller: "p2" });
    expect(s.room.rules?.objects[hunter.id]?.damage).toBe(2);
  });
});

describe("skip [R444]", () => {
  it("[R444.1.a][R444.2][EX:444.1.a] \"skip your Draw Phase\" replaces the Draw Phase draw with nothing", () => {
    const s = scenario();
    run(s, { op: "skip", what: "draw" }, { controller: "p2" });
    const before = boardOf(s, "p2").hand.length;
    s.as("p1").endTurn().expectOk();
    expect(s.room.rules?.turn.player).toBe("p2");
    expect(boardOf(s, "p2").hand.length).toBe(before);
    expect(s.events().some((event) => event.type === "skip")).toBe(true);
    // Used up: the next Draw Phase draws normally.
    expect(s.room.rules?.effects.some((effect) => effect.modifier.kind === "custom" && effect.modifier.id === "skip")).toBe(false);
  });
});
