/**
 * Origins A–N, batch 1: keyword-only/vanilla units and simple play/conquer triggers.
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
import { cardIn, drain, passBoth, pick, settle, toTrash, withCards } from "./helpers";

describe("Origins A–N — keyword-only and vanilla units", () => {
  const rows: Array<{ name: string; keywords: string[]; might: number; tags: string }> = [
    { name: "Blazing Scorcher", keywords: ["Accelerate"], might: 5, tags: "[R805.1.b]" },
    { name: "Legion Rearguard", keywords: ["Accelerate"], might: 2, tags: "[R805.1.b]" },
    { name: "Daring Poro", keywords: ["Assault"], might: 2, tags: "[R807.1.c]" },
    {
      name: "Jeweled Colossus",
      keywords: ["Vision", "Shield"],
      might: 5,
      tags: "[R817.1.b][R814.1.c]",
    },
    { name: "Mystic Poro", keywords: ["Vision"], might: 2, tags: "[R817.1.b]" },
    { name: "Mega-Mech", keywords: [], might: 8, tags: "[R143.4]" },
    { name: "Mountain Drake", keywords: [], might: 10, tags: "[R143.4]" },
  ];
  for (const row of rows) {
    it(`[C:${row.name}]${row.tags} is played at its printed cost with its printed keywords`, () => {
      const s = withCards([row.name]);
      fund(s, "p1", row.name);
      s.as("p1").play(row.name).expectOk();
      const card = cardIn(s, "p1", "base", row.name)!;
      expect(card).toBeTruthy();
      expect(s.room.rules!.pools.p1).toEqual({ energy: 0, power: expect.anything() });
      expect(effectiveMight(s.room, card.id, s.host)).toBe(row.might);
      for (const keyword of row.keywords)
        expect(effectiveKeywords(s.room, card.id, s.host)).toContain(keyword);
      expect(getCardScript(row.name)?.status).toBe("implemented");
    });
  }

  it("[C:Blazing Scorcher][C:Legion Rearguard][R805.1.b][R805.6] paying Accelerate makes the unit enter ready", () => {
    for (const name of ["Blazing Scorcher", "Legion Rearguard"]) {
      const s = withCards([name]);
      fund(s, "p1", name);
      s.room.rules!.pools.p1!.energy += 1;
      s.room.rules!.pools.p1!.power = { ...s.room.rules!.pools.p1!.power, Fury: 1 };
      const card = s.handCard("p1", name)!;
      s.as("p1")
        .apply({ type: "rules_play", cardId: card.id, optionalCosts: ["accelerate"] } as never)
        .expectOk();
      expect(cardIn(s, "p1", "base", name)!.exhausted).toBe(false);
    }
  });

  it("[C:Daring Poro][R807.1.c] has Assault 1", () => {
    const s = withCards(["Daring Poro"]);
    const poro = place(s, "p1", "Daring Poro", "base");
    expect(effectiveKeywordValues(s.room, poro.id, s.host).assault).toBe(1);
  });

  it("[C:Mystic Poro][C:Jeweled Colossus][R817.1.b] Vision predicts when played", () => {
    for (const name of ["Mystic Poro", "Jeweled Colossus"]) {
      const s = withCards([name]);
      fund(s, "p1", name);
      s.as("p1").play(name).expectOk();
      expect(s.room.rules!.chain[0]?.abilityRef).toBe("keyword:vision:1");
      passBoth(s);
      s.expectPrompt("choose-card", "p1");
      expect(s.room.rules!.prompt!.rule).toBe("437.1");
    }
  });
});

describe("Origins A–N — play and conquer triggers", () => {
  it("[C:Lecturing Yordle][R383.4.a] when you play me, draw 1 (Tank is printed)", () => {
    const s = withCards(["Lecturing Yordle"]);
    const before = boardOf(s, "p1").hand.length;
    fund(s, "p1", "Lecturing Yordle");
    s.as("p1").play("Lecturing Yordle").expectOk();
    expect(s.room.rules!.chain[0]?.cardName).toBe("Lecturing Yordle");
    passBoth(s);
    expect(boardOf(s, "p1").hand.length).toBe(before);
    const yordle = cardIn(s, "p1", "base", "Lecturing Yordle")!;
    expect(effectiveKeywords(s.room, yordle.id, s.host)).toContain("Tank");
  });

  it("[C:Chemtech Enforcer][R423.1.a][R807.1.c] when you play me, discard 1 (chosen); I have Assault 2", () => {
    const s = withCards(["Chemtech Enforcer", "Rebuke", "Defy"]);
    fund(s, "p1", "Chemtech Enforcer");
    s.as("p1").play("Chemtech Enforcer").expectOk();
    passBoth(s);
    s.expectPrompt("choose-card", "p1");
    const choice = s.room.rules!.prompt!.options![0]!.id;
    const handBefore = boardOf(s, "p1").hand.length;
    pick(s, choice);
    expect(boardOf(s, "p1").hand.length).toBe(handBefore - 1);
    expect(zoneOf(s, choice)).toBe("trash");
    const enforcer = cardIn(s, "p1", "base", "Chemtech Enforcer")!;
    expect(effectiveKeywordValues(s.room, enforcer.id, s.host).assault).toBe(2);
  });

  it("[C:Harnessed Dragon][R429.2] when you play me, kill an enemy unit", () => {
    const s = withCards(["Harnessed Dragon"]);
    const enemy = place(s, "p2", "Stellacorn Herder", "battlefieldA");
    place(s, "p1", "Treasure Hunter", "base");
    fund(s, "p1", "Harnessed Dragon");
    s.as("p1").play("Harnessed Dragon").expectOk();
    // Only enemy units are legal choices (one here, so it is bound automatically, 411.2).
    expect(s.room.rules!.chain[0]?.choices["target:0"]).toBe(enemy.id);
    passBoth(s);
    expect(zoneOf(s, enemy.id)).toBe("trash");
  });

  it("[C:First Mate][R416.1] when you play me, ready another unit", () => {
    const s = withCards(["First Mate"]);
    const friend = place(s, "p1", "Caitlyn, Patrolling", "base", { exhausted: true });
    fund(s, "p1", "First Mate");
    s.as("p1").play("First Mate").expectOk();
    expect(s.room.rules!.chain[0]?.choices["target:0"]).toBe(friend.id);
    passBoth(s);
    expect(s.host.isExhausted(s.room, friend.id)).toBe(false);
    expect(cardIn(s, "p1", "base", "First Mate")!.exhausted).toBe(true);
  });

  it("[C:Faithful Manufactor][R440.2.c][R187.1] when you play me, play a 1 Might Recruit here", () => {
    const s = withCards(["Faithful Manufactor"]);
    place(s, "p1", "Treasure Hunter", "battlefieldA");
    setControl(s.room, "battlefieldA", "p1");
    fund(s, "p1", "Faithful Manufactor");
    s.as("p1").play("Faithful Manufactor", { location: "battlefieldA" }).expectOk();
    passBoth(s);
    const recruit = cardIn(s, "p1", "battlefieldA", "Recruit")!;
    expect(recruit).toBeTruthy();
    expect(effectiveMight(s.room, recruit.id, s.host)).toBe(1);
    expect(cardIn(s, "p1", "base", "Recruit")).toBeUndefined();
  });

  it("[C:Kadregrin the Infernal][R708] when you play me, draw 1 for each of your Mighty units", () => {
    const s = withCards(["Kadregrin the Infernal"]);
    place(s, "p1", "Astral Heron", "base"); // 7 Might
    place(s, "p1", "Treasure Hunter", "base"); // 1 Might
    place(s, "p2", "Whiteflame Protector", "base"); // enemy: not counted
    const before = boardOf(s, "p1").hand.length;
    fund(s, "p1", "Kadregrin the Infernal");
    s.as("p1").play("Kadregrin the Infernal").expectOk();
    passBoth(s);
    // Kadregrin (9) and Astral Heron (7): draw 2.
    expect(boardOf(s, "p1").hand.length).toBe(before - 1 + 2);
  });

  it("[C:Cemetery Attendant][R355.7] when you play me, return a unit from your trash to your hand", () => {
    const s = withCards(["Cemetery Attendant"]);
    const dead = toTrash(s, "p1", "Astral Heron");
    toTrash(s, "p1", "Rebuke");
    toTrash(s, "p2", "Stellacorn Herder");
    fund(s, "p1", "Cemetery Attendant");
    s.as("p1").play("Cemetery Attendant").expectOk();
    // The only unit in p1's trash is chosen automatically (an enemy trash is not "your trash").
    expect(s.room.rules!.chain[0]?.choices["target:0"]).toBe(dead.id);
    passBoth(s);
    expect(zoneOf(s, dead.id)).toBe("hand");
  });

  it("[C:Kai'Sa, Survivor][R383.4.c] when I conquer, draw 1", () => {
    const s = withCards(["Kai'Sa, Survivor"]);
    place(s, "p1", "Kai'Sa, Survivor", "base");
    const before = boardOf(s, "p1").hand.length;
    s.as("p1").move("Kai'Sa, Survivor", "battlefieldA").expectOk();
    settle(s, () => s.room.rules!.chain.some((item) => item.cardName === "Kai'Sa, Survivor"));
    expect(s.room.rules!.chain.some((item) => item.cardName === "Kai'Sa, Survivor")).toBe(true);
    drain(s);
    settle(s);
    expect(boardOf(s, "p1").hand.length).toBe(before + 1);
  });
});
