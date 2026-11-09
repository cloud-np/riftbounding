/**
 * Unleashed (UNL) batch 4 — unit and legend triggers, conditional passives.
 */
import { describe, expect, it } from "vitest";
import {
  costAdjustments,
  dealsCombatDamage,
  effectiveKeywordValues,
  effectiveKeywords,
  effectiveMight,
  lookupAbility,
  requiredChoices,
  xpOf,
} from "../../../src";
import { boardOf, fund, place, run, zoneOf } from "../../rules/effects/helpers";
import { cardsNamed, hand, nextOwnTurn, resolveChain, settle, withCards, type S } from "./helpers";

function killWithRay(s: S, id: string, by = "p2"): void {
  fund(s, by, "Hextech Ray");
  s.as(by)
    .play("Hextech Ray", { choices: { "target:0": id } })
    .expectOk();
  s.as(by === "p1" ? "p2" : "p1")
    .pass()
    .expectOk();
}

/** p1 controls battlefieldA with `name` there at the start of its next turn (hold, 383.4.d). */
function holdWith(s: S, name: string): void {
  place(s, "p1", name, "battlefieldA");
  s.room.rules!.objects.battlefieldA = { controller: "p1" };
  nextOwnTurn(s);
}

const say = (answer: string) => (prompt: { options?: Array<{ id: string }> }) =>
  prompt.options?.some((option) => option.id === answer) ? [answer] : undefined;

describe("Unleashed batch 4 — death and spell watchers", () => {
  it("[C:Spectral Centaur][C:Vicious Snapjaws][R383.2.c.3] another friendly unit dies: +2 Might / gain 1 XP", () => {
    const s = withCards(["Spectral Centaur", "Vicious Snapjaws"], ["Hextech Ray"], {
      firstPlayer: "p2",
    });
    const centaur = place(s, "p1", "Spectral Centaur", "base");
    place(s, "p1", "Vicious Snapjaws", "base");
    const victim = place(s, "p1", "Treasure Hunter", "battlefieldA");
    killWithRay(s, victim.id);
    settle(s);
    expect(effectiveMight(s.room, centaur.id, s.host)).toBe(8);
    expect(xpOf(s.room, "p1")).toBe(1);
  });

  it("[C:Diana, No Longer human][R420.4.a] when you play a spell, +2 Might this turn", () => {
    const s = withCards(["Diana, No Longer human", "Moonlight Affliction"]);
    const diana = place(s, "p1", "Diana, No Longer human", "base");
    const enemy = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    fund(s, "p1", "Moonlight Affliction");
    s.as("p1")
      .play("Moonlight Affliction", { choices: { "target:0": enemy.id } })
      .expectOk();
    settle(s);
    expect(effectiveMight(s.room, diana.id, s.host)).toBe(5);
  });
});

describe("Unleashed batch 4 — combat, conquer and hold triggers", () => {
  it("[C:Nidalee, Cat Form][C:Kha'Zix, Voidreaver][R468.3.c] winning a combat: Nidalee draws 1, the legend gains 1 XP", () => {
    const s = withCards(["Nidalee, Cat Form", "Kha'Zix, Voidreaver"]);
    place(s, "p1", "Kha'Zix, Voidreaver", "legend");
    place(s, "p1", "Nidalee, Cat Form", "base");
    place(s, "p2", "Treasure Hunter", "battlefieldB");
    const before = hand(s, "p1").length;
    s.as("p1").move("Nidalee, Cat Form", "battlefieldB").expectOk();
    settle(s);
    expect(hand(s, "p1")).toHaveLength(before + 1);
    expect(xpOf(s.room, "p1")).toBe(1);
  });

  it("[C:Kha'Zix, Voidreaver][R730.2][R421] Spend 1 XP, [Tap]: Buff a unit; Spend 2 XP, [Tap]: move an exhausted friendly unit from a battlefield to base", () => {
    const s = withCards(["Kha'Zix, Voidreaver"]);
    const legend = place(s, "p1", "Kha'Zix, Voidreaver", "legend");
    const unit = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA", { exhausted: true });
    run(s, { op: "gain_xp", amount: 3 });
    s.as("p1")
      .apply({
        type: "rules_activate",
        objectId: legend.id,
        ability: "activated:1",
        choices: { "target:0": unit.id },
      })
      .expectOk();
    resolveChain(s);
    expect(s.room.rules!.objects[unit.id]?.buffs).toBe(1);
    s.host.setExhausted(s.room, legend.id, false);
    s.as("p1")
      .apply({
        type: "rules_activate",
        objectId: legend.id,
        ability: "activated:2",
        choices: { "target:0": unit.id },
      })
      .expectOk();
    resolveChain(s);
    expect(zoneOf(s, unit.id)).toBe("base");
    expect(xpOf(s.room, "p1")).toBe(0);
  });

  it("[C:Poppy, Keeper of the Hammer][R383.4.d][R730.2] when you hold, gain 1 XP; Spend 3 XP, [Tap]: draw 1", () => {
    const s = withCards(["Poppy, Keeper of the Hammer"]);
    const legend = place(s, "p1", "Poppy, Keeper of the Hammer", "legend");
    holdWith(s, "Caitlyn, Patrolling");
    expect(xpOf(s.room, "p1")).toBe(1);
    run(s, { op: "gain_xp", amount: 2 });
    const before = hand(s, "p1").length;
    s.as("p1")
      .apply({ type: "rules_activate", objectId: legend.id, ability: "activated:1" })
      .expectOk();
    resolveChain(s);
    expect(hand(s, "p1")).toHaveLength(before + 1);
    expect(xpOf(s.room, "p1")).toBe(0);
  });

  it("[C:Inviolus Vox][R383.4.c] when I conquer, give a friendly unit +8 Might this turn", () => {
    const s = withCards(["Inviolus Vox"]);
    const vox = place(s, "p1", "Inviolus Vox", "base");
    s.as("p1").move("Inviolus Vox", "battlefieldB").expectOk();
    settle(s);
    expect(effectiveMight(s.room, vox.id, s.host)).toBe(16);
  });

  it("[C:Vi, Peacekeeper][R383.4.e][R424] when I attack, stun an enemy unit here", () => {
    const s = withCards(["Vi, Peacekeeper"]);
    place(s, "p1", "Vi, Peacekeeper", "base");
    const enemy = place(s, "p2", "Whiteflame Protector", "battlefieldB");
    s.as("p1").move("Vi, Peacekeeper", "battlefieldB").expectOk();
    settle(s, { until: () => !!s.room.rules!.objects[enemy.id]?.stunned });
    expect(s.room.rules!.objects[enemy.id]?.stunned).toBe(true);
    expect(
      effectiveKeywords(s.room, s.findBoardCardAnywhere("Vi, Peacekeeper")!.id, s.host),
    ).not.toContain("Reaction");
  });

  it("[C:Trevor Snoozebottom][R383.4.d][R816] when I hold, play a ready 3 Might Sprite here", () => {
    const s = withCards(["Trevor Snoozebottom"]);
    holdWith(s, "Trevor Snoozebottom");
    const sprites = cardsNamed(s, "p1", "battlefieldA", "Sprite");
    expect(sprites).toHaveLength(1);
    expect(sprites[0]!.exhausted).toBe(false);
    const trevor = s.findBoardCardAnywhere("Trevor Snoozebottom")!;
    expect(effectiveKeywords(s.room, trevor.id, s.host)).not.toContain("Temporary");
    expect(effectiveKeywords(s.room, trevor.id, s.host)).toContain("Shield");
  });

  it("[C:Yuumi, Magical Cat][R383.4.e][R815] when I attack, another unit of mine here gets +3 and Tank this turn", () => {
    const s = withCards(["Yuumi, Magical Cat"]);
    const yuumi = place(s, "p1", "Yuumi, Magical Cat", "base");
    const friend = place(s, "p1", "Caitlyn, Patrolling", "base");
    place(s, "p2", "Whiteflame Protector", "battlefieldB");
    expect(effectiveKeywords(s.room, yuumi.id, s.host)).not.toContain("Tank");
    s.as("p1")
      .apply({ type: "rules_move", unitIds: [yuumi.id, friend.id], to: "battlefieldB" })
      .expectOk();
    settle(s, { until: () => effectiveMight(s.room, friend.id, s.host) === 6 });
    expect(effectiveMight(s.room, friend.id, s.host)).toBe(6);
    expect(effectiveKeywords(s.room, friend.id, s.host)).toContain("Tank");
  });

  it("[C:Kha'Zix, Mutating Horror][R383.4.e.2.b] attacking a lone enemy unit: +2 Might and gain 2 XP", () => {
    const s = withCards(["Kha'Zix, Mutating Horror"]);
    const khazix = place(s, "p1", "Kha'Zix, Mutating Horror", "base");
    place(s, "p2", "Whiteflame Protector", "battlefieldB");
    s.as("p1").move("Kha'Zix, Mutating Horror", "battlefieldB").expectOk();
    settle(s, { until: () => xpOf(s.room, "p1") === 2 });
    expect(xpOf(s.room, "p1")).toBe(2);
    expect(effectiveMight(s.room, khazix.id, s.host)).toBe(6);
  });

  it("[C:Kha'Zix, Evolving Hunter][R740.4.a] when I attack, you may spend 3 XP to deal my Might to an enemy unit here", () => {
    const s = withCards(["Kha'Zix, Evolving Hunter"]);
    place(s, "p1", "Kha'Zix, Evolving Hunter", "base");
    const enemy = place(s, "p2", "Whiteflame Protector", "battlefieldB");
    run(s, { op: "gain_xp", amount: 3 });
    s.as("p1").move("Kha'Zix, Evolving Hunter", "battlefieldB").expectOk();
    settle(s, {
      onPrompt: (prompt) => say("yes")(prompt) ?? say("pay")(prompt),
      until: () => (s.room.rules!.objects[enemy.id]?.damage ?? 0) > 0,
    });
    expect(xpOf(s.room, "p1")).toBe(0);
    // Damage equal to Kha'Zix's Might (5), before combat damage.
    expect(s.room.rules!.objects[enemy.id]?.damage).toBe(5);
  });

  it("[C:Icevale Archer][R740.4.a] when I attack, you may pay [1] to give a unit here -1 Might this turn", () => {
    const s = withCards(["Icevale Archer"]);
    place(s, "p1", "Icevale Archer", "base");
    const enemy = place(s, "p2", "Whiteflame Protector", "battlefieldB");
    const before = effectiveMight(s.room, enemy.id, s.host);
    s.room.rules!.pools.p1 = { energy: 1, power: {} };
    s.as("p1").move("Icevale Archer", "battlefieldB").expectOk();
    settle(s, {
      onPrompt: (prompt) =>
        say("yes")(prompt) ??
        say("pay")(prompt) ??
        (prompt.options?.some((o) => o.id === enemy.id) ? [enemy.id] : undefined),
      until: () => effectiveMight(s.room, enemy.id, s.host) === before - 1,
    });
    expect(effectiveMight(s.room, enemy.id, s.host)).toBe(before - 1);
  });

  it("[C:Sinister Poro][R740.4.a][R421] when I attack, you may pay [1] to move an enemy unit here to its base", () => {
    const s = withCards(["Sinister Poro"]);
    place(s, "p1", "Sinister Poro", "base");
    const enemy = place(s, "p2", "Whiteflame Protector", "battlefieldB");
    s.room.rules!.pools.p1 = { energy: 1, power: {} };
    s.as("p1").move("Sinister Poro", "battlefieldB").expectOk();
    settle(s, {
      onPrompt: (prompt) => say("yes")(prompt) ?? say("pay")(prompt),
      until: () => zoneOf(s, enemy.id) === "base",
    });
    expect(zoneOf(s, enemy.id)).toBe("base");
  });

  it("[C:Vex, Gloomist][R383.4.d][R740.4.a] when you hold, you may exhaust me to draw 1", () => {
    const s = withCards(["Vex, Gloomist"]);
    const legend = place(s, "p1", "Vex, Gloomist", "legend");
    place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    s.room.rules!.objects.battlefieldA = { controller: "p1" };
    s.as("p1").endTurn().expectOk();
    settle(s);
    s.as("p2").endTurn().expectOk();
    const before = hand(s, "p1").length;
    settle(s, { onPrompt: (prompt) => say("yes")(prompt) ?? say("pay")(prompt) });
    // Beginning Phase: hold → Vex exhausts → draw 1; the Draw Phase draws 1 more.
    expect(hand(s, "p1").length).toBe(before + 2);
    expect(s.host.isExhausted(s.room, legend.id)).toBe(true);
  });

  it("[C:Vilemaw][R467.2.a][R383.4.d] enemy units here with less Might deal no combat damage; when I hold, draw 1", () => {
    const s = withCards(["Vilemaw"], ["Whiteflame Protector"]);
    const vilemaw = place(s, "p1", "Vilemaw", "battlefieldA");
    const small = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    expect(dealsCombatDamage(s.room, small.id, s.host)).toBe(false);
    expect(dealsCombatDamage(s.room, vilemaw.id, s.host)).toBe(true);
    s.host.moveCard(s.room, "p2", "battlefieldA", "base", small.id);
    expect(dealsCombatDamage(s.room, small.id, s.host)).toBe(true);
    s.room.rules!.objects.battlefieldA = { controller: "p1" };
    const before = hand(s, "p1").length;
    nextOwnTurn(s);
    expect(s.room.rules!.chain).toHaveLength(0);
    // Hold draw + Draw Phase draw.
    expect(hand(s, "p1")).toHaveLength(before + 2);
  });
});

describe("Unleashed batch 4 — play and move triggers", () => {
  it("[C:Rengar, Pridestalker][R440.2.c] when you play a unit, give a unit +1 Might this turn", () => {
    const s = withCards(["Rengar, Pridestalker", "Treasure Hunter"]);
    place(s, "p1", "Rengar, Pridestalker", "legend");
    const friend = place(s, "p1", "Caitlyn, Patrolling", "base");
    fund(s, "p1", "Treasure Hunter");
    s.as("p1").play("Treasure Hunter").expectOk();
    settle(s, {
      onPrompt: (prompt) =>
        prompt.options?.some((o) => o.id === friend.id) ? [friend.id] : undefined,
    });
    expect(effectiveMight(s.room, friend.id, s.host)).toBe(4);
  });

  it("[C:Pyke, Bloodharbor Ripper][R187] [1], [Tap]: return a friendly unit at a battlefield to hand; play an exhausted Gold", () => {
    const s = withCards(["Pyke, Bloodharbor Ripper"]);
    const legend = place(s, "p1", "Pyke, Bloodharbor Ripper", "legend");
    const unit = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    s.room.rules!.pools.p1 = { energy: 1, power: {} };
    s.as("p1")
      .apply({
        type: "rules_activate",
        objectId: legend.id,
        ability: "activated:2",
        choices: { "target:0": unit.id },
      })
      .expectOk();
    resolveChain(s);
    expect(zoneOf(s, unit.id)).toBe("hand");
    const gold = cardsNamed(s, "p1", "base", "Gold");
    expect(gold).toHaveLength(1);
    expect(gold[0]!.exhausted).toBe(true);
  });

  it("[C:Nilah, Joyful Ascetic][C:Mister Root][R421] when I move gain 1 XP; Mister Root gains 2 XP only moving to a battlefield", () => {
    const s = withCards(["Nilah, Joyful Ascetic", "Mister Root"]);
    place(s, "p1", "Nilah, Joyful Ascetic", "base");
    place(s, "p1", "Mister Root", "battlefieldA");
    s.room.rules!.objects.battlefieldA = { controller: "p1" };
    s.as("p1").move("Mister Root", "base").expectOk();
    settle(s);
    expect(xpOf(s.room, "p1")).toBe(0);
    s.as("p1").move("Nilah, Joyful Ascetic", "battlefieldA").expectOk();
    settle(s);
    expect(xpOf(s.room, "p1")).toBe(1);
    s.host.setExhausted(s.room, s.findBoardCardAnywhere("Mister Root")!.id, false);
    s.as("p1").move("Mister Root", "battlefieldA").expectOk();
    settle(s);
    expect(xpOf(s.room, "p1")).toBe(3);
  });

  it("[C:Irresistible Faefolk][R421] when I move to a battlefield, you may move an enemy unit there", () => {
    const s = withCards(["Irresistible Faefolk"]);
    place(s, "p1", "Irresistible Faefolk", "base");
    const enemy = place(s, "p2", "Caitlyn, Patrolling", "base");
    s.as("p1").move("Irresistible Faefolk", "battlefieldA").expectOk();
    settle(s, {
      onPrompt: (prompt) =>
        say("yes")(prompt) ??
        (prompt.options?.some((o) => o.id === enemy.id) ? [enemy.id] : undefined),
      until: () => zoneOf(s, enemy.id) === "battlefieldA",
    });
    expect(zoneOf(s, enemy.id)).toBe("battlefieldA");
  });

  it("[C:Imposing Challenger][R355.4.a] when I move, you may move a smaller enemy unit here to a different battlefield", () => {
    const s = withCards(["Imposing Challenger"]);
    place(s, "p1", "Imposing Challenger", "base");
    const small = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    s.as("p1").move("Imposing Challenger", "battlefieldA").expectOk();
    settle(s, {
      onPrompt: (prompt) =>
        say("yes")(prompt) ??
        (prompt.options?.some((o) => o.id === small.id) ? [small.id] : undefined) ??
        say("battlefieldB")(prompt),
      until: () => zoneOf(s, small.id) === "battlefieldB",
    });
    expect(zoneOf(s, small.id)).toBe("battlefieldB");
  });

  it("[C:Lillia, Fae Fawn][R440.2.c][R816] when I move from a location, play a 3 Might Sprite there", () => {
    const s = withCards(["Lillia, Fae Fawn"]);
    const lillia = place(s, "p1", "Lillia, Fae Fawn", "base");
    expect(effectiveKeywords(s.room, lillia.id, s.host)).not.toContain("Temporary");
    s.as("p1").move("Lillia, Fae Fawn", "battlefieldA").expectOk();
    settle(s);
    const sprites = cardsNamed(s, "p1", "base", "Sprite");
    expect(sprites).toHaveLength(1);
    expect(effectiveKeywords(s.room, sprites[0]!.id, s.host)).toContain("Temporary");
  });

  it("[C:Lord Broadmane][C:Chakram Dancer][R801.3.a] other units here gain Assault / Shield this turn", () => {
    const s = withCards(["Lord Broadmane", "Chakram Dancer"]);
    const friend = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    const away = place(s, "p1", "Treasure Hunter", "base");
    s.room.rules!.objects.battlefieldA = { controller: "p1" };
    fund(s, "p1", "Lord Broadmane");
    s.as("p1").play("Lord Broadmane", { location: "battlefieldA" }).expectOk();
    settle(s);
    fund(s, "p1", "Chakram Dancer");
    s.as("p1").play("Chakram Dancer", { location: "battlefieldA" }).expectOk();
    settle(s);
    expect(effectiveKeywords(s.room, friend.id, s.host)).toEqual(
      expect.arrayContaining(["Assault", "Shield"]),
    );
    expect(effectiveKeywords(s.room, away.id, s.host)).not.toContain("Assault");
    const lord = s.findBoardCardAnywhere("Lord Broadmane")!;
    expect(effectiveKeywords(s.room, lord.id, s.host)).not.toContain("Assault");
    expect(effectiveKeywords(s.room, lord.id, s.host)).toContain("Shield");
  });

  it("[C:Grim Apothecary][R403.1] you may return a friendly unit at a battlefield to its owner's hand", () => {
    const s = withCards(["Grim Apothecary"]);
    const friend = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    fund(s, "p1", "Grim Apothecary");
    s.as("p1").play("Grim Apothecary").expectOk();
    settle(s, {
      onPrompt: (prompt) =>
        say("yes")(prompt) ??
        (prompt.options?.some((o) => o.id === friend.id) ? [friend.id] : undefined),
    });
    expect(zoneOf(s, friend.id)).toBe("hand");
  });

  it("[C:Gentle Gemdragon][R355.13] when you play me or another Dragon, ready up to 2 runes", () => {
    const s = withCards(["Gentle Gemdragon", "Inviolus Vox"]);
    const runes = boardOf(s, "p1").runeArea;
    for (const rune of runes) rune.exhausted = true;
    fund(s, "p1", "Gentle Gemdragon");
    s.as("p1").play("Gentle Gemdragon").expectOk();
    settle(s, { onPrompt: (prompt) => prompt.options?.slice(0, 2).map((o) => o.id) });
    expect(boardOf(s, "p1").runeArea.filter((rune) => !rune.exhausted)).toHaveLength(
      Math.min(2, runes.length),
    );
  });

  it("[C:Jhin, Murderous Artist][R430.5] when I move, add [1] and 1 Power of any Domain", () => {
    const s = withCards(["Jhin, Murderous Artist"]);
    place(s, "p1", "Jhin, Murderous Artist", "base");
    s.room.rules!.pools.p1 = { energy: 0, power: {} };
    s.as("p1").move("Jhin, Murderous Artist", "battlefieldA").expectOk();
    settle(s, { until: () => (s.room.rules!.pools.p1?.energy ?? 0) === 1 });
    expect(s.room.rules!.pools.p1).toEqual({ energy: 1, power: { any: 1 } });
  });
});

describe("Unleashed batch 4 — conditional passives", () => {
  it("[C:Alpha Wildclaw][R757.1] your smaller units here can't be chosen by enemy spells", () => {
    const s = withCards(["Alpha Wildclaw"], ["Hextech Ray"]);
    place(s, "p1", "Alpha Wildclaw", "battlefieldA");
    const small = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    const elsewhere = place(s, "p1", "Treasure Hunter", "battlefieldB");
    const ability = lookupAbility("Hextech Ray", "spell")!.ability;
    const enemyOptions = requiredChoices(s.room, s.host, ability, {
      controller: "p2",
      choices: {},
    })[0]!.options.map((o) => o.id);
    expect(enemyOptions).not.toContain(small.id);
    expect(enemyOptions).toContain(elsewhere.id);
    const ownOptions = requiredChoices(s.room, s.host, ability, {
      controller: "p1",
      choices: {},
    })[0]!.options.map((o) => o.id);
    expect(ownOptions).toContain(small.id);
  });

  it("[C:Allay, Eager Admirer][R809.2] at a battlefield, your other units here have Deflect", () => {
    const s = withCards(["Allay, Eager Admirer"]);
    const allay = place(s, "p1", "Allay, Eager Admirer", "base");
    const friend = place(s, "p1", "Caitlyn, Patrolling", "base");
    expect(effectiveKeywords(s.room, friend.id, s.host)).not.toContain("Deflect");
    s.host.moveCard(s.room, "p1", "base", "battlefieldA", allay.id);
    s.host.moveCard(s.room, "p1", "base", "battlefieldA", friend.id);
    expect(effectiveKeywordValues(s.room, friend.id, s.host).deflect).toBe(1);
    expect(effectiveKeywordValues(s.room, allay.id, s.host).deflect).toBe(1);
  });

  it("[C:Crimson Pigeons][R466.2.c.3] +2 Might while attacking with another unit", () => {
    const s = withCards(["Crimson Pigeons"]);
    const pigeons = place(s, "p1", "Crimson Pigeons", "base");
    const friend = place(s, "p1", "Caitlyn, Patrolling", "base");
    place(s, "p2", "Whiteflame Protector", "battlefieldB");
    expect(effectiveMight(s.room, pigeons.id, s.host)).toBe(3);
    s.as("p1")
      .apply({ type: "rules_move", unitIds: [pigeons.id, friend.id], to: "battlefieldB" })
      .expectOk();
    expect(s.room.rules!.objects[pigeons.id]?.designation).toBe("attacker");
    expect(effectiveMight(s.room, pigeons.id, s.host)).toBe(5);
  });

  it("[C:Monch][R366.2.a][R369.3] costs [2] less and enters ready while an opponent controls a stunned unit", () => {
    const s = withCards(["Monch"]);
    const monch = s.handCard("p1", "Monch")!;
    const enemy = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    expect(costAdjustments(s.room, s.host, { playerId: "p1", cardId: monch.id })).toEqual([]);
    run(s, { op: "stun", target: { targetRef: `obj:${enemy.id}` } });
    expect(costAdjustments(s.room, s.host, { playerId: "p1", cardId: monch.id })).toEqual([
      expect.objectContaining({ energy: -2 }),
    ]);
    s.room.rules!.pools.p1 = { energy: 4, power: {} };
    s.as("p1").play("Monch").expectOk();
    expect(s.findBoardCardAnywhere("Monch")!.exhausted).toBe(false);
  });

  it("[C:Shadow][R369.3][R135.2.e.7] enters ready when played to a battlefield; [Action] ability stuns an enemy attacking here", () => {
    const s = withCards(["Shadow", "Shadow"], [], { firstPlayer: "p2" });
    // p2's turn: p2 attacks battlefieldA where p1's Shadow is.
    const shadow = place(s, "p1", "Shadow", "battlefieldA");
    const attacker = place(s, "p2", "Whiteflame Protector", "base");
    s.as("p2").move("Whiteflame Protector", "battlefieldA").expectOk();
    s.as("p2").pass().expectOk();
    s.room.rules!.pools.p1 = { energy: 1, power: { any: 1 } };
    s.as("p1")
      .apply({
        type: "rules_activate",
        objectId: shadow.id,
        ability: "activated:2",
        choices: { "target:0": attacker.id },
      })
      .expectOk();
    settle(s, { until: () => !!s.room.rules!.objects[attacker.id]?.stunned });
    expect(s.room.rules!.objects[attacker.id]?.stunned).toBe(true);
  });

  it("[C:Shadow][R369.3] played to a battlefield it enters ready; played to base it does not", () => {
    const s = withCards(["Shadow", "Shadow"]);
    place(s, "p1", "Treasure Hunter", "battlefieldB");
    s.room.rules!.objects.battlefieldB = { controller: "p1" };
    fund(s, "p1", "Shadow");
    s.as("p1").play("Shadow").expectOk();
    expect(cardsNamed(s, "p1", "base", "Shadow")[0]!.exhausted).toBe(true);
    // Riven, The Exile (fixture legend) also readies units played to battlefields you control, so
    // move the legend out of the way first.
    const legend = boardOf(s, "p1").legend.splice(0, 1);
    fund(s, "p1", "Shadow");
    s.as("p1").play("Shadow", { location: "battlefieldB" }).expectOk();
    expect(cardsNamed(s, "p1", "battlefieldB", "Shadow")[0]!.exhausted).toBe(false);
    boardOf(s, "p1").legend.push(...legend);
  });
});
