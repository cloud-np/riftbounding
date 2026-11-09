/**
 * RAD wave R4 spells — Fanfare, Encore, Remember the Fallen, Last Caress.
 */
import { describe, expect, it } from "vitest";
import { effectiveMight, getCardScript } from "../../../src";
import { boardOf, fund, zoneOf } from "../../rules/effects/helpers";
import { answer, flushWork, namesIn, put, resolveAll, withCards } from "./helpers";

describe("RAD wave R4 spells", () => {
  it("[C:Fanfare][R390] the next three units you play this turn draw 1", () => {
    const s = withCards(["Fanfare", "Treasure Hunter", "Treasure Hunter"]);
    s.room.rules!.pools.p1 = { energy: 30, power: {} };
    s.as("p1").play("Fanfare").expectOk();
    resolveAll(s);
    const hand = boardOf(s, "p1").hand.length;
    s.as("p1").play("Treasure Hunter").expectOk();
    flushWork(s);
    expect(boardOf(s, "p1").hand.length).toBe(hand); // -1 played, +1 drawn
    s.as("p1").play("Treasure Hunter").expectOk();
    flushWork(s);
    expect(boardOf(s, "p1").hand.length).toBe(hand);
  });

  it("[C:Encore][R355.3] choose two modes: two Recruits and 2 damage to a unit", () => {
    const s = withCards(["Encore"]);
    const enemy = put(s, "p2", "Astral Heron", "battlefieldA");
    fund(s, "p1", "Encore");
    s.as("p1").play("Encore").expectOk();
    resolveAll(s);
    s.expectPrompt("choose-mode", "p1");
    expect(s.room.rules!.prompt!.min).toBe(2);
    expect(s.room.rules!.prompt!.max).toBe(2);
    answer(s, ["tokens", "deal"]);
    resolveAll(s);
    if (s.room.rules!.prompt?.kind === "choose-target") answer(s, [enemy.id]);
    resolveAll(s);
    expect(namesIn(s, "p1", "base").filter((name) => name === "Recruit")).toHaveLength(2);
    expect(s.room.rules!.objects[enemy.id]?.damage).toBe(2);
  });

  it("[C:Remember the Fallen][R420.3] plays up to 3 units/gear from the trash ignoring costs", () => {
    const s = withCards(["Remember the Fallen"]);
    const unit = put(s, "p1", "Treasure Hunter", "trash");
    const gear = put(s, "p1", "Blade of the Exile", "trash");
    fund(s, "p1", "Remember the Fallen");
    s.as("p1").play("Remember the Fallen").expectOk();
    resolveAll(s);
    s.expectPrompt("choose-card", "p1");
    answer(s, [unit.id, gear.id]);
    resolveAll(s);
    expect(zoneOf(s, unit.id)).toBe("base");
    expect(zoneOf(s, gear.id)).toBe("base");
  });

  it("[C:Last Caress][R420.1.a] the next unit you play this turn is buffed", () => {
    const s = withCards(["Last Caress", "Treasure Hunter"]);
    s.room.rules!.pools.p1 = { energy: 20, power: {} };
    s.as("p1").play("Last Caress").expectOk();
    resolveAll(s);
    s.as("p1").play("Treasure Hunter").expectOk();
    resolveAll(s);
    const unit = boardOf(s, "p1").base.find((card) => card.name === "Treasure Hunter")!;
    expect(s.room.rules!.objects[unit.id]?.buffs).toBe(1);
    expect(effectiveMight(s.room, unit.id, s.host)).toBe(2);
    expect(getCardScript("Last Caress")?.status).toBe("partial");
  });
});
