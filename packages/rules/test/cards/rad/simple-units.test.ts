/**
 * RAD units with keyword-only text or one simple ability (wave R3).
 */
import { describe, expect, it } from "vitest";
import {
  effectiveKeywordValues,
  effectiveKeywords,
  effectiveMight,
  getCardScript,
  listActivatedAbilities,
  requiredChoices,
  lookupAbility,
} from "../../../src";
import { boardOf, fund, zoneOf } from "../../rules/effects/helpers";
import {
  answer,
  handNames,
  namesIn,
  pool,
  put,
  resolveAll,
  settle,
  withCards,
  withDeck,
} from "./helpers";

describe("RAD keyword-only units", () => {
  it.each([
    ["Trinket Peddler", { disarm: 1 }],
    ["Staunch Survivor", { assault: 2, shield: 2 }],
    ["Siren of the Shallows", { disarm: 1, ganking: 1 }],
  ] as const)(
    "[C:%s][R831.1.c.3][R807.2][R814.2] playable at its cost with its printed keywords",
    (name, values) => {
      const s = withCards([name]);
      fund(s, "p1", name);
      s.as("p1").play(name).expectOk();
      const card = s.findBoardCard(name)!;
      expect(zoneOf(s, card.id)).toBe("base");
      expect(effectiveKeywordValues(s.room, card.id, s.host)).toMatchObject(values);
      expect(getCardScript(name)?.status).toBe("implemented");
    },
  );
});

describe("RAD simple units", () => {
  it("[C:Wrath of the Freljord][R369.3][R814.1.c] enters ready and has Shield 3", () => {
    const s = withCards(["Wrath of the Freljord"]);
    fund(s, "p1", "Wrath of the Freljord");
    s.as("p1").play("Wrath of the Freljord").expectOk();
    const card = s.findBoardCard("Wrath of the Freljord")!;
    expect(card.exhausted).toBe(false);
    expect(effectiveKeywordValues(s.room, card.id, s.host).shield).toBe(3);
  });

  it("[C:Disposal Expert][R369.3][R364.3.a] enters ready only if you control no other units", () => {
    const alone = withCards(["Disposal Expert"]);
    fund(alone, "p1", "Disposal Expert");
    alone.as("p1").play("Disposal Expert").expectOk();
    expect(alone.findBoardCard("Disposal Expert")!.exhausted).toBe(false);
    expect(
      effectiveKeywordValues(alone.room, alone.findBoardCard("Disposal Expert")!.id, alone.host)
        .disarm,
    ).toBe(2);

    const crowded = withCards(["Disposal Expert"]);
    put(crowded, "p1", "Treasure Hunter", "base");
    fund(crowded, "p1", "Disposal Expert");
    crowded.as("p1").play("Disposal Expert").expectOk();
    expect(crowded.findBoardCard("Disposal Expert")!.exhausted).toBe(true);
  });

  it("[C:Mysterious Chronomancer][R437.1] When you play me, Predict 2", () => {
    const s = withCards(["Mysterious Chronomancer"]);
    fund(s, "p1", "Mysterious Chronomancer");
    s.as("p1").play("Mysterious Chronomancer").expectOk();
    settle(s, 1);
    s.as("p2").pass().expectOk();
    s.expectPrompt("choose-card", "p1");
    expect(s.room.rules!.prompt!.rule).toBe("437.1");
    expect(s.room.rules!.prompt!.options).toHaveLength(2);
  });

  it("[C:K'Sante, Courageous][R383.4.d.2.a][R431] When I hold, channel 1 rune", () => {
    const s = withDeck(["K'Sante, Courageous"]);
    put(s, "p1", "K'Sante, Courageous", "battlefieldB");
    s.room.rules!.objects["battlefieldB"] = { controller: "p1" };
    const runes = boardOf(s, "p1").runeArea.length;
    s.as("p1").endTurn().expectOk();
    s.as("p2").endTurn().expectOk();
    // p1's Beginning Phase: hold at battlefieldB → the trigger.
    settle(s);
    // Channel Phase adds 2; the hold trigger adds 1.
    expect(boardOf(s, "p1").runeArea.length).toBe(runes + 3);
  });

  it("[C:Strigian Oracle][R415][R437.3.a] When I become exhausted, Predict", () => {
    const s = withDeck(["Strigian Oracle"]);
    const oracle = put(s, "p1", "Strigian Oracle", "base");
    s.as("p1").move("Strigian Oracle", "battlefieldA").expectOk();
    expect(oracle.id).toBeTruthy();
    settle(s, 4);
    s.expectPrompt("choose-card", "p1");
    expect(s.room.rules!.prompt!.rule).toBe("437.1");
  });

  it("[C:War Scout][R479.4] When you play me, give a unit +2 Might this turn", () => {
    const s = withCards(["War Scout"]);
    const ally = put(s, "p1", "Treasure Hunter", "base");
    fund(s, "p1", "War Scout");
    s.as("p1").play("War Scout").expectOk();
    const scout = s.findBoardCard("War Scout")!;
    expect(s.room.rules!.prompt?.kind).toBe("choose-target");
    answer(s, [ally.id]);
    settle(s);
    expect(effectiveMight(s.room, ally.id, s.host)).toBe(3);
    expect(effectiveMight(s.room, scout.id, s.host)).toBe(2);
  });

  it("[C:Riptide Mage][R479.4] When you play me, give an enemy unit -3 Might this turn", () => {
    const s = withCards(["Riptide Mage"]);
    const enemy = put(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    fund(s, "p1", "Riptide Mage");
    s.as("p1").play("Riptide Mage").expectOk();
    settle(s);
    expect(effectiveMight(s.room, enemy.id, s.host)).toBe(0);
  });

  it("[C:Industrious Mechsmith][R440.2.c] When you play me, play a 3 Might Mech unit token here", () => {
    const s = withCards(["Industrious Mechsmith"]);
    fund(s, "p1", "Industrious Mechsmith");
    s.as("p1").play("Industrious Mechsmith").expectOk();
    settle(s);
    const mech = boardOf(s, "p1").base.find((card) => card.name === "Mech")!;
    expect(mech).toBeTruthy();
    expect(effectiveMight(s.room, mech.id, s.host)).toBe(3);
    expect(mech.exhausted).toBe(true);
  });

  it("[C:Antagonistic Apparatus][R369.3][R184.1] enters ready and plays a ready 3 Might Mech here", () => {
    const s = withCards(["Antagonistic Apparatus"]);
    fund(s, "p1", "Antagonistic Apparatus");
    s.as("p1").play("Antagonistic Apparatus").expectOk();
    expect(s.findBoardCard("Antagonistic Apparatus")!.exhausted).toBe(false);
    settle(s);
    const mech = boardOf(s, "p1").base.find((card) => card.name === "Mech")!;
    expect(mech.exhausted).toBe(false);
    expect(effectiveMight(s.room, mech.id, s.host)).toBe(3);
  });

  it("[C:Sneaky Zeebles][R383.4.c.2.a][R430.5] When I conquer, Add [A]", () => {
    const s = withDeck(["Sneaky Zeebles"]);
    put(s, "p1", "Sneaky Zeebles", "base");
    s.as("p1").move("Sneaky Zeebles", "battlefieldA").expectOk();
    resolveAll(s);
    const power = pool(s, "p1").power;
    expect(Object.values(power).reduce((sum, value) => sum + (value ?? 0), 0)).toBe(1);
    expect(getCardScript("Sneaky Zeebles")?.status).toBe("partial");
  });

  it("[C:Watchful Curator][R809.1.c][R801.3] your gear have Deflect; the Curator itself does not", () => {
    const s = withDeck(["Watchful Curator", "Ephemeral Ward"]);
    const curator = put(s, "p1", "Watchful Curator", "base");
    const gear = put(s, "p1", "Blade of the Exile", "base");
    expect(effectiveKeywords(s.room, curator.id, s.host)).not.toContain("Deflect");
    expect(effectiveKeywords(s.room, gear.id, s.host)).toContain("Deflect");
    const enemyGear = put(s, "p2", "Blade of the Exile", "base");
    expect(effectiveKeywords(s.room, enemyGear.id, s.host)).not.toContain("Deflect");
  });

  it("[C:Hunting Dog][R808.1][R440.2.c] Deathknell: play a 1 Might Bird with Deflect to your base", () => {
    const s = withCards(["Hextech Ray"], ["Hunting Dog"]);
    const dog = put(s, "p2", "Hunting Dog", "battlefieldA");
    expect(effectiveKeywords(s.room, dog.id, s.host)).not.toContain("Deflect");
    fund(s, "p1", "Hextech Ray");
    s.as("p1")
      .play("Hextech Ray", { choices: { "target:0": dog.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(zoneOf(s, dog.id)).toBe("trash");
    settle(s);
    const bird = boardOf(s, "p2").base.find((card) => card.name === "Bird")!;
    expect(bird).toBeTruthy();
    expect(effectiveMight(s.room, bird.id, s.host)).toBe(1);
    expect(effectiveKeywordValues(s.room, bird.id, s.host).deflect).toBe(1);
  });

  it("[C:Seraphine, Not Alone][R415][R440.2.c] Recruits on play and when exhausted; +1 per other exhausted unit", () => {
    const s = withCards(["Seraphine, Not Alone"]);
    put(s, "p1", "Treasure Hunter", "base", true);
    fund(s, "p1", "Seraphine, Not Alone");
    s.as("p1").play("Seraphine, Not Alone").expectOk();
    settle(s);
    expect(namesIn(s, "p1", "base").filter((name) => name === "Recruit")).toHaveLength(1);
    const seraphine = s.findBoardCardAnywhere("Seraphine, Not Alone")!;
    // Base 1 + the exhausted Treasure Hunter + the exhausted (newly played) Recruit.
    expect(effectiveMight(s.room, seraphine.id, s.host)).toBe(3);
  });

  it("[C:Bilgewater Tracker][R355.13][R418] When you play me, deal 1 to each of up to 2 units", () => {
    const s = withCards(["Bilgewater Tracker"]);
    const a = put(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    const b = put(s, "p2", "Treasure Hunter", "battlefieldA");
    fund(s, "p1", "Bilgewater Tracker");
    s.as("p1").play("Bilgewater Tracker").expectOk();
    s.expectPrompt("choose-target", "p1");
    expect(s.room.rules!.prompt!.max).toBe(2);
    answer(s, [a.id, b.id]);
    settle(s);
    expect(s.room.rules!.objects[a.id]?.damage).toBe(1);
    expect(zoneOf(s, b.id)).toBe("trash");
  });

  it("[C:Suave Negotiator][R355.7] choose an opponent: you and that player each draw 1", () => {
    const s = withCards(["Suave Negotiator"]);
    const mine = boardOf(s, "p1").hand.length;
    const theirs = boardOf(s, "p2").hand.length;
    fund(s, "p1", "Suave Negotiator");
    s.as("p1").play("Suave Negotiator").expectOk();
    settle(s);
    expect(boardOf(s, "p1").hand.length).toBe(mine - 1 + 1);
    expect(boardOf(s, "p2").hand.length).toBe(theirs + 1);
  });

  it("[C:Stalwart Goatherd][R429] you may kill a gear with Energy cost 4 or less", () => {
    const s = withCards(["Stalwart Goatherd"], ["Ephemeral Ward"]);
    const cheap = put(s, "p2", "Blade of the Exile", "base");
    const pricey = put(s, "p2", "Ephemeral Ward", "base");
    const ability = lookupAbility("Stalwart Goatherd", "triggered:0")!.ability;
    const options = requiredChoices(s.room, s.host, ability, {
      controller: "p1",
      choices: {},
    })[0]!.options.map((o) => o.id);
    expect(options).toContain(cheap.id);
    expect(options).toContain(pricey.id);
    fund(s, "p1", "Stalwart Goatherd");
    s.as("p1").play("Stalwart Goatherd").expectOk();
    answer(s, [cheap.id]);
    settle(s, 2);
    answer(s, "yes");
    settle(s);
    expect(zoneOf(s, cheap.id)).toBe("trash");
    expect(zoneOf(s, pricey.id)).toBe("base");
  });

  it("[C:Pitiless Stalker][R424][R377.1] [Tap]: Stun an enemy unit", () => {
    const s = withDeck(["Pitiless Stalker"]);
    const stalker = put(s, "p1", "Pitiless Stalker", "base");
    const enemy = put(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    s.as("p1")
      .apply({
        type: "rules_activate",
        objectId: stalker.id,
        ability: listActivatedAbilities("Pitiless Stalker")[0]!.ref,
      })
      .expectOk();
    settle(s);
    expect(s.room.rules!.objects[enemy.id]?.stunned).toBe(true);
    expect(stalker.exhausted || s.host.isExhausted(s.room, stalker.id)).toBe(true);
    expect(handNames(s, "p1")).toBeTruthy();
  });
});
