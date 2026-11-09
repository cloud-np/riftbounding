/** Origins O–Z: gear, legends and activated abilities. */
import { describe, expect, it } from "vitest";
import {
  effectiveKeywords,
  effectiveMight,
  getCardScript,
  listActivatedAbilities,
} from "../../../src";
import { boardOf, fund, place, zoneOf } from "../../rules/effects/helpers";
import { boardCard, passBoth, placeLegend, resolveAll, setMight, withCards } from "./helpers";

/** Activate the object's first scripted activated ability (refs index the full ability list, F7). */
function activate(
  s: ReturnType<typeof withCards>,
  player: string,
  objectId: string,
  extra: Record<string, unknown> = {},
) {
  const name = s.host.findCard(s.room, objectId)!.card.name;
  const ref = listActivatedAbilities(name)[0]!.ref;
  return s.as(player).apply({ type: "rules_activate", objectId, ability: ref, ...extra } as never);
}

const SEALS: Array<[string, string]> = [
  ["Seal of Discord", "Chaos"],
  ["Seal of Focus", "Calm"],
  ["Seal of Insight", "Mind"],
  ["Seal of Rage", "Fury"],
  ["Seal of Strength", "Body"],
  ["Seal of Unity", "Order"],
];

describe("Origins O–Z gear, legends and activated abilities", () => {
  for (const [name, domain] of SEALS) {
    it(`[C:${name}][R430.2][R430.5] [Tap]: [Reaction] Add 1 ${domain} Power, resolving immediately`, () => {
      const s = withCards([name]);
      const seal = place(s, "p1", name, "base");
      expect(effectiveKeywords(s.room, seal.id, s.host)).not.toContain("Reaction");
      const [entry] = listActivatedAbilities(name);
      expect(entry?.ability).toMatchObject({ addsResources: true, keywords: ["reaction"] });
      activate(s, "p1", seal.id).expectOk();
      expect(s.room.rules!.chain).toHaveLength(0);
      expect(s.room.rules!.pools.p1!.power[domain as "Fury"]).toBe(1);
      expect(s.host.isExhausted(s.room, seal.id)).toBe(true);
    });
  }

  it("[C:Seal of Rage][R806][R430.3] the gear itself is not played at Reaction speed", () => {
    const s = withCards(["Progress Day"], ["Seal of Rage"]);
    fund(s, "p1", "Progress Day");
    s.as("p1").play("Progress Day").expectOk();
    fund(s, "p2", "Seal of Rage");
    s.as("p2").play("Seal of Rage").expectError("closed_state_requires_reaction");
  });

  it("[C:Orb of Regret][R479.4.b] [Tap]: a unit gets -1 Might this turn, to a minimum of 1", () => {
    const s = withCards(["Orb of Regret"]);
    const orb = place(s, "p1", "Orb of Regret", "base");
    const enemy = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    activate(s, "p1", orb.id, { choices: { "target:0": enemy.id } }).expectOk();
    s.as("p2").pass().expectOk();
    expect(effectiveMight(s.room, enemy.id, s.host)).toBe(2);
    expect(s.host.isExhausted(s.room, orb.id)).toBe(true);
  });

  it("[C:The Syren][R421] [1], [Tap]: move a friendly unit at a battlefield to its base", () => {
    const s = withCards(["The Syren"]);
    const syren = place(s, "p1", "The Syren", "base");
    const unit = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    s.room.rules!.pools.p1 = { energy: 1, power: {} };
    activate(s, "p1", syren.id, { choices: { "target:0": unit.id } }).expectOk();
    s.as("p2").pass().expectOk();
    expect(zoneOf(s, unit.id)).toBe("base");
    expect(s.room.rules!.pools.p1!.energy).toBe(0);
  });

  it("[C:Treasure Trove][R383.2.c.3] [Chaos],[Tap]: kill this; leaving the board draws 1 and channels 1 rune exhausted", () => {
    const s = withCards(["Treasure Trove"]);
    const trove = place(s, "p1", "Treasure Trove", "base");
    const hand = boardOf(s, "p1").hand.length;
    const runes = boardOf(s, "p1").runeArea.length;
    s.room.rules!.pools.p1 = { energy: 0, power: { Chaos: 1 } };
    activate(s, "p1", trove.id).expectOk();
    s.as("p2").pass().expectOk();
    expect(zoneOf(s, trove.id)).toBe("trash");
    resolveAll(s);
    expect(boardOf(s, "p1").hand.length).toBe(hand + 1);
    expect(boardOf(s, "p1").runeArea).toHaveLength(runes + 1);
    expect(boardOf(s, "p1").runeArea.at(-1)!.exhausted).toBe(true);
  });

  it("[C:Treasure Trove][R383.2.c.3] returned to hand by an effect, it still triggers", () => {
    const s = withCards(["Treasure Trove", "Pack of Wonders"]);
    const trove = place(s, "p1", "Treasure Trove", "base");
    const pack = place(s, "p1", "Pack of Wonders", "base");
    const hand = boardOf(s, "p1").hand.length;
    activate(s, "p1", pack.id, { choices: { "target:0": trove.id } }).expectOk();
    s.as("p2").pass().expectOk();
    expect(zoneOf(s, trove.id)).toBe("hand");
    resolveAll(s);
    expect(boardOf(s, "p1").hand.length).toBe(hand + 2);
  });

  it("[C:Pack of Wonders][R056][R811] [Tap]: return another friendly gear, unit or facedown card to its owner's hand", () => {
    const s = withCards(["Pack of Wonders", "Pakaa Cub"]);
    const pack = place(s, "p1", "Pack of Wonders", "base");
    const unit = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    const enemy = place(s, "p2", "Treasure Hunter", "battlefieldB");
    const hidden = place(s, "p1", "Pakaa Cub", "battlefieldA");
    hidden.hidden = true;
    const rune = boardOf(s, "p1").runeArea[0]!;
    for (const illegal of [pack.id, enemy.id, rune.id]) {
      activate(s, "p1", pack.id, { choices: { "target:0": illegal } }).expectError(
        "illegal_target",
      );
    }
    activate(s, "p1", pack.id, { choices: { "target:0": hidden.id } }).expectOk();
    s.as("p2").pass().expectOk();
    expect(zoneOf(s, hidden.id)).toBe("hand");
    expect(zoneOf(s, unit.id)).toBe("battlefieldA");
  });

  it("[C:Viktor, Herald of the Arcane][R440.2.c] [1], [Tap]: play a 1 Might Recruit token", () => {
    const s = withCards(["Viktor, Herald of the Arcane"]);
    const viktor = placeLegend(s, "p1", "Viktor, Herald of the Arcane");
    s.room.rules!.pools.p1 = { energy: 1, power: {} };
    activate(s, "p1", viktor.id).expectOk();
    s.as("p2").pass().expectOk();
    const recruit = boardCard(s, "p1", "Recruit")!;
    expect(recruit).toBeTruthy();
    expect(effectiveMight(s.room, recruit.id, s.host)).toBe(1);
    expect(s.host.isExhausted(s.room, viktor.id)).toBe(true);
  });

  it("[C:Volibear, Relentless Storm][R706][R740.4.a] when you play a Mighty unit, you may exhaust him to channel 1 rune exhausted", () => {
    const s = withCards(["Volibear, Relentless Storm", "Playful Phantom", "Pouty Poro"]);
    const voli = placeLegend(s, "p1", "Volibear, Relentless Storm");
    const runes = boardOf(s, "p1").runeArea.length;
    fund(s, "p1", "Pouty Poro");
    s.as("p1").play("Pouty Poro").expectOk();
    expect(s.room.rules!.chain).toHaveLength(0);
    fund(s, "p1", "Playful Phantom");
    s.as("p1").play("Playful Phantom").expectOk();
    expect(s.room.rules!.chain[0]?.cardName).toBe("Volibear, Relentless Storm");
    // 383.3.b / 405.2: the leading optional cost is decided (and paid) when the trigger finalizes.
    s.expectPrompt();
    s.as("p1")
      .choose({ optionIds: ["yes"] })
      .expectOk();
    expect(s.host.isExhausted(s.room, voli.id)).toBe(true);
    passBoth(s);
    expect(boardOf(s, "p1").runeArea).toHaveLength(runes + 1);
    expect(boardOf(s, "p1").runeArea.at(-1)!.exhausted).toBe(true);
  });

  it("[C:Yasuo, Unforgiven][R355.3][R421] [2], [Tap]: move a friendly unit to or from its base", () => {
    const s = withCards(["Yasuo, Unforgiven"]);
    const yasuo = placeLegend(s, "p1", "Yasuo, Unforgiven");
    const out = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    s.room.rules!.pools.p1 = { energy: 2, power: {} };
    activate(s, "p1", yasuo.id, { choices: { mode: "to-base", "target:0": out.id } }).expectOk();
    s.as("p2").pass().expectOk();
    expect(zoneOf(s, out.id)).toBe("base");
    // Next turn cycle: from base to a battlefield.
    s.as("p1").endTurn().expectOk();
    s.as("p2").endTurn().expectOk();
    resolveAll(s);
    s.room.rules!.pools.p1 = { energy: 2, power: {} };
    activate(s, "p1", yasuo.id, {
      choices: { mode: "from-base", "target:1": out.id, destination: "battlefieldA" },
    }).expectOk();
    s.as("p2").pass().expectOk();
    expect(zoneOf(s, out.id)).toBe("battlefieldA");
  });

  it("[C:Sun Disc][R812.2][R377.2.b] [Tap]: [Legion] — only with Legion; the effect resolves in the manual window", () => {
    const s = withCards(["Sun Disc", "Progress Day"]);
    const disc = place(s, "p1", "Sun Disc", "base");
    activate(s, "p1", disc.id).expectError("illegal_action");
    fund(s, "p1", "Progress Day");
    s.as("p1").play("Progress Day").expectOk();
    s.as("p2").pass().expectOk();
    activate(s, "p1", disc.id).expectOk();
    s.as("p2").pass().expectOk();
    expect(s.room.rules!.manual?.cardName).toBe("Sun Disc");
    expect(getCardScript("Sun Disc")?.status).toBe("partial");
  });

  it("[C:Teemo, Swift Scout][R355.18][R056] [1], [Tap]: put a Teemo unit you own into your hand from the board", () => {
    const s = withCards(["Teemo, Swift Scout", "Teemo, Scout"]);
    const legend = placeLegend(s, "p1", "Teemo, Swift Scout");
    const teemo = place(s, "p1", "Teemo, Scout", "battlefieldA");
    place(s, "p1", "Caitlyn, Patrolling", "base");
    s.room.rules!.pools.p1 = { energy: 1, power: {} };
    activate(s, "p1", legend.id).expectOk();
    s.as("p2").pass().expectOk();
    expect(zoneOf(s, teemo.id)).toBe("hand");
    expect(getCardScript("Teemo, Swift Scout")?.status).toBe("partial");
  });

  it("[C:Teemo, Swift Scout][R355.18] the Teemo can come from the Champion Zone", () => {
    const s = withCards(["Teemo, Swift Scout", "Teemo, Scout"]);
    const legend = placeLegend(s, "p1", "Teemo, Swift Scout");
    const champion = boardOf(s, "p1").champion;
    champion.splice(0, champion.length);
    const teemo = place(s, "p1", "Teemo, Scout", "champion");
    s.room.rules!.pools.p1 = { energy: 1, power: {} };
    activate(s, "p1", legend.id).expectOk();
    s.as("p2").pass().expectOk();
    expect(zoneOf(s, teemo.id)).toBe("hand");
  });

  it("[C:Wallop][R416] readies a unit (the spend-a-buff alternative cost is not payable)", () => {
    const s = withCards(["Wallop"]);
    const unit = place(s, "p1", "Caitlyn, Patrolling", "base", { exhausted: true });
    fund(s, "p1", "Wallop");
    s.as("p1")
      .play("Wallop", { choices: { "target:0": unit.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(s.host.isExhausted(s.room, unit.id)).toBe(false);
    expect(getCardScript("Wallop")?.status).toBe("partial");
  });

  it("[C:Unlicensed Armory][R357.2] Discard 1, [Tap]: the cost is paid; the effect resolves in the manual window", () => {
    const s = withCards(["Unlicensed Armory", "Progress Day"]);
    const armory = place(s, "p1", "Unlicensed Armory", "base");
    activate(s, "p1", armory.id).expectOk();
    expect(boardOf(s, "p1").trash.map((card) => card.name)).toContain("Progress Day");
    s.as("p2").pass().expectOk();
    expect(s.room.rules!.manual?.cardName).toBe("Unlicensed Armory");
  });

  it("[C:Sett, The Boss][R383.4.c.2.b] when you conquer, ready him", () => {
    const s = withCards(["Sett, The Boss"]);
    const sett = placeLegend(s, "p1", "Sett, The Boss");
    s.host.setExhausted(s.room, sett.id, true);
    place(s, "p1", "Caitlyn, Patrolling", "base");
    s.as("p1").move("Caitlyn, Patrolling", "battlefieldB").expectOk();
    resolveAll(s);
    expect(s.host.isExhausted(s.room, sett.id)).toBe(false);
    expect(getCardScript("Sett, The Boss")?.status).toBe("partial");
  });

  it("[C:Scrapheap][R420.4.a][R383.2.c.3] draws 1 when played and draws 1 when killed", () => {
    const s = withCards(["Scrapheap", "Thermo Beam"]);
    const before = boardOf(s, "p1").hand.length;
    fund(s, "p1", "Scrapheap");
    s.as("p1").play("Scrapheap").expectOk();
    passBoth(s);
    expect(boardOf(s, "p1").hand.length).toBe(before - 1 + 1);
    fund(s, "p1", "Thermo Beam");
    s.as("p1").play("Thermo Beam").expectOk();
    s.as("p2").pass().expectOk();
    resolveAll(s);
    expect(boardOf(s, "p1").hand.length).toBe(before - 2 + 2);
    expect(getCardScript("Scrapheap")?.status).toBe("partial");
  });
});
