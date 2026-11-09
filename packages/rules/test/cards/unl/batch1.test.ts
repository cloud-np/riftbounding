/**
 * Unleashed (UNL) batch 1 — play effects and Deathknell units.
 */
import { describe, expect, it } from "vitest";
import { effectiveKeywordValues, effectiveKeywords, getCardScript, xpOf } from "../../../src";
import { boardOf, fund, place, run, zoneOf } from "../../rules/effects/helpers";
import { answer, cardsNamed, hand, resolveChain, withCards } from "./helpers";

describe("Unleashed batch 1 — play effects", () => {
  it("[C:Demacian Diplomat][R383.4.a][R730.1] when you play me, gain 1 XP", () => {
    const s = withCards(["Demacian Diplomat"]);
    fund(s, "p1", "Demacian Diplomat");
    s.as("p1").play("Demacian Diplomat").expectOk();
    expect(s.room.rules!.chain[0]?.cardName).toBe("Demacian Diplomat");
    resolveChain(s);
    expect(xpOf(s.room, "p1")).toBe(1);
  });

  it("[C:Herald of Spring][R383.4.a][R823] when you play me, gain 2 XP; I have Hunt", () => {
    const s = withCards(["Herald of Spring"]);
    fund(s, "p1", "Herald of Spring");
    s.as("p1").play("Herald of Spring").expectOk();
    resolveChain(s);
    expect(xpOf(s.room, "p1")).toBe(2);
    expect(
      effectiveKeywords(s.room, s.findBoardCardAnywhere("Herald of Spring")!.id, s.host),
    ).toContain("Hunt");
  });

  it("[C:Evershade Stalker][R423.1.a][R414] when you play me, discard 1, then draw 1", () => {
    const s = withCards(["Evershade Stalker", "Gust", "Rebuke"]);
    fund(s, "p1", "Evershade Stalker");
    s.as("p1").play("Evershade Stalker").expectOk();
    const before = hand(s, "p1").map((card) => card.id);
    s.as(s.room.rules!.priority!).pass().expectOk();
    s.as(s.room.rules!.priority!).pass().expectOk();
    s.expectPrompt("choose-card", "p1");
    answer(s, [before[0]!]);
    expect(zoneOf(s, before[0]!)).toBe("trash");
    expect(hand(s, "p1")).toHaveLength(before.length);
  });

  it("[C:Scrutinizing Sergeant][R740.1] gains 1 XP for each friendly unit (itself included)", () => {
    const s = withCards(["Scrutinizing Sergeant"]);
    place(s, "p1", "Caitlyn, Patrolling", "base");
    place(s, "p1", "Treasure Hunter", "battlefieldA");
    place(s, "p2", "Astral Heron", "battlefieldA");
    fund(s, "p1", "Scrutinizing Sergeant");
    s.as("p1").play("Scrutinizing Sergeant").expectOk();
    resolveChain(s);
    expect(xpOf(s.room, "p1")).toBe(3);
  });

  it("[C:Kinkou Initiate][R359.3.f.2] draws only if your other units have total Might 5 or more", () => {
    const s = withCards(["Kinkou Initiate", "Kinkou Initiate"]);
    place(s, "p1", "Caitlyn, Patrolling", "base");
    fund(s, "p1", "Kinkou Initiate");
    let before = hand(s, "p1").length;
    s.as("p1").play("Kinkou Initiate").expectOk();
    resolveChain(s);
    // Other units: Caitlyn (3) → no draw.
    expect(hand(s, "p1")).toHaveLength(before - 1);
    fund(s, "p1", "Kinkou Initiate");
    before = hand(s, "p1").length;
    s.as("p1").play("Kinkou Initiate").expectOk();
    resolveChain(s);
    // Other units: Caitlyn (3) + the first Initiate (3) = 6 → draw 1.
    expect(hand(s, "p1")).toHaveLength(before);
  });

  it("[C:Bewitching Spirit][R355.7][R423.1.a] the chosen player discards 1 of their choice", () => {
    const s = withCards(["Bewitching Spirit"], ["Gust", "Rebuke"]);
    fund(s, "p1", "Bewitching Spirit");
    s.as("p1").play("Bewitching Spirit").expectOk();
    s.expectPrompt(undefined, "p1");
    answer(s, ["p2"]);
    const theirs = hand(s, "p2").map((card) => card.id);
    resolveUntilPrompt(s);
    s.expectPrompt("choose-card", "p2");
    answer(s, [theirs[1]!]);
    expect(zoneOf(s, theirs[1]!)).toBe("trash");
    expect(hand(s, "p2")).toHaveLength(theirs.length - 1);
  });

  it("[C:Frisky Hunter][R440.2.c] plays a 1 Might Bird with Deflect at its own location", () => {
    const s = withCards(["Frisky Hunter"]);
    place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    fund(s, "p1", "Frisky Hunter");
    s.as("p1").play("Frisky Hunter", { location: "battlefieldA" }).expectOk();
    resolveChain(s);
    const birds = cardsNamed(s, "p1", "battlefieldA", "Bird");
    expect(birds).toHaveLength(1);
    expect(effectiveKeywordValues(s.room, birds[0]!.id, s.host).deflect).toBe(1);
    // [R135.2.d.3] the reminder text's [Deflect] is not the Hunter's own keyword.
    const hunter = s.findBoardCardAnywhere("Frisky Hunter")!;
    expect(effectiveKeywords(s.room, hunter.id, s.host)).not.toContain("Deflect");
  });

  it("[C:Walking Roost][R440.4] the chosen opponent plays (and controls) a Bird token", () => {
    const s = withCards(["Walking Roost"]);
    fund(s, "p1", "Walking Roost");
    s.as("p1").play("Walking Roost").expectOk();
    resolveChain(s);
    expect(cardsNamed(s, "p2", "base", "Bird")).toHaveLength(1);
    expect(cardsNamed(s, "p1", "base", "Bird")).toHaveLength(0);
    const bird = cardsNamed(s, "p2", "base", "Bird")[0]!;
    expect(effectiveKeywordValues(s.room, bird.id, s.host).deflect).toBe(1);
    expect(
      effectiveKeywords(s.room, s.findBoardCardAnywhere("Walking Roost")!.id, s.host),
    ).toContain("Deflect");
  });

  it("[C:Angler Beast][R056] returns every unit with 2 Might or less to its owner's hand", () => {
    const s = withCards(["Angler Beast"]);
    const small = place(s, "p2", "Treasure Hunter", "battlefieldA");
    const mine = place(s, "p1", "Treasure Hunter", "base");
    const big = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    fund(s, "p1", "Angler Beast");
    s.as("p1").play("Angler Beast").expectOk();
    resolveChain(s);
    expect(zoneOf(s, small.id)).toBe("hand");
    expect(zoneOf(s, mine.id)).toBe("hand");
    expect(zoneOf(s, big.id)).toBe("battlefieldA");
    expect(s.findBoardCardAnywhere("Angler Beast")).toBeTruthy();
  });

  it("[C:Mischievous Marai][R383.2.a.1][R811.6] played from facedown at a battlefield, it deals 2 to an enemy unit there", () => {
    const s = withCards(["Mischievous Marai", "Mischievous Marai"]);
    // Played to the base: the "at a battlefield" trigger condition is false (no trigger).
    fund(s, "p1", "Mischievous Marai");
    s.as("p1").play("Mischievous Marai").expectOk();
    expect(s.room.rules!.chain).toHaveLength(0);
    // Hidden at a battlefield p1 controls, then played from facedown during p2's attack (811.6).
    place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    const marai = s.handCard("p1", "Mischievous Marai")!;
    s.room.rules!.pools.p1 = { energy: 0, power: { any: 1 } };
    s.as("p1")
      .apply({ type: "rules_play", cardId: marai.id, hide: true, location: "battlefieldA" })
      .expectOk();
    s.as("p1").endTurn().expectOk();
    // Engine bug workaround (see bugs.test.ts): the end-of-turn 3d cleanup drops `hiddenTurn`.
    s.room.rules!.objects[marai.id] = { hiddenTurn: 1 };
    const enemy = place(s, "p2", "Astral Heron", "base");
    s.as("p2").move("Astral Heron", "battlefieldA").expectOk();
    s.as("p2").pass().expectOk();
    s.as("p1").apply({ type: "rules_play", cardId: marai.id }).expectOk();
    expect(s.room.rules!.chain[0]?.cardName).toBe("Mischievous Marai");
    resolveChain(s);
    expect(s.room.rules!.objects[enemy.id]?.damage).toBe(2);
  });

  it("[C:Poppy, Paragon][R383.2.a.1] readies and gains 3 XP only when an opponent is within 3 of the Victory Score", () => {
    const s = withCards(["Poppy, Paragon", "Poppy, Paragon"]);
    fund(s, "p1", "Poppy, Paragon");
    s.as("p1").play("Poppy, Paragon").expectOk();
    expect(s.room.rules!.chain).toHaveLength(0);
    expect(xpOf(s.room, "p1")).toBe(0);
    boardOf(s, "p2").score = 6;
    fund(s, "p1", "Poppy, Paragon");
    s.as("p1").play("Poppy, Paragon").expectOk();
    resolveChain(s);
    expect(xpOf(s.room, "p1")).toBe(3);
    const poppies = cardsNamed(s, "p1", "base", "Poppy, Paragon");
    expect(poppies.some((card) => !card.exhausted)).toBe(true);
  });

  it("[C:Wuju Apprentice][R727.1.c.1][R824] [Level 6]: the play effect draws 1 only with 6+ XP", () => {
    const s = withCards(["Wuju Apprentice", "Wuju Apprentice"]);
    fund(s, "p1", "Wuju Apprentice");
    s.as("p1").play("Wuju Apprentice").expectOk();
    expect(s.room.rules!.chain).toHaveLength(0);
    run(s, { op: "gain_xp", amount: 6 });
    fund(s, "p1", "Wuju Apprentice");
    const before = hand(s, "p1").length;
    s.as("p1").play("Wuju Apprentice").expectOk();
    resolveChain(s);
    expect(hand(s, "p1")).toHaveLength(before);
  });
});

describe("Unleashed batch 1 — Deathknell", () => {
  function killWithRay(s: ReturnType<typeof withCards>, id: string): void {
    fund(s, "p2", "Hextech Ray");
    s.as("p2")
      .play("Hextech Ray", { choices: { "target:0": id } })
      .expectOk();
    s.as("p1").pass().expectOk();
  }

  it("[C:Black Rose Dignitary][R808][R431.2.a] Deathknell: channel 1 rune exhausted", () => {
    const s = withCards(["Black Rose Dignitary"], ["Hextech Ray"], { firstPlayer: "p2" });
    const unit = place(s, "p1", "Black Rose Dignitary", "battlefieldA");
    const runes = boardOf(s, "p1").runeArea.length;
    killWithRay(s, unit.id);
    resolveChain(s);
    const area = boardOf(s, "p1").runeArea;
    expect(area).toHaveLength(runes + 1);
    expect(area[area.length - 1]!.exhausted).toBe(true);
  });

  it("[C:Carrion Dredger][R808][R440.2.c] Deathknell: play a 1 Might Bird with Deflect to your base", () => {
    const s = withCards(["Carrion Dredger"], ["Hextech Ray"], { firstPlayer: "p2" });
    const unit = place(s, "p1", "Carrion Dredger", "battlefieldA");
    expect(effectiveKeywords(s.room, unit.id, s.host)).not.toContain("Deflect");
    killWithRay(s, unit.id);
    resolveChain(s);
    const birds = cardsNamed(s, "p1", "base", "Bird");
    expect(birds).toHaveLength(1);
    expect(effectiveKeywordValues(s.room, birds[0]!.id, s.host).deflect).toBe(1);
  });

  it("[C:Ruined Rex][R808][R418] Deathknell: deal 4 to an enemy unit", () => {
    const s = withCards(["Ruined Rex"], ["Hextech Ray"], { firstPlayer: "p2" });
    const unit = place(s, "p1", "Ruined Rex", "battlefieldA");
    s.room.rules!.objects[unit.id] = { damage: 4 };
    const enemy = place(s, "p2", "Astral Heron", "battlefieldB");
    killWithRay(s, unit.id);
    resolveChain(s);
    expect(s.room.rules!.objects[enemy.id]?.damage).toBe(4);
  });

  it("[C:Dramatic Visionary][R808][R437] Deathknell: Predict 2", () => {
    const s = withCards(["Dramatic Visionary"], ["Hextech Ray"], { firstPlayer: "p2" });
    const unit = place(s, "p1", "Dramatic Visionary", "battlefieldA");
    s.room.rules!.objects[unit.id] = { damage: 1 };
    killWithRay(s, unit.id);
    resolveUntilPrompt(s);
    s.expectPrompt("choose-card", "p1");
    expect(s.room.rules!.prompt!.options).toHaveLength(2);
    expect(s.room.rules!.prompt!.rule).toBe("437.1");
  });

  it("[C:LeBlanc, Fragmented][R808] Deathknell: draw 1 (2 during your Beginning Phase)", () => {
    const s = withCards(["LeBlanc, Fragmented"], ["Hextech Ray"], { firstPlayer: "p2" });
    const unit = place(s, "p1", "LeBlanc, Fragmented", "battlefieldA");
    const before = hand(s, "p1").length;
    killWithRay(s, unit.id);
    resolveChain(s);
    expect(hand(s, "p1")).toHaveLength(before + 1);
    expect(getCardScript("LeBlanc, Fragmented")?.status).toBe("implemented");
  });

  it("[C:Loyal Poro][R740.2.a] Deathknell: draws only if another friendly unit was there", () => {
    const s = withCards(["Loyal Poro", "Loyal Poro"], ["Hextech Ray", "Hextech Ray"], {
      firstPlayer: "p2",
    });
    const alone = place(s, "p1", "Loyal Poro", "battlefieldA");
    let before = hand(s, "p1").length;
    killWithRay(s, alone.id);
    resolveChain(s);
    expect(hand(s, "p1")).toHaveLength(before);
    const second = place(s, "p1", "Loyal Poro", "battlefieldB");
    place(s, "p1", "Treasure Hunter", "battlefieldB");
    before = hand(s, "p1").length;
    killWithRay(s, second.id);
    resolveChain(s);
    expect(hand(s, "p1")).toHaveLength(before + 1);
  });
});

/** Pass until a prompt opens or the chain empties. */
function resolveUntilPrompt(s: ReturnType<typeof withCards>): void {
  for (
    let guard = 0;
    guard < 12 && !s.room.rules!.prompt && s.room.rules!.chain.length > 0;
    guard += 1
  ) {
    const holder = s.room.rules!.priority;
    if (!holder) break;
    s.as(holder).pass().expectOk();
  }
}
