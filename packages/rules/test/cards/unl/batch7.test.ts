/**
 * Unleashed (UNL) batch 7 — units, gear and battlefields.
 */
import { describe, expect, it } from "vitest";
import { costAdjustments, effectiveMight, xpOf } from "../../../src";
import { fund, place, run, zoneOf } from "../../rules/effects/helpers";
import { cardsNamed, playWith, resolveChain, settle, withCards } from "./helpers";

const say = (answer: string) => (prompt: { options?: Array<{ id: string }> }) =>
  prompt.options?.some((option) => option.id === answer) ? [answer] : undefined;

describe("Unleashed batch 7 — unit triggers", () => {
  it("[C:Vex, Mocking][R424][R421] when you stun an enemy unit at a battlefield, you may move me there", () => {
    const s = withCards(["Heroic Charge", "Vex, Mocking"], [], { firstPlayer: "p1" });
    const vex = place(s, "p1", "Vex, Mocking", "base");
    const friend = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    const near = place(s, "p2", "Whiteflame Protector", "battlefieldA");
    fund(s, "p1", "Heroic Charge");
    s.as("p1")
      .play("Heroic Charge", { choices: { "target:0": friend.id, "target:1": near.id } })
      .expectOk();
    settle(s, {
      onPrompt: (prompt) => say("yes")(prompt),
      until: () => zoneOf(s, vex.id) === "battlefieldA",
    });
    expect(s.room.rules!.objects[near.id]?.stunned).toBe(true);
    expect(zoneOf(s, vex.id)).toBe("battlefieldA");
  });

  it("[C:Red Brambleback][R383.4.c][R427] when I conquer, buff a friendly unit", () => {
    const s = withCards(["Red Brambleback"]);
    const rb = place(s, "p1", "Red Brambleback", "base");
    s.as("p1").move("Red Brambleback", "battlefieldB").expectOk();
    settle(s);
    expect(s.room.rules!.objects[rb.id]?.buffs).toBe(1);
  });

  it("[C:Atakhan][R466.2.c][R429] when I attack, the defender kills one of their units here", () => {
    const s = withCards(["Atakhan"]);
    place(s, "p1", "Atakhan", "base");
    const a = place(s, "p2", "Caitlyn, Patrolling", "battlefieldB");
    const b = place(s, "p2", "Treasure Hunter", "battlefieldB");
    s.as("p1").move("Atakhan", "battlefieldB").expectOk();
    settle(s, {
      onPrompt: (prompt) => (prompt.options?.some((o) => o.id === b.id) ? [b.id] : undefined),
      until: () => zoneOf(s, b.id) === "trash",
    });
    expect(zoneOf(s, b.id)).toBe("trash");
    expect(zoneOf(s, a.id)).toBe("battlefieldB");
  });

  it("[C:Safety Inspector][R429][R356.2.b.1] spending 3 XP as the additional cost: only the opponent kills a unit", () => {
    const s = withCards(["Safety Inspector"]);
    const mine = place(s, "p1", "Treasure Hunter", "base");
    const theirs = place(s, "p2", "Caitlyn, Patrolling", "base");
    run(s, { op: "gain_xp", amount: 3 });
    fund(s, "p1", "Safety Inspector");
    playWith(s, "p1", "Safety Inspector", { optionalCosts: ["optional:0"] });
    settle(s);
    expect(xpOf(s.room, "p1")).toBe(0);
    expect(zoneOf(s, theirs.id)).toBe("trash");
    expect(zoneOf(s, mine.id)).toBe("base");
  });

  it("[C:Baron Nashor][R757.1][R479] other friendly units have +2 Might; enemies can't choose me", () => {
    const s = withCards(["Baron Nashor", "Moonlight Affliction"], ["Moonlight Affliction"]);
    const baron = place(s, "p1", "Baron Nashor", "base");
    const ally = place(s, "p1", "Caitlyn, Patrolling", "base");
    expect(effectiveMight(s.room, ally.id, s.host)).toBe(5);
    expect(effectiveMight(s.room, baron.id, s.host)).toBe(12);
    fund(s, "p2", "Moonlight Affliction");
    s.room.rules!.turn.player = "p2";
    const result = s.as("p2").play("Moonlight Affliction", { choices: { "target:0": baron.id } });
    expect(result.lastError()).toBeTruthy();
  });

  it("[C:Daisy!][R366.2.a][R369.3] enters ready; costs 1 less for each of Bird, Cat, Dog and Poro among your units", () => {
    const s = withCards(["Daisy!", "Mutated Mouser", "Mosstomper", "Loyal Poro"]);
    const daisy = s.handCard("p1", "Daisy!")!;
    const reduction = () =>
      costAdjustments(s.room, s.host, { playerId: "p1", cardId: daisy.id }).reduce(
        (sum, adjustment) => sum + (adjustment.energy ?? 0),
        0,
      );
    expect(reduction()).toBe(0);
    place(s, "p1", "Mutated Mouser", "base"); // Cat
    expect(reduction()).toBe(-1);
    place(s, "p1", "Mosstomper", "base"); // Dog
    place(s, "p1", "Loyal Poro", "base"); // Poro
    run(s, { op: "create", token: { name: "Bird", play: true } }); // Bird
    expect(reduction()).toBe(-4);
    s.room.rules!.pools.p1 = { energy: 5, power: { Calm: 2, Order: 2 } };
    s.as("p1").play("Daisy!").expectOk();
    resolveChain(s);
    expect(cardsNamed(s, "p1", "base", "Daisy!")[0]!.exhausted).toBe(false);
  });

  it("[C:Daisy!][R383.4.e][R424] when I attack while your units have all four tags, stun an enemy unit here", () => {
    const s = withCards(["Daisy!", "Mutated Mouser", "Mosstomper", "Loyal Poro"]);
    place(s, "p1", "Daisy!", "base");
    place(s, "p1", "Mutated Mouser", "base");
    place(s, "p1", "Mosstomper", "base");
    place(s, "p1", "Loyal Poro", "base");
    run(s, { op: "create", token: { name: "Bird", play: true } });
    const enemy = place(s, "p2", "Whiteflame Protector", "battlefieldB");
    s.as("p1").move("Daisy!", "battlefieldB").expectOk();
    settle(s, { until: () => !!s.room.rules!.objects[enemy.id]?.stunned });
    expect(s.room.rules!.objects[enemy.id]?.stunned).toBe(true);
  });

  it("[C:Daisy!][R383.4.e] without all four tags nothing is stunned", () => {
    const s = withCards(["Daisy!", "Mutated Mouser"]);
    place(s, "p1", "Daisy!", "base");
    place(s, "p1", "Mutated Mouser", "base");
    const enemy = place(s, "p2", "Whiteflame Protector", "battlefieldB");
    s.as("p1").move("Daisy!", "battlefieldB").expectOk();
    settle(s);
    expect(s.room.rules!.objects[enemy.id]?.stunned).toBeFalsy();
  });
});
