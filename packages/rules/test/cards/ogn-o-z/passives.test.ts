/** Origins O–Z: passive abilities (Might, keyword and cost passives, battlefields). */
import { describe, expect, it } from "vitest";
import {
  combatKeywordProfile,
  costAdjustments,
  effectiveKeywords,
  effectiveMight,
  getCardScript,
  restrictionFor,
} from "../../../src";
import { boardOf, fund, place } from "../../rules/effects/helpers";
import { boardCard, passBoth, setMight, withCards } from "./helpers";

describe("Origins O–Z passive abilities", () => {
  it("[C:Sett, Kingpin][R365.1] +1 Might per buffed friendly unit at his battlefield (himself included); none in base", () => {
    const s = withCards(["Sett, Kingpin"]);
    const sett = place(s, "p1", "Sett, Kingpin", "battlefieldA");
    const a = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    const b = place(s, "p1", "Treasure Hunter", "battlefieldA");
    const far = place(s, "p1", "Stellacorn Herder", "base");
    s.room.rules!.objects[a.id] = { buffs: 1 };
    s.room.rules!.objects[far.id] = { buffs: 1 };
    expect(effectiveMight(s.room, sett.id, s.host)).toBe(6);
    s.room.rules!.objects[sett.id] = { buffs: 1 };
    s.room.rules!.objects[b.id] = { buffs: 1 };
    // 5 + 1 (own buff) + 3 buffed friendly units here.
    expect(effectiveMight(s.room, sett.id, s.host)).toBe(9);
    s.host.moveCard(s.room, "p1", "battlefieldA", "base", sett.id);
    expect(effectiveMight(s.room, sett.id, s.host)).toBe(6);
    expect(combatKeywordProfile(s.room, sett.id, s.host).tank).toBe(true);
  });

  it("[C:Taric, Protector][R801.3][R814.2] other friendly units here have [Shield]", () => {
    const s = withCards(["Taric, Protector"]);
    const taric = place(s, "p1", "Taric, Protector", "battlefieldA");
    const here = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    const away = place(s, "p1", "Treasure Hunter", "base");
    const enemy = place(s, "p2", "Stellacorn Herder", "battlefieldA");
    expect(effectiveKeywords(s.room, here.id, s.host)).toContain("Shield");
    expect(combatKeywordProfile(s.room, here.id, s.host).shield).toBe(1);
    expect(effectiveKeywords(s.room, away.id, s.host)).not.toContain("Shield");
    expect(effectiveKeywords(s.room, enemy.id, s.host)).not.toContain("Shield");
    expect(combatKeywordProfile(s.room, taric.id, s.host)).toMatchObject({ shield: 1, tank: true });
  });

  it("[C:Wizened Elder][R364.3.a] +1 Might while buffed", () => {
    const s = withCards(["Wizened Elder"]);
    const elder = place(s, "p1", "Wizened Elder", "base");
    expect(effectiveMight(s.room, elder.id, s.host)).toBe(4);
    s.room.rules!.objects[elder.id] = { buffs: 1 };
    expect(effectiveMight(s.room, elder.id, s.host)).toBe(6);
  });

  it("[C:Wielder of Water][R740.2.a][R323.2] +2 Might while attacking or defending alone", () => {
    const s = withCards(["Wielder of Water"]);
    const wielder = place(s, "p1", "Wielder of Water", "battlefieldA");
    expect(effectiveMight(s.room, wielder.id, s.host)).toBe(2);
    // 740.2.c: "attacking or defending" = in combat — at the combat battlefield with a designation.
    s.room.rules!.combat = { battlefield: "battlefieldA", attacker: "p2", defender: "p1", step: "showdown" };
    s.room.rules!.objects[wielder.id] = { designation: "defender" };
    expect(effectiveMight(s.room, wielder.id, s.host)).toBe(4);
    const friend = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    expect(effectiveMight(s.room, wielder.id, s.host)).toBe(2);
    s.host.moveCard(s.room, "p1", "battlefieldA", "base", friend.id);
    s.room.rules!.objects[wielder.id] = { designation: "attacker" };
    expect(effectiveMight(s.room, wielder.id, s.host)).toBe(4);
  });

  it("[C:Wielder of Water][R466] attacking alone through a real move gets +2 Might in combat", () => {
    const s = withCards(["Wielder of Water"]);
    const wielder = place(s, "p1", "Wielder of Water", "base");
    const enemy = place(s, "p2", "Treasure Hunter", "battlefieldA");
    setMight(s, enemy.id, 3);
    s.as("p1").move("Wielder of Water", "battlefieldA").expectOk();
    expect(s.room.rules!.objects[wielder.id]?.designation).toBe("attacker");
    expect(effectiveMight(s.room, wielder.id, s.host)).toBe(4);
  });

  it("[C:Trifarian War Camp][R365.1][R053.3] units here have +1 Might", () => {
    const s = withCards([], [], { battlefields: { p1: "Trifarian War Camp" } });
    const mine = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    const theirs = place(s, "p2", "Treasure Hunter", "battlefieldA");
    const based = place(s, "p1", "Stellacorn Herder", "base");
    expect(effectiveMight(s.room, mine.id, s.host)).toBe(4);
    expect(effectiveMight(s.room, theirs.id, s.host)).toBe(2);
    expect(effectiveMight(s.room, based.id, s.host)).toBe(s.host.cardInfo(s.room, based.id)!.might);
  });

  it("[C:Windswept Hillock][R801.3] units here have [Ganking] (keyword layer); units elsewhere do not", () => {
    const s = withCards([], [], { battlefields: { p1: "Windswept Hillock" } });
    const here = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    const enemy = place(s, "p2", "Treasure Hunter", "battlefieldA");
    const away = place(s, "p1", "Stellacorn Herder", "battlefieldB");
    expect(effectiveKeywords(s.room, here.id, s.host)).toContain("Ganking");
    expect(effectiveKeywords(s.room, enemy.id, s.host)).toContain("Ganking");
    expect(effectiveKeywords(s.room, away.id, s.host)).not.toContain("Ganking");
    expect(getCardScript("Windswept Hillock")?.status).toBe("implemented");
  });

  // R3-engine makes Standard Move legality read Ganking through keyword passives (810.3 /
  // 144.4.c.1): a unit granted Ganking by "Units here have [GANKING]" may move battlefield to
  // battlefield.
  it("[C:Windswept Hillock][R810.3][R144.4.c.1] a unit granted Ganking by a passive can move battlefield to battlefield", () => {
    const s = withCards([], [], { battlefields: { p1: "Windswept Hillock" } });
    const unit = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    expect(effectiveKeywords(s.room, unit.id, s.host)).toContain("Ganking");
    s.as("p1").move("Caitlyn, Patrolling", "battlefieldB").expectOk();
  });

  it("[C:Vilemaw's Lair][R054.1] stays manual: a destination-qualified move restriction is not supported", () => {
    const s = withCards([], [], { battlefields: { p1: "Vilemaw's Lair" } });
    const unit = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    expect(getCardScript("Vilemaw's Lair")?.status).toBe("manual");
    expect(
      restrictionFor(s.room, s.host, { kind: "move", objectId: unit.id, to: "base" }),
    ).toBeNull();
  });

  it("[C:Rhasa the Sunderer][R366.2.a][R356.4] costs [1] less for each card in your trash", () => {
    const s = withCards(["Rhasa the Sunderer"]);
    const rhasa = s.handCard("p1", "Rhasa the Sunderer")!;
    expect(costAdjustments(s.room, s.host, { playerId: "p1", cardId: rhasa.id })).toEqual([]);
    const board = boardOf(s, "p1");
    board.trash.push(...board.deck.splice(0, 4));
    const total = costAdjustments(s.room, s.host, { playerId: "p1", cardId: rhasa.id }).reduce(
      (sum, entry) => sum + (entry.energy ?? 0),
      0,
    );
    expect(total).toBe(-4);
    // Funded for exactly 10 - 4 Energy and its [Chaos]: the play succeeds and spends everything.
    s.room.rules!.pools.p1 = { energy: 6, power: { Chaos: 1 } };
    s.as("p1").play("Rhasa the Sunderer").expectOk();
    expect(s.room.rules!.pools.p1!.energy).toBe(0);
    expect(boardCard(s, "p1", "Rhasa the Sunderer")).toBeTruthy();
  });

  it("[C:Sky Splitter][R356.4][R418] costs less by your highest Might, then deals 5 to a unit at a battlefield", () => {
    const s = withCards(["Sky Splitter"]);
    const big = place(s, "p1", "Caitlyn, Patrolling", "base");
    setMight(s, big.id, 5);
    place(s, "p1", "Treasure Hunter", "base");
    const enemy = place(s, "p2", "Whiteflame Protector", "battlefieldA");
    setMight(s, enemy.id, 9);
    const card = s.handCard("p1", "Sky Splitter")!;
    const total = costAdjustments(s.room, s.host, { playerId: "p1", cardId: card.id }).reduce(
      (sum, entry) => sum + (entry.energy ?? 0),
      0,
    );
    expect(total).toBe(-5);
    s.room.rules!.pools.p1 = { energy: 3, power: { Fury: 1 } };
    s.as("p1")
      .play("Sky Splitter", { choices: { "target:0": enemy.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(s.room.rules!.objects[enemy.id]?.damage).toBe(5);
    expect(getCardScript("Sky Splitter")?.status).toBe("partial");
  });

  it("[C:Spirit's Refuge][R801.3][R809] buffs a friendly unit on play; friendly buffed units have [Deflect]", () => {
    const s = withCards(["Spirit's Refuge"]);
    const unit = place(s, "p1", "Caitlyn, Patrolling", "base");
    const other = place(s, "p1", "Treasure Hunter", "base");
    const enemy = place(s, "p2", "Stellacorn Herder", "base");
    s.room.rules!.objects[enemy.id] = { buffs: 1 };
    fund(s, "p1", "Spirit's Refuge");
    s.as("p1").play("Spirit's Refuge").expectOk();
    s.expectPrompt("choose-target", "p1");
    s.as("p1")
      .choose({ optionIds: [unit.id] })
      .expectOk();
    passBoth(s);
    expect(s.room.rules!.objects[unit.id]?.buffs).toBe(1);
    expect(effectiveKeywords(s.room, unit.id, s.host)).toContain("Deflect");
    expect(effectiveKeywords(s.room, other.id, s.host)).not.toContain("Deflect");
    expect(effectiveKeywords(s.room, enemy.id, s.host)).not.toContain("Deflect");
    const refuge = boardCard(s, "p1", "Spirit's Refuge")!;
    expect(effectiveKeywords(s.room, refuge.id, s.host)).not.toContain("Deflect");
  });

  it("[C:Stand United][R391.4][R702.3] buffs a friendly unit; buffed friendly units get +1 more Might this turn", () => {
    const s = withCards(["Stand United"]);
    const unit = place(s, "p1", "Caitlyn, Patrolling", "base");
    const already = place(s, "p1", "Treasure Hunter", "base");
    s.room.rules!.objects[already.id] = { buffs: 1 };
    const enemy = place(s, "p2", "Stellacorn Herder", "base");
    s.room.rules!.objects[enemy.id] = { buffs: 1 };
    const enemyBefore = effectiveMight(s.room, enemy.id, s.host);
    fund(s, "p1", "Stand United");
    s.as("p1")
      .play("Stand United", { choices: { "target:0": unit.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(effectiveMight(s.room, unit.id, s.host)).toBe(3 + 1 + 1);
    expect(effectiveMight(s.room, already.id, s.host)).toBe(1 + 1 + 1);
    expect(effectiveMight(s.room, enemy.id, s.host)).toBe(enemyBefore);
    s.as("p1").endTurn().expectOk();
    expect(effectiveMight(s.room, unit.id, s.host)).toBe(4);
  });
});
