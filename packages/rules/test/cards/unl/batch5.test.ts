/**
 * Unleashed (UNL) batch 5 — gear, battlefields, look/Sprite units, delayed replacements.
 */
import { describe, expect, it } from "vitest";
import {
  costAdjustments,
  effectiveKeywordValues,
  effectiveKeywords,
  effectiveMight,
  lookupAbility,
  requiredChoices,
  xpOf,
} from "../../../src";
import { boardOf, fund, place, run, zoneOf } from "../../rules/effects/helpers";
import { cardsNamed, hand, nextOwnTurn, resolveChain, settle, withCards, type S } from "./helpers";

const say = (answer: string) => (prompt: { options?: Array<{ id: string }> }) =>
  prompt.options?.some((option) => option.id === answer) ? [answer] : undefined;

function playWith(s: S, player: string, name: string, extra: Record<string, unknown>): void {
  const card = s.handCard(player, name);
  if (!card) throw new Error(`${name} not in ${player}'s hand`);
  s.as(player)
    .apply({ type: "rules_play", cardId: card.id, ...extra } as never)
    .expectOk();
}

describe("Unleashed batch 5 — delayed replacements", () => {
  it("[C:Smite][R370.1.b][R428] deals 3; if it would die this turn it is banished instead", () => {
    const s = withCards(["Smite"]);
    const enemy = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    fund(s, "p1", "Smite");
    s.as("p1")
      .play("Smite", { choices: { "target:0": enemy.id } })
      .expectOk();
    settle(s);
    expect(zoneOf(s, enemy.id)).toBe("banished");
  });

  it("[C:Tactical Retreat][R370.1.b][R456] the next time the unit would die this turn: heal, exhaust, recall", () => {
    const s = withCards(["Tactical Retreat"], ["Hextech Ray"], { firstPlayer: "p2" });
    const unit = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    fund(s, "p2", "Hextech Ray");
    s.as("p2")
      .play("Hextech Ray", { choices: { "target:0": unit.id } })
      .expectOk();
    fund(s, "p1", "Tactical Retreat");
    s.as("p1")
      .play("Tactical Retreat", { choices: { "target:0": unit.id } })
      .expectOk();
    settle(s);
    expect(zoneOf(s, unit.id)).toBe("base");
    expect(s.host.isExhausted(s.room, unit.id)).toBe(true);
    expect(s.room.rules!.objects[unit.id]?.damage).toBeUndefined();
  });
});

describe("Unleashed batch 5 — look, return and Sprite units", () => {
  it("[C:Fate Weaver][R425][R414] may reveal a spell with Energy cost 4+ from the top 4 and draw it", () => {
    const s = withCards(["Fate Weaver", "The Ruination"]);
    // Put The Ruination (cost 9) on top of the deck.
    const board = boardOf(s, "p1");
    const ruination = board.hand.splice(
      board.hand.findIndex((card) => card.name === "The Ruination"),
      1,
    )[0]!;
    s.host.putCard(s.room, "p1", "deck", ruination, 0);
    s.host.moveCardTo(s.room, "p1", "deck", "deck", ruination.id, "top");
    fund(s, "p1", "Fate Weaver");
    s.as("p1").play("Fate Weaver").expectOk();
    settle(s, {
      onPrompt: (prompt) =>
        prompt.options?.some((o) => o.id === ruination.id) ? [ruination.id] : undefined,
    });
    expect(zoneOf(s, ruination.id)).toBe("hand");
  });

  it("[C:Ivern, Nurturer][R387] reveals a unit and draws it; a Bird/Cat/Dog/Poro also buffs a friendly unit", () => {
    const s = withCards(["Ivern, Nurturer", "Loyal Poro"]);
    const board = boardOf(s, "p1");
    const poro = board.hand.splice(
      board.hand.findIndex((card) => card.name === "Loyal Poro"),
      1,
    )[0]!;
    s.host.putCard(s.room, "p1", "deck", poro, 0);
    s.host.moveCardTo(s.room, "p1", "deck", "deck", poro.id, "top");
    fund(s, "p1", "Ivern, Nurturer");
    s.as("p1").play("Ivern, Nurturer").expectOk();
    settle(s, {
      onPrompt: (prompt) => (prompt.options?.some((o) => o.id === poro.id) ? [poro.id] : undefined),
    });
    expect(zoneOf(s, poro.id)).toBe("hand");
    const ivern = s.findBoardCardAnywhere("Ivern, Nurturer")!;
    expect(s.room.rules!.objects[ivern.id]?.buffs).toBe(1);
  });

  it("[C:Starhound][R355.7] returns a Bird, Cat, Dog or Poro from your trash to your hand", () => {
    const s = withCards(["Starhound", "Loyal Poro"]);
    const board = boardOf(s, "p1");
    const poro = board.hand.splice(
      board.hand.findIndex((card) => card.name === "Loyal Poro"),
      1,
    )[0]!;
    board.trash.push(poro, ...board.deck.splice(0, 2));
    const ability = lookupAbility("Starhound", "triggered:0")!.ability;
    const options = requiredChoices(s.room, s.host, ability, { controller: "p1", choices: {} })[0]!
      .options;
    expect(options.map((o) => o.id)).toEqual([poro.id]);
    fund(s, "p1", "Starhound");
    s.as("p1").play("Starhound").expectOk();
    settle(s);
    expect(zoneOf(s, poro.id)).toBe("hand");
  });

  it("[C:Sprite Queen][R315.2.a.1][R816] plays a ready Sprite when played and at the start of your Beginning Phase", () => {
    const s = withCards(["Sprite Queen"]);
    fund(s, "p1", "Sprite Queen");
    s.as("p1").play("Sprite Queen").expectOk();
    settle(s);
    expect(cardsNamed(s, "p1", "base", "Sprite")).toHaveLength(1);
    expect(cardsNamed(s, "p1", "base", "Sprite")[0]!.exhausted).toBe(false);
    const queen = s.findBoardCardAnywhere("Sprite Queen")!;
    expect(effectiveKeywords(s.room, queen.id, s.host)).not.toContain("Temporary");
    nextOwnTurn(s);
    // The first Sprite died to Temporary; a new one was played; the Queen survived.
    expect(cardsNamed(s, "p1", "base", "Sprite")).toHaveLength(1);
    expect(zoneOf(s, queen.id)).toBe("base");
  });

  it("[C:Sprite Fountain][R808][R816] play effect and Deathknell each play a ready Sprite", () => {
    const s = withCards(["Sprite Fountain"]);
    fund(s, "p1", "Sprite Fountain");
    s.as("p1").play("Sprite Fountain").expectOk();
    settle(s);
    expect(cardsNamed(s, "p1", "base", "Sprite")).toHaveLength(1);
    const fountain = s.findBoardCardAnywhere("Sprite Fountain")!;
    expect(effectiveKeywords(s.room, fountain.id, s.host)).toContain("Temporary");
    nextOwnTurn(s);
    // Temporary killed the Fountain (and the first Sprite): Deathknell played a new Sprite.
    expect(zoneOf(s, fountain.id)).toBe("trash");
    expect(cardsNamed(s, "p1", "base", "Sprite")).toHaveLength(1);
  });

  it("[C:Scuttle Crab][R808][R425] draws on play; Deathknell: the opponent reveals their hand and you gain 1 XP", () => {
    const s = withCards(["Scuttle Crab", "Scuttle Crab"], ["Hextech Ray", "Gust"], {
      firstPlayer: "p1",
    });
    const before = hand(s, "p1").length;
    fund(s, "p1", "Scuttle Crab");
    s.as("p1").play("Scuttle Crab").expectOk();
    settle(s);
    expect(hand(s, "p1")).toHaveLength(before);
    const crab = place(s, "p1", "Scuttle Crab", "battlefieldA");
    s.as("p1").endTurn().expectOk();
    settle(s);
    fund(s, "p2", "Hextech Ray");
    s.as("p2")
      .play("Hextech Ray", { choices: { "target:0": crab.id } })
      .expectOk();
    settle(s);
    expect(xpOf(s.room, "p1")).toBe(1);
    expect(s.events().some((event) => event.type === "reveal")).toBe(true);
  });
});

describe("Unleashed batch 5 — gear", () => {
  it("[C:Sumpworks Map][R470] when an opponent scores, draw 1", () => {
    const s = withCards(["Sumpworks Map"], [], { firstPlayer: "p2" });
    place(s, "p1", "Sumpworks Map", "base");
    place(s, "p2", "Caitlyn, Patrolling", "base");
    const before = hand(s, "p1").length;
    s.as("p2").move("Caitlyn, Patrolling", "battlefieldA").expectOk();
    settle(s);
    expect(hand(s, "p1")).toHaveLength(before + 1);
  });

  it("[C:Shepherd's Heirloom][R818] gain 1 XP when played; [Equip] — Spend 1 XP attaches it", () => {
    const s = withCards(["Shepherd's Heirloom"]);
    const unit = place(s, "p1", "Caitlyn, Patrolling", "base");
    fund(s, "p1", "Shepherd's Heirloom");
    s.as("p1").play("Shepherd's Heirloom").expectOk();
    settle(s);
    expect(xpOf(s.room, "p1")).toBe(1);
    const gear = s.findBoardCardAnywhere("Shepherd's Heirloom")!;
    s.as("p1")
      .apply({
        type: "rules_activate",
        objectId: gear.id,
        ability: "activated:1",
        choices: { "target:0": unit.id },
      })
      .expectOk();
    settle(s);
    expect(s.host.findCard(s.room, gear.id)?.card.attachedToCardId).toBe(unit.id);
    expect(xpOf(s.room, "p1")).toBe(0);
  });

  it("[C:Hunter's Machete][C:Soul Sword][R718.3][R718.4] attached: the unit gets +2 and Hunt / +1 (+2 at Level 3)", () => {
    const s = withCards(["Hunter's Machete", "Soul Sword"]);
    const a = place(s, "p1", "Caitlyn, Patrolling", "base");
    const b = place(s, "p1", "Treasure Hunter", "base");
    const machete = place(s, "p1", "Hunter's Machete", "base");
    const sword = place(s, "p1", "Soul Sword", "base");
    expect(effectiveKeywords(s.room, machete.id, s.host)).not.toContain("Hunt");
    s.room.rules!.pools.p1 = { energy: 0, power: { Body: 1, Calm: 1 } };
    s.as("p1")
      .apply({
        type: "rules_activate",
        objectId: machete.id,
        ability: "activated:0",
        choices: { "target:0": a.id },
      })
      .expectOk();
    settle(s);
    s.as("p1")
      .apply({
        type: "rules_activate",
        objectId: sword.id,
        ability: "activated:0",
        choices: { "target:0": b.id },
      })
      .expectOk();
    settle(s);
    expect(effectiveMight(s.room, a.id, s.host)).toBe(5);
    expect(effectiveKeywords(s.room, a.id, s.host)).toContain("Hunt");
    expect(effectiveMight(s.room, b.id, s.host)).toBe(2);
    run(s, { op: "gain_xp", amount: 3 });
    expect(effectiveMight(s.room, b.id, s.host)).toBe(3);
  });

  it("[C:Fresh Beans][R740.4.a] when you play a unit during a showdown, you may exhaust this to draw 1", () => {
    const s = withCards(["Fresh Beans", "Inferna"]);
    const beans = place(s, "p1", "Fresh Beans", "base");
    place(s, "p1", "Caitlyn, Patrolling", "base");
    place(s, "p2", "Whiteflame Protector", "battlefieldB");
    s.room.rules!.objects.battlefieldB = { controller: "p2" };
    s.as("p1").move("Caitlyn, Patrolling", "battlefieldB").expectOk();
    // p1 (the attacker) has Focus in the showdown: Ambush Inferna to battlefieldB (822.1.b).
    fund(s, "p1", "Inferna");
    const before = hand(s, "p1").length;
    s.as("p1").play("Inferna", { location: "battlefieldB" }).expectOk();
    settle(s, {
      onPrompt: (prompt) => say("yes")(prompt) ?? say("pay")(prompt),
      until: () =>
        s.host.isExhausted(s.room, beans.id) === true && s.room.rules!.chain.length === 0,
    });
    expect(hand(s, "p1")).toHaveLength(before - 1 + 1);
  });

  it("[C:Blood Rose][R740.4.a][R730.2] pay [1] to gain 1 XP when you play a unit; Spend 3 XP, [Tap]: ready a unit", () => {
    const s = withCards(["Blood Rose", "Treasure Hunter"]);
    const rose = place(s, "p1", "Blood Rose", "base");
    fund(s, "p1", "Treasure Hunter");
    s.room.rules!.pools.p1!.energy += 1;
    s.as("p1").play("Treasure Hunter").expectOk();
    settle(s, { onPrompt: (prompt) => say("yes")(prompt) ?? say("pay")(prompt) });
    expect(xpOf(s.room, "p1")).toBe(1);
    run(s, { op: "gain_xp", amount: 2 });
    const hunter = cardsNamed(s, "p1", "base", "Treasure Hunter")[0]!;
    expect(hunter.exhausted).toBe(true);
    s.as("p1")
      .apply({
        type: "rules_activate",
        objectId: rose.id,
        ability: "activated:1",
        choices: { "target:0": hunter.id },
      })
      .expectOk();
    settle(s);
    expect(s.host.isExhausted(s.room, hunter.id)).toBe(false);
  });
});

describe("Unleashed batch 5 — units", () => {
  it("[C:Enthusiastic Promoter][R383.4.d][R826] when I hold, buff all units here; I have Backline", () => {
    const s = withCards(["Enthusiastic Promoter"]);
    const promoter = place(s, "p1", "Enthusiastic Promoter", "battlefieldA");
    const friend = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    s.room.rules!.objects.battlefieldA = { controller: "p1" };
    nextOwnTurn(s);
    expect(s.room.rules!.objects[promoter.id]?.buffs).toBe(1);
    expect(s.room.rules!.objects[friend.id]?.buffs).toBe(1);
  });

  it("[C:Pyke, Returned][R383.3.e] once each turn, an enemy unit dying while I'm at a battlefield plays an exhausted Gold", () => {
    const s = withCards(["Pyke, Returned", "Hextech Ray", "Hextech Ray"]);
    place(s, "p1", "Pyke, Returned", "battlefieldA");
    const a = place(s, "p2", "Treasure Hunter", "battlefieldB");
    const b = place(s, "p2", "Caitlyn, Patrolling", "battlefieldB");
    for (const target of [a, b]) {
      fund(s, "p1", "Hextech Ray");
      s.as("p1")
        .play("Hextech Ray", { choices: { "target:0": target.id } })
        .expectOk();
      settle(s);
    }
    const gold = cardsNamed(s, "p1", "base", "Gold");
    expect(gold).toHaveLength(1);
    expect(gold[0]!.exhausted).toBe(true);
  });

  it("[C:Pyke, Dockside Butcher][R356.2.b.1] paying the optional [Fury] readies me with +2 Might this turn", () => {
    const s = withCards(["Pyke, Dockside Butcher", "Pyke, Dockside Butcher"]);
    fund(s, "p1", "Pyke, Dockside Butcher");
    s.as("p1").play("Pyke, Dockside Butcher").expectOk();
    expect(s.room.rules!.chain).toHaveLength(0);
    fund(s, "p1", "Pyke, Dockside Butcher");
    s.room.rules!.pools.p1!.power = { Fury: 1 };
    playWith(s, "p1", "Pyke, Dockside Butcher", { optionalCosts: ["optional:0"] });
    settle(s);
    const [, paid] = cardsNamed(s, "p1", "base", "Pyke, Dockside Butcher");
    expect(paid!.exhausted).toBe(false);
    expect(effectiveMight(s.room, paid!.id, s.host)).toBe(4);
  });

  it("[C:Nami, Headstrong][R356.2.b.1][R392] paid [Calm]: stun an enemy unit; when I hold, the next unit you play is readied and buffed", () => {
    const s = withCards(["Nami, Headstrong", "Treasure Hunter"]);
    const enemy = place(s, "p2", "Caitlyn, Patrolling", "battlefieldB");
    fund(s, "p1", "Nami, Headstrong");
    s.room.rules!.pools.p1!.power = { Calm: 1 };
    playWith(s, "p1", "Nami, Headstrong", { optionalCosts: ["optional:0"] });
    settle(s);
    expect(s.room.rules!.objects[enemy.id]?.stunned).toBe(true);
    const nami = s.findBoardCardAnywhere("Nami, Headstrong")!;
    s.host.moveCard(s.room, "p1", "base", "battlefieldA", nami.id);
    s.room.rules!.objects.battlefieldA = { controller: "p1" };
    nextOwnTurn(s);
    fund(s, "p1", "Treasure Hunter");
    s.as("p1").play("Treasure Hunter").expectOk();
    settle(s);
    const hunter = cardsNamed(s, "p1", "base", "Treasure Hunter")[0]!;
    expect(hunter.exhausted).toBe(false);
    expect(s.room.rules!.objects[hunter.id]?.buffs).toBe(1);
  });

  it("[C:Master Yi, Unstoppable][R366.2.a][R757.1] Level 3/6/11 cost reductions (one applies); Level 16 untargetable", () => {
    const s = withCards(["Master Yi, Unstoppable"], ["Hextech Ray"]);
    const yi = s.handCard("p1", "Master Yi, Unstoppable")!;
    const adjust = () => costAdjustments(s.room, s.host, { playerId: "p1", cardId: yi.id });
    expect(adjust()).toEqual([]);
    run(s, { op: "gain_xp", amount: 3 });
    expect(adjust()).toEqual([expect.objectContaining({ energy: -2, power: { Calm: -1 } })]);
    run(s, { op: "gain_xp", amount: 3 });
    expect(adjust()).toEqual([expect.objectContaining({ energy: -4, power: { Calm: -2 } })]);
    run(s, { op: "gain_xp", amount: 5 });
    expect(adjust()).toEqual([expect.objectContaining({ energy: -6, power: { Calm: -3 } })]);
    const board = boardOf(s, "p1");
    const card = board.hand.splice(
      board.hand.findIndex((c) => c.id === yi.id),
      1,
    )[0]!;
    board.battlefieldA.push(card);
    const ray = lookupAbility("Hextech Ray", "spell")!.ability;
    const options = () =>
      requiredChoices(s.room, s.host, ray, { controller: "p2", choices: {} })[0]!.options.map(
        (o) => o.id,
      );
    expect(options()).toContain(yi.id);
    run(s, { op: "gain_xp", amount: 5 });
    expect(options()).not.toContain(yi.id);
  });

  it("[C:Vex, Apathetic][R424][R054.1] an opponent's unit played while I'm at a battlefield is stunned and can't move this turn", () => {
    const s2 = withCards(["Vex, Apathetic"], ["Treasure Hunter"], { firstPlayer: "p2" });
    place(s2, "p1", "Vex, Apathetic", "battlefieldA");
    fund(s2, "p2", "Treasure Hunter");
    s2.as("p2").play("Treasure Hunter").expectOk();
    settle(s2);
    const hunter = cardsNamed(s2, "p2", "base", "Treasure Hunter")[0]!;
    expect(s2.room.rules!.objects[hunter.id]?.stunned).toBe(true);
    s2.host.setExhausted(s2.room, hunter.id, false);
    s2.as("p2").move("Treasure Hunter", "battlefieldB").expectError("restricted");
  });
});

describe("Unleashed batch 5 — battlefields", () => {
  it("[C:Abandoned Hall][R420.4.a] when a player plays a spell, they may give a unit they control here +1 Might", () => {
    const s = withCards(["Moonlight Affliction"], [], { battlefields: { p1: "Abandoned Hall" } });
    const unit = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    const enemy = place(s, "p2", "Treasure Hunter", "base");
    fund(s, "p1", "Moonlight Affliction");
    s.as("p1")
      .play("Moonlight Affliction", { choices: { "target:0": enemy.id } })
      .expectOk();
    settle(s, { onPrompt: (prompt) => say("yes")(prompt) });
    expect(effectiveMight(s.room, unit.id, s.host)).toBe(4);
  });

  it("[C:Amateur Recital][R383.4.d.2.b] when you hold here, you may move a unit at a battlefield to its base", () => {
    const s = withCards([], [], { battlefields: { p1: "Amateur Recital" } });
    place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    const enemy = place(s, "p2", "Whiteflame Protector", "battlefieldB");
    s.room.rules!.objects.battlefieldA = { controller: "p1" };
    s.as("p1").endTurn().expectOk();
    settle(s);
    s.as("p2").endTurn().expectOk();
    settle(s, {
      onPrompt: (prompt) =>
        say("yes")(prompt) ??
        (prompt.options?.some((o) => o.id === enemy.id) ? [enemy.id] : undefined),
    });
    expect(zoneOf(s, enemy.id)).toBe("base");
  });

  it("[C:Black Flame Altar][R814] units here with Temporary have Shield", () => {
    const s = withCards([], [], { battlefields: { p1: "Black Flame Altar" } });
    run(s, { op: "create", token: { name: "Sprite", play: true }, zone: "battlefieldA" });
    const sprite = cardsNamed(s, "p1", "battlefieldA", "Sprite")[0]!;
    const plain = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    expect(effectiveKeywords(s.room, sprite.id, s.host)).toContain("Shield");
    expect(effectiveKeywords(s.room, plain.id, s.host)).not.toContain("Shield");
  });

  it("[C:Forbidding Waste][R740.2.a] a unit defending alone here has -2 Might", () => {
    const s = withCards([], [], { battlefields: { p1: "Forbidding Waste" }, firstPlayer: "p2" });
    const defender = place(s, "p1", "Whiteflame Protector", "battlefieldA");
    const base = effectiveMight(s.room, defender.id, s.host);
    place(s, "p2", "Caitlyn, Patrolling", "base");
    s.as("p2").move("Caitlyn, Patrolling", "battlefieldA").expectOk();
    expect(s.room.rules!.objects[defender.id]?.designation).toBe("defender");
    expect(effectiveMight(s.room, defender.id, s.host)).toBe(base - 2);
  });

  it("[C:Ripper's Bay][R740.4.a][R431.2.a] a unit returned to hand from here: its owner may pay [1] to channel 1 rune exhausted", () => {
    const s = withCards(["Rebuke"], [], { battlefields: { p1: "Ripper's Bay" } });
    const enemy = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    s.room.rules!.pools.p2 = { energy: 1, power: {} };
    const runes = boardOf(s, "p2").runeArea.length;
    fund(s, "p1", "Rebuke");
    s.as("p1")
      .play("Rebuke", { choices: { "target:0": enemy.id } })
      .expectOk();
    settle(s, { onPrompt: (prompt) => say("yes")(prompt) ?? say("pay")(prompt) });
    expect(zoneOf(s, enemy.id)).toBe("hand");
    expect(boardOf(s, "p2").runeArea).toHaveLength(runes + 1);
  });

  it("[C:Valley of Idols][R740.4.a][R702.3] a player playing a unit here may pay [1] to buff it", () => {
    const s = withCards(["Treasure Hunter"], [], { battlefields: { p1: "Valley of Idols" } });
    place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    s.room.rules!.objects.battlefieldA = { controller: "p1" };
    fund(s, "p1", "Treasure Hunter");
    s.room.rules!.pools.p1!.energy += 1;
    s.as("p1").play("Treasure Hunter", { location: "battlefieldA" }).expectOk();
    settle(s, { onPrompt: (prompt) => say("yes")(prompt) ?? say("pay")(prompt) });
    const hunter = cardsNamed(s, "p1", "battlefieldA", "Treasure Hunter")[0]!;
    expect(s.room.rules!.objects[hunter.id]?.buffs).toBe(1);
  });

  it("[C:Vaults of Helia][R356.3] when you hold here, your non-token units cost [1] more this turn", () => {
    const s = withCards(["Treasure Hunter"], [], { battlefields: { p1: "Vaults of Helia" } });
    place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    s.room.rules!.objects.battlefieldA = { controller: "p1" };
    nextOwnTurn(s);
    const hunter = s.handCard("p1", "Treasure Hunter")!;
    expect(costAdjustments(s.room, s.host, { playerId: "p1", cardId: hunter.id })).toEqual([
      expect.objectContaining({ energy: 1 }),
    ]);
  });

  it("[C:Star Spring][R383.3.e] the first non-token unit played here each turn may send another of your units here to base", () => {
    const s = withCards(["Treasure Hunter"], [], { battlefields: { p1: "Star Spring" } });
    const other = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    s.room.rules!.objects.battlefieldA = { controller: "p1" };
    fund(s, "p1", "Treasure Hunter");
    s.as("p1").play("Treasure Hunter", { location: "battlefieldA" }).expectOk();
    settle(s, {
      onPrompt: (prompt) =>
        say("yes")(prompt) ??
        (prompt.options?.some((o) => o.id === other.id) ? [other.id] : undefined),
    });
    expect(zoneOf(s, other.id)).toBe("base");
  });
});
