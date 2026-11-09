/**
 * Origins A–N, batch 6: each-player choices, delayed/reflexive abilities, computed amounts.
 */
import { describe, expect, it } from "vitest";
import {
  costAdjustments,
  effectiveKeywords,
  effectiveMight,
  getCardScript,
  lookupAbility,
  requiredChoices,
} from "../../../src";
import { boardOf, fund, place, zoneOf } from "../../rules/effects/helpers";
import {
  answer,
  cardIn,
  drain,
  handOnly,
  passBoth,
  pick,
  promptOptions,
  settle,
  withCards,
} from "./helpers";

describe("Origins A–N — each player chooses", () => {
  it("[C:Acceptable Losses][R303.2.a][R429.2] each player kills one of their gear", () => {
    const s = withCards(["Acceptable Losses", "Blade of the Exile"], ["Blade of the Exile"]);
    const a = place(s, "p1", "Blade of the Exile", "base");
    const b = place(s, "p1", "Blade of the Exile", "base");
    const theirs = place(s, "p2", "Blade of the Exile", "base");
    fund(s, "p1", "Acceptable Losses");
    s.as("p1").play("Acceptable Losses").expectOk();
    drain(s);
    // p1 (Turn Player) chooses one of their two gear; p2's only gear is forced.
    s.expectPrompt("choose-card", "p1");
    expect(promptOptions(s).sort()).toEqual([a.id, b.id].sort());
    pick(s, b.id);
    drain(s);
    expect(zoneOf(s, b.id)).toBe("trash");
    expect(zoneOf(s, a.id)).toBe("base");
    expect(zoneOf(s, theirs.id)).toBe("trash");
  });

  it("[C:Cull the Weak][R303.2.a][R429.2] each player kills one of their units", () => {
    const s = withCards(["Cull the Weak"]);
    const mine = place(s, "p1", "Treasure Hunter", "base");
    const a = place(s, "p2", "Astral Heron", "base");
    const b = place(s, "p2", "Stellacorn Herder", "battlefieldA");
    fund(s, "p1", "Cull the Weak");
    s.as("p1").play("Cull the Weak").expectOk();
    drain(s);
    s.expectPrompt("choose-card", "p2");
    pick(s, b.id);
    drain(s);
    expect(zoneOf(s, mine.id)).toBe("trash");
    expect(zoneOf(s, b.id)).toBe("trash");
    expect(zoneOf(s, a.id)).toBe("base");
  });

  it("[C:King's Edict][R429.2] each other player chooses a unit you don't control; kill those units", () => {
    const s = withCards(["King's Edict"]);
    const mine = place(s, "p1", "Astral Heron", "base");
    const a = place(s, "p2", "Whiteflame Protector", "base");
    const b = place(s, "p2", "Treasure Hunter", "base");
    fund(s, "p1", "King's Edict");
    s.as("p1").play("King's Edict").expectOk();
    drain(s);
    s.expectPrompt("choose-card", "p2");
    // p1's own unit is not an option ("a unit you don't control").
    expect(promptOptions(s).sort()).toEqual([a.id, b.id].sort());
    pick(s, b.id);
    drain(s);
    expect(zoneOf(s, b.id)).toBe("trash");
    expect(zoneOf(s, a.id)).toBe("base");
    expect(zoneOf(s, mine.id)).toBe("base");
  });

  it("[C:Invert Timelines][R423.4][R414.1] each player discards their hand, then draws 4", () => {
    const s = withCards(["Invert Timelines", "Rebuke", "Defy"], ["Gust"]);
    fund(s, "p1", "Invert Timelines");
    const myHand = boardOf(s, "p1")
      .hand.filter((card) => card.name !== "Invert Timelines")
      .map((card) => card.id);
    const theirHand = boardOf(s, "p2").hand.map((card) => card.id);
    s.as("p1").play("Invert Timelines").expectOk();
    drain(s);
    for (const id of [...myHand, ...theirHand]) expect(zoneOf(s, id)).toBe("trash");
    expect(boardOf(s, "p1").hand).toHaveLength(4);
    expect(boardOf(s, "p2").hand).toHaveLength(4);
  });
});

describe("Origins A–N — more spells", () => {
  it("[C:Fading Memories][R816.1.b] gives a unit at a battlefield or a gear Temporary", () => {
    const s = withCards(["Fading Memories"]);
    const atBase = place(s, "p2", "Astral Heron", "base");
    const there = place(s, "p2", "Whiteflame Protector", "battlefieldB");
    s.room.rules!.objects[there.id] = { baseMight: 8 };
    const gear = place(s, "p2", "Blade of the Exile", "base");
    fund(s, "p1", "Fading Memories");
    // A unit at a base is not a legal choice; a gear anywhere is.
    s.as("p1")
      .play("Fading Memories", { choices: { "target:0": atBase.id } })
      .expectError("illegal_target");
    const ability = lookupAbility("Fading Memories", "spell")!.ability;
    const options = requiredChoices(s.room, s.host, ability, { controller: "p1", choices: {} })[0]!
      .options;
    expect(options.map((option) => option.id).sort()).toEqual([there.id, gear.id].sort());
    s.as("p1")
      .play("Fading Memories", { choices: { "target:0": there.id } })
      .expectOk();
    drain(s);
    expect(effectiveKeywords(s.room, there.id, s.host)).toContain("Temporary");
    // p2's Beginning Phase: the unit is killed before scoring.
    s.as("p1").endTurn().expectOk();
    settle(s);
    expect(zoneOf(s, there.id)).toBe("trash");
    expect(getCardScript("Fading Memories")?.status).toBe("partial");
  });

  it.skip("[BUG][C:Fading Memories][R317.2.c][R816.1.b] a gear given Temporary keeps it past the end of turn", () => {
    // 317.2.c expire step (cleanup.ts "expire-this-turn") deletes every rules object without
    // buffs/baseMight/counters/grantedKeywords/grantedAbilities/controller. Gear never have
    // baseMight, so a permanent `keywordGrants` entry (Temporary here) is lost at the end of the
    // turn and the gear is never killed. The keep-list should include keywordGrants, mightMods,
    // prevent and empowered (docs/rules/effects.md, "Contracts for the merge", R2-combat).
    const s = withCards(["Fading Memories"]);
    const gear = place(s, "p2", "Blade of the Exile", "base");
    fund(s, "p1", "Fading Memories");
    s.as("p1")
      .play("Fading Memories", { choices: { "target:0": gear.id } })
      .expectOk();
    drain(s);
    expect(effectiveKeywords(s.room, gear.id, s.host)).toContain("Temporary");
    s.as("p1").endTurn().expectOk();
    expect(effectiveKeywords(s.room, gear.id, s.host)).toContain("Temporary");
    settle(s);
    expect(zoneOf(s, gear.id)).toBe("trash");
  });

  it("[C:Facebreaker][R424.1] stuns a friendly unit and an enemy unit at the same battlefield", () => {
    const s = withCards(["Facebreaker"]);
    const mine = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    const theirs = place(s, "p2", "Astral Heron", "battlefieldA");
    const elsewhere = place(s, "p2", "Stellacorn Herder", "battlefieldB");
    fund(s, "p1", "Facebreaker");
    s.as("p1")
      .play("Facebreaker", { choices: { "target:0": mine.id, "target:1": elsewhere.id } })
      .expectError("illegal_target");
    s.as("p1")
      .play("Facebreaker", { choices: { "target:0": mine.id, "target:1": theirs.id } })
      .expectOk();
    drain(s);
    expect(s.room.rules!.objects[mine.id]?.stunned).toBe(true);
    expect(s.room.rules!.objects[theirs.id]?.stunned).toBe(true);
  });

  it("[C:Find Your Center][R366.2.a][R431.2.a] costs [2] less if an opponent is within 3 of the Victory Score; draw 1, channel 1 exhausted", () => {
    const s = withCards(["Find Your Center"]);
    const card = s.handCard("p1", "Find Your Center")!;
    expect(costAdjustments(s.room, s.host, { playerId: "p1", cardId: card.id })).toEqual([]);
    s.host.setScore(s.room, "p2", s.host.victoryScore(s.room) - 3);
    expect(costAdjustments(s.room, s.host, { playerId: "p1", cardId: card.id })).toEqual([
      expect.objectContaining({ energy: -2 }),
    ]);
    s.room.rules!.pools.p1 = { energy: 1, power: {} };
    const hand = boardOf(s, "p1").hand.length;
    const runes = boardOf(s, "p1").runeArea.length;
    for (const rune of boardOf(s, "p1").runeArea) rune.exhausted = true;
    s.as("p1").play("Find Your Center").expectOk();
    drain(s);
    expect(boardOf(s, "p1").hand.length).toBe(hand - 1 + 1);
    expect(boardOf(s, "p1").runeArea.length).toBe(runes + 1);
  });

  it("[C:Icathian Rain][R355.7][R418.1.c] deals 2 to a unit six times (separate targets, possibly the same unit)", () => {
    const s = withCards(["Icathian Rain"]);
    const a = place(s, "p2", "Astral Heron", "base");
    const b = place(s, "p2", "Whiteflame Protector", "battlefieldA");
    fund(s, "p1", "Icathian Rain");
    const choices = {
      "target:0": a.id,
      "target:1": a.id,
      "target:2": a.id,
      "target:3": b.id,
      "target:4": b.id,
      "target:5": b.id,
    };
    s.as("p1").play("Icathian Rain", { choices }).expectOk();
    drain(s);
    expect(s.room.rules!.objects[a.id]?.damage).toBe(6);
    expect(s.room.rules!.objects[b.id]?.damage).toBe(6);
  });

  it("[C:Imperial Decree][R391.2][R393] when any unit takes damage this turn, kill it", () => {
    const s = withCards(["Imperial Decree", "Falling Comet"]);
    const big = place(s, "p2", "Whiteflame Protector", "battlefieldA"); // 8 Might: survives 6 damage
    fund(s, "p1", "Imperial Decree");
    s.as("p1").play("Imperial Decree").expectOk();
    drain(s);
    fund(s, "p1", "Falling Comet");
    s.as("p1")
      .play("Falling Comet", { choices: { "target:0": big.id } })
      .expectOk();
    drain(s);
    expect(zoneOf(s, big.id)).toBe("trash");
  });

  it("[C:Get Excited!][R423.1.a][R418.1.b] discard 1; deal its Energy cost to a unit at a battlefield", () => {
    const s = withCards(["Get Excited!", "Astral Heron", "Gust"]);
    const enemy = place(s, "p2", "Whiteflame Protector", "battlefieldA");
    handOnly(s, "p1", ["Get Excited!", "Astral Heron", "Gust"]);
    fund(s, "p1", "Get Excited!");
    s.as("p1")
      .play("Get Excited!", { choices: { "target:0": enemy.id } })
      .expectOk();
    drain(s);
    s.expectPrompt("choose-card", "p1");
    const heron = s.handCard("p1", "Astral Heron")!;
    pick(s, heron.id);
    drain(s);
    expect(zoneOf(s, heron.id)).toBe("trash");
    // Astral Heron's Energy cost is 7.
    expect(s.room.rules!.objects[enemy.id]?.damage).toBe(7);
  });

  it("[C:Convergent Mutation][R479.4.b][R479.4.c] increases a friendly unit's Might to another friendly unit's this turn", () => {
    const s = withCards(["Convergent Mutation"]);
    const small = place(s, "p1", "Treasure Hunter", "base"); // 1
    const big = place(s, "p1", "Astral Heron", "base"); // 7
    fund(s, "p1", "Convergent Mutation");
    s.as("p1")
      .play("Convergent Mutation", { choices: { "target:0": small.id, "target:1": big.id } })
      .expectOk();
    drain(s);
    expect(effectiveMight(s.room, small.id, s.host)).toBe(7);
    expect(effectiveMight(s.room, big.id, s.host)).toBe(7);

    // Choosing a smaller unit as the reference does not decrease the Might.
    const t = withCards(["Convergent Mutation"]);
    const x = place(t, "p1", "Astral Heron", "base");
    const y = place(t, "p1", "Treasure Hunter", "base");
    fund(t, "p1", "Convergent Mutation");
    t.as("p1")
      .play("Convergent Mutation", { choices: { "target:0": x.id, "target:1": y.id } })
      .expectOk();
    drain(t);
    expect(effectiveMight(t.room, x.id, t.host)).toBe(7);
  });

  it("[C:Dragon's Rage][R387][R355.5.b][R418.6.b] move an enemy unit; then it and another enemy unit at its destination deal damage to each other", () => {
    const s = withCards(["Dragon's Rage"]);
    const moved = place(s, "p2", "Caitlyn, Patrolling", "base"); // 3
    const other = place(s, "p2", "Astral Heron", "battlefieldA"); // 7
    fund(s, "p1", "Dragon's Rage");
    s.as("p1")
      .play("Dragon's Rage", { choices: { "target:0": moved.id, destination: "battlefieldA" } })
      .expectOk();
    drain(s);
    if (s.room.rules!.prompt) pick(s, other.id);
    drain(s);
    expect(zoneOf(s, moved.id)).toBe("trash");
    expect(s.room.rules!.objects[other.id]?.damage).toBe(3);
  });
});

describe("Origins A–N — triggers and costs", () => {
  it("[C:Mistfall][R740.4.a.2][R405.2] when you buff a friendly unit, you may pay [Body] and exhaust this to ready it", () => {
    const s = withCards(["Mistfall", "Arena Bar"]);
    const mistfall = place(s, "p1", "Mistfall", "base");
    const bar = place(s, "p1", "Arena Bar", "base");
    const unit = place(s, "p1", "Caitlyn, Patrolling", "base", { exhausted: true });
    s.room.rules!.pools.p1 = { energy: 0, power: { Body: 1 } };
    s.as("p1")
      .apply({ type: "rules_activate", objectId: bar.id, ability: "activated:0" })
      .expectOk();
    for (let guard = 0; guard < 8 && s.host.isExhausted(s.room, unit.id); guard += 1) {
      const prompt = s.room.rules!.prompt;
      if (prompt) answer(s, { optionIds: ["yes"] });
      else if (s.room.rules!.priority && s.room.rules!.chain.length > 0)
        s.as(s.room.rules!.priority).pass().expectOk();
      else break;
    }
    expect(s.room.rules!.objects[unit.id]?.buffs).toBe(1);
    expect(s.host.isExhausted(s.room, unit.id)).toBe(false);
    expect(s.host.isExhausted(s.room, mistfall.id)).toBe(true);
    expect(s.room.rules!.pools.p1!.power.Body ?? 0).toBe(0);
  });

  it("[C:Cruel Patron][R204.2][R357.2] as an additional cost to play me, kill a friendly unit", () => {
    const s = withCards(["Cruel Patron"]);
    fund(s, "p1", "Cruel Patron");
    s.as("p1").play("Cruel Patron").expectError("insufficient_resources");
    const victim = place(s, "p1", "Treasure Hunter", "base");
    s.as("p1").play("Cruel Patron").expectOk();
    expect(zoneOf(s, victim.id)).toBe("trash");
    expect(cardIn(s, "p1", "base", "Cruel Patron")).toBeTruthy();
  });

  it("[C:Mindsplitter][R425.1][R423.1] when you play me, an opponent reveals their hand; you choose a card and they discard it", () => {
    const s = withCards(["Mindsplitter"], ["Gust", "Defy"]);
    handOnly(s, "p2", ["Gust", "Defy"]);
    fund(s, "p1", "Mindsplitter");
    s.as("p1").play("Mindsplitter").expectOk();
    passBoth(s);
    s.expectPrompt("choose-card", "p1");
    const defy = s.handCard("p2", "Defy")!;
    pick(s, defy.id);
    drain(s);
    expect(zoneOf(s, defy.id)).toBe("trash");
    expect(boardOf(s, "p2").hand.map((card) => card.name)).toEqual(["Gust"]);
  });
});
