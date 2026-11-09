/** Origins O–Z: units with "When you play me" effects (383.4.a). */
import { describe, expect, it } from "vitest";
import { effectiveKeywords, effectiveMight } from "../../../src";
import { boardOf, fund, place, zoneOf } from "../../rules/effects/helpers";
import { boardCard, passBoth, resolveAll, setMight, withCards } from "./helpers";

describe("Origins O–Z play effects", () => {
  it("[C:Peak Guardian][R427.1.b] buffs itself and, at a battlefield, every other friendly unit there", () => {
    const s = withCards(["Peak Guardian"]);
    const friend = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    const based = place(s, "p1", "Treasure Hunter", "base");
    const enemy = place(s, "p2", "Stellacorn Herder", "battlefieldB");
    fund(s, "p1", "Peak Guardian");
    s.as("p1").play("Peak Guardian", { location: "battlefieldA" }).expectOk();
    passBoth(s);
    const guardian = boardCard(s, "p1", "Peak Guardian")!;
    expect(s.room.rules!.objects[guardian.id]?.buffs).toBe(1);
    expect(s.room.rules!.objects[friend.id]?.buffs).toBe(1);
    expect(s.room.rules!.objects[based.id]?.buffs).toBeUndefined();
    expect(s.room.rules!.objects[enemy.id]?.buffs).toBeUndefined();
  });

  it("[C:Peak Guardian][R359.3.f.2] played to the base it only buffs itself", () => {
    const s = withCards(["Peak Guardian"]);
    const friend = place(s, "p1", "Caitlyn, Patrolling", "base");
    fund(s, "p1", "Peak Guardian");
    s.as("p1").play("Peak Guardian").expectOk();
    passBoth(s);
    expect(s.room.rules!.objects[boardCard(s, "p1", "Peak Guardian")!.id]?.buffs).toBe(1);
    expect(s.room.rules!.objects[friend.id]?.buffs).toBeUndefined();
  });

  it("[C:Pit Rookie][R403.4] buffs another friendly unit; with none the trigger is removed", () => {
    const s = withCards(["Pit Rookie", "Pit Rookie"]);
    fund(s, "p1", "Pit Rookie");
    s.as("p1").play("Pit Rookie").expectOk();
    expect(s.room.rules!.chain).toHaveLength(0);
    const first = boardCard(s, "p1", "Pit Rookie")!;
    fund(s, "p1", "Pit Rookie");
    s.as("p1").play("Pit Rookie").expectOk();
    passBoth(s);
    expect(s.room.rules!.objects[first.id]?.buffs).toBe(1);
  });

  it("[C:Poro Herder][R383.2.a.1] buffs itself and draws 1 only if you control a Poro", () => {
    const s = withCards(["Poro Herder", "Poro Herder", "Pouty Poro"]);
    const before = boardOf(s, "p1").hand.length;
    fund(s, "p1", "Poro Herder");
    s.as("p1").play("Poro Herder").expectOk();
    expect(s.room.rules!.chain).toHaveLength(0);
    place(s, "p1", "Pouty Poro", "base");
    fund(s, "p1", "Poro Herder");
    s.as("p1").play("Poro Herder").expectOk();
    expect(s.room.rules!.chain[0]?.cardName).toBe("Poro Herder");
    passBoth(s);
    const herders = boardOf(s, "p1").base.filter((card) => card.name === "Poro Herder");
    expect(herders.map((card) => s.room.rules!.objects[card.id]?.buffs ?? 0).sort()).toEqual([
      0, 1,
    ]);
    expect(boardOf(s, "p1").hand.length).toBe(before - 3 + 1);
  });

  it("[C:Riptide Rex][R418] deals 6 to an enemy unit at a battlefield", () => {
    const s = withCards(["Riptide Rex"]);
    const enemy = place(s, "p2", "Whiteflame Protector", "battlefieldA");
    setMight(s, enemy.id, 7);
    place(s, "p2", "Caitlyn, Patrolling", "base");
    fund(s, "p1", "Riptide Rex");
    s.as("p1").play("Riptide Rex").expectOk();
    // Only one enemy unit is at a battlefield: it is selected automatically (403.2).
    passBoth(s);
    expect(s.room.rules!.objects[enemy.id]?.damage).toBe(6);
  });

  it("[C:Solari Chief][R424][R429] stuns an unstunned enemy unit; kills a stunned one", () => {
    const s = withCards(["Solari Chief", "Solari Chief"]);
    const enemy = place(s, "p2", "Whiteflame Protector", "battlefieldA");
    fund(s, "p1", "Solari Chief");
    s.as("p1").play("Solari Chief").expectOk();
    passBoth(s);
    expect(s.room.rules!.objects[enemy.id]?.stunned).toBe(true);
    expect(zoneOf(s, enemy.id)).toBe("battlefieldA");
    fund(s, "p1", "Solari Chief");
    s.as("p1").play("Solari Chief").expectOk();
    passBoth(s);
    expect(zoneOf(s, enemy.id)).toBe("trash");
  });

  it("[C:Solari Shieldbearer][R424] stuns a unit", () => {
    const s = withCards(["Solari Shieldbearer"]);
    const enemy = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    fund(s, "p1", "Solari Shieldbearer");
    s.as("p1").play("Solari Shieldbearer").expectOk();
    s.expectPrompt("choose-target", "p1");
    s.as("p1")
      .choose({ optionIds: [enemy.id] })
      .expectOk();
    passBoth(s);
    expect(s.room.rules!.objects[enemy.id]?.stunned).toBe(true);
  });

  it("[C:Sprite Mother][R184.1][R816.1.b] plays a ready 3 Might Temporary Sprite here; she has no Temporary herself", () => {
    const s = withCards(["Sprite Mother"]);
    place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    fund(s, "p1", "Sprite Mother");
    s.as("p1").play("Sprite Mother", { location: "battlefieldA" }).expectOk();
    passBoth(s);
    const sprite = boardOf(s, "p1").battlefieldA.find((card) => card.name === "Sprite")!;
    expect(sprite).toBeTruthy();
    expect(sprite.exhausted).toBe(false);
    expect(effectiveMight(s.room, sprite.id, s.host)).toBe(3);
    expect(effectiveKeywords(s.room, sprite.id, s.host)).toContain("Temporary");
    const mother = boardCard(s, "p1", "Sprite Mother")!;
    expect(effectiveKeywords(s.room, mother.id, s.host)).not.toContain("Temporary");
    // P1's next Beginning Phase: the Sprite dies (Temporary), Sprite Mother stays.
    s.as("p1").endTurn().expectOk();
    s.as("p2").endTurn().expectOk();
    resolveAll(s);
    expect(zoneOf(s, sprite.id)).not.toBe("battlefieldA");
    expect(zoneOf(s, mother.id)).toBe("battlefieldA");
  });

  it("[C:Stormclaw Ursine][R431.2.a] channels 1 rune exhausted", () => {
    const s = withCards(["Stormclaw Ursine"]);
    const runes = boardOf(s, "p1").runeArea.length;
    fund(s, "p1", "Stormclaw Ursine");
    s.as("p1").play("Stormclaw Ursine").expectOk();
    passBoth(s);
    const area = boardOf(s, "p1").runeArea;
    expect(area).toHaveLength(runes + 1);
    expect(area[area.length - 1]!.exhausted).toBe(true);
  });

  it("[C:Teemo, Scout][R479.4] gives himself +3 Might this turn", () => {
    const s = withCards(["Teemo, Scout"]);
    fund(s, "p1", "Teemo, Scout");
    s.as("p1").play("Teemo, Scout").expectOk();
    passBoth(s);
    const teemo = boardCard(s, "p1", "Teemo, Scout")!;
    expect(effectiveMight(s.room, teemo.id, s.host)).toBe(4);
    expect(effectiveKeywords(s.room, teemo.id, s.host)).toContain("Hidden");
  });

  it("[C:Thousand-Tailed Watcher][R479.4.b] every enemy unit gets -3 Might this turn, to a minimum of 1", () => {
    const s = withCards(["Thousand-Tailed Watcher"]);
    const big = place(s, "p2", "Whiteflame Protector", "battlefieldA");
    setMight(s, big.id, 6);
    const small = place(s, "p2", "Caitlyn, Patrolling", "base");
    const mine = place(s, "p1", "Stellacorn Herder", "base");
    const before = effectiveMight(s.room, mine.id, s.host);
    fund(s, "p1", "Thousand-Tailed Watcher");
    s.as("p1").play("Thousand-Tailed Watcher").expectOk();
    passBoth(s);
    expect(effectiveMight(s.room, big.id, s.host)).toBe(3);
    expect(effectiveMight(s.room, small.id, s.host)).toBe(1);
    expect(effectiveMight(s.room, mine.id, s.host)).toBe(before);
  });

  it("[C:Zaunite Bouncer][R056] returns another unit at a battlefield to its owner's hand", () => {
    const s = withCards(["Zaunite Bouncer"]);
    const enemy = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    fund(s, "p1", "Zaunite Bouncer");
    s.as("p1").play("Zaunite Bouncer").expectOk();
    passBoth(s);
    expect(zoneOf(s, enemy.id)).toBe("hand");
  });

  it("[C:Trifarian Gloryseeker][R812.2][R727.1.b] [Legion]: buffs itself only if another card was played this turn", () => {
    const s = withCards(["Trifarian Gloryseeker", "Trifarian Gloryseeker"]);
    fund(s, "p1", "Trifarian Gloryseeker");
    s.as("p1").play("Trifarian Gloryseeker").expectOk();
    expect(s.room.rules!.chain).toHaveLength(0);
    const first = boardCard(s, "p1", "Trifarian Gloryseeker")!;
    expect(s.room.rules!.objects[first.id]?.buffs).toBeUndefined();
    fund(s, "p1", "Trifarian Gloryseeker");
    s.as("p1").play("Trifarian Gloryseeker").expectOk();
    passBoth(s);
    const second = boardOf(s, "p1").base.filter(
      (card) => card.name === "Trifarian Gloryseeker",
    )[1]!;
    expect(s.room.rules!.objects[second.id]?.buffs).toBe(1);
  });

  it("[C:Vanguard Captain][R812.2][R440.2.c] [Legion]: plays two 1 Might Recruits here", () => {
    const s = withCards(["Progress Day", "Vanguard Captain"]);
    place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    fund(s, "p1", "Progress Day");
    s.as("p1").play("Progress Day").expectOk();
    s.as("p2").pass().expectOk();
    fund(s, "p1", "Vanguard Captain");
    s.as("p1").play("Vanguard Captain", { location: "battlefieldA" }).expectOk();
    passBoth(s);
    const recruits = boardOf(s, "p1").battlefieldA.filter((card) => card.name === "Recruit");
    expect(recruits).toHaveLength(2);
    expect(effectiveMight(s.room, recruits[0]!.id, s.host)).toBe(1);
  });

  it("[C:Vanguard Captain][R727.1.b] without [Legion] nothing is played", () => {
    const s = withCards(["Vanguard Captain"]);
    fund(s, "p1", "Vanguard Captain");
    s.as("p1").play("Vanguard Captain").expectOk();
    expect(s.room.rules!.chain).toHaveLength(0);
    expect(boardOf(s, "p1").base.filter((card) => card.name === "Recruit")).toHaveLength(0);
  });

  it("[C:Scrapyard Champion][R812.2][R423] [Legion]: discard 2, then draw 2", () => {
    const s = withCards(["Progress Day", "Scrapyard Champion"]);
    fund(s, "p1", "Progress Day");
    s.as("p1").play("Progress Day").expectOk();
    s.as("p2").pass().expectOk();
    const before = boardOf(s, "p1").hand.length;
    fund(s, "p1", "Scrapyard Champion");
    s.as("p1").play("Scrapyard Champion").expectOk();
    passBoth(s);
    s.expectPrompt("choose-card", "p1");
    const pick = s.room.rules!.prompt!.options!.slice(0, 2).map((option) => option.id);
    s.as("p1").choose({ optionIds: pick }).expectOk();
    expect(boardOf(s, "p1").hand.length).toBe(before - 1);
    expect(boardOf(s, "p1").trash.filter((card) => pick.includes(card.id))).toHaveLength(2);
  });

  it("[C:Wildclaw Shaman][R740.4.a][R702.2.b] may spend a friendly buff to buff and ready itself", () => {
    const s = withCards(["Wildclaw Shaman"]);
    const buffed = place(s, "p1", "Caitlyn, Patrolling", "base");
    s.room.rules!.objects[buffed.id] = { buffs: 1 };
    fund(s, "p1", "Wildclaw Shaman");
    s.as("p1").play("Wildclaw Shaman").expectOk();
    s.expectPrompt("yes-no", "p1");
    s.as("p1")
      .choose({ optionIds: ["yes"] })
      .expectOk();
    passBoth(s);
    const shaman = boardCard(s, "p1", "Wildclaw Shaman")!;
    expect(s.room.rules!.objects[buffed.id]?.buffs).toBeUndefined();
    expect(s.room.rules!.objects[shaman.id]?.buffs).toBe(1);
    expect(shaman.exhausted).toBe(false);
  });

  it("[C:Wildclaw Shaman][R702.2.b.1] without a buff to spend nothing happens", () => {
    const s = withCards(["Wildclaw Shaman"]);
    fund(s, "p1", "Wildclaw Shaman");
    s.as("p1").play("Wildclaw Shaman").expectOk();
    s.expectPrompt("yes-no", "p1");
    s.as("p1")
      .choose({ optionIds: ["yes"] })
      .expectOk();
    passBoth(s);
    const shaman = boardCard(s, "p1", "Wildclaw Shaman")!;
    expect(s.room.rules!.objects[shaman.id]?.buffs).toBeUndefined();
    expect(shaman.exhausted).toBe(true);
  });

  it("[C:Qiyana, Victorious][R383.4.c.2.a][R355.3] when she conquers, draw 1 or channel 1 rune exhausted", () => {
    const s = withCards(["Qiyana, Victorious"]);
    place(s, "p1", "Qiyana, Victorious", "base");
    const before = boardOf(s, "p1").hand.length;
    s.as("p1").move("Qiyana, Victorious", "battlefieldB").expectOk();
    resolveAll(s);
    s.expectPrompt("choose-mode", "p1");
    s.as("p1")
      .choose({ optionIds: ["draw"] })
      .expectOk();
    resolveAll(s);
    expect(boardOf(s, "p1").hand.length).toBe(before + 1);
  });
});
