/**
 * Origins A–N, batch 3: attack/defend triggers and passive abilities.
 */
import { describe, expect, it } from "vitest";
import {
  costAdjustments,
  effectiveKeywordValues,
  effectiveKeywords,
  effectiveMight,
  getCardScript,
} from "../../../src";
import { boardOf, fund, place } from "../../rules/effects/helpers";
import { setControl } from "../../rules/combat/helpers";
import { cardIn, drain, passBoth, settle, withCards, type S } from "./helpers";

/** p1 attacks battlefieldA (held by p2) with `attacker`; returns once the attack triggers are on the chain. */
function attack(s: S, attacker: string): void {
  setControl(s.room, "battlefieldA", "p2");
  s.as("p1").move(attacker, "battlefieldA").expectOk();
  expect(s.room.rules!.combat).toMatchObject({ attacker: "p1", defender: "p2" });
}

/** Resolve the chain items whose source is `name` (combat damage has not been dealt yet). */
function resolveTriggersOf(s: S, name: string): void {
  for (
    let guard = 0;
    guard < 8 && s.room.rules!.chain.some((item) => item.cardName === name);
    guard += 1
  ) {
    if (s.room.rules!.prompt) break;
    const who = s.room.rules!.priority;
    if (!who) break;
    s.as(who).pass().expectOk();
  }
}

describe("Origins A–N — attack and defend triggers", () => {
  it("[C:Anivia, Primal][R383.4.e][R418.1.d] when I attack, deal 3 to all enemy units here", () => {
    const s = withCards(["Anivia, Primal"]);
    const a = place(s, "p2", "Astral Heron", "battlefieldA");
    const b = place(s, "p2", "Whiteflame Protector", "battlefieldA");
    const home = place(s, "p2", "Stellacorn Herder", "base");
    place(s, "p1", "Anivia, Primal", "base");
    attack(s, "Anivia, Primal");
    resolveTriggersOf(s, "Anivia, Primal");
    expect(s.room.rules!.objects[a.id]?.damage).toBe(3);
    expect(s.room.rules!.objects[b.id]?.damage).toBe(3);
    expect(s.room.rules!.objects[home.id]?.damage).toBeUndefined();
  });

  it("[C:Crackshot Corsair][R383.4.e] when I attack, deal 1 to an enemy unit here", () => {
    const s = withCards(["Crackshot Corsair"]);
    const enemy = place(s, "p2", "Astral Heron", "battlefieldA");
    place(s, "p1", "Crackshot Corsair", "base");
    attack(s, "Crackshot Corsair");
    resolveTriggersOf(s, "Crackshot Corsair");
    expect(s.room.rules!.objects[enemy.id]?.damage).toBe(1);
  });

  it("[C:Leona, Determined][R424.1] when I attack, stun an enemy unit here (Shield is printed)", () => {
    const s = withCards(["Leona, Determined"]);
    const enemy = place(s, "p2", "Astral Heron", "battlefieldA");
    const leona = place(s, "p1", "Leona, Determined", "base");
    expect(effectiveKeywords(s.room, leona.id, s.host)).toContain("Shield");
    attack(s, "Leona, Determined");
    resolveTriggersOf(s, "Leona, Determined");
    expect(s.room.rules!.objects[enemy.id]?.stunned).toBe(true);
  });

  it("[C:Ahri, Inquisitive][R383.4.e][R479.4.b] when I attack, an enemy unit here gets -2 Might this turn, to a minimum of 1", () => {
    const s = withCards(["Ahri, Inquisitive"]);
    const enemy = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA"); // 3 Might
    place(s, "p1", "Ahri, Inquisitive", "base");
    attack(s, "Ahri, Inquisitive");
    resolveTriggersOf(s, "Ahri, Inquisitive");
    expect(effectiveMight(s.room, enemy.id, s.host)).toBe(1);
  });

  it("[C:Ahri, Inquisitive][R383.4.f] when I defend, an enemy unit here gets -2 Might this turn", () => {
    const s = withCards(["Ahri, Inquisitive"]);
    place(s, "p1", "Ahri, Inquisitive", "battlefieldA");
    setControl(s.room, "battlefieldA", "p1");
    s.as("p1").endTurn().expectOk();
    settle(s);
    const enemy = place(s, "p2", "Astral Heron", "base"); // 7 Might
    s.as("p2").move("Astral Heron", "battlefieldA").expectOk();
    expect(s.room.rules!.combat).toMatchObject({ attacker: "p2", defender: "p1" });
    resolveTriggersOf(s, "Ahri, Inquisitive");
    expect(effectiveMight(s.room, enemy.id, s.host)).toBe(5);
  });

  it("[C:Dune Drake][R359.3.f.2] when I attack, +2 Might this turn only if a ready enemy unit is here", () => {
    const s = withCards(["Dune Drake"]);
    place(s, "p2", "Astral Heron", "battlefieldA");
    const drake = place(s, "p1", "Dune Drake", "base");
    attack(s, "Dune Drake");
    resolveTriggersOf(s, "Dune Drake");
    expect(effectiveMight(s.room, drake.id, s.host)).toBe(7);

    const t = withCards(["Dune Drake"]);
    place(t, "p2", "Astral Heron", "battlefieldA", { exhausted: true });
    const drake2 = place(t, "p1", "Dune Drake", "base");
    attack(t, "Dune Drake");
    resolveTriggersOf(t, "Dune Drake");
    expect(effectiveMight(t.room, drake2.id, t.host)).toBe(5);
  });

  it("[C:Ahri, Nine-Tailed Fox][R383.2.a.1][R479.4.b] an enemy unit attacking a battlefield you control gets -1 Might, to a minimum of 1", () => {
    const s = withCards([], ["Ahri, Nine-Tailed Fox"]);
    place(s, "p2", "Ahri, Nine-Tailed Fox", "legend");
    place(s, "p2", "Astral Heron", "battlefieldA");
    const attacker = place(s, "p1", "Caitlyn, Patrolling", "base");
    attack(s, "Caitlyn, Patrolling");
    expect(s.room.rules!.chain.some((item) => item.cardName === "Ahri, Nine-Tailed Fox")).toBe(
      true,
    );
    resolveTriggersOf(s, "Ahri, Nine-Tailed Fox");
    expect(effectiveMight(s.room, attacker.id, s.host)).toBe(2);
  });

  it("[C:Ahri, Nine-Tailed Fox][R383.2.a.1] does not trigger for an attack on a battlefield you don't control", () => {
    const s = withCards([], ["Ahri, Nine-Tailed Fox"]);
    place(s, "p2", "Ahri, Nine-Tailed Fox", "legend");
    place(s, "p2", "Astral Heron", "battlefieldA");
    setControl(s.room, "battlefieldA", null);
    s.room.rules!.contested.battlefieldA = "p2";
    place(s, "p1", "Caitlyn, Patrolling", "base");
    s.as("p1").move("Caitlyn, Patrolling", "battlefieldA").expectOk();
    expect(s.room.rules!.chain.some((item) => item.cardName === "Ahri, Nine-Tailed Fox")).toBe(
      false,
    );
  });

  it("[C:Mask of Foresight][R740.2.a][R383.2.a.1] a friendly unit that attacks alone gets +1 Might this turn", () => {
    const s = withCards(["Mask of Foresight"]);
    place(s, "p1", "Mask of Foresight", "base");
    place(s, "p2", "Astral Heron", "battlefieldA");
    const unit = place(s, "p1", "Caitlyn, Patrolling", "base");
    attack(s, "Caitlyn, Patrolling");
    resolveTriggersOf(s, "Mask of Foresight");
    expect(effectiveMight(s.room, unit.id, s.host)).toBe(4);

    // Two attackers: neither is alone, so nothing triggers.
    const t = withCards(["Mask of Foresight"]);
    place(t, "p1", "Mask of Foresight", "base");
    place(t, "p2", "Astral Heron", "battlefieldA");
    const a = place(t, "p1", "Caitlyn, Patrolling", "base");
    const b = place(t, "p1", "Stellacorn Herder", "base");
    setControl(t.room, "battlefieldA", "p2");
    t.as("p1")
      .apply({ type: "rules_move", unitIds: [a.id, b.id], to: "battlefieldA" })
      .expectOk();
    expect(t.room.rules!.chain.some((item) => item.cardName === "Mask of Foresight")).toBe(false);
  });
});

describe("Origins A–N — passive abilities", () => {
  it("[C:Captain Farron][R365.1][R801.3] other friendly units here have Assault", () => {
    const s = withCards(["Captain Farron"]);
    const farron = place(s, "p1", "Captain Farron", "battlefieldA");
    const here = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    const there = place(s, "p1", "Stellacorn Herder", "base");
    const enemy = place(s, "p2", "Astral Heron", "battlefieldA");
    expect(effectiveKeywords(s.room, here.id, s.host)).toContain("Assault");
    expect(effectiveKeywordValues(s.room, here.id, s.host).assault).toBe(1);
    expect(effectiveKeywords(s.room, there.id, s.host)).not.toContain("Assault");
    expect(effectiveKeywords(s.room, enemy.id, s.host)).not.toContain("Assault");
    expect(effectiveKeywords(s.room, farron.id, s.host)).not.toContain("Assault");
  });

  it("[C:Darius, Executioner][R812.1.c][R365.1] other friendly units have +1 Might here; [Legion] when played, ready me", () => {
    const s = withCards(["Darius, Executioner", "Rebuke"]);
    place(s, "p1", "Darius, Executioner", "battlefieldA");
    const here = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    const there = place(s, "p1", "Stellacorn Herder", "base");
    expect(effectiveMight(s.room, here.id, s.host)).toBe(4);
    expect(effectiveMight(s.room, there.id, s.host)).toBe(3);

    // Without another card played this turn, the Legion trigger does not exist.
    const t = withCards(["Darius, Executioner"]);
    fund(t, "p1", "Darius, Executioner");
    t.as("p1").play("Darius, Executioner").expectOk();
    expect(t.room.rules!.chain).toHaveLength(0);
    expect(cardIn(t, "p1", "base", "Darius, Executioner")!.exhausted).toBe(true);

    // After another card: ready me.
    const u = withCards(["Rebuke", "Darius, Executioner"]);
    const target = place(u, "p2", "Astral Heron", "battlefieldA");
    fund(u, "p1", "Rebuke");
    u.as("p1")
      .play("Rebuke", { choices: { "target:0": target.id } })
      .expectOk();
    drain(u);
    fund(u, "p1", "Darius, Executioner");
    u.as("p1").play("Darius, Executioner").expectOk();
    expect(u.room.rules!.chain[0]?.cardName).toBe("Darius, Executioner");
    passBoth(u);
    expect(cardIn(u, "p1", "base", "Darius, Executioner")!.exhausted).toBe(false);
  });

  it("[C:Lee Sin, Centered][R364.3.a] other buffed friendly units at my battlefield have +2 Might", () => {
    const s = withCards(["Lee Sin, Centered"]);
    const lee = place(s, "p1", "Lee Sin, Centered", "battlefieldA");
    const buffed = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    const plain = place(s, "p1", "Stellacorn Herder", "battlefieldA");
    s.room.rules!.objects[buffed.id] = { buffs: 1 };
    s.room.rules!.objects[lee.id] = { buffs: 1 };
    expect(effectiveMight(s.room, buffed.id, s.host)).toBe(3 + 1 + 2);
    expect(effectiveMight(s.room, plain.id, s.host)).toBe(3);
    expect(effectiveMight(s.room, lee.id, s.host)).toBe(6 + 1);
    // At the base, Lee Sin is not at a battlefield.
    s.host.moveCard(s.room, "p1", "battlefieldA", "base", lee.id);
    s.host.moveCard(s.room, "p1", "battlefieldA", "base", buffed.id);
    expect(effectiveMight(s.room, buffed.id, s.host)).toBe(4);
  });

  it("[C:Draven, Showboat][R479.4] my Might is increased by your points", () => {
    const s = withCards(["Draven, Showboat"]);
    const draven = place(s, "p1", "Draven, Showboat", "base");
    expect(effectiveMight(s.room, draven.id, s.host)).toBe(3);
    s.host.setScore(s.room, "p1", 4);
    s.host.setScore(s.room, "p2", 6);
    expect(effectiveMight(s.room, draven.id, s.host)).toBe(7);
  });

  it("[C:Bilgewater Bully][R364.3.a] while I'm buffed, I have Ganking", () => {
    const s = withCards(["Bilgewater Bully"]);
    const bully = place(s, "p1", "Bilgewater Bully", "base");
    expect(effectiveKeywords(s.room, bully.id, s.host)).not.toContain("Ganking");
    s.room.rules!.objects[bully.id] = { buffs: 1 };
    expect(effectiveKeywords(s.room, bully.id, s.host)).toContain("Ganking");
  });

  it("[C:Fiora, Victorious][R708][R364.3.a] while I'm Mighty, I have Deflect, Ganking and Shield", () => {
    const s = withCards(["Fiora, Victorious"]);
    const fiora = place(s, "p1", "Fiora, Victorious", "base");
    for (const keyword of ["Deflect", "Ganking", "Shield"]) {
      expect(effectiveKeywords(s.room, fiora.id, s.host)).not.toContain(keyword);
    }
    s.room.rules!.objects[fiora.id] = { buffs: 1 };
    for (const keyword of ["Deflect", "Ganking", "Shield"]) {
      expect(effectiveKeywords(s.room, fiora.id, s.host)).toContain(keyword);
    }
  });

  it("[C:Gemcraft Seer][R817.1.b][R801.3] other friendly units have Vision (a unit played with it predicts)", () => {
    const s = withCards(["Gemcraft Seer", "Stellacorn Herder"]);
    const seer = place(s, "p1", "Gemcraft Seer", "base");
    const other = place(s, "p1", "Caitlyn, Patrolling", "base");
    const enemy = place(s, "p2", "Astral Heron", "base");
    expect(effectiveKeywords(s.room, seer.id, s.host)).toContain("Vision");
    expect(effectiveKeywords(s.room, other.id, s.host)).toContain("Vision");
    expect(effectiveKeywords(s.room, enemy.id, s.host)).not.toContain("Vision");
    fund(s, "p1", "Stellacorn Herder");
    s.as("p1").play("Stellacorn Herder").expectOk();
    expect(s.room.rules!.chain.map((item) => item.abilityRef)).toContain("keyword:vision:1");
  });

  it("[C:Magma Wurm][R369.3] other friendly units enter ready", () => {
    const s = withCards(["Magma Wurm", "Stellacorn Herder"]);
    fund(s, "p1", "Magma Wurm");
    s.as("p1").play("Magma Wurm").expectOk();
    expect(cardIn(s, "p1", "base", "Magma Wurm")!.exhausted).toBe(true);
    fund(s, "p1", "Stellacorn Herder");
    s.as("p1").play("Stellacorn Herder").expectOk();
    expect(cardIn(s, "p1", "base", "Stellacorn Herder")!.exhausted).toBe(false);
  });

  it("[C:Leona, Zealot][R369.3] I enter ready if an opponent's score is within 3 points of the Victory Score", () => {
    const s = withCards(["Leona, Zealot"]);
    fund(s, "p1", "Leona, Zealot");
    s.as("p1").play("Leona, Zealot").expectOk();
    expect(cardIn(s, "p1", "base", "Leona, Zealot")!.exhausted).toBe(true);

    const t = withCards(["Leona, Zealot"]);
    t.host.setScore(t.room, "p2", t.host.victoryScore(t.room) - 3);
    fund(t, "p1", "Leona, Zealot");
    t.as("p1").play("Leona, Zealot").expectOk();
    expect(cardIn(t, "p1", "base", "Leona, Zealot")!.exhausted).toBe(false);
    expect(getCardScript("Leona, Zealot")?.status).toBe("partial");
  });

  it("[C:Herald of Scales][R356.4] your Dragons' Energy costs are reduced by [2]", () => {
    const s = withCards(
      ["Herald of Scales", "Mountain Drake", "Stellacorn Herder"],
      ["Mountain Drake"],
    );
    place(s, "p1", "Herald of Scales", "base");
    const drake = s.handCard("p1", "Mountain Drake")!;
    const other = s.handCard("p1", "Stellacorn Herder")!;
    expect(costAdjustments(s.room, s.host, { playerId: "p1", cardId: drake.id })).toEqual([
      expect.objectContaining({ energy: -2 }),
    ]);
    expect(costAdjustments(s.room, s.host, { playerId: "p1", cardId: other.id })).toEqual([]);
    const theirs = s.handCard("p2", "Mountain Drake")!;
    expect(costAdjustments(s.room, s.host, { playerId: "p2", cardId: theirs.id })).toEqual([]);
    // Played for 9 - 2 Energy.
    s.room.rules!.pools.p1 = { energy: 7, power: {} };
    s.as("p1").play("Mountain Drake").expectOk();
    expect(s.room.rules!.pools.p1!.energy).toBe(0);
    expect(boardOf(s, "p1").base.some((card) => card.name === "Mountain Drake")).toBe(true);
  });

  it("[C:Eager Apprentice][R364.3.a][R356.4] while at a battlefield, your spells cost [1] less", () => {
    const s = withCards(["Eager Apprentice", "Falling Comet", "Gust"]);
    const apprentice = place(s, "p1", "Eager Apprentice", "base");
    const comet = s.handCard("p1", "Falling Comet")!;
    const gust = s.handCard("p1", "Gust")!;
    expect(costAdjustments(s.room, s.host, { playerId: "p1", cardId: comet.id })).toEqual([]);
    s.host.moveCard(s.room, "p1", "base", "battlefieldA", apprentice.id);
    expect(costAdjustments(s.room, s.host, { playerId: "p1", cardId: comet.id })).toEqual([
      expect.objectContaining({ energy: -1 }),
    ]);
    // Gust costs [1]: the minimum of [1] leaves it unchanged.
    expect(costAdjustments(s.room, s.host, { playerId: "p1", cardId: gust.id })).toEqual([]);
  });
});
