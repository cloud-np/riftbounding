/**
 * Vendetta Empower / Empowered cards (827 Empower, 828 Empowered, 442/443).
 */
import { describe, expect, it } from "vitest";
import { getCardScript } from "../../../src";
import {
  activate,
  addPool,
  empowered,
  keywordValue,
  keywords,
  might,
  exhaustRunes,
  place,
  setRunes,
  withCards,
  boardOf,
} from "./helpers";

describe("Vendetta: Empower passives", () => {
  it("[C:Steel Paws][R827.1.c.1][R828.1.c] Empower [7] makes me Empowered: +7 Might; not again while Empowered", () => {
    const s = withCards(["Steel Paws"]);
    const paws = place(s, "p1", "Steel Paws", "base");
    expect(might(s, paws.id)).toBe(0);
    expect(keywords(s, paws.id)).toContain("Deflect");
    exhaustRunes(s, "p1");
    addPool(s, "p1", 6);
    activate(s, "p1", paws, "activated:0").expectError("insufficient_resources");
    addPool(s, "p1", 1);
    activate(s, "p1", paws, "activated:0").expectOk();
    s.as("p2").pass().expectOk();
    expect(empowered(s, paws.id)).toBe(true);
    expect(might(s, paws.id)).toBe(7);
    addPool(s, "p1", 7);
    activate(s, "p1", paws, "activated:0").expectError("illegal_action");
  });

  it("[C:Solari Sunhawk][R727.1.b][R828.1.c] Empower [2]: +1 Might and Deflect 2 only while Empowered", () => {
    const s = withCards(["Solari Sunhawk"]);
    const hawk = place(s, "p1", "Solari Sunhawk", "base");
    expect(keywords(s, hawk.id)).not.toContain("Deflect");
    expect(keywordValue(s, hawk.id, "Deflect")).toBe(0);
    addPool(s, "p1", 2);
    activate(s, "p1", hawk, "activated:1").expectOk();
    s.as("p2").pass().expectOk();
    expect(might(s, hawk.id)).toBe(4);
    expect(keywordValue(s, hawk.id, "Deflect")).toBe(2);
    expect(getCardScript("Solari Sunhawk")?.status).toBe("partial");
  });

  it("[C:Serene Ascetic][R828.1.c] Empower [3]: Deflect and Shield 3 only while Empowered", () => {
    const s = withCards(["Serene Ascetic"]);
    const unit = place(s, "p1", "Serene Ascetic", "base");
    expect(keywords(s, unit.id)).not.toContain("Shield");
    addPool(s, "p1", 3);
    activate(s, "p1", unit, "activated:2").expectOk();
    s.as("p2").pass().expectOk();
    expect(keywords(s, unit.id)).toEqual(expect.arrayContaining(["Deflect", "Shield"]));
    expect(keywordValue(s, unit.id, "Shield")).toBe(3);
  });

  it("[C:Grumpy Rockbear][R827.1.c.3][R356.4] Empower [12] costs [1] less per rune; Deflect and Shield 3", () => {
    const s = withCards(["Grumpy Rockbear"]);
    const bear = place(s, "p1", "Grumpy Rockbear", "base");
    setRunes(s, "p1", 5);
    for (const rune of boardOf(s, "p1").runeArea) rune.exhausted = true;
    addPool(s, "p1", 6);
    activate(s, "p1", bear, "activated:2").expectError("insufficient_resources");
    addPool(s, "p1", 1);
    activate(s, "p1", bear, "activated:2").expectOk();
    s.as("p2").pass().expectOk();
    expect(s.room.rules!.pools.p1!.energy).toBe(0);
    expect(keywordValue(s, bear.id, "Shield")).toBe(3);
    expect(keywords(s, bear.id)).toContain("Deflect");
  });

  it("[C:Frostcoat Mother][R827.1.c.3][R366.2.a] Empower [12] less [1] per rune (not my play cost); +3 Might", () => {
    const s = withCards(["Frostcoat Mother", "Frostcoat Mother"]);
    setRunes(s, "p1", 8);
    for (const rune of boardOf(s, "p1").runeArea) rune.exhausted = true;
    // In hand, the ability's reduction does not change the card's own cost (3).
    addPool(s, "p1", 3);
    s.as("p1").play("Frostcoat Mother").expectOk();
    expect(s.room.rules!.pools.p1!.energy).toBe(0);
    const mother = s.findBoardCard("Frostcoat Mother")!;
    expect(might(s, mother.id)).toBe(3);
    addPool(s, "p1", 4);
    activate(s, "p1", mother, "activated:0").expectOk();
    s.as("p2").pass().expectOk();
    expect(might(s, mother.id)).toBe(6);
  });

  it("[C:Shadow Fiend][R727.1.b] Empower [2][Fury]: Assault 3 only while Empowered", () => {
    const s = withCards(["Shadow Fiend"]);
    const fiend = place(s, "p1", "Shadow Fiend", "base");
    expect(keywordValue(s, fiend.id, "Assault")).toBe(0);
    addPool(s, "p1", 2, { Fury: 1 });
    activate(s, "p1", fiend, "activated:1").expectOk();
    s.as("p2").pass().expectOk();
    expect(keywordValue(s, fiend.id, "Assault")).toBe(3);
  });

  it("[C:Kinkou Lifeblade][C:Brutal Hunter][R828.1.c] Empower: Might bonus and Ganking only while Empowered", () => {
    const s = withCards(["Kinkou Lifeblade", "Brutal Hunter"]);
    const blade = place(s, "p1", "Kinkou Lifeblade", "base");
    const hunter = place(s, "p1", "Brutal Hunter", "base");
    expect(keywords(s, blade.id)).not.toContain("Ganking");
    expect(keywords(s, hunter.id)).not.toContain("Ganking");
    addPool(s, "p1", 2);
    activate(s, "p1", blade, "activated:1").expectOk();
    s.as("p2").pass().expectOk();
    addPool(s, "p1", 3);
    activate(s, "p1", hunter, "activated:1").expectOk();
    s.as("p2").pass().expectOk();
    expect(might(s, blade.id)).toBe(5);
    expect(might(s, hunter.id)).toBe(6);
    expect(keywords(s, blade.id)).toContain("Ganking");
    expect(keywords(s, hunter.id)).toContain("Ganking");
  });

  it("[C:Legion Marauder][R204.1.b][R827.3] Empower for [1] or for [Body]: +1 Might", () => {
    const s = withCards(["Legion Marauder", "Legion Marauder"]);
    const [a, b] = [
      place(s, "p1", "Legion Marauder", "base"),
      place(s, "p1", "Legion Marauder", "base"),
    ];
    addPool(s, "p1", 1);
    activate(s, "p1", a, "activated:0").expectOk();
    s.as("p2").pass().expectOk();
    addPool(s, "p1", 0, { Body: 1 });
    activate(s, "p1", b, "activated:1").expectOk();
    s.as("p2").pass().expectOk();
    expect(might(s, a.id)).toBe(3);
    expect(might(s, b.id)).toBe(3);
  });

  it("[C:Punching Poro][R827.1.c.2] Empower — discard 1: +1 Might", () => {
    const s = withCards(["Punching Poro"]);
    const poro = place(s, "p1", "Punching Poro", "base");
    s.moveDeckCardToHand("p1", "Rebuke");
    const hand = boardOf(s, "p1").hand.length;
    activate(s, "p1", poro, "activated:0").expectOk();
    if (s.room.rules!.prompt)
      s.as("p1")
        .choose({ optionIds: [s.room.rules!.prompt.options![0]!.id] })
        .expectOk();
    s.as("p2").pass().expectOk();
    expect(boardOf(s, "p1").hand.length).toBe(hand - 1);
    expect(might(s, poro.id)).toBe(3);
  });

  it("[C:Escaped Grayback][R827.1.c.2] Empower — kill a friendly unit: +2 Might", () => {
    const s = withCards(["Escaped Grayback"]);
    const wolf = place(s, "p1", "Escaped Grayback", "base");
    const victim = place(s, "p1", "Treasure Hunter", "base");
    activate(s, "p1", wolf, "activated:0").expectOk();
    if (s.room.rules!.prompt)
      s.as("p1")
        .choose({ optionIds: [victim.id] })
        .expectOk();
    s.as("p2").pass().expectOk();
    expect(s.host.findCard(s.room, victim.id)?.zone).toBe("trash");
    expect(might(s, wolf.id)).toBe(5);
  });

  it("[C:Baccai Sandspinner][R827.1.c.3] Empower 5 costs [3] less with 4 or fewer runes; Deflect and Assault 2", () => {
    const s = withCards(["Baccai Sandspinner"]);
    const unit = place(s, "p1", "Baccai Sandspinner", "base");
    setRunes(s, "p1", 4);
    for (const rune of boardOf(s, "p1").runeArea) rune.exhausted = true;
    expect(keywordValue(s, unit.id, "Assault")).toBe(0);
    addPool(s, "p1", 2);
    activate(s, "p1", unit, "activated:2").expectOk();
    s.as("p2").pass().expectOk();
    expect(keywordValue(s, unit.id, "Assault")).toBe(2);
    expect(keywords(s, unit.id)).toContain("Deflect");
  });

  it("[C:Aurok General][R828.1.c] Empowered: your Empowered units have +2 Might, me included", () => {
    const s = withCards(["Aurok General", "Steel Paws"]);
    const general = place(s, "p1", "Aurok General", "base");
    const paws = place(s, "p1", "Steel Paws", "base");
    s.room.rules!.objects[paws.id] = { empowered: 1 };
    expect(might(s, paws.id)).toBe(7);
    addPool(s, "p1", 3, { Order: 1 });
    activate(s, "p1", general, "activated:0").expectOk();
    s.as("p2").pass().expectOk();
    expect(might(s, general.id)).toBe(7);
    expect(might(s, paws.id)).toBe(9);
  });

  it("[C:Rage Amplifier][R364.3.a] your units +1 Might, +2 instead while Empowered", () => {
    const s = withCards(["Rage Amplifier"]);
    const amp = place(s, "p1", "Rage Amplifier", "base");
    const unit = place(s, "p1", "Treasure Hunter", "base");
    const enemy = place(s, "p2", "Treasure Hunter", "base");
    expect(might(s, unit.id)).toBe(2);
    expect(might(s, enemy.id)).toBe(1);
    addPool(s, "p1", 6, { Fury: 1 });
    activate(s, "p1", amp, "activated:0").expectOk();
    s.as("p2").pass().expectOk();
    expect(might(s, unit.id)).toBe(3);
  });
});
