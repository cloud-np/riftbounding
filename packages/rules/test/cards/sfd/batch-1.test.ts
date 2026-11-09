/**
 * Spiritforged (SFD) wave R3 batch 1 — one behaviour test per card.
 */
import { describe, expect, it } from "vitest";
import { costAdjustments, effectiveMight, registerActionInterceptor } from "../../../src";
import {
  attack,
  boardCard,
  countNamed,
  damageOf,
  hand,
  killWithSpell,
  playCard,
  put,
  settle,
  statusOf,
  withCards,
  zoneOf,
} from "./helpers";
import { run } from "../../rules/effects/helpers";

describe("SFD batch 1 — spells", () => {
  it("[C:Against the Odds][R740.1] +2 Might this turn for each enemy unit at the friendly unit's battlefield", () => {
    const s = withCards(["Against the Odds"]);
    const mine = put(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    put(s, "p2", "Treasure Hunter", "battlefieldA");
    put(s, "p2", "Stellacorn Herder", "battlefieldA");
    put(s, "p2", "Astral Heron", "battlefieldB");
    playCard(s, "p1", "Against the Odds", { choices: { "target:0": mine.id } }).expectOk();
    settle(s);
    expect(effectiveMight(s.room, mine.id, s.host)).toBe(3 + 4);
  });

  it("[C:Premonition][R414] draws 3", () => {
    const s = withCards(["Premonition"]);
    const before = hand(s, "p1").length;
    playCard(s, "p1", "Premonition").expectOk();
    settle(s);
    expect(hand(s, "p1").length).toBe(before - 1 + 3);
  });

  it("[C:Punch First][R479.4] gives a unit +5 Might this turn", () => {
    const s = withCards(["Punch First"]);
    const unit = put(s, "p1", "Caitlyn, Patrolling", "base");
    playCard(s, "p1", "Punch First", { choices: { "target:0": unit.id } }).expectOk();
    settle(s);
    expect(effectiveMight(s.room, unit.id, s.host)).toBe(8);
  });

  it("[C:Detonate][R429][R359.3.e.13] kills a gear; its controller draws 2", () => {
    const s = withCards(["Detonate"], ["Doran's Blade"]);
    const gear = put(s, "p2", "Doran's Blade", "base");
    const before = hand(s, "p2").length;
    playCard(s, "p1", "Detonate", { choices: { "target:0": gear.id } }).expectOk();
    settle(s);
    expect(zoneOf(s, gear.id)).toBe("trash");
    expect(hand(s, "p2").length).toBe(before + 2);
  });

  it("[C:Factory Recall][R056] returns a gear to its owner's hand", () => {
    const s = withCards(["Factory Recall"], ["Doran's Blade"]);
    const gear = put(s, "p2", "Doran's Blade", "base");
    playCard(s, "p1", "Factory Recall", { choices: { "target:0": gear.id } }).expectOk();
    settle(s);
    expect(zoneOf(s, gear.id)).toBe("hand");
  });

  it("[C:Defiant Dance][R479.4] +2 to one unit and -2 to another unit this turn", () => {
    const s = withCards(["Defiant Dance"]);
    const up = put(s, "p1", "Caitlyn, Patrolling", "base");
    const down = put(s, "p2", "Astral Heron", "battlefieldA");
    playCard(s, "p1", "Defiant Dance", {
      choices: { "target:0": up.id, "target:1": down.id },
    }).expectOk();
    settle(s);
    expect(effectiveMight(s.room, up.id, s.host)).toBe(5);
    expect(effectiveMight(s.room, down.id, s.host)).toBe(5);
    // "another unit": the same unit cannot be both choices (355.9).
    const again = withCards(["Defiant Dance"]);
    const solo = put(again, "p1", "Caitlyn, Patrolling", "base");
    playCard(again, "p1", "Defiant Dance", {
      choices: { "target:0": solo.id, "target:1": solo.id },
    }).expectError("illegal_target");
  });

  it("[C:On the Hunt][R416] readies your units (and only yours)", () => {
    const s = withCards(["On the Hunt"]);
    const a = put(s, "p1", "Caitlyn, Patrolling", "base", { exhausted: true });
    const b = put(s, "p1", "Astral Heron", "battlefieldA", { exhausted: true });
    const enemy = put(s, "p2", "Treasure Hunter", "battlefieldB", { exhausted: true });
    playCard(s, "p1", "On the Hunt").expectOk();
    settle(s);
    expect(s.host.isExhausted(s.room, a.id)).toBe(false);
    expect(s.host.isExhausted(s.room, b.id)).toBe(false);
    expect(s.host.isExhausted(s.room, enemy.id)).toBe(true);
  });

  it("[C:Downwell][R056][R719.5] returns all units and gear to their owners' hands", () => {
    const s = withCards(["Downwell"], ["Doran's Blade"]);
    const mine = put(s, "p1", "Caitlyn, Patrolling", "base");
    const theirs = put(s, "p2", "Astral Heron", "battlefieldA");
    const gear = put(s, "p2", "Doran's Blade", "base");
    playCard(s, "p1", "Downwell").expectOk();
    settle(s);
    for (const card of [mine, theirs, gear]) expect(zoneOf(s, card.id)).toBe("hand");
  });

  it("[C:Show of Strength][R706] draws 1 for each of your Mighty units", () => {
    const s = withCards(["Show of Strength"]);
    put(s, "p1", "Astral Heron", "base"); // 7 Might
    put(s, "p1", "Whiteflame Protector", "battlefieldA");
    put(s, "p1", "Caitlyn, Patrolling", "base"); // 3 Might
    put(s, "p2", "Astral Heron", "battlefieldB"); // enemy, not counted
    const mighty = [
      s.findBoardCard("Astral Heron")!,
      s.findBoardCard("Whiteflame Protector")!,
    ].filter((card) => effectiveMight(s.room, card.id, s.host) >= 5).length;
    const before = hand(s, "p1").length;
    playCard(s, "p1", "Show of Strength").expectOk();
    settle(s);
    expect(hand(s, "p1").length).toBe(before - 1 + mighty);
  });

  it("[C:Sudden Storm][R466.2.c.3] deals 2 to a unit at a battlefield, 4 if it is attacking", () => {
    const s = withCards(["Sudden Storm"]);
    const idle = put(s, "p2", "Astral Heron", "battlefieldB");
    playCard(s, "p1", "Sudden Storm", { choices: { "target:0": idle.id } }).expectOk();
    settle(s);
    expect(damageOf(s, idle.id)).toBe(2);

    const c = withCards([], ["Sudden Storm"]);
    const { attacker } = attack(c, "Astral Heron", ["Treasure Hunter"]);
    // In the combat showdown, the defender plays Sudden Storm on the attacker.
    c.as("p1").pass().expectOk();
    playCard(c, "p2", "Sudden Storm", { choices: { "target:0": attacker.id } }).expectOk();
    c.as("p1").pass().expectOk();
    expect(damageOf(c, attacker.id)).toBe(4);
  });

  it("[C:Wages of Pain][R418][R440.2.c] deals 3 to a unit at a battlefield and plays a Gold exhausted", () => {
    const s = withCards(["Wages of Pain"]);
    const enemy = put(s, "p2", "Astral Heron", "battlefieldA");
    playCard(s, "p1", "Wages of Pain", { choices: { "target:0": enemy.id } }).expectOk();
    settle(s);
    expect(damageOf(s, enemy.id)).toBe(3);
    const gold = s.findBoardCardAnywhere("Gold")!;
    expect(gold.exhausted).toBe(true);
  });

  it("[C:Blood Money][R359.3.e.13] kills a ≤2 Might unit: an enemy gives 1 Gold, a friendly unit 2 Gold", () => {
    const s = withCards(["Blood Money", "Blood Money"]);
    const enemy = put(s, "p2", "Treasure Hunter", "battlefieldA");
    const big = put(s, "p2", "Astral Heron", "battlefieldA");
    playCard(s, "p1", "Blood Money", { choices: { "target:0": big.id } }).expectError(
      "illegal_target",
    );
    playCard(s, "p1", "Blood Money", { choices: { "target:0": enemy.id }, fund: false }).expectOk();
    settle(s);
    expect(zoneOf(s, enemy.id)).toBe("trash");
    expect(countNamed(s, "p1", "base", "Gold")).toBe(1);
    const friend = put(s, "p1", "Treasure Hunter", "battlefieldB");
    playCard(s, "p1", "Blood Money", { choices: { "target:0": friend.id } }).expectOk();
    settle(s);
    expect(zoneOf(s, friend.id)).toBe("trash");
    expect(countNamed(s, "p1", "base", "Gold")).toBe(3);
  });

  it("[C:Drag Under][R366.2.a][R356.4] kills a unit at a battlefield; costs [2] less outside the hand", () => {
    const s = withCards(["Drag Under"]);
    const card = s.handCard("p1", "Drag Under")!;
    expect(costAdjustments(s.room, s.host, { playerId: "p1", cardId: card.id })).toEqual([]);
    const enemy = put(s, "p2", "Astral Heron", "battlefieldA");
    playCard(s, "p1", "Drag Under", { choices: { "target:0": enemy.id } }).expectOk();
    settle(s);
    expect(zoneOf(s, enemy.id)).toBe("trash");
    // In the trash (e.g. for an effect that plays it from there) the passive applies.
    expect(costAdjustments(s.room, s.host, { playerId: "p1", cardId: card.id })).toEqual([
      expect.objectContaining({ energy: -2 }),
    ]);
  });

  it("[C:Production Surge][R356.4] costs [2] less with a Mech; plays a 3 Might Mech to base and draws 1", () => {
    const s = withCards(["Production Surge"]);
    const card = s.handCard("p1", "Production Surge")!;
    expect(costAdjustments(s.room, s.host, { playerId: "p1", cardId: card.id })).toEqual([]);
    const before = hand(s, "p1").length;
    playCard(s, "p1", "Production Surge").expectOk();
    settle(s);
    const token = boardCard(s, "p1", "Mech")!;
    expect(zoneOf(s, token.id)).toBe("base");
    expect(effectiveMight(s.room, token.id, s.host)).toBe(3);
    expect(hand(s, "p1").length).toBe(before - 1 + 1);
    // Now p1 controls a Mech: a second copy costs 2 less.
    const s2 = withCards(["Production Surge", "Clanging Sentry"]);
    put(s2, "p1", "Clanging Sentry", "base");
    const second = s2.handCard("p1", "Production Surge")!;
    expect(costAdjustments(s2.room, s2.host, { playerId: "p1", cardId: second.id })).toEqual([
      expect.objectContaining({ energy: -2 }),
    ]);
  });
});

describe("SFD batch 1 — units", () => {
  it("[C:Beast Below][R383.4.a][R056] returns another friendly unit and an enemy unit to their owners' hands", () => {
    const s = withCards(["Beast Below"]);
    const friend = put(s, "p1", "Caitlyn, Patrolling", "base");
    const enemy = put(s, "p2", "Astral Heron", "battlefieldA");
    playCard(s, "p1", "Beast Below").expectOk();
    settle(s, (prompt) => {
      const ids = (prompt.options ?? []).map((option) => option.id);
      if (ids.includes(friend.id)) return { optionIds: [friend.id] };
      if (ids.includes(enemy.id)) return { optionIds: [enemy.id] };
      return undefined;
    });
    expect(zoneOf(s, friend.id)).toBe("hand");
    expect(zoneOf(s, enemy.id)).toBe("hand");
    expect(boardCard(s, "p1", "Beast Below")).toBeTruthy();
  });

  it("[C:Bubble Bot][R416] readies another friendly Mech when played", () => {
    const s = withCards(["Bubble Bot", "Clanging Sentry"]);
    const sentry = put(s, "p1", "Clanging Sentry", "base", { exhausted: true });
    playCard(s, "p1", "Bubble Bot").expectOk();
    settle(s);
    expect(s.host.isExhausted(s.room, sentry.id)).toBe(false);
  });

  it("[C:Sandshifter][R429] kills an enemy unit with 3 Might or less when played", () => {
    const s = withCards(["Sandshifter"]);
    const small = put(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    const big = put(s, "p2", "Astral Heron", "battlefieldA");
    playCard(s, "p1", "Sandshifter").expectOk();
    settle(s);
    expect(zoneOf(s, small.id)).toBe("trash");
    expect(zoneOf(s, big.id)).toBe("battlefieldA");
  });

  it("[C:Trove Golem][R440.2.c] plays four Gold tokens exhausted when played", () => {
    const s = withCards(["Trove Golem"]);
    playCard(s, "p1", "Trove Golem").expectOk();
    settle(s);
    expect(countNamed(s, "p1", "base", "Gold")).toBe(4);
  });

  it("[C:Royal Guard][R440.2.b] plays a 2 Might Sand Soldier here (its own location)", () => {
    const s = withCards(["Royal Guard"]);
    put(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    playCard(s, "p1", "Royal Guard", { location: "battlefieldA" }).expectOk();
    settle(s);
    const soldier = boardCard(s, "p1", "Sand Soldier")!;
    expect(zoneOf(s, soldier.id)).toBe("battlefieldA");
    expect(effectiveMight(s.room, soldier.id, s.host)).toBe(2);
  });

  it("[C:Eager Drakehound][R369.3] enters ready", () => {
    const s = withCards(["Eager Drakehound"]);
    playCard(s, "p1", "Eager Drakehound").expectOk();
    expect(s.findBoardCard("Eager Drakehound")!.exhausted).toBe(false);
  });

  it("[C:Direwing][R369.3] enters ready only if you control another Dragon", () => {
    const s = withCards(["Direwing", "Direwing"]);
    playCard(s, "p1", "Direwing").expectOk();
    const first = s.findBoardCard("Direwing")!;
    expect(first.exhausted).toBe(true);
    playCard(s, "p1", "Direwing").expectOk();
    expect(boardCard(s, "p1", "Direwing", 1)!.exhausted).toBe(false);
  });

  it("[C:Xin Zhao, Vigilant][R369.3] enters ready with two or more other units in your base", () => {
    const s = withCards(["Xin Zhao, Vigilant", "Xin Zhao, Vigilant"]);
    put(s, "p1", "Caitlyn, Patrolling", "base");
    playCard(s, "p1", "Xin Zhao, Vigilant").expectOk();
    expect(s.findBoardCard("Xin Zhao, Vigilant")!.exhausted).toBe(true);
    put(s, "p1", "Astral Heron", "base");
    playCard(s, "p1", "Xin Zhao, Vigilant").expectOk();
    const xins = s.room.players[0]!.board!.base.filter(
      (card) => card.name === "Xin Zhao, Vigilant",
    );
    expect(xins[1]!.exhausted).toBe(false);
  });

  it("[C:Honest Broker][R808] Deathknell: plays a Gold token exhausted", () => {
    const s = withCards(["Hextech Ray"], ["Honest Broker"]);
    const broker = put(s, "p2", "Honest Broker", "battlefieldA");
    playCard(s, "p1", "Hextech Ray", { choices: { "target:0": broker.id } }).expectOk();
    settle(s);
    expect(zoneOf(s, broker.id)).toBe("trash");
    expect(countNamed(s, "p2", "base", "Gold")).toBe(1);
  });

  it("[C:Ferrous Forerunner][R808] Deathknell: plays two 3 Might Mechs to your base", () => {
    const s = withCards(["Drag Under"], ["Ferrous Forerunner"]);
    const unit = put(s, "p2", "Ferrous Forerunner", "battlefieldA");
    killWithSpell(s, unit.id);
    const mechs = s.room.players[1]!.board!.base.filter((card) => card.name === "Mech");
    expect(mechs).toHaveLength(2);
    expect(effectiveMight(s.room, mechs[0]!.id, s.host)).toBe(3);
  });

  it("[C:Unsung Hero][R808][R706] Deathknell: draws 2 only if it was Mighty", () => {
    const s = withCards(["Drag Under", "Drag Under"], ["Unsung Hero", "Unsung Hero"]);
    const plain = put(s, "p2", "Unsung Hero", "battlefieldA");
    const mighty = put(s, "p2", "Unsung Hero", "battlefieldB");
    const before = hand(s, "p2").length;
    killWithSpell(s, plain.id);
    expect(hand(s, "p2").length).toBe(before);
    run(s, { op: "temporary_might", amount: 3, target: { targetRef: `obj:${mighty.id}` } });
    killWithSpell(s, mighty.id);
    expect(hand(s, "p2").length).toBe(before + 2);
  });

  it("[C:Lonely Poro][R808] Deathknell: draws 1 if it died alone", () => {
    const s = withCards(["Drag Under", "Drag Under"], ["Lonely Poro", "Lonely Poro"]);
    const alone = put(s, "p2", "Lonely Poro", "battlefieldA");
    const accompanied = put(s, "p2", "Lonely Poro", "battlefieldB");
    put(s, "p2", "Caitlyn, Patrolling", "battlefieldB");
    const before = hand(s, "p2").length;
    killWithSpell(s, alone.id);
    expect(hand(s, "p2").length).toBe(before + 1);
    killWithSpell(s, accompanied.id);
    expect(hand(s, "p2").length).toBe(before + 1);
    expect(statusOf("Lonely Poro")).toBe("partial");
  });
});

void registerActionInterceptor;
