/** Origins O–Z: single-instruction spells. */
import { describe, expect, it } from "vitest";
import { effectiveMight } from "../../../src";
import { boardOf, fund, place, zoneOf } from "../../rules/effects/helpers";
import { setMight, withCards } from "./helpers";

describe("Origins O–Z simple spells", () => {
  it("[C:Primal Strength][R479.4] gives a unit +7 Might this turn", () => {
    const s = withCards(["Primal Strength"]);
    const unit = place(s, "p1", "Caitlyn, Patrolling", "base");
    fund(s, "p1", "Primal Strength");
    s.as("p1")
      .play("Primal Strength", { choices: { "target:0": unit.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(effectiveMight(s.room, unit.id, s.host)).toBe(10);
  });

  it("[C:Progress Day][R414] draws 4", () => {
    const s = withCards(["Progress Day"]);
    const before = boardOf(s, "p1").hand.length;
    fund(s, "p1", "Progress Day");
    s.as("p1").play("Progress Day").expectOk();
    s.as("p2").pass().expectOk();
    expect(boardOf(s, "p1").hand.length).toBe(before - 1 + 4);
  });

  it("[C:Rune Prison][R424] stuns a unit", () => {
    const s = withCards(["Rune Prison"]);
    const enemy = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    fund(s, "p1", "Rune Prison");
    s.as("p1")
      .play("Rune Prison", { choices: { "target:0": enemy.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(s.room.rules!.objects[enemy.id]?.stunned).toBe(true);
  });

  it("[C:Smoke Screen][R479.4.b] -4 Might this turn, to a minimum of 1", () => {
    const s = withCards(["Smoke Screen", "Smoke Screen"]);
    const big = place(s, "p2", "Whiteflame Protector", "battlefieldA");
    setMight(s, big.id, 7);
    const small = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    fund(s, "p1", "Smoke Screen");
    s.as("p1")
      .play("Smoke Screen", { choices: { "target:0": big.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(effectiveMight(s.room, big.id, s.host)).toBe(3);
    fund(s, "p1", "Smoke Screen");
    s.as("p1")
      .play("Smoke Screen", { choices: { "target:0": small.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(effectiveMight(s.room, small.id, s.host)).toBe(1);
  });

  it("[C:Vengeance][R429] kills a unit (anywhere on the board)", () => {
    const s = withCards(["Vengeance"]);
    const enemy = place(s, "p2", "Caitlyn, Patrolling", "base");
    fund(s, "p1", "Vengeance");
    s.as("p1")
      .play("Vengeance", { choices: { "target:0": enemy.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(zoneOf(s, enemy.id)).toBe("trash");
  });

  it("[C:Wind Wall][R426][R355.9.a.2] counters a spell on the chain; it goes to its owner's trash", () => {
    const s = withCards(["Progress Day"], ["Wind Wall"]);
    const before = boardOf(s, "p1").hand.length;
    fund(s, "p1", "Progress Day");
    s.as("p1").play("Progress Day").expectOk();
    const item = s.room.rules!.chain[0]!;
    fund(s, "p2", "Wind Wall");
    s.as("p2")
      .play("Wind Wall", { choices: { "target:0": item.id } })
      .expectOk();
    s.as("p1").pass().expectOk();
    expect(s.room.rules!.chain).toHaveLength(0);
    expect(boardOf(s, "p1").hand.length).toBe(before - 1);
    expect(boardOf(s, "p1").trash.map((card) => card.name)).toContain("Progress Day");
  });

  it("[C:Thermo Beam][R429][R355.5.a] kills all gear, friendly and enemy", () => {
    const s = withCards(["Thermo Beam"], ["Blade of the Exile"]);
    const mine = place(s, "p1", "Blade of the Exile", "base");
    const theirs = place(s, "p2", "Blade of the Exile", "base");
    const unit = place(s, "p2", "Caitlyn, Patrolling", "base");
    fund(s, "p1", "Thermo Beam");
    s.as("p1").play("Thermo Beam").expectOk();
    s.as("p2").pass().expectOk();
    expect(zoneOf(s, mine.id)).toBe("trash");
    expect(zoneOf(s, theirs.id)).toBe("trash");
    expect(zoneOf(s, unit.id)).toBe("base");
  });
});
