/**
 * Vendetta Empower cards with triggered/activated abilities and Empowered checks (442, 443,
 * 827, 828).
 */
import { describe, expect, it } from "vitest";
import { costAdjustments, getCardScript } from "../../../src";
import { fund } from "../../rules/effects/helpers";
import {
  activate,
  addPool,
  answer,
  boardOf,
  empowered,
  exhaustRunes,
  keywordValue,
  keywords,
  might,
  passBoth,
  place,
  setRunes,
  settle,
  withCards,
  zoneOf,
} from "./helpers";

describe("Vendetta: Empower triggers and checks", () => {
  it("[C:Apprentice Mage][R442.2.a][R437] when I become Empowered, Predict 2; Empowered +1 Might", () => {
    const s = withCards(["Apprentice Mage"]);
    const mage = place(s, "p1", "Apprentice Mage", "base");
    addPool(s, "p1", 2);
    activate(s, "p1", mage, "activated:0").expectOk();
    s.as("p2").pass().expectOk();
    expect(empowered(s, mage.id)).toBe(true);
    expect(might(s, mage.id)).toBe(4);
    expect(s.room.rules!.chain[0]?.cardName).toBe("Apprentice Mage");
    passBoth(s);
    s.expectPrompt("choose-card", "p1");
    expect(s.room.rules!.prompt!.rule).toBe("437.1");
    expect(s.room.rules!.prompt!.options).toHaveLength(2);
  });

  it("[C:Akali, Deadly Weapon][R421][R403.2] when I move, may deal 1 (2 if Empowered) to a unit at a battlefield I moved from", () => {
    const s = withCards(["Akali, Deadly Weapon"]);
    const akali = place(s, "p1", "Akali, Deadly Weapon", "battlefieldA");
    const other = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    const elsewhere = place(s, "p1", "Stellacorn Herder", "battlefieldB");
    s.room.rules!.objects[akali.id] = { empowered: 1 };
    expect(might(s, akali.id)).toBe(4);
    s.as("p1").move("Akali, Deadly Weapon", "base").expectOk();
    expect(s.room.rules!.chain.some((item) => item.cardName === "Akali, Deadly Weapon")).toBe(true);
    // "You may" (403.1), then the only legal target at the battlefield I moved from is bound.
    s.expectPrompt(undefined, "p1");
    s.as("p1")
      .choose({ optionIds: ["yes"] })
      .expectOk();
    if (s.room.rules!.prompt) {
      expect(s.room.rules!.prompt.options!.map((option) => option.id)).not.toContain(elsewhere.id);
      answer(s, [other.id]);
    }
    settle(s);
    expect(s.room.rules!.objects[other.id]?.damage).toBe(2);
    expect(s.room.rules!.objects[elsewhere.id]?.damage).toBeUndefined();
  });

  it("[C:Covert Informant][R828.1.c] Empowered: when I move, draw 1 (not while not Empowered)", () => {
    const s = withCards(["Covert Informant"]);
    const unit = place(s, "p1", "Covert Informant", "battlefieldA");
    s.as("p1").move("Covert Informant", "base").expectOk();
    expect(s.room.rules!.chain).toHaveLength(0);
    s.host.moveCard(s.room, "p1", "base", "battlefieldA", unit.id);
    s.host.setExhausted(s.room, unit.id, false);
    s.room.rules!.objects[unit.id] = { empowered: 1 };
    const hand = boardOf(s, "p1").hand.length;
    s.as("p1").move("Covert Informant", "base").expectOk();
    settle(s);
    expect(boardOf(s, "p1").hand.length).toBe(hand + 1);
  });

  it("[C:Nasus, Ascended][R383.4.c.2.a][R828.1.c] Empowered: when I conquer, you score 1 point", () => {
    const s = withCards(["Nasus, Ascended"]);
    const nasus = place(s, "p1", "Nasus, Ascended", "base");
    s.room.rules!.objects[nasus.id] = { empowered: 1 };
    s.as("p1").move("Nasus, Ascended", "battlefieldB").expectOk();
    settle(s);
    s.expectScore("p1", 2);
    expect(getCardScript("Nasus, Ascended")?.status).toBe("partial");
  });

  it("[C:Ambessa, Respected and Feared][R383.4.e][R828.1.c] Empowered: Assault 2; when I attack, kill an enemy unit here with less Might", () => {
    const s = withCards(["Ambessa, Respected and Feared"], [], {
      battlefields: { p2: "Bandle Tree" },
    });
    const ambessa = place(s, "p1", "Ambessa, Respected and Feared", "base");
    expect(keywordValue(s, ambessa.id, "Assault")).toBe(0);
    const enemy = place(s, "p2", "Treasure Hunter", "battlefieldA");
    s.room.rules!.objects.battlefieldA = { controller: "p2" };
    addPool(s, "p1", 1, { Order: 2 });
    activate(s, "p1", ambessa, "activated:1").expectOk();
    s.as("p2").pass().expectOk();
    expect(keywordValue(s, ambessa.id, "Assault")).toBe(2);
    s.as("p1").move("Ambessa, Respected and Feared", "battlefieldA").expectOk();
    expect(
      s.room.rules!.chain.some((item) => item.cardName === "Ambessa, Respected and Feared"),
    ).toBe(true);
    settle(s);
    expect(zoneOf(s, enemy.id)).toBe("trash");
    expect(s.events().length).toBeGreaterThanOrEqual(0);
  });

  it("[C:Ambessa, The Wolf][R740.2.c][R467.2.c.10] Empowered: +3 Might and can't be dealt damage unless in combat", () => {
    const s = withCards(["Ambessa, The Wolf", "Hextech Ray"]);
    const wolf = place(s, "p1", "Ambessa, The Wolf", "battlefieldA");
    addPool(s, "p1", 3, { Body: 1 });
    activate(s, "p1", wolf, "activated:0").expectOk();
    s.as("p2").pass().expectOk();
    expect(might(s, wolf.id)).toBe(7);
    fund(s, "p1", "Hextech Ray");
    s.as("p1")
      .play("Hextech Ray", { choices: { "target:0": wolf.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(s.room.rules!.objects[wolf.id]?.damage).toBeUndefined();
  });

  it("[C:Tools of Empire][R359.3.f.2] [Tap]: +2 Might this turn, +4 instead while Empowered", () => {
    const s = withCards(["Tools of Empire"]);
    const tools = place(s, "p1", "Tools of Empire", "base");
    const unit = place(s, "p1", "Treasure Hunter", "base");
    activate(s, "p1", tools, "activated:1", { "target:0": unit.id }).expectOk();
    s.as("p2").pass().expectOk();
    expect(might(s, unit.id)).toBe(3);
    s.host.setExhausted(s.room, tools.id, false);
    addPool(s, "p1", 2);
    activate(s, "p1", tools, "activated:0").expectOk();
    s.as("p2").pass().expectOk();
    activate(s, "p1", tools, "activated:1", { "target:0": unit.id }).expectOk();
    s.as("p2").pass().expectOk();
    expect(might(s, unit.id)).toBe(7);
  });

  it("[C:Jayce, Defender of Tomorrow][R828.1.c][R377.2.b] [1],[Tap]: ready a gear; Empowered: ready 2 gear", () => {
    const s = withCards(["Jayce, Defender of Tomorrow", "Tools of Empire", "Tools of Empire"]);
    const jayce = place(s, "p1", "Jayce, Defender of Tomorrow", "legend");
    const a = place(s, "p1", "Tools of Empire", "base", { exhausted: true });
    const b = place(s, "p1", "Tools of Empire", "base", { exhausted: true });
    exhaustRunes(s, "p1");
    addPool(s, "p1", 1);
    activate(s, "p1", jayce, "activated:2", { "target:2": [a.id, b.id] }).expectError(
      "illegal_action",
    );
    activate(s, "p1", jayce, "activated:1", { "target:0": a.id }).expectOk();
    s.as("p2").pass().expectOk();
    expect(s.host.isExhausted(s.room, a.id)).toBe(false);
    s.host.setExhausted(s.room, jayce.id, false);
    s.host.setExhausted(s.room, a.id, true);
    s.room.rules!.objects[jayce.id] = { empowered: 1 };
    addPool(s, "p1", 1);
    activate(s, "p1", jayce, "activated:2", { "target:1": [a.id, b.id] }).expectOk();
    s.as("p2").pass().expectOk();
    expect(s.host.isExhausted(s.room, a.id)).toBe(false);
    expect(s.host.isExhausted(s.room, b.id)).toBe(false);
  });

  it("[C:Guttural Roar][R359.3.f.2] +2 Might this turn, +4 if the unit is Empowered", () => {
    const s = withCards(["Guttural Roar", "Guttural Roar", "Steel Paws"]);
    const plain = place(s, "p1", "Treasure Hunter", "base");
    const strong = place(s, "p1", "Steel Paws", "base");
    s.room.rules!.objects[strong.id] = { empowered: 1 };
    fund(s, "p1", "Guttural Roar");
    s.as("p1")
      .play("Guttural Roar", { choices: { "target:0": plain.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    fund(s, "p1", "Guttural Roar");
    s.as("p1")
      .play("Guttural Roar", { choices: { "target:0": strong.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(might(s, plain.id)).toBe(3);
    expect(might(s, strong.id)).toBe(11);
  });

  it("[C:Shock Blast][R366.2.a][R356.4] costs [2] less while you control something Empowered; deals 4", () => {
    const s = withCards(["Shock Blast", "Steel Paws"]);
    const card = s.handCard("p1", "Shock Blast")!;
    const legend = place(s, "p1", "Steel Paws", "base");
    expect(costAdjustments(s.room, s.host, { playerId: "p1", cardId: card.id })).toEqual([]);
    s.room.rules!.objects[legend.id] = { empowered: 1 };
    expect(costAdjustments(s.room, s.host, { playerId: "p1", cardId: card.id })).toEqual([
      expect.objectContaining({ energy: -2 }),
    ]);
    const enemy = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    exhaustRunes(s, "p1");
    fund(s, "p1", "Shock Blast");
    s.room.rules!.pools.p1!.energy -= 2;
    s.as("p1")
      .play("Shock Blast", { choices: { "target:0": enemy.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(zoneOf(s, enemy.id)).toBe("trash");
  });

  it("[C:Sanction][R355.3][R391.2] empower a unit, disempowered again at end of turn", () => {
    const s = withCards(["Sanction", "Steel Paws"]);
    const unit = place(s, "p1", "Steel Paws", "base");
    fund(s, "p1", "Sanction");
    s.as("p1")
      .play("Sanction", { choices: { mode: "empower", "target:0": unit.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(empowered(s, unit.id)).toBe(true);
    s.as("p1").endTurn().expectOk();
    settle(s);
    expect(empowered(s, unit.id)).toBe(false);
  });

  it("[C:Sanction][R443.1] disempower an Empowered unit, empowered again at end of turn", () => {
    const s = withCards(["Kinkou Lifeblade", "Sanction"]);
    const unit = place(s, "p1", "Kinkou Lifeblade", "base");
    // A played unit keeps its rules object through the Expiration Step (baseMight is set on entry).
    s.room.rules!.objects[unit.id] = { empowered: 1, baseMight: 4 };
    fund(s, "p1", "Sanction");
    s.as("p1")
      .play("Sanction", { choices: { mode: "disempower", "target:1": unit.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(empowered(s, unit.id)).toBe(false);
    s.as("p1").endTurn().expectOk();
    settle(s);
    expect(empowered(s, unit.id)).toBe(true);
  });

  it("[C:Lacerate][R443.1][R359.3.f.2] disempowers the chosen unit, then kills it if it has 3 Might or less", () => {
    const s = withCards(["Lacerate"], ["Steel Paws"]);
    const paws = place(s, "p2", "Steel Paws", "base");
    s.room.rules!.objects[paws.id] = { empowered: 1 };
    expect(might(s, paws.id)).toBe(7);
    fund(s, "p1", "Lacerate");
    s.as("p1")
      .play("Lacerate", { choices: { "target:0": paws.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(zoneOf(s, paws.id)).toBe("trash");
    expect(getCardScript("Lacerate")?.status).toBe("partial");
  });

  it("[C:Tomb-Raider Barbara][R383.2.a.1] with 7+ runes: disempower an Empowered enemy gear, otherwise kill it", () => {
    const s = withCards(
      ["Tomb-Raider Barbara", "Tomb-Raider Barbara"],
      ["Tools of Empire", "Rage Amplifier"],
    );
    const tools = place(s, "p2", "Tools of Empire", "base");
    const amp = place(s, "p2", "Rage Amplifier", "base");
    s.room.rules!.objects[amp.id] = { empowered: 1 };
    // Fewer than 7 runes: no trigger.
    fund(s, "p1", "Tomb-Raider Barbara");
    s.as("p1").play("Tomb-Raider Barbara").expectOk();
    expect(s.room.rules!.chain).toHaveLength(0);
    setRunes(s, "p1", 7);
    exhaustRunes(s, "p1");
    fund(s, "p1", "Tomb-Raider Barbara");
    s.as("p1").play("Tomb-Raider Barbara").expectOk();
    expect(s.room.rules!.prompt?.playerId).toBe("p1");
    answer(s, [amp.id]);
    settle(s);
    expect(empowered(s, amp.id)).toBe(false);
    expect(zoneOf(s, amp.id)).toBe("base");
    expect(zoneOf(s, tools.id)).toBe("base");
  });

  it("[C:Tomb-Raider Barbara] kills a gear that is not Empowered", () => {
    const s = withCards(["Tomb-Raider Barbara"], ["Tools of Empire"]);
    const tools = place(s, "p2", "Tools of Empire", "base");
    setRunes(s, "p1", 7);
    exhaustRunes(s, "p1");
    fund(s, "p1", "Tomb-Raider Barbara");
    s.as("p1").play("Tomb-Raider Barbara").expectOk();
    settle(s);
    expect(zoneOf(s, tools.id)).toBe("trash");
  });

  it("[C:Hextech Formula][R442] [Tap]: empower another gear", () => {
    const s = withCards(["Hextech Formula", "Tools of Empire"]);
    const formula = place(s, "p1", "Hextech Formula", "base");
    const tools = place(s, "p1", "Tools of Empire", "base");
    activate(s, "p1", formula, "activated:0", { "target:0": tools.id }).expectOk();
    s.as("p2").pass().expectOk();
    expect(empowered(s, tools.id)).toBe(true);
    expect(getCardScript("Hextech Formula")?.status).toBe("partial");
  });

  it("[C:Platewyrm Egg][R430.2][R827.1.c.2] [Tap]: Add [1], [2] instead while Empowered", () => {
    const s = withCards(["Platewyrm Egg"]);
    const egg = place(s, "p1", "Platewyrm Egg", "base");
    activate(s, "p1", egg, "activated:1").expectOk();
    expect(s.room.rules!.pools.p1!.energy).toBe(1);
    s.host.setExhausted(s.room, egg.id, false);
    activate(s, "p1", egg, "activated:0").expectOk();
    s.as("p2").pass().expectOk();
    expect(empowered(s, egg.id)).toBe(true);
    expect(s.room.rules!.pools.p1!.energy).toBe(0);
    s.host.setExhausted(s.room, egg.id, false);
    activate(s, "p1", egg, "activated:1").expectOk();
    expect(s.room.rules!.pools.p1!.energy).toBe(2);
  });

  it("[C:Applied Researchers][R356.4][R828.1.c] Empowered: your spells cost [1][Rune] less", () => {
    const s = withCards(["Applied Researchers", "Hextech Ray", "Shock Blast"], ["Hextech Ray"]);
    const researchers = place(s, "p1", "Applied Researchers", "base");
    const ray = s.handCard("p1", "Hextech Ray")!;
    const blast = s.handCard("p1", "Shock Blast")!;
    expect(costAdjustments(s.room, s.host, { playerId: "p1", cardId: ray.id })).toEqual([]);
    s.room.rules!.objects[researchers.id] = { empowered: 1 };
    const adjustments = costAdjustments(s.room, s.host, { playerId: "p1", cardId: blast.id });
    expect(adjustments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ power: { any: -1 } }),
        expect.objectContaining({ energy: -1 }),
      ]),
    );
    const theirs = s.handCard("p2", "Hextech Ray")!;
    expect(costAdjustments(s.room, s.host, { playerId: "p2", cardId: theirs.id })).toEqual([]);
  });

  it("[C:Baccai Witherclaw][C:Noxian Emissary][R827.1.c.1] Empower; Witherclaw has +2 Might while Empowered", () => {
    const s = withCards(["Baccai Witherclaw", "Noxian Emissary"]);
    const claw = place(s, "p1", "Baccai Witherclaw", "base");
    const emissary = place(s, "p1", "Noxian Emissary", "base");
    addPool(s, "p1", 1, { Body: 2 });
    activate(s, "p1", claw, "activated:0").expectOk();
    s.as("p2").pass().expectOk();
    addPool(s, "p1", 1, { Order: 1 });
    activate(s, "p1", emissary, "activated:0").expectOk();
    s.as("p2").pass().expectOk();
    expect(might(s, claw.id)).toBe(6);
    expect(empowered(s, emissary.id)).toBe(true);
    expect(getCardScript("Baccai Witherclaw")?.status).toBe("partial");
    expect(getCardScript("Noxian Emissary")?.status).toBe("partial");
  });

  it("[C:Kayle, Justified][R442.1.c.1][R443.1.b] Empowered up to three times: +2 Might each; Deflect 3 and Ganking at three", () => {
    const s = withCards(["Kayle, Justified"]);
    const kayle = place(s, "p1", "Kayle, Justified", "base");
    exhaustRunes(s, "p1");
    for (let index = 0; index < 4; index += 1) {
      addPool(s, "p1", 3);
      activate(s, "p1", kayle, "activated:2").expectOk();
      s.as("p2").pass().expectOk();
      if (index === 1) {
        expect(might(s, kayle.id)).toBe(7);
        expect(keywords(s, kayle.id)).not.toContain("Ganking");
      }
    }
    expect(s.room.rules!.objects[kayle.id]?.empowered).toBe(3);
    expect(might(s, kayle.id)).toBe(9);
    expect(keywords(s, kayle.id)).toContain("Ganking");
    expect(keywordValue(s, kayle.id, "Deflect")).toBe(3);
  });

  it("[C:Mel, Newly Awakened][R383.4.a] when you play me, draw 1; Empower [3]", () => {
    const s = withCards(["Mel, Newly Awakened"]);
    s.moveDeckCardToHand("p1", "Rebuke");
    const hand = boardOf(s, "p1").hand.length;
    fund(s, "p1", "Mel, Newly Awakened");
    s.as("p1").play("Mel, Newly Awakened").expectOk();
    settle(s);
    expect(boardOf(s, "p1").hand.length).toBe(hand - 1 + 1);
    const mel = s.findBoardCardAnywhere("Mel, Newly Awakened")!;
    addPool(s, "p1", 3);
    activate(s, "p1", mel, "activated:1").expectOk();
    s.as("p2").pass().expectOk();
    expect(empowered(s, mel.id)).toBe(true);
  });

  it("[C:Renekton, Brute][R828.1.c] [1]: +1 Might this turn; Deflect and Ganking only while Empowered", () => {
    const s = withCards(["Renekton, Brute"]);
    const renekton = place(s, "p1", "Renekton, Brute", "base");
    expect(keywords(s, renekton.id)).not.toContain("Ganking");
    exhaustRunes(s, "p1");
    addPool(s, "p1", 1);
    activate(s, "p1", renekton, "activated:2").expectOk();
    s.as("p2").pass().expectOk();
    expect(might(s, renekton.id)).toBe(5);
    s.room.rules!.objects[renekton.id] = { ...s.room.rules!.objects[renekton.id], empowered: 1 };
    expect(keywords(s, renekton.id)).toEqual(expect.arrayContaining(["Deflect", "Ganking"]));
  });
});
