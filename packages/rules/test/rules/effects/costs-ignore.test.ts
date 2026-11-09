import { afterEach, describe, expect, it } from "vitest";
import { ignoredKeywords } from "../../../src";
import { clearCardScripts, registerTestCardScript } from "../../../src/testing";
import { scenario } from "../../scenarios/dsl";
import { boardOf, place, spell, zoneOf } from "./helpers";

afterEach(() => clearCardScripts());

describe("trigger costs [R383.3.b][R404.1.b.1][R405.2]", () => {
  /** Ekko, Recurrent style: "[Deathknell] Recycle me to ready your runes." */
  function setup() {
    registerTestCardScript({
      name: "Stellacorn Herder",
      text: "test: [Deathknell] Exhaust a friendly unit to draw 2.",
      status: "implemented",
      abilities: [
        {
          kind: "triggered",
          trigger: { kind: "event", event: { type: "die", subject: { targetRef: "self" } } },
          effect: { op: "cost_then", cost: { exhaust: { cardType: "unit", controller: "self", zone: "base" } }, effect: { op: "draw", amount: 2 } },
        },
      ],
    });
    registerTestCardScript(spell("Rebuke", { op: "kill", target: { chosen: true, cardType: "unit" } }));
    const s = scenario({ p1: { hand: ["Rebuke"], energy: 2 } });
    const herder = place(s, "p2", "Stellacorn Herder", "battlefieldA");
    const payer = place(s, "p2", "Caitlyn, Patrolling", "base");
    s.as("p1").play("Rebuke", { choices: { "target:0": herder.id } }).expectOk();
    s.as("p2").pass().expectOk();
    return { s, herder, payer };
  }

  it("[R383.3.b][EX:383.3.b] a leading cost within instructions is paid when the trigger finalizes", () => {
    const { s, payer } = setup();
    s.expectPrompt("yes-no", "p2");
    expect(s.room.rules!.prompt!.rule).toBe("405.2");
    s.as("p2").choose({ optionIds: ["yes"] }).expectOk();
    expect(s.host.isExhausted(s.room, payer.id)).toBe(true);
    const before = boardOf(s, "p2").hand.length;
    s.as("p2").pass().expectOk();
    s.as("p1").pass().expectOk();
    expect(boardOf(s, "p2").hand.length).toBe(before + 2);
  });

  it("[R405.2][R405.2.a] declining the trigger's cost removes it before it is finalized", () => {
    const { s, payer } = setup();
    s.as("p2").choose({ optionIds: ["no"] }).expectOk();
    expect(s.room.rules!.chain).toHaveLength(0);
    expect(s.host.isExhausted(s.room, payer.id)).toBe(false);
  });

  it("[R383.3.b.1] a trigger whose cost cannot be paid never becomes a Finalized Chain Item", () => {
    registerTestCardScript({
      name: "Stellacorn Herder",
      text: "test: [Deathknell] Spend 3 XP to draw 2.",
      status: "implemented",
      abilities: [
        {
          kind: "triggered",
          trigger: { kind: "event", event: { type: "die", subject: { targetRef: "self" } } },
          effect: { op: "cost_then", cost: { spendXp: 3 }, effect: { op: "draw", amount: 2 } },
        },
      ],
    });
    registerTestCardScript(spell("Rebuke", { op: "kill", target: { chosen: true, cardType: "unit" } }));
    const s = scenario({ p1: { hand: ["Rebuke"], energy: 2 } });
    const herder = place(s, "p2", "Stellacorn Herder", "battlefieldA");
    s.as("p1").play("Rebuke", { choices: { "target:0": herder.id } }).expectOk();
    s.as("p2").pass().expectOk();
    expect(zoneOf(s, herder.id)).toBe("trash");
    expect(s.room.rules!.chain).toHaveLength(0);
    expect(s.room.rules!.prompt).toBe(null);
  });

  it("[R740.4.a.1] a spell's cost within instructions is paid on resolution (optional: the player decides)", () => {
    registerTestCardScript(
      spell("Gust", {
        op: "cost_then",
        optional: true,
        cost: { exhaust: { cardType: "unit", controller: "self", zone: "base" } },
        effect: { op: "gain_xp", amount: 2 },
      }),
    );
    const s = scenario({ p1: { hand: ["Gust", "Gust"], energy: 2 } });
    const unit = place(s, "p1", "Caitlyn, Patrolling", "base");
    s.as("p1").play("Gust").expectOk();
    s.as("p2").pass().expectOk();
    s.expectPrompt("yes-no", "p1");
    s.as("p1").choose({ optionIds: ["yes"] }).expectOk();
    expect(s.host.isExhausted(s.room, unit.id)).toBe(true);
    expect(boardOf(s, "p1").legendXp ?? 0).toBe(2);
    // 415.4: with the unit already exhausted, the cost cannot be paid → no prompt, no effect.
    s.as("p1").play("Gust").expectOk();
    s.as("p2").pass().expectOk();
    expect(s.room.rules!.prompt).toBe(null);
    expect(boardOf(s, "p1").legendXp ?? 0).toBe(2);
  });
});

describe("ignoring effects [R764–R767]", () => {
  it("[R766][R767][EX:766][EX:767] \"You ignore Backline while assigning combat damage here\" applies only to you, only here", () => {
    registerTestCardScript({
      name: "Treasure Hunter",
      text: "test: You ignore Backline while assigning combat damage here.",
      status: "implemented",
      abilities: [
        { kind: "passive", modifier: { kind: "ignore-keyword", keyword: "Backline", action: "assign-combat-damage", here: true } },
      ],
    });
    const s = scenario();
    place(s, "p1", "Treasure Hunter", "battlefieldA");
    expect(ignoredKeywords(s.room, s.host, { playerId: "p1", action: "assign-combat-damage", zone: "battlefieldA" })).toEqual(["Backline"]);
    expect(ignoredKeywords(s.room, s.host, { playerId: "p2", action: "assign-combat-damage", zone: "battlefieldA" })).toEqual([]);
    expect(ignoredKeywords(s.room, s.host, { playerId: "p1", action: "assign-combat-damage", zone: "battlefieldB" })).toEqual([]);
    expect(ignoredKeywords(s.room, s.host, { playerId: "p1", action: "pay-costs", zone: "battlefieldA" })).toEqual([]);
  });
});
