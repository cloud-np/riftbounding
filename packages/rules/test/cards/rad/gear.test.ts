/**
 * RAD gear (wave R3).
 */
import { describe, expect, it } from "vitest";
import {
  effectiveKeywordValues,
  effectiveKeywords,
  effectiveMight,
  getCardScript,
  listActivatedAbilities,
} from "../../../src";
import { boardOf, fund, zoneOf } from "../../rules/effects/helpers";
import {
  answer,
  drain,
  namesIn,
  put,
  resolveAll,
  settle,
  withCards,
  withDeck,
  type S,
} from "./helpers";

function activate(s: S, player: string, id: string, index = 0): void {
  const name = s.host.findCard(s.room, id)!.card.name;
  const ref = listActivatedAbilities(name)[index]!.ref;
  s.as(player).apply({ type: "rules_activate", objectId: id, ability: ref }).expectOk();
}

/** p1 ends the turn and p2 ends theirs, so p1's Beginning Phase (hold) has run. */
function toNextTurn(s: S): void {
  s.as("p1").endTurn().expectOk();
  resolveAll(s);
  s.as("p2").endTurn().expectOk();
}

describe("RAD gear", () => {
  it("[C:Banner of Conquest][R830.1.b.1][R807] Deploy to a battlefield; friendly units there have Assault", () => {
    const s = withCards(["Banner of Conquest"]);
    const there = put(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    const home = put(s, "p1", "Treasure Hunter", "base");
    const enemy = put(s, "p2", "Treasure Hunter", "battlefieldA");
    fund(s, "p1", "Banner of Conquest");
    s.as("p1").play("Banner of Conquest", { location: "battlefieldA" }).expectOk();
    const banner = s.findBoardCardAnywhere("Banner of Conquest")!;
    expect(zoneOf(s, banner.id)).toBe("battlefieldA");
    expect(effectiveKeywords(s.room, there.id, s.host)).toContain("Assault");
    expect(effectiveKeywords(s.room, home.id, s.host)).not.toContain("Assault");
    expect(effectiveKeywords(s.room, enemy.id, s.host)).not.toContain("Assault");
    expect(effectiveKeywords(s.room, banner.id, s.host)).not.toContain("Assault");
  });

  it("[C:Blossoming Dreamroot][R468.3] When you win a combat here, draw 1", () => {
    const s = withDeck(["Blossoming Dreamroot"]);
    put(s, "p1", "Blossoming Dreamroot", "battlefieldA");
    const attacker = put(s, "p1", "Astral Heron", "base");
    s.room.rules!.objects[attacker.id] = { baseMight: 7 };
    const defender = put(s, "p2", "Treasure Hunter", "battlefieldA");
    s.room.rules!.objects[defender.id] = { baseMight: 1 };
    s.room.rules!.objects["battlefieldA"] = { controller: "p2" };
    const hand = boardOf(s, "p1").hand.length;
    s.as("p1").move("Astral Heron", "battlefieldA").expectOk();
    resolveAll(s, 40);
    expect(zoneOf(s, defender.id)).toBe("trash");
    expect(boardOf(s, "p1").hand.length).toBe(hand + 1);
  });

  it("[C:Concert Poster][R740.4.a][R405.2] on play you may pay [1] for a Recruit in your base", () => {
    const s = withCards(["Concert Poster"]);
    fund(s, "p1", "Concert Poster");
    s.room.rules!.pools.p1!.energy += 1;
    s.as("p1").play("Concert Poster", { location: "battlefieldA" }).expectOk();
    settle(s);
    s.expectPrompt("yes-no", "p1");
    answer(s, "yes");
    settle(s);
    expect(namesIn(s, "p1", "base")).toContain("Recruit");
    expect(s.room.rules!.pools.p1!.energy).toBe(0);
  });

  it("[C:Demacian Standard][R383.4.e][R466.2.c.3] friendly units attack here: one of them gets +2 this turn", () => {
    const s = withDeck(["Demacian Standard"]);
    put(s, "p1", "Demacian Standard", "battlefieldA");
    const attacker = put(s, "p1", "Astral Heron", "base");
    s.room.rules!.objects[attacker.id] = { baseMight: 7 };
    const defender = put(s, "p2", "Treasure Hunter", "battlefieldA");
    s.room.rules!.objects[defender.id] = { baseMight: 1 };
    s.room.rules!.objects["battlefieldA"] = { controller: "p2" };
    s.as("p1").move("Astral Heron", "battlefieldA").expectOk();
    for (
      let guard = 0;
      guard < 10 && !s.events().some((event) => event.type === "might");
      guard += 1
    ) {
      const rules = s.room.rules!;
      if (rules.prompt) answer(s, [rules.prompt.options![0]!.id]);
      else if (rules.priority ?? rules.focus)
        s.as((rules.priority ?? rules.focus)!)
          .pass()
          .expectOk();
      else break;
    }
    expect(
      s
        .events()
        .some(
          (event) => event.type === "might" && event.cardId === attacker.id && event.amount === 2,
        ),
    ).toBe(true);
  });

  it("[C:Demacian Standard][R383.4.d.2.b] When you hold here, you may return this to its owner's hand", () => {
    const s = withDeck(["Demacian Standard"]);
    const standard = put(s, "p1", "Demacian Standard", "battlefieldB");
    put(s, "p1", "Treasure Hunter", "battlefieldB");
    s.room.rules!.objects["battlefieldB"] = { controller: "p1" };
    toNextTurn(s);
    settle(s);
    s.expectPrompt("yes-no", "p1");
    answer(s, "yes");
    settle(s);
    expect(zoneOf(s, standard.id)).toBe("hand");
  });

  it("[C:Ephemeral Ward][R440.2.c] your units have +2 Might; when you play a unit, kill this", () => {
    const s = withCards(["Ephemeral Ward", "Treasure Hunter"]);
    const unit = put(s, "p1", "Caitlyn, Patrolling", "base");
    const enemy = put(s, "p2", "Caitlyn, Patrolling", "base");
    fund(s, "p1", "Ephemeral Ward");
    s.as("p1").play("Ephemeral Ward").expectOk();
    const ward = s.findBoardCardAnywhere("Ephemeral Ward")!;
    expect(effectiveMight(s.room, unit.id, s.host)).toBe(5);
    expect(effectiveMight(s.room, enemy.id, s.host)).toBe(3);
    fund(s, "p1", "Treasure Hunter");
    s.as("p1").play("Treasure Hunter").expectOk();
    settle(s);
    expect(zoneOf(s, ward.id)).toBe("trash");
    expect(effectiveMight(s.room, unit.id, s.host)).toBe(3);
  });

  it("[C:Hunting Blind][R421][R814] may move an enemy unit here; friendly units here have Shield 2", () => {
    const s = withCards(["Hunting Blind"]);
    const friend = put(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    const enemy = put(s, "p2", "Treasure Hunter", "base");
    fund(s, "p1", "Hunting Blind");
    s.as("p1").play("Hunting Blind", { location: "battlefieldA" }).expectOk();
    settle(s);
    if (s.room.rules!.prompt?.kind === "choose-target") answer(s, [enemy.id]);
    settle(s);
    s.expectPrompt("yes-no", "p1");
    answer(s, "yes");
    settle(s);
    expect(zoneOf(s, enemy.id)).toBe("battlefieldA");
    expect(effectiveKeywordValues(s.room, friend.id, s.host).shield).toBe(2);
    expect(effectiveKeywordValues(s.room, enemy.id, s.host).shield).toBeUndefined();
  });

  it("[C:Invigorating Bloom] partial: When you play this, give a friendly unit +3 Might this turn", () => {
    const s = withCards(["Invigorating Bloom"]);
    const friend = put(s, "p1", "Caitlyn, Patrolling", "base");
    fund(s, "p1", "Invigorating Bloom");
    s.as("p1").play("Invigorating Bloom").expectOk();
    settle(s);
    expect(effectiveMight(s.room, friend.id, s.host)).toBe(6);
    expect(getCardScript("Invigorating Bloom")?.status).toBe("partial");
  });

  it("[C:Nazuman Ntofo][R718.3][R718.4] attached: the host has Shield 2 (and +0 Might)", () => {
    const s = withDeck(["Nazuman Ntofo"]);
    const gear = put(s, "p1", "Nazuman Ntofo", "base");
    const unit = put(s, "p1", "Caitlyn, Patrolling", "base");
    // Equip (818) is the play layer's built-in ability; attach directly to test the effect text.
    s.host.attach(s.room, gear.id, unit.id);
    expect(effectiveKeywordValues(s.room, unit.id, s.host).shield).toBe(2);
    expect(effectiveKeywordValues(s.room, gear.id, s.host).shield).toBeUndefined();
    expect(effectiveMight(s.room, unit.id, s.host)).toBe(3);
  });

  it("[C:Pillaged Armory][R427] When you play this, buff a friendly unit", () => {
    const s = withCards(["Pillaged Armory"]);
    const friend = put(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    fund(s, "p1", "Pillaged Armory");
    s.as("p1").play("Pillaged Armory", { location: "battlefieldA" }).expectOk();
    settle(s);
    expect(s.room.rules!.objects[friend.id]?.buffs).toBe(1);
  });

  it("[C:Portable Portal][R740.4.a][R810] may pay [Body] to ready a unit here; friendly units here have Ganking", () => {
    const s = withCards(["Portable Portal"]);
    const friend = put(s, "p1", "Caitlyn, Patrolling", "battlefieldA", true);
    fund(s, "p1", "Portable Portal");
    s.room.rules!.pools.p1!.power = { ...s.room.rules!.pools.p1!.power, Body: 1 };
    s.as("p1").play("Portable Portal", { location: "battlefieldA" }).expectOk();
    settle(s);
    s.expectPrompt("yes-no", "p1");
    answer(s, "yes");
    settle(s);
    expect(s.host.isExhausted(s.room, friend.id)).toBe(false);
    expect(effectiveKeywords(s.room, friend.id, s.host)).toContain("Ganking");
  });

  it("[C:Protector's Shield][R718.4][R815] attached: the host has Tank and +1 Might", () => {
    const s = withDeck(["Protector's Shield"]);
    const gear = put(s, "p1", "Protector's Shield", "base");
    const unit = put(s, "p1", "Caitlyn, Patrolling", "base");
    s.host.attach(s.room, gear.id, unit.id);
    expect(effectiveKeywords(s.room, unit.id, s.host)).toContain("Tank");
    expect(effectiveMight(s.room, unit.id, s.host)).toBe(4);
  });

  it("[C:Resource Extractor][R383.2.a.1][R190.2.b] at the end of your turn, if you control this battlefield, an exhausted Gold", () => {
    const s = withDeck(["Resource Extractor", "Resource Extractor"]);
    put(s, "p1", "Resource Extractor", "battlefieldA");
    put(s, "p1", "Treasure Hunter", "battlefieldA");
    s.room.rules!.objects["battlefieldA"] = { controller: "p1" };
    put(s, "p1", "Resource Extractor", "battlefieldB");
    s.room.rules!.objects["battlefieldB"] = { controller: "p2" };
    s.as("p1").endTurn().expectOk();
    resolveAll(s);
    const golds = boardOf(s, "p1").base.filter((card) => card.name === "Gold");
    expect(golds).toHaveLength(1);
    expect(golds[0]!.exhausted).toBe(true);
  });

  it("[C:Resplendent Rostrum][R377.1][R415] [Tap]: draw 1 and channel 1 exhausted; when exhausted, +3 to a friendly unit", () => {
    const s = withDeck(["Resplendent Rostrum"]);
    const rostrum = put(s, "p1", "Resplendent Rostrum", "base");
    const friend = put(s, "p1", "Caitlyn, Patrolling", "base");
    const hand = boardOf(s, "p1").hand.length;
    const runes = boardOf(s, "p1").runeArea.length;
    activate(s, "p1", rostrum.id);
    resolveAll(s);
    expect(boardOf(s, "p1").hand.length).toBe(hand + 1);
    expect(boardOf(s, "p1").runeArea.length).toBe(runes + 1);
    expect(effectiveMight(s.room, friend.id, s.host)).toBe(6);
  });

  it("[C:The Ball][R355.3][R403.2] when played, choose one: draw 1 or deal 2 to enemy units here", () => {
    const s = withCards(["The Ball"]);
    const a = put(s, "p2", "Treasure Hunter", "battlefieldA");
    const b = put(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    const away = put(s, "p2", "Treasure Hunter", "base");
    fund(s, "p1", "The Ball");
    s.as("p1").play("The Ball", { location: "battlefieldA" }).expectOk();
    settle(s);
    s.expectPrompt("choose-mode", "p1");
    answer(s, ["deal"]);
    settle(s);
    expect(zoneOf(s, a.id)).toBe("trash");
    expect(s.room.rules!.objects[b.id]?.damage).toBe(2);
    expect(zoneOf(s, away.id)).toBe("base");
  });

  it("[C:The Good Stuff][R423][R383.4.d.2.b] on play discard 1 then draw 3; when you hold here, return it to hand", () => {
    const s = withCards(["The Good Stuff", "Gust"]);
    fund(s, "p1", "The Good Stuff");
    s.as("p1").play("The Good Stuff", { location: "battlefieldB" }).expectOk();
    const hand = boardOf(s, "p1").hand.length;
    settle(s);
    expect(boardOf(s, "p1").hand.length).toBe(hand - 1 + 3);
    const stuff = s.findBoardCardAnywhere("The Good Stuff")!;
    put(s, "p1", "Treasure Hunter", "battlefieldB");
    s.room.rules!.objects["battlefieldB"] = { controller: "p1" };
    toNextTurn(s);
    settle(s);
    expect(zoneOf(s, stuff.id)).toBe("hand");
  });

  it("[C:Whirling Twirligig][R357.2] [Tap]: Gold; kill a gear: Recruit; kill a unit: 3 Might Mech", () => {
    const s = withDeck(["Whirling Twirligig"]);
    const twirl = put(s, "p1", "Whirling Twirligig", "base");
    activate(s, "p1", twirl.id, 0);
    resolveAll(s);
    expect(namesIn(s, "p1", "base")).toContain("Gold");
    s.host.setExhausted(s.room, twirl.id, false);
    const victim = put(s, "p1", "Treasure Hunter", "base");
    activate(s, "p1", twirl.id, 2);
    resolveAll(s);
    expect(zoneOf(s, victim.id)).toBe("trash");
    const mech = boardOf(s, "p1").base.find((card) => card.name === "Mech")!;
    expect(effectiveMight(s.room, mech.id, s.host)).toBe(3);
  });

  it("[C:Titanic Shrine][R383.3.b][R143.2] play the mightiest unit: exhaust me to draw 1", () => {
    const t = withCards(["Astral Heron", "Titanic Shrine"]);
    const titanic = put(t, "p1", "Titanic Shrine", "base");
    put(t, "p2", "Caitlyn, Patrolling", "base");
    const hand = boardOf(t, "p1").hand.length;
    fund(t, "p1", "Astral Heron");
    t.as("p1").play("Astral Heron").expectOk();
    settle(t);
    t.expectPrompt("yes-no", "p1");
    answer(t, "yes");
    settle(t);
    expect(t.host.isExhausted(t.room, titanic.id)).toBe(true);
    expect(boardOf(t, "p1").hand.length).toBe(hand - 1 + 1);
  });

  it("[C:Gravity Field][R808] partial: Deathknell draw 1", () => {
    const s = withCards(["Lost to the Sands"], ["Gravity Field"]);
    const field = put(s, "p2", "Gravity Field", "battlefieldA");
    const hand = boardOf(s, "p2").hand.length;
    fund(s, "p1", "Lost to the Sands");
    s.as("p1")
      .play("Lost to the Sands", { choices: { mode: "kill", "target:1": field.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    resolveAll(s);
    expect(zoneOf(s, field.id)).toBe("trash");
    expect(boardOf(s, "p2").hand.length).toBe(hand + 1);
    expect(getCardScript("Gravity Field")?.status).toBe("partial");
  });

  it("[C:Detonation Amplifier][R740.4.a] partial: on play you may kill another friendly unit or gear to draw 1", () => {
    const s = withCards(["Detonation Amplifier"]);
    const victim = put(s, "p1", "Treasure Hunter", "base");
    const hand = boardOf(s, "p1").hand.length;
    fund(s, "p1", "Detonation Amplifier");
    s.as("p1").play("Detonation Amplifier", { location: "battlefieldA" }).expectOk();
    settle(s);
    s.expectPrompt("yes-no", "p1");
    answer(s, "yes");
    settle(s);
    expect(zoneOf(s, victim.id)).toBe("trash");
    expect(boardOf(s, "p1").hand.length).toBe(hand - 1 + 1);
  });

  it("[C:Mechanical Bandit][R315.2.a.1][R425][R417] Beginning Phase: draw your revealed card if it has the lowest cost", () => {
    const s = withDeck(["Mechanical Bandit"]);
    put(s, "p1", "Mechanical Bandit", "base");
    s.as("p1").endTurn().expectOk();
    resolveAll(s);
    // Top cards (the end of the list): p1 Gust (Energy 1), p2 Astral Heron (Energy 7).
    const p1deck = boardOf(s, "p1").deck;
    const gust = p1deck.splice(
      p1deck.findIndex((card) => card.name === "Gust"),
      1,
    )[0]!;
    p1deck.push(gust);
    const p2deck = boardOf(s, "p2").deck;
    const heron = p2deck.splice(
      p2deck.findIndex((card) => card.name === "Astral Heron"),
      1,
    )[0]!;
    p2deck.push(heron);
    s.as("p2").endTurn().expectOk();
    resolveAll(s);
    expect(zoneOf(s, gust.id)).toBe("hand");
    expect(boardOf(s, "p2").deck[0]!.id).toBe(heron.id);
  });

  it("[C:Zero Point Inflection][R420.4.a][R414] play a card: draw 2; drawing with 9+ other cards: discard, kill, opponent scores", () => {
    const zpi = withDeck(["Zero Point Inflection", "Gust"]);
    const inflection = put(zpi, "p1", "Zero Point Inflection", "base");
    zpi.moveDeckCardToHand("p1", "Gust");
    const target = put(zpi, "p2", "Treasure Hunter", "battlefieldA");
    const hand = boardOf(zpi, "p1").hand.length;
    fund(zpi, "p1", "Gust");
    zpi
      .as("p1")
      .play("Gust", { choices: { "target:0": target.id } })
      .expectOk();
    zpi.as("p2").pass().expectOk();
    settle(zpi);
    expect(boardOf(zpi, "p1").hand.length).toBe(hand - 1 + 2);
    expect(zoneOf(zpi, inflection.id)).toBe("base");

    // Fill the hand to 9 cards, then a draw of 1 or more triggers the second ability.
    const board = boardOf(zpi, "p1");
    while (board.hand.length < 9) board.hand.push(board.deck.shift()!);
    zpi.moveDeckCardToHand("p1", "Gust");
    const target2 = put(zpi, "p2", "Caitlyn, Patrolling", "battlefieldA");
    fund(zpi, "p1", "Gust");
    zpi
      .as("p1")
      .play("Gust", { choices: { "target:0": target2.id } })
      .expectOk();
    zpi.as("p2").pass().expectOk();
    resolveAll(zpi);
    expect(zoneOf(zpi, inflection.id)).toBe("trash");
    expect(boardOf(zpi, "p1").hand).toHaveLength(0);
    zpi.expectScore("p2", 1);
  });

  it("[C:Dockside Lock-Up][R428][R383.3.b] banish a unit here; on hold, kill this to play the banished card free", () => {
    const s = withCards(["Dockside Lock-Up"]);
    put(s, "p1", "Treasure Hunter", "battlefieldB");
    const prisoner = put(s, "p2", "Caitlyn, Patrolling", "battlefieldB");
    fund(s, "p1", "Dockside Lock-Up");
    s.as("p1").play("Dockside Lock-Up", { location: "battlefieldB" }).expectOk();
    settle(s);
    if (s.room.rules!.prompt?.kind === "choose-target") answer(s, [prisoner.id]);
    resolveAll(s);
    expect(zoneOf(s, prisoner.id)).toBe("banished");
    const lockup = s.findBoardCardAnywhere("Dockside Lock-Up")!;
    s.room.rules!.objects["battlefieldB"] = { controller: "p1" };
    toNextTurn(s);
    settle(s);
    s.expectPrompt("yes-no", "p1");
    answer(s, "yes");
    resolveAll(s);
    expect(zoneOf(s, lockup.id)).toBe("trash");
    // p1 played p2's banished card, ignoring its cost: p1 controls it now.
    expect(boardOf(s, "p1").base.map((card) => card.id)).toContain(prisoner.id);
  });

  it("[C:Runeblade Anvil][R383.2.c.3][R377.1] [2][Fury],[Tap]: kill this — it leaves the board and banishes the next card", () => {
    const s = withDeck(["Runeblade Anvil"]);
    const anvil = put(s, "p1", "Runeblade Anvil", "base");
    const top = boardOf(s, "p1").deck.at(-1)!;
    s.room.rules!.pools.p1 = { energy: 2, power: { Fury: 1 } };
    activate(s, "p1", anvil.id);
    resolveAll(s);
    expect(zoneOf(s, anvil.id)).toBe("trash");
    expect(zoneOf(s, top.id)).toBe("banished");
  });

  it("[C:Runeblade Anvil][R428][R420.1.a] banish the top card; you may play it until your next Ending Phase", () => {
    const s = withCards(["Runeblade Anvil"]);
    const top = boardOf(s, "p1").deck.at(-1)!;
    fund(s, "p1", "Runeblade Anvil");
    s.as("p1").play("Runeblade Anvil").expectOk();
    settle(s);
    expect(zoneOf(s, top.id)).toBe("banished");
    // The banished card is playable from Banishment, paying its cost.
    drain(s, "p1");
    fund(s, "p1", top.name);
    expect(s.expectLegal("p1").playableCardIds).toContain(top.id);
  });
});
