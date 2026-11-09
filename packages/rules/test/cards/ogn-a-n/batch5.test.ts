/**
 * Origins A–N, batch 5: Deathknell, move/hold/conquer triggers, buff spending, restrictions.
 */
import { describe, expect, it } from "vitest";
import { effectiveMight, getCardScript, restrictionFor } from "../../../src";
import { boardOf, fund, place, zoneOf } from "../../rules/effects/helpers";
import { setControl } from "../../rules/combat/helpers";
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

describe("Origins A–N — Deathknell", () => {
  it("[C:Kog'Maw, Caustic][R808.1.c][R808.1.d.3] when I die, deal 4 to all units at my battlefield", () => {
    const s = withCards(["Hextech Ray"], ["Kog'Maw, Caustic"]);
    const kog = place(s, "p2", "Kog'Maw, Caustic", "battlefieldA");
    const friend = place(s, "p2", "Astral Heron", "battlefieldA");
    const enemy = place(s, "p1", "Whiteflame Protector", "battlefieldA");
    const elsewhere = place(s, "p1", "Stellacorn Herder", "base");
    fund(s, "p1", "Hextech Ray");
    s.as("p1")
      .play("Hextech Ray", { choices: { "target:0": kog.id } })
      .expectOk();
    drain(s);
    expect(zoneOf(s, kog.id)).toBe("trash");
    expect(s.room.rules!.objects[friend.id]?.damage).toBe(4);
    expect(s.room.rules!.objects[enemy.id]?.damage).toBe(4);
    expect(s.room.rules!.objects[elsewhere.id]?.damage).toBeUndefined();
  });

  it("[C:Machine Evangel][R808.1.c][R440.2.c] when I die, play three 1 Might Recruits into your base", () => {
    const s = withCards(["Hextech Ray"], ["Machine Evangel"]);
    const evangel = place(s, "p2", "Machine Evangel", "battlefieldA");
    fund(s, "p1", "Hextech Ray");
    s.as("p1")
      .play("Hextech Ray", { choices: { "target:0": evangel.id } })
      .expectOk();
    s.room.rules!.objects[evangel.id] = {
      ...(s.room.rules!.objects[evangel.id] ?? {}),
      baseMight: 3,
    };
    drain(s);
    expect(zoneOf(s, evangel.id)).toBe("trash");
    expect(boardOf(s, "p2").base.filter((card) => card.name === "Recruit")).toHaveLength(3);
  });

  it("[C:Ekko, Recurrent][R808.1.c][R403.1] when I die, you may recycle me to ready your runes", () => {
    const s = withCards(["Hextech Ray"], ["Ekko, Recurrent"]);
    const ekko = place(s, "p2", "Ekko, Recurrent", "battlefieldA");
    s.room.rules!.objects[ekko.id] = { baseMight: 3 };
    for (const rune of boardOf(s, "p2").runeArea) rune.exhausted = true;
    fund(s, "p1", "Hextech Ray");
    s.as("p1")
      .play("Hextech Ray", { choices: { "target:0": ekko.id } })
      .expectOk();
    drain(s);
    s.expectPrompt(undefined, "p2");
    answer(s, { optionIds: ["yes"] });
    drain(s);
    expect(boardOf(s, "p2").deck[0]!.id).toBe(ekko.id);
    expect(boardOf(s, "p2").runeArea.every((rune) => !rune.exhausted)).toBe(true);
    expect(getCardScript("Ekko, Recurrent")?.status).toBe("partial");
  });
});

describe("Origins A–N — move, hold, conquer and play triggers", () => {
  it("[C:Maddened Marauder][R421.2] when you play me, move a unit from a battlefield to its base", () => {
    const s = withCards(["Maddened Marauder"]);
    const enemy = place(s, "p2", "Astral Heron", "battlefieldA");
    fund(s, "p1", "Maddened Marauder");
    s.as("p1").play("Maddened Marauder").expectOk();
    expect(s.room.rules!.chain[0]?.choices["target:0"]).toBe(enemy.id);
    passBoth(s);
    expect(zoneOf(s, enemy.id)).toBe("base");
  });

  it("[C:Noxian Drummer][R383.2.a.1][R440.2.c] when I move to a battlefield, play a Recruit here", () => {
    const s = withCards(["Noxian Drummer"]);
    place(s, "p1", "Noxian Drummer", "base");
    s.as("p1").move("Noxian Drummer", "battlefieldB").expectOk();
    settle(s, () => !!cardIn(s, "p1", "battlefieldB", "Recruit"));
    expect(cardIn(s, "p1", "battlefieldB", "Recruit")).toBeTruthy();
  });

  it("[C:Navori Fighting Pit][R383.4.d] when you hold here, buff a unit here", () => {
    const s = withCards([], [], { battlefields: { p2: "Navori Fighting Pit" } });
    const unit = place(s, "p2", "Astral Heron", "battlefieldB");
    setControl(s.room, "battlefieldB", "p2");
    s.as("p1").endTurn().expectOk();
    expect(s.room.rules!.chain.some((item) => item.cardName === "Navori Fighting Pit")).toBe(true);
    drain(s);
    expect(s.room.rules!.objects[unit.id]?.buffs).toBe(1);
  });

  it("[C:Monastery of Hirana][R383.4.c][R702.2.b] when you conquer here, you may spend a buff to draw 1", () => {
    const s = withCards([], [], { battlefields: { p2: "Monastery of Hirana" } });
    const unit = place(s, "p1", "Caitlyn, Patrolling", "base");
    s.room.rules!.objects[unit.id] = { buffs: 1 };
    const hand = boardOf(s, "p1").hand.length;
    s.as("p1").move("Caitlyn, Patrolling", "battlefieldB").expectOk();
    settle(s);
    s.expectPrompt(undefined, "p1");
    answer(s, { optionIds: ["yes"] });
    settle(s);
    expect(s.room.rules!.objects[unit.id]?.buffs).toBeUndefined();
    expect(boardOf(s, "p1").hand.length).toBe(hand + 1);
  });

  it("[C:Kinkou Monk][R355.13] when you play me, buff up to two other friendly units", () => {
    const s = withCards(["Kinkou Monk"]);
    const a = place(s, "p1", "Caitlyn, Patrolling", "base");
    const b = place(s, "p1", "Stellacorn Herder", "base");
    const c = place(s, "p1", "Treasure Hunter", "base");
    fund(s, "p1", "Kinkou Monk");
    s.as("p1").play("Kinkou Monk").expectOk();
    s.expectPrompt(undefined, "p1");
    expect(promptOptions(s)).toEqual(expect.arrayContaining([a.id, b.id, c.id]));
    pick(s, a.id, b.id);
    drain(s);
    expect(s.room.rules!.objects[a.id]?.buffs).toBe(1);
    expect(s.room.rules!.objects[b.id]?.buffs).toBe(1);
    expect(s.room.rules!.objects[c.id]?.buffs).toBeUndefined();
    expect(
      s.room.rules!.objects[cardIn(s, "p1", "base", "Kinkou Monk")!.id]?.buffs,
    ).toBeUndefined();
  });

  it("[C:Adaptatron][R403.1][R359.3.e.14.b] when I conquer, you may kill a gear; if you do, buff me", () => {
    const s = withCards(["Adaptatron"], ["Blade of the Exile"]);
    const adaptatron = place(s, "p1", "Adaptatron", "base");
    const gear = place(s, "p2", "Blade of the Exile", "base");
    s.as("p1").move("Adaptatron", "battlefieldB").expectOk();
    settle(s);
    s.expectPrompt(undefined, "p1");
    answer(s, { optionIds: ["yes"] });
    settle(s);
    expect(zoneOf(s, gear.id)).toBe("trash");
    expect(s.room.rules!.objects[adaptatron.id]?.buffs).toBe(1);
  });

  it("[C:Albus Ferros][R702.2.b][R431.2.a] when you play me, spend any number of buffs; channel 1 rune exhausted for each", () => {
    const s = withCards(["Albus Ferros"]);
    const a = place(s, "p1", "Caitlyn, Patrolling", "base");
    const b = place(s, "p1", "Stellacorn Herder", "base");
    const c = place(s, "p1", "Treasure Hunter", "base");
    for (const unit of [a, b, c]) s.room.rules!.objects[unit.id] = { buffs: 1 };
    const runes = boardOf(s, "p1").runeArea.length;
    fund(s, "p1", "Albus Ferros");
    s.as("p1").play("Albus Ferros").expectOk();
    passBoth(s);
    s.expectPrompt("choose-card", "p1");
    pick(s, a.id, b.id);
    expect(s.room.rules!.objects[a.id]?.buffs).toBeUndefined();
    expect(s.room.rules!.objects[c.id]?.buffs).toBe(1);
    const area = boardOf(s, "p1").runeArea;
    expect(area.length).toBe(runes + 2);
    expect(area.slice(-2).every((rune) => rune.exhausted)).toBe(true);
  });

  it("[C:Dangerous Duo][R812.1.c] [Legion] when you play me, give a unit +2 Might this turn", () => {
    const s = withCards(["Dangerous Duo"]);
    fund(s, "p1", "Dangerous Duo");
    s.as("p1").play("Dangerous Duo").expectOk();
    expect(s.room.rules!.chain).toHaveLength(0);

    const t = withCards(["Treasure Hunter", "Dangerous Duo"]);
    fund(t, "p1", "Treasure Hunter");
    t.as("p1").play("Treasure Hunter").expectOk();
    const hunter = cardIn(t, "p1", "base", "Treasure Hunter")!;
    fund(t, "p1", "Dangerous Duo");
    t.as("p1")
      .play("Dangerous Duo", { choices: { "target:0": hunter.id } })
      .expectOk();
    if (t.room.rules!.prompt) pick(t, hunter.id);
    drain(t);
    expect(effectiveMight(t.room, hunter.id, t.host)).toBe(3);
  });

  it("[C:Carnivorous Snapvine][R418.6.b] when you play me, it and an enemy unit at a battlefield deal damage equal to their Mights to each other", () => {
    const s = withCards(["Carnivorous Snapvine"]);
    const enemy = place(s, "p2", "Astral Heron", "battlefieldA");
    fund(s, "p1", "Carnivorous Snapvine");
    s.as("p1").play("Carnivorous Snapvine").expectOk();
    passBoth(s);
    const vine = cardIn(s, "p1", "base", "Carnivorous Snapvine");
    // Snapvine (6) deals 6 to the Heron (7); the Heron deals 7 to the Snapvine (6), which dies.
    expect(s.room.rules!.objects[enemy.id]?.damage).toBe(6);
    expect(vine).toBeUndefined();
  });

  it("[C:Brynhir Thundersong][R054.1] when you play me, opponents can't play cards this turn", () => {
    const s = withCards(["Brynhir Thundersong"], ["Gust"]);
    fund(s, "p1", "Brynhir Thundersong");
    s.as("p1").play("Brynhir Thundersong").expectOk();
    passBoth(s);
    const gust = s.handCard("p2", "Gust")!;
    expect(
      restrictionFor(s.room, s.host, { kind: "play", playerId: "p2", cardId: gust.id }),
    ).toBeTruthy();
    const mine = boardOf(s, "p1").hand[0];
    if (mine)
      expect(
        restrictionFor(s.room, s.host, { kind: "play", playerId: "p1", cardId: mine.id }),
      ).toBeNull();
    // Next turn the restriction is gone (317.2.c).
    s.as("p1").endTurn().expectOk();
    settle(s);
    expect(
      restrictionFor(s.room, s.host, { kind: "play", playerId: "p2", cardId: gust.id }),
    ).toBeNull();
  });

  it("[C:Blastcone Fae][R479.4.b] when you play me, give a unit -2 Might this turn, to a minimum of 1", () => {
    const s = withCards(["Blastcone Fae"]);
    const enemy = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    fund(s, "p1", "Blastcone Fae");
    s.as("p1").play("Blastcone Fae").expectOk();
    s.expectPrompt(undefined, "p1");
    pick(s, enemy.id);
    drain(s);
    expect(effectiveMight(s.room, enemy.id, s.host)).toBe(1);
  });

  it("[C:Mushroom Pouch][R383.2.a.1] start of your Beginning Phase: draw 1 if you control a facedown card at a battlefield", () => {
    const s = withCards(["Mushroom Pouch", "Hidden Blade"]);
    place(s, "p1", "Mushroom Pouch", "base");
    place(s, "p1", "Treasure Hunter", "battlefieldB");
    setControl(s.room, "battlefieldB", "p1");
    const blade = place(s, "p1", "Hidden Blade", "battlefieldB");
    blade.hidden = true;
    handOnly(s, "p1", []);
    s.as("p1").endTurn().expectOk();
    s.as("p2").endTurn().expectOk();
    expect(s.room.rules!.chain.some((item) => item.cardName === "Mushroom Pouch")).toBe(true);
    drain(s);
    settle(s);
    expect(boardOf(s, "p1").hand.length).toBe(2);

    const t = withCards(["Mushroom Pouch"]);
    place(t, "p1", "Mushroom Pouch", "base");
    t.as("p1").endTurn().expectOk();
    t.as("p2").endTurn().expectOk();
    expect(t.room.rules!.chain.some((item) => item.cardName === "Mushroom Pouch")).toBe(false);
  });

  it("[C:Leona, Radiant Dawn][R424.1][R412.4] when you stun an enemy unit, buff a friendly unit", () => {
    const s = withCards(["Leona, Radiant Dawn", "Leona, Determined"]);
    place(s, "p1", "Leona, Radiant Dawn", "legend");
    const leona = place(s, "p1", "Leona, Determined", "base");
    const enemy = place(s, "p2", "Astral Heron", "battlefieldA");
    setControl(s.room, "battlefieldA", "p2");
    s.as("p1").move("Leona, Determined", "battlefieldA").expectOk();
    // Leona, Determined's attack trigger stuns the enemy; Leona, Radiant Dawn then buffs a friendly unit.
    for (let guard = 0; guard < 8 && !s.room.rules!.objects[leona.id]?.buffs; guard += 1) {
      if (s.room.rules!.prompt) break;
      const who = s.room.rules!.priority;
      if (!who) break;
      s.as(who).pass().expectOk();
    }
    expect(s.room.rules!.objects[enemy.id]?.stunned).toBe(true);
    expect(s.room.rules!.objects[leona.id]?.buffs).toBe(1);
    expect(getCardScript("Leona, Radiant Dawn")?.status).toBe("partial");
  });

  it("[C:Jinx, Rebel][R423.1] when you discard, ready me and give me +1 Might this turn", () => {
    const s = withCards(["Chemtech Enforcer", "Rebuke", "Jinx, Rebel"]);
    const jinx = place(s, "p1", "Jinx, Rebel", "base", { exhausted: true });
    fund(s, "p1", "Chemtech Enforcer");
    s.as("p1").play("Chemtech Enforcer").expectOk();
    passBoth(s);
    // One card left in hand: discarded without a choice.
    drain(s);
    expect(s.room.rules!.chain.some((item) => item.cardName === "Jinx, Rebel")).toBe(false);
    expect(s.host.isExhausted(s.room, jinx.id)).toBe(false);
    expect(effectiveMight(s.room, jinx.id, s.host)).toBe(6);
  });
});
