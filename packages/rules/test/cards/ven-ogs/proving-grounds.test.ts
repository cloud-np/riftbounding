/**
 * Proving Grounds (OGS) cards.
 */
import { describe, expect, it } from "vitest";
import { getCardScript, lookupAbility, requiredChoices } from "../../../src";
import { fund } from "../../rules/effects/helpers";
import {
  answer,
  boardOf,
  keywordValue,
  might,
  passBoth,
  place,
  setControl,
  setRunes,
  settle,
  withCards,
  zoneOf,
} from "./helpers";

describe("Proving Grounds", () => {
  it("[C:Blast of Power][R429] kills a unit at a battlefield (not at a base)", () => {
    const s = withCards(["Blast of Power"]);
    const enemy = place(s, "p2", "Whiteflame Protector", "battlefieldA");
    const based = place(s, "p2", "Caitlyn, Patrolling", "base");
    const ability = lookupAbility("Blast of Power", "spell")!.ability;
    const options = requiredChoices(s.room, s.host, ability, {
      controller: "p1",
      choices: {},
    })[0]!.options.map((o) => o.id);
    expect(options).toContain(enemy.id);
    expect(options).not.toContain(based.id);
    fund(s, "p1", "Blast of Power");
    s.as("p1")
      .play("Blast of Power", { choices: { "target:0": enemy.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(zoneOf(s, enemy.id)).toBe("trash");
  });

  it("[C:Decisive Strike][R355.5.a] gives every friendly unit +2 Might this turn", () => {
    const s = withCards(["Decisive Strike"]);
    const a = place(s, "p1", "Treasure Hunter", "base");
    const b = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    const enemy = place(s, "p2", "Caitlyn, Patrolling", "base");
    fund(s, "p1", "Decisive Strike");
    s.as("p1").play("Decisive Strike").expectOk();
    s.as("p2").pass().expectOk();
    expect([might(s, a.id), might(s, b.id), might(s, enemy.id)]).toEqual([3, 5, 3]);
  });

  it("[C:Final Spark][R418] deals 8 to a unit", () => {
    const s = withCards(["Final Spark"]);
    const enemy = place(s, "p2", "Whiteflame Protector", "base");
    fund(s, "p1", "Final Spark");
    s.as("p1")
      .play("Final Spark", { choices: { "target:0": enemy.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(zoneOf(s, enemy.id)).toBe("trash");
  });

  it("[C:Firestorm][R355.7][R355.5.a] deals 3 to all enemy units at the chosen battlefield", () => {
    const s = withCards(["Firestorm"]);
    const a = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    const b = place(s, "p2", "Whiteflame Protector", "battlefieldA");
    const other = place(s, "p2", "Caitlyn, Patrolling", "battlefieldB");
    const mine = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    fund(s, "p1", "Firestorm");
    s.as("p1")
      .play("Firestorm", { choices: { "target:0": "battlefield:battlefieldA" } })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(zoneOf(s, a.id)).toBe("trash");
    expect(s.room.rules!.objects[b.id]?.damage).toBe(3);
    expect(s.room.rules!.objects[other.id]?.damage).toBeUndefined();
    expect(s.room.rules!.objects[mine.id]?.damage).toBeUndefined();
  });

  it("[C:Incinerate][R418] deals 2 to a unit at a battlefield", () => {
    const s = withCards(["Incinerate"]);
    const enemy = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    fund(s, "p1", "Incinerate");
    s.as("p1")
      .play("Incinerate", { choices: { "target:0": enemy.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(s.room.rules!.objects[enemy.id]?.damage).toBe(2);
  });

  it("[C:Gentlemen's Duel][R418.6.b.3] +3 to a friendly unit, then it and an enemy deal their Mights to each other", () => {
    const s = withCards(["Gentlemen's Duel"]);
    const mine = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    const theirs = place(s, "p2", "Stellacorn Herder", "battlefieldA");
    fund(s, "p1", "Gentlemen's Duel");
    s.as("p1")
      .play("Gentlemen's Duel", { choices: { "target:0": mine.id, "target:1": theirs.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(zoneOf(s, theirs.id)).toBe("trash");
    expect(s.room.rules!.objects[mine.id]?.damage).toBe(3);
    expect(zoneOf(s, mine.id)).toBe("battlefieldA");
  });

  it("[C:Highlander][R369.1][R391.3][R370.1.b] the next time the unit dies this turn: heal, exhaust, recall instead", () => {
    const s = withCards(["Highlander", "Hextech Ray", "Hextech Ray"]);
    const unit = place(s, "p1", "Treasure Hunter", "battlefieldA");
    fund(s, "p1", "Highlander");
    s.as("p1")
      .play("Highlander", { choices: { "target:0": unit.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    fund(s, "p1", "Hextech Ray");
    s.as("p1")
      .play("Hextech Ray", { choices: { "target:0": unit.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(zoneOf(s, unit.id)).toBe("base");
    expect(s.room.rules!.objects[unit.id]?.damage).toBeUndefined();
    expect(s.host.isExhausted(s.room, unit.id)).toBe(true);
    // Used up: the second death is not replaced.
    s.host.moveCard(s.room, "p1", "base", "battlefieldA", unit.id);
    fund(s, "p1", "Hextech Ray");
    s.as("p1")
      .play("Hextech Ray", { choices: { "target:0": unit.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(zoneOf(s, unit.id)).toBe("trash");
  });

  it("[C:Recruit the Vanguard][R440.2.c] plays four 1 Might Recruit tokens", () => {
    const s = withCards(["Recruit the Vanguard"]);
    fund(s, "p1", "Recruit the Vanguard");
    s.as("p1").play("Recruit the Vanguard").expectOk();
    s.as("p2").pass().expectOk();
    const recruits = boardOf(s, "p1").base.filter((card) => card.name === "Recruit");
    expect(recruits).toHaveLength(4);
    expect(might(s, recruits[0]!.id)).toBe(1);
    expect(getCardScript("Recruit the Vanguard")?.status).toBe("partial");
  });

  it("[C:Tibbers][R383.4.a] when played, deals 3 to all units at battlefields", () => {
    const s = withCards(["Tibbers"]);
    const enemy = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    const friend = place(s, "p1", "Whiteflame Protector", "battlefieldB");
    const based = place(s, "p2", "Caitlyn, Patrolling", "base");
    fund(s, "p1", "Tibbers");
    s.as("p1").play("Tibbers").expectOk();
    settle(s);
    expect(zoneOf(s, enemy.id)).toBe("trash");
    expect(s.room.rules!.objects[friend.id]?.damage).toBe(3);
    expect(s.room.rules!.objects[based.id]?.damage).toBeUndefined();
  });

  it("[C:Vanguard Attendant][R369.3] I enter ready", () => {
    const s = withCards(["Vanguard Attendant"]);
    fund(s, "p1", "Vanguard Attendant");
    s.as("p1").play("Vanguard Attendant").expectOk();
    expect(s.findBoardCard("Vanguard Attendant")!.exhausted).toBe(false);
  });

  it("[C:Zephyr Sage][C:Garen, Rugged][R807][R814] keyword-only units: Shield; Assault 2 and Shield 2", () => {
    const s = withCards(["Zephyr Sage", "Garen, Rugged"]);
    const sage = place(s, "p1", "Zephyr Sage", "base");
    const garen = place(s, "p1", "Garen, Rugged", "base");
    expect(keywordValue(s, sage.id, "Shield")).toBe(1);
    expect(keywordValue(s, garen.id, "Assault")).toBe(2);
    expect(keywordValue(s, garen.id, "Shield")).toBe(2);
    for (const name of ["Zephyr Sage", "Garen, Rugged"]) {
      fund(s, "p1", name);
    }
  });

  it("[C:Garen, Commander][R365.1] other friendly units have +1 Might here", () => {
    const s = withCards(["Garen, Commander"]);
    const garen = place(s, "p1", "Garen, Commander", "battlefieldA");
    const here = place(s, "p1", "Treasure Hunter", "battlefieldA");
    const there = place(s, "p1", "Treasure Hunter", "base");
    const enemy = place(s, "p2", "Treasure Hunter", "battlefieldA");
    expect([might(s, garen.id), might(s, here.id), might(s, there.id), might(s, enemy.id)]).toEqual(
      [5, 2, 1, 1],
    );
  });

  it("[C:Garen, Might of Demacia][R383.4.c][R383.2.a.1] when you conquer with 4+ units there, draw 2", () => {
    const s = withCards(["Garen, Might of Demacia"]);
    place(s, "p1", "Garen, Might of Demacia", "legend");
    const ids = [
      "Caitlyn, Patrolling",
      "Caitlyn, Patrolling",
      "Caitlyn, Patrolling",
      "Whiteflame Protector",
    ].map((name) => place(s, "p1", name, "base").id);
    const hand = boardOf(s, "p1").hand.length;
    s.as("p1").apply({ type: "rules_move", unitIds: ids, to: "battlefieldB" }).expectOk();
    settle(s);
    expect(s.room.rules!.objects.battlefieldB?.controller).toBe("p1");
    expect(boardOf(s, "p1").hand.length).toBe(hand + 2);
  });

  it("[C:Garen, Might of Demacia] no draw when conquering with fewer than 4 units", () => {
    const s = withCards(["Garen, Might of Demacia"]);
    place(s, "p1", "Garen, Might of Demacia", "legend");
    place(s, "p1", "Caitlyn, Patrolling", "base");
    const hand = boardOf(s, "p1").hand.length;
    s.as("p1").move("Caitlyn, Patrolling", "battlefieldB").expectOk();
    settle(s);
    expect(boardOf(s, "p1").hand.length).toBe(hand);
  });

  it("[C:Lux, Illuminated][C:Lux, Lady of Luminosity][R420.4.a] a spell that costs [5]+ resolved: +3 Might and draw 1", () => {
    const s = withCards([
      "Lux, Illuminated",
      "Lux, Lady of Luminosity",
      "Final Spark",
      "Hextech Ray",
    ]);
    const lux = place(s, "p1", "Lux, Illuminated", "base");
    place(s, "p1", "Lux, Lady of Luminosity", "legend");
    const enemy = place(s, "p2", "Whiteflame Protector", "battlefieldA");
    fund(s, "p1", "Hextech Ray");
    s.as("p1")
      .play("Hextech Ray", { choices: { "target:0": enemy.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(s.room.rules!.chain).toHaveLength(0);
    const hand = boardOf(s, "p1").hand.length;
    fund(s, "p1", "Final Spark");
    s.as("p1")
      .play("Final Spark", { choices: { "target:0": enemy.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    settle(s);
    expect(might(s, lux.id)).toBe(8);
    expect(boardOf(s, "p1").hand.length).toBe(hand - 1 + 1);
  });

  it("[C:Master Yi, Meditative][R364.3.a] +4 Might while you have 8+ runes", () => {
    const s = withCards(["Master Yi, Meditative"]);
    const yi = place(s, "p1", "Master Yi, Meditative", "base");
    setRunes(s, "p1", 7);
    expect(might(s, yi.id)).toBe(4);
    setRunes(s, "p1", 8);
    expect(might(s, yi.id)).toBe(8);
  });

  it("[C:Master Yi, Wuju Bladesman][R740.2.a][R323.2] a friendly unit defending alone gets +2 Might", () => {
    const s = withCards(["Caitlyn, Patrolling"], ["Master Yi, Wuju Bladesman"], {
      battlefields: { p2: "Bandle Tree" },
    });
    place(s, "p2", "Master Yi, Wuju Bladesman", "legend");
    const defender = place(s, "p2", "Stellacorn Herder", "battlefieldA");
    setControl(s, "battlefieldA", "p2");
    expect(might(s, defender.id)).toBe(3);
    place(s, "p1", "Caitlyn, Patrolling", "base");
    s.as("p1").move("Caitlyn, Patrolling", "battlefieldA").expectOk();
    expect(s.room.rules!.objects[defender.id]?.designation).toBe("defender");
    expect(might(s, defender.id)).toBe(5);
  });

  it("[C:Annie, Dark Child][R317.1] at the end of your turn, ready up to 2 runes", () => {
    const s = withCards(["Annie, Dark Child"]);
    place(s, "p1", "Annie, Dark Child", "legend");
    setRunes(s, "p1", 4);
    for (const rune of boardOf(s, "p1").runeArea) rune.exhausted = true;
    s.as("p1").endTurn().expectOk();
    s.expectPrompt("choose-target", "p1");
    expect(s.room.rules!.prompt!.max).toBe(2);
    const pick = s.room.rules!.prompt!.options!.slice(0, 2).map((option) => option.id);
    answer(s, pick);
    passBoth(s);
    for (const id of pick) expect(s.host.isExhausted(s.room, id)).toBe(false);
  });

  it("[C:Annie, Stubborn][R383.4.a] when you play me, return a spell from your trash to your hand", () => {
    const s = withCards(["Annie, Stubborn", "Hextech Ray"]);
    const ray = place(s, "p1", "Hextech Ray", "trash");
    fund(s, "p1", "Annie, Stubborn");
    s.as("p1").play("Annie, Stubborn").expectOk();
    settle(s);
    expect(zoneOf(s, ray.id)).toBe("hand");
  });
});
