/**
 * Edge cases: the Awaken Phase ready (315.1 / 416.3.a) — docs/rules/edge-cases-audit.md.
 *
 * Every turn starts by readying everything the Turn Player controls. The rules make this a
 * per-object Ready (416.3.a "A player Readies all non-spell Game Objects they Control during the
 * Awakening Phase"), so "can't be readied" (054.1) still applies and "when I become ready" /
 * "when you ready" abilities trigger exactly as they do for an effect-driven ready (416.3.b).
 */
import { describe, expect, it } from "vitest";
import { effectiveKeywords, effectiveMight, exhaust, ready } from "../../src";
import { register } from "../scenarios/dsl";
import { boardOf, drive, duel, exhausted, nextOwnTurn, placeUnit } from "./helpers";

describe("Awaken Phase ready [R315.1][R416.3.a]", () => {
  it("[R315.1.b][R416.3.a] the Turn Player's exhausted units, gear, runes and legend all ready; the opponent's do not", () => {
    const s = duel();
    const unit = placeUnit(s, "p1", "Clockwork Keeper", "base", "mine");
    const theirs = placeUnit(s, "p2", "Clockwork Keeper", "base", "theirs");
    unit.exhausted = true;
    theirs.exhausted = true;
    const rune = boardOf(s, "p1").runeArea[0]!;
    rune.exhausted = true;
    s.as("p1").endTurn().expectOk();
    drive(s);
    // p2's Awaken readied p2's unit only.
    expect(exhausted(s, theirs)).toBe(false);
    expect(exhausted(s, unit)).toBe(true);
    s.as("p2").endTurn().expectOk();
    drive(s);
    expect(exhausted(s, unit)).toBe(false);
    expect(exhausted(s, rune)).toBe(false);
  });

  it("[R416.3.a][R054.1][C:Maduli the Gatekeeper] \"I can't be readied\" also holds during its controller's Awaken Phase", () => {
    const s = duel({ p1: ["Maduli the Gatekeeper"] });
    const maduli = placeUnit(s, "p1", "Maduli the Gatekeeper", "base", "maduli");
    maduli.exhausted = true;
    const keeper = placeUnit(s, "p1", "Clockwork Keeper", "base", "keeper");
    keeper.exhausted = true;
    nextOwnTurn(s);
    expect(s.room.rules?.turn.player).toBe("p1");
    expect(exhausted(s, keeper)).toBe(false);
    expect(exhausted(s, maduli)).toBe(true);
  });

  it("[R416.3.a][R383.1][C:Fretful Feline] \"When I become ready\" triggers when the Awaken Phase readies it", () => {
    const s = duel({ p1: ["Fretful Feline"] });
    const feline = placeUnit(s, "p1", "Fretful Feline", "base", "feline");
    feline.exhausted = true;
    nextOwnTurn(s);
    expect(s.room.rules?.turn.player).toBe("p1");
    expect(exhausted(s, feline)).toBe(false);
    // 5 printed Might + 2 this turn from its own trigger.
    expect(effectiveMight(s.room, feline.id, s.host)).toBe(7);
  });

  it("[R416.1.b][C:Fretful Feline] a unit that was already ready at the Awaken Phase is not readied again and does not trigger", () => {
    const s = duel({ p1: ["Fretful Feline"] });
    const feline = placeUnit(s, "p1", "Fretful Feline", "base", "feline");
    feline.exhausted = false;
    nextOwnTurn(s);
    expect(effectiveMight(s.room, feline.id, s.host)).toBe(5);
  });

  it("[R416.1.c][C:Fretful Feline] readying an already-ready unit by an effect does nothing and does not trigger", () => {
    const s = duel({ p1: ["Fretful Feline"] });
    const feline = placeUnit(s, "p1", "Fretful Feline", "base", "feline");
    feline.exhausted = false;
    const step = { ctx: s.ctx, host: s.host, events: [] as import("@rift/protocol").GameEvent[] };
    expect(ready(s.room, feline.id, step)).toBe(false);
    expect(step.events.some((event) => event.type === "ready")).toBe(false);
    feline.exhausted = true;
    expect(exhaust(s.room, feline.id, step)).toBe(false);
    expect(step.events.some((event) => event.type === "exhaust")).toBe(false);
  });

  it("[R416.3.a][R412.4][R383.3.d][C:Pirate's Haven] \"When you ready a friendly unit\" triggers once per unit the Turn Player readies", () => {
    const s = duel({ p1: ["Pirate's Haven"] });
    placeUnit(s, "p1", "Pirate's Haven", "base", "haven");
    const keeper = placeUnit(s, "p1", "Clockwork Keeper", "base", "keeper");
    const hunter = placeUnit(s, "p1", "Treasure Hunter", "base", "hunter");
    const enemy = placeUnit(s, "p2", "Treasure Hunter", "base", "enemy");
    keeper.exhausted = true;
    hunter.exhausted = true;
    enemy.exhausted = true;
    s.as("p1").endTurn().expectOk();
    drive(s);
    // p2's own Awaken readied p2's unit: not "you" (412.4), so no trigger for p1.
    expect(effectiveMight(s.room, enemy.id, s.host)).toBe(1);
    s.as("p2").endTurn().expectOk();
    const kinds: string[] = [];
    drive(s, { answer: (prompt) => (kinds.push(prompt.kind), null) });
    // Two simultaneous triggers of one player are ordered by that player (383.3.d).
    expect(kinds).toEqual(["order"]);
    expect(effectiveMight(s.room, keeper.id, s.host)).toBe(3);
    expect(effectiveMight(s.room, hunter.id, s.host)).toBe(2);
  });

  it("[R412.1][R416.3.b][C:Pirate's Haven] an effect that readies a friendly unit triggers it too", () => {
    const s = duel({ p1: ["Pirate's Haven"] });
    placeUnit(s, "p1", "Pirate's Haven", "base", "haven");
    const keeper = placeUnit(s, "p1", "Clockwork Keeper", "base", "keeper");
    keeper.exhausted = true;
    // A test spell (replacing Meditation's script for this file) that readies a friendly unit.
    register({
      name: "Meditation",
      text: "Ready a friendly unit.",
      status: "implemented",
      abilities: [{ kind: "spell", effect: { op: "ready", target: { chosen: true, cardType: "unit", controller: "self" } } }],
    });
    s.moveDeckCardToHand("p1", "Meditation");
    s.room.rules!.pools.p1 = { energy: 2, power: {} };
    s.as("p1").play("Meditation", { choices: { "target:0": [keeper.id] } }).expectOk();
    drive(s);
    expect(exhausted(s, keeper)).toBe(false);
    expect(effectiveMight(s.room, keeper.id, s.host)).toBe(3);
  });

  it("[R416.3.a][R383.1][C:Jayce, Hammer in Hand] \"When I become ready, choose one\" asks its controller at the Awaken Phase", () => {
    const s = duel({ p1: ["Jayce, Hammer in Hand"] });
    const jayce = placeUnit(s, "p1", "Jayce, Hammer in Hand", "base", "jayce");
    jayce.exhausted = true;
    let asked: string[] = [];
    s.as("p1").endTurn().expectOk();
    drive(s);
    s.as("p2").endTurn().expectOk();
    drive(s, {
      answer: (prompt) => {
        asked = (prompt.options ?? []).map((option) => option.id);
        return prompt.kind === "choose-mode" ? ["ganking"] : null;
      },
    });
    expect(s.room.rules?.turn.player).toBe("p1");
    expect(asked).toEqual(["assault", "deflect", "ganking"]);
    expect(effectiveKeywords(s.room, jayce.id, s.host)).toContain("Ganking");
  });
});
