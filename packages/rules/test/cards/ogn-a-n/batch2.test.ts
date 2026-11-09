/**
 * Origins A–N, batch 2: spells (damage, Might, keywords, moves, channel, enter ready).
 */
import { describe, expect, it } from "vitest";
import {
  effectiveKeywordValues,
  effectiveKeywords,
  effectiveMight,
  getCardScript,
} from "../../../src";
import { boardOf, fund, place, zoneOf } from "../../rules/effects/helpers";
import { setControl } from "../../rules/combat/helpers";
import { cardIn, drain, toTrash, withCards } from "./helpers";

describe("Origins A–N — spells", () => {
  it("[C:Falling Comet][R418.1.b] deals 6 to a unit at a battlefield", () => {
    const s = withCards(["Falling Comet"]);
    const enemy = place(s, "p2", "Astral Heron", "battlefieldA");
    fund(s, "p1", "Falling Comet");
    s.as("p1")
      .play("Falling Comet", { choices: { "target:0": enemy.id } })
      .expectOk();
    drain(s);
    expect(s.room.rules!.objects[enemy.id]?.damage).toBe(6);
  });

  it("[C:Flurry of Blades][R418.1.d] deals 1 to all units at battlefields (not at bases)", () => {
    const s = withCards(["Flurry of Blades"]);
    const mine = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    const theirs = place(s, "p2", "Stellacorn Herder", "battlefieldB");
    const home = place(s, "p2", "Astral Heron", "base");
    fund(s, "p1", "Flurry of Blades");
    s.as("p1").play("Flurry of Blades").expectOk();
    drain(s);
    expect(s.room.rules!.objects[mine.id]?.damage).toBe(1);
    expect(s.room.rules!.objects[theirs.id]?.damage).toBe(1);
    expect(s.room.rules!.objects[home.id]?.damage).toBeUndefined();
  });

  it("[C:Grand Strategem][R479.4] gives friendly units +5 Might this turn", () => {
    const s = withCards(["Grand Strategem"]);
    const a = place(s, "p1", "Caitlyn, Patrolling", "base");
    const b = place(s, "p1", "Treasure Hunter", "battlefieldA");
    const enemy = place(s, "p2", "Stellacorn Herder", "base");
    fund(s, "p1", "Grand Strategem");
    s.as("p1").play("Grand Strategem").expectOk();
    drain(s);
    expect(effectiveMight(s.room, a.id, s.host)).toBe(8);
    expect(effectiveMight(s.room, b.id, s.host)).toBe(6);
    expect(effectiveMight(s.room, enemy.id, s.host)).toBe(3);
  });

  it("[C:Back to Back][R355.7] gives two friendly units each +2 Might this turn", () => {
    const s = withCards(["Back to Back"]);
    const a = place(s, "p1", "Caitlyn, Patrolling", "base");
    const b = place(s, "p1", "Treasure Hunter", "base");
    fund(s, "p1", "Back to Back");
    s.as("p1")
      .play("Back to Back", { choices: { "target:0": [a.id, b.id] } })
      .expectOk();
    drain(s);
    expect(effectiveMight(s.room, a.id, s.host)).toBe(5);
    expect(effectiveMight(s.room, b.id, s.host)).toBe(3);
  });

  it("[C:Cleave][R801.3.a][R807.1.c] gives a unit Assault 3 this turn", () => {
    const s = withCards(["Cleave"]);
    const unit = place(s, "p1", "Caitlyn, Patrolling", "base");
    fund(s, "p1", "Cleave");
    s.as("p1")
      .play("Cleave", { choices: { "target:0": unit.id } })
      .expectOk();
    drain(s);
    expect(effectiveKeywordValues(s.room, unit.id, s.host).assault).toBe(3);
  });

  it("[C:Block][R801.3.a][R814.1.c] gives a unit Shield 3 and Tank this turn", () => {
    const s = withCards(["Block"]);
    const unit = place(s, "p1", "Caitlyn, Patrolling", "base");
    fund(s, "p1", "Block");
    s.as("p1")
      .play("Block", { choices: { "target:0": unit.id } })
      .expectOk();
    drain(s);
    expect(effectiveKeywordValues(s.room, unit.id, s.host).shield).toBe(3);
    expect(effectiveKeywords(s.room, unit.id, s.host)).toContain("Tank");
  });

  it("[C:Consult the Past][R414.1] draws 2", () => {
    const s = withCards(["Consult the Past"]);
    const before = boardOf(s, "p1").hand.length;
    fund(s, "p1", "Consult the Past");
    s.as("p1").play("Consult the Past").expectOk();
    drain(s);
    expect(boardOf(s, "p1").hand.length).toBe(before - 1 + 2);
  });

  it("[C:Morbid Return][R355.7] returns a unit from your trash to your hand", () => {
    const s = withCards(["Morbid Return"]);
    const dead = toTrash(s, "p1", "Stellacorn Herder");
    fund(s, "p1", "Morbid Return");
    s.as("p1")
      .play("Morbid Return", { choices: { "target:0": dead.id } })
      .expectOk();
    drain(s);
    expect(zoneOf(s, dead.id)).toBe("hand");
  });

  it("[C:Fight or Flight][R421.2] moves a unit from a battlefield to its base", () => {
    const s = withCards(["Fight or Flight"]);
    const enemy = place(s, "p2", "Astral Heron", "battlefieldA");
    fund(s, "p1", "Fight or Flight");
    s.as("p1")
      .play("Fight or Flight", { choices: { "target:0": enemy.id } })
      .expectOk();
    drain(s);
    expect(zoneOf(s, enemy.id)).toBe("base");
    expect(boardOf(s, "p2").base.some((card) => card.id === enemy.id)).toBe(true);
  });

  it("[C:Charm][R355.4][R421.2] moves an enemy unit to the chosen location", () => {
    const s = withCards(["Charm"]);
    const enemy = place(s, "p2", "Astral Heron", "battlefieldA");
    fund(s, "p1", "Charm");
    s.as("p1")
      .play("Charm", { choices: { "target:0": enemy.id, destination: "base" } })
      .expectOk();
    drain(s);
    expect(boardOf(s, "p2").base.some((card) => card.id === enemy.id)).toBe(true);
  });

  it("[C:Confront][R369.3][R391.4] units you play this turn enter ready; draw 1", () => {
    const s = withCards(["Confront", "Stellacorn Herder"]);
    const before = boardOf(s, "p1").hand.length;
    fund(s, "p1", "Confront");
    s.as("p1").play("Confront").expectOk();
    drain(s);
    expect(boardOf(s, "p1").hand.length).toBe(before - 1 + 1);
    fund(s, "p1", "Stellacorn Herder");
    s.as("p1").play("Stellacorn Herder").expectOk();
    expect(cardIn(s, "p1", "base", "Stellacorn Herder")!.exhausted).toBe(false);
  });

  it("[C:Mobilize][R431.2.a][R431.3] channels 1 rune exhausted; if it can't, draws 1", () => {
    const s = withCards(["Mobilize"]);
    const runes = boardOf(s, "p1").runeArea.length;
    const hand = boardOf(s, "p1").hand.length;
    fund(s, "p1", "Mobilize");
    s.as("p1").play("Mobilize").expectOk();
    drain(s);
    const area = boardOf(s, "p1").runeArea;
    expect(area.length).toBe(runes + 1);
    expect(area[area.length - 1]!.exhausted).toBe(true);
    expect(boardOf(s, "p1").hand.length).toBe(hand - 1);

    const t = withCards(["Mobilize"]);
    boardOf(t, "p1").runeDeck.splice(0);
    const hand2 = boardOf(t, "p1").hand.length;
    fund(t, "p1", "Mobilize");
    t.as("p1").play("Mobilize").expectOk();
    drain(t);
    expect(boardOf(t, "p1").hand.length).toBe(hand2 - 1 + 1);
  });

  it("[C:Catalyst of Aeons][R431.3] channels 2 runes exhausted; if it couldn't channel 2, draws 1", () => {
    const s = withCards(["Catalyst of Aeons"]);
    const hand = boardOf(s, "p1").hand.length;
    const runes = boardOf(s, "p1").runeArea.length;
    fund(s, "p1", "Catalyst of Aeons");
    s.as("p1").play("Catalyst of Aeons").expectOk();
    drain(s);
    expect(boardOf(s, "p1").runeArea.length).toBe(runes + 2);
    expect(boardOf(s, "p1").hand.length).toBe(hand - 1);

    const t = withCards(["Catalyst of Aeons"]);
    boardOf(t, "p1").runeDeck.splice(1);
    const hand2 = boardOf(t, "p1").hand.length;
    const runes2 = boardOf(t, "p1").runeArea.length;
    fund(t, "p1", "Catalyst of Aeons");
    t.as("p1").play("Catalyst of Aeons").expectOk();
    drain(t);
    expect(boardOf(t, "p1").runeArea.length).toBe(runes2 + 1);
    expect(boardOf(t, "p1").hand.length).toBe(hand2 - 1 + 1);
  });

  it("[C:Last Breath][R416.1][R418.6.b] readies a friendly unit; it deals damage equal to its Might to an enemy at a battlefield", () => {
    const s = withCards(["Last Breath"]);
    const mine = place(s, "p1", "Caitlyn, Patrolling", "base", { exhausted: true });
    const enemy = place(s, "p2", "Astral Heron", "battlefieldA");
    fund(s, "p1", "Last Breath");
    s.as("p1")
      .play("Last Breath", { choices: { "target:0": mine.id, "target:1": enemy.id } })
      .expectOk();
    drain(s);
    expect(s.host.isExhausted(s.room, mine.id)).toBe(false);
    expect(s.room.rules!.objects[enemy.id]?.damage).toBe(3);
    const damage = s.events().find((event) => event.type === "damage");
    expect(damage?.sourceObjectId).toBe(mine.id);
  });

  it("[C:Cannon Barrage][R740.2.c] deals 2 to all enemy units in combat", () => {
    const s = withCards(["Cannon Barrage"]);
    const defender = place(s, "p2", "Astral Heron", "battlefieldA");
    const elsewhere = place(s, "p2", "Stellacorn Herder", "base");
    setControl(s.room, "battlefieldA", "p2");
    const attacker = place(s, "p1", "Caitlyn, Patrolling", "base");
    s.as("p1").move("Caitlyn, Patrolling", "battlefieldA").expectOk();
    expect(s.room.rules!.combat).toBeTruthy();
    fund(s, "p1", "Cannon Barrage");
    s.as("p1").play("Cannon Barrage").expectOk();
    s.as("p2").pass().expectOk();
    expect(s.room.rules!.objects[defender.id]?.damage).toBe(2);
    expect(s.room.rules!.objects[elsewhere.id]?.damage).toBeUndefined();
    expect(s.room.rules!.objects[attacker.id]?.damage).toBeUndefined();
    expect(getCardScript("Cannon Barrage")?.status).toBe("implemented");
  });
});
