/**
 * RAD wave R4 — cards upgraded by R3-engine capabilities: Show Off (832) and damage split
 * (355.14 / 715.3), plus the R4 optional-replacement card.
 */
import { describe, expect, it } from "vitest";
import { effectiveMight, getCardScript } from "../../../src";
import { boardOf, fund, zoneOf } from "../../rules/effects/helpers";
import { answer, namesIn, put, resolveAll, withCards } from "./helpers";

describe("RAD wave R4 upgrades", () => {
  it("[C:Scorched Earth][R355.14.f] the controller divides 5 damage at a single battlefield", () => {
    const s = withCards(["Scorched Earth"]);
    const a = put(s, "p2", "Whiteflame Protector", "battlefieldA");
    const b = put(s, "p2", "Astral Heron", "battlefieldA");
    const far = put(s, "p2", "Caitlyn, Patrolling", "battlefieldB");
    fund(s, "p1", "Scorched Earth");
    s.as("p1")
      .play("Scorched Earth", { choices: { "target:0": [a.id, b.id] } })
      .expectOk();
    s.as("p2").pass().expectOk();
    s.expectPrompt("damage-assignment", "p1");
    s.as("p1")
      .choose({
        assignments: [
          { targetId: a.id, amount: 1 },
          { targetId: b.id, amount: 4 },
        ],
      })
      .expectOk();
    expect(s.room.rules!.objects[a.id]?.damage).toBe(1);
    expect(s.room.rules!.objects[b.id]?.damage).toBe(4);
    expect(zoneOf(s, far.id)).toBe("battlefieldB");
  });

  it("[C:Battle Preparations][R832][R416] Show Off a gear: +2 Might and ready up to 2 runes", () => {
    const s = withCards(["Battle Preparations", "Blade of the Exile"]);
    const unit = put(s, "p1", "Caitlyn, Patrolling", "base");
    const gear = s.handCard("p1", "Blade of the Exile")!;
    const board = boardOf(s, "p1");
    const runes = board.runeDeck.splice(0, 3);
    board.runeArea.push(...runes.map((rune) => ({ ...rune, exhausted: true })));
    s.room.rules!.pools.p1 = { energy: 10, power: {} };
    s.as("p1")
      .play("Battle Preparations", {
        choices: { showOff: [gear.id], "target:0": unit.id },
      })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(effectiveMight(s.room, unit.id, s.host)).toBe(5);
    expect(board.runeArea.filter((rune) => !rune.exhausted)).toHaveLength(2);
    expect(getCardScript("Battle Preparations")?.status).toBe("implemented");
  });

  it("[C:Rousing Display][R832] Show Off a 7+ cost card plays four Recruits instead of two", () => {
    const s = withCards(["Rousing Display", "The Empyrean"]);
    const shown = s.handCard("p1", "The Empyrean")!;
    fund(s, "p1", "Rousing Display");
    s.as("p1")
      .play("Rousing Display", { choices: { showOff: [shown.id] } })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(namesIn(s, "p1", "base").filter((name) => name === "Recruit")).toHaveLength(4);
  });

  it("[C:Incorrigible Construct][R832][R369.3] Show Off a Mech: enters ready", () => {
    const s = withCards(["Incorrigible Construct", "Piltovan Guidebot"]);
    const mech = s.handCard("p1", "Piltovan Guidebot")!;
    fund(s, "p1", "Incorrigible Construct");
    s.as("p1")
      .play("Incorrigible Construct", { choices: { showOff: [mech.id] } })
      .expectOk();
    resolveAll(s);
    const construct = boardOf(s, "p1").base.find((card) => card.name === "Incorrigible Construct")!;
    expect(s.host.isExhausted(s.room, construct.id)).toBe(false);
  });

  it("[C:Primordial Roar][R832] deals the shown-off unit's Might to a unit", () => {
    const s = withCards(["Primordial Roar", "Caitlyn, Patrolling"]);
    const shown = s.handCard("p1", "Caitlyn, Patrolling")!;
    const enemy = put(s, "p2", "Astral Heron", "battlefieldA");
    fund(s, "p1", "Primordial Roar");
    s.as("p1")
      .play("Primordial Roar", { choices: { showOff: [shown.id], "target:0": enemy.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(s.room.rules!.objects[enemy.id]?.damage).toBe(3);
  });

  it("[C:The Empyrean][R832] Show Off, Predict its Power cost, then draw 2", () => {
    const s = withCards(["The Empyrean", "Kai'Sa, Rebel"]);
    const shown = s.handCard("p1", "Kai'Sa, Rebel")!; // Power cost 1
    const hand = boardOf(s, "p1").hand.length;
    fund(s, "p1", "The Empyrean");
    s.as("p1")
      .play("The Empyrean", { choices: { showOff: [shown.id] } })
      .expectOk();
    resolveAll(s);
    s.expectPrompt("choose-card", "p1");
    answer(s, []);
    expect(boardOf(s, "p1").hand.length).toBe(hand - 1 + 2);
    expect(namesIn(s, "p1", "base")).toContain("The Empyrean");
  });
});
