/**
 * Unleashed (UNL) batch 2 — keyword-only units, [Level] units, simple activated abilities and
 * passives.
 */
import { describe, expect, it } from "vitest";
import {
  combatKeywordProfile,
  dealsCombatDamage,
  effectiveKeywordValues,
  effectiveKeywords,
  effectiveMight,
  listActivatedAbilities,
  xpOf,
} from "../../../src";
import { fund, place, run, zoneOf } from "../../rules/effects/helpers";
import { cardsNamed, resolveChain, withCards } from "./helpers";

describe("Unleashed batch 2 — keyword-only units", () => {
  const table: Array<{
    name: string;
    keywords: string[];
    values?: Record<string, number>;
    absent?: string[];
    rules: string;
  }> = [
    {
      name: "Inferna",
      keywords: ["Ambush", "Assault"],
      values: { assault: 2 },
      absent: ["Reaction"],
      rules: "[R822][R807]",
    },
    {
      name: "Mutated Mouser",
      keywords: ["Shield", "Tank"],
      values: { shield: 2 },
      rules: "[R814][R815]",
    },
    {
      name: "Rengar, Unseen",
      keywords: ["Accelerate", "Assault", "Deflect", "Ganking"],
      values: { assault: 2 },
      rules: "[R805][R807][R809][R810]",
    },
    {
      name: "Sharkling",
      keywords: ["Accelerate", "Assault"],
      values: { assault: 4 },
      rules: "[R805][R807]",
    },
    {
      name: "Towering Combatant",
      keywords: ["Shield", "Tank"],
      values: { shield: 2 },
      rules: "[R814][R815]",
    },
    { name: "Voracious Gromp", keywords: ["Hunt"], values: { hunt: 3 }, rules: "[R823]" },
    { name: "Galio, Indefatigable", keywords: ["Deflect", "Tank"], rules: "[R809][R815]" },
  ];
  for (const row of table) {
    it(`[C:${row.name}]${row.rules} is playable at its cost and has its printed keywords`, () => {
      const s = withCards([row.name]);
      fund(s, "p1", row.name);
      s.as("p1").play(row.name).expectOk();
      const unit = s.findBoardCardAnywhere(row.name)!;
      expect(unit).toBeTruthy();
      const keywords = effectiveKeywords(s.room, unit.id, s.host);
      for (const keyword of row.keywords) expect(keywords).toContain(keyword);
      for (const keyword of row.absent ?? []) expect(keywords).not.toContain(keyword);
      const values = effectiveKeywordValues(s.room, unit.id, s.host);
      for (const [key, value] of Object.entries(row.values ?? {})) expect(values[key]).toBe(value);
    });
  }

  it("[C:Galio, Indefatigable][R424.1.b][R815] I don't deal combat damage; Tank", () => {
    const s = withCards(["Galio, Indefatigable"]);
    const galio = place(s, "p1", "Galio, Indefatigable", "battlefieldA");
    expect(dealsCombatDamage(s.room, galio.id, s.host)).toBe(false);
    expect(combatKeywordProfile(s.room, galio.id, s.host).tank).toBe(true);
  });
});

describe("Unleashed batch 2 — [Level] units", () => {
  it("[C:Gemhand Hunter][R824][R727.1.b] [Level 6]: +1 Might while you have 6+ XP; Hunt", () => {
    const s = withCards(["Gemhand Hunter"]);
    const unit = place(s, "p1", "Gemhand Hunter", "base");
    expect(effectiveMight(s.room, unit.id, s.host)).toBe(2);
    run(s, { op: "gain_xp", amount: 5 });
    expect(effectiveMight(s.room, unit.id, s.host)).toBe(2);
    run(s, { op: "gain_xp", amount: 1 });
    expect(effectiveMight(s.room, unit.id, s.host)).toBe(3);
    expect(effectiveKeywordValues(s.room, unit.id, s.host).hunt).toBe(1);
  });

  it("[C:Targonian Visionary][R824] [Level 11]: +4 Might", () => {
    const s = withCards(["Targonian Visionary"]);
    const unit = place(s, "p1", "Targonian Visionary", "base");
    run(s, { op: "gain_xp", amount: 10 });
    expect(effectiveMight(s.room, unit.id, s.host)).toBe(6);
    run(s, { op: "gain_xp", amount: 1 });
    expect(effectiveMight(s.room, unit.id, s.host)).toBe(10);
  });

  it("[C:Mosstomper][R824][R727.1.b] [Level 3]: +1 Might and Deflect only while you have 3+ XP", () => {
    const s = withCards(["Mosstomper"]);
    const unit = place(s, "p1", "Mosstomper", "base");
    expect(effectiveKeywords(s.room, unit.id, s.host)).not.toContain("Deflect");
    expect(effectiveKeywordValues(s.room, unit.id, s.host).hunt).toBe(2);
    run(s, { op: "gain_xp", amount: 3 });
    expect(effectiveMight(s.room, unit.id, s.host)).toBe(4);
    expect(effectiveKeywords(s.room, unit.id, s.host)).toContain("Deflect");
  });

  it("[C:Master Yi, Tempered][R824][R727.1.b] [Level 6]: Deflect and Ganking only while you have 6+ XP", () => {
    const s = withCards(["Master Yi, Tempered"]);
    const unit = place(s, "p1", "Master Yi, Tempered", "base");
    expect(effectiveKeywords(s.room, unit.id, s.host)).not.toContain("Ganking");
    expect(effectiveKeywords(s.room, unit.id, s.host)).not.toContain("Deflect");
    run(s, { op: "gain_xp", amount: 6 });
    expect(effectiveKeywords(s.room, unit.id, s.host)).toEqual(
      expect.arrayContaining(["Deflect", "Ganking"]),
    );
    expect(effectiveKeywordValues(s.room, unit.id, s.host).hunt).toBe(2);
  });

  it("[C:Scorchclaw][R824][R369.3] [Level 3]: +1 Might and enters ready", () => {
    const s = withCards(["Scorchclaw", "Scorchclaw"]);
    fund(s, "p1", "Scorchclaw");
    s.as("p1").play("Scorchclaw").expectOk();
    expect(cardsNamed(s, "p1", "base", "Scorchclaw")[0]!.exhausted).toBe(true);
    run(s, { op: "gain_xp", amount: 3 });
    fund(s, "p1", "Scorchclaw");
    s.as("p1").play("Scorchclaw").expectOk();
    const [, second] = cardsNamed(s, "p1", "base", "Scorchclaw");
    expect(second!.exhausted).toBe(false);
    expect(effectiveMight(s.room, second!.id, s.host)).toBe(4);
  });

  it("[C:Bandle Soldier][R824][R369.3] [Level 3]: I enter ready", () => {
    const s = withCards(["Bandle Soldier", "Bandle Soldier"]);
    fund(s, "p1", "Bandle Soldier");
    s.as("p1").play("Bandle Soldier").expectOk();
    expect(cardsNamed(s, "p1", "base", "Bandle Soldier")[0]!.exhausted).toBe(true);
    run(s, { op: "gain_xp", amount: 3 });
    fund(s, "p1", "Bandle Soldier");
    s.as("p1").play("Bandle Soldier").expectOk();
    expect(cardsNamed(s, "p1", "base", "Bandle Soldier")[1]!.exhausted).toBe(false);
  });

  it("[C:Master Yi, Wuju Master][R824][R369.3] [Level 6]: your units +1 Might; [Level 11]: your units enter ready", () => {
    const s = withCards(["Master Yi, Wuju Master", "Treasure Hunter"]);
    place(s, "p1", "Master Yi, Wuju Master", "legend");
    const unit = place(s, "p1", "Caitlyn, Patrolling", "base");
    const enemy = place(s, "p2", "Caitlyn, Patrolling", "base");
    run(s, { op: "gain_xp", amount: 6 });
    expect(effectiveMight(s.room, unit.id, s.host)).toBe(4);
    expect(effectiveMight(s.room, enemy.id, s.host)).toBe(3);
    run(s, { op: "gain_xp", amount: 5 });
    fund(s, "p1", "Treasure Hunter");
    s.as("p1").play("Treasure Hunter").expectOk();
    expect(cardsNamed(s, "p1", "base", "Treasure Hunter")[0]!.exhausted).toBe(false);
  });
});

describe("Unleashed batch 2 — activated abilities and passives", () => {
  it("[C:Arena Kingpin][R369.3][R377] enters ready and [Tap]: gives a unit +3 Might this turn", () => {
    const s = withCards(["Arena Kingpin"]);
    const friend = place(s, "p1", "Caitlyn, Patrolling", "base");
    fund(s, "p1", "Arena Kingpin");
    s.as("p1").play("Arena Kingpin").expectOk();
    const kingpin = s.findBoardCardAnywhere("Arena Kingpin")!;
    expect(kingpin.exhausted).toBe(false);
    s.as("p1")
      .apply({
        type: "rules_activate",
        objectId: kingpin.id,
        ability: "activated:1",
        choices: { "target:0": friend.id },
      })
      .expectOk();
    resolveChain(s);
    expect(effectiveMight(s.room, friend.id, s.host)).toBe(6);
    expect(s.host.isExhausted(s.room, kingpin.id)).toBe(true);
  });

  it("[C:Soul Shepherd][R179][R479.4] your token units have +1 Might", () => {
    const s = withCards(["Soul Shepherd"]);
    place(s, "p1", "Soul Shepherd", "base");
    run(s, { op: "create", token: { name: "Bird", might: 1, play: true } });
    run(s, { op: "create", token: { name: "Bird", might: 1, play: true } }, { controller: "p2" });
    const mine = cardsNamed(s, "p1", "base", "Bird")[0]!;
    const theirs = cardsNamed(s, "p2", "base", "Bird")[0]!;
    expect(effectiveMight(s.room, mine.id, s.host)).toBe(2);
    expect(effectiveMight(s.room, theirs.id, s.host)).toBe(1);
    expect(effectiveMight(s.room, s.findBoardCardAnywhere("Soul Shepherd")!.id, s.host)).toBe(3);
  });

  it("[C:Crowd Favorite][C:Enthralling Protector][R730.2][R702.3] Spend 2 XP: Buff me (once)", () => {
    for (const name of ["Crowd Favorite", "Enthralling Protector"]) {
      const s = withCards([name]);
      const unit = place(s, "p1", name, "base");
      expect(effectiveKeywordValues(s.room, unit.id, s.host).hunt).toBe(1);
      run(s, { op: "gain_xp", amount: 3 });
      s.as("p1")
        .apply({ type: "rules_activate", objectId: unit.id, ability: "activated:0" })
        .expectOk();
      resolveChain(s);
      expect(s.room.rules!.objects[unit.id]?.buffs).toBe(1);
      expect(xpOf(s.room, "p1")).toBe(1);
      // Not enough XP left to pay again (203.3).
      s.as("p1").apply({ type: "rules_activate", objectId: unit.id, ability: "activated:0" });
      expect(s.lastError()).not.toBeNull();
      expect(xpOf(s.room, "p1")).toBe(1);
    }
  });

  it("[C:Dragonsoul Sage][R430.2] [Reaction] [Tap]: Add [1] resolves immediately", () => {
    const s = withCards(["Dragonsoul Sage"]);
    const sage = place(s, "p1", "Dragonsoul Sage", "base");
    const entry = listActivatedAbilities("Dragonsoul Sage")[0]!;
    expect(entry.ability).toMatchObject({ addsResources: true, keywords: ["reaction"] });
    s.room.rules!.pools.p1 = { energy: 0, power: {} };
    s.as("p1").apply({ type: "rules_activate", objectId: sage.id, ability: entry.ref }).expectOk();
    expect(s.room.rules!.pools.p1!.energy).toBe(1);
    expect(s.room.rules!.chain).toHaveLength(0);
    expect(effectiveKeywords(s.room, sage.id, s.host)).not.toContain("Reaction");
  });

  it("[C:Xerath, Freed][R377.2.b][R418] [Fury], [Tap]: deal 3 to a unit — only while at a battlefield", () => {
    const s = withCards(["Xerath, Freed"]);
    const xerath = place(s, "p1", "Xerath, Freed", "base");
    const enemy = place(s, "p2", "Caitlyn, Patrolling", "battlefieldB");
    s.room.rules!.pools.p1 = { energy: 0, power: { Fury: 2 } };
    s.as("p1")
      .apply({
        type: "rules_activate",
        objectId: xerath.id,
        ability: "activated:0",
        choices: { "target:0": enemy.id },
      })
      .expectError("illegal_action");
    s.host.moveCard(s.room, "p1", "base", "battlefieldA", xerath.id);
    s.host.setExhausted(s.room, xerath.id, false);
    s.as("p1")
      .apply({
        type: "rules_activate",
        objectId: xerath.id,
        ability: "activated:0",
        choices: { "target:0": enemy.id },
      })
      .expectOk();
    resolveChain(s);
    expect(zoneOf(s, enemy.id)).toBe("trash");
  });

  it("[C:Vi, Hotheaded][R433.1.a] [2][Fury]: double my Might this turn", () => {
    const s = withCards(["Vi, Hotheaded"]);
    const vi = place(s, "p1", "Vi, Hotheaded", "base");
    s.room.rules!.pools.p1 = { energy: 2, power: { Fury: 1 } };
    s.as("p1")
      .apply({ type: "rules_activate", objectId: vi.id, ability: "activated:0" })
      .expectOk();
    resolveChain(s);
    expect(effectiveMight(s.room, vi.id, s.host)).toBe(6);
    expect(effectiveKeywords(s.room, vi.id, s.host)).toContain("Deflect");
  });

  it("[C:Divining Shells][R817][R135.2.e.7] Vision on play; [Action] Kill this, [Tap]: +2 Might this turn", () => {
    const s = withCards(["Divining Shells"]);
    const unit = place(s, "p1", "Caitlyn, Patrolling", "base");
    fund(s, "p1", "Divining Shells");
    s.as("p1").play("Divining Shells").expectOk();
    // [Vision]: the keyword trigger looks at the top card (437 prompt).
    expect(s.room.rules!.chain[0]?.abilityRef).toMatch(/^keyword:vision/);
    s.as("p1").pass().expectOk();
    s.as("p2").pass().expectOk();
    s.as("p1").choose({ optionIds: [] }).expectOk();
    const shells = s.findBoardCardAnywhere("Divining Shells")!;
    expect(effectiveKeywords(s.room, shells.id, s.host)).not.toContain("Action");
    s.as("p1")
      .apply({
        type: "rules_activate",
        objectId: shells.id,
        ability: "activated:1",
        choices: { "target:0": unit.id },
      })
      .expectOk();
    expect(zoneOf(s, shells.id)).toBe("trash");
    resolveChain(s);
    expect(effectiveMight(s.room, unit.id, s.host)).toBe(5);
  });

  it("[C:Megatusk][R801.3.a][R730.2] Spend 3 XP: your units here gain Ganking this turn", () => {
    const s = withCards(["Megatusk"]);
    const tusk = place(s, "p1", "Megatusk", "battlefieldA");
    const friend = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    const elsewhere = place(s, "p1", "Treasure Hunter", "base");
    expect(effectiveKeywords(s.room, tusk.id, s.host)).not.toContain("Ganking");
    run(s, { op: "gain_xp", amount: 3 });
    s.as("p1")
      .apply({ type: "rules_activate", objectId: tusk.id, ability: "activated:1" })
      .expectOk();
    resolveChain(s);
    expect(effectiveKeywords(s.room, tusk.id, s.host)).toContain("Ganking");
    expect(effectiveKeywords(s.room, friend.id, s.host)).toContain("Ganking");
    expect(effectiveKeywords(s.room, elsewhere.id, s.host)).not.toContain("Ganking");
  });

  it("[C:Lillia, Protector of Dreams][R440.2.c][R815] +1 Might when you play a token unit; your token units have Tank", () => {
    const s = withCards(["Lillia, Protector of Dreams", "Frisky Hunter"]);
    const lillia = place(s, "p1", "Lillia, Protector of Dreams", "base");
    expect(effectiveKeywords(s.room, lillia.id, s.host)).not.toContain("Tank");
    // Frisky Hunter (not a token) plays a Bird token: only the Bird triggers Lillia.
    fund(s, "p1", "Frisky Hunter");
    s.as("p1").play("Frisky Hunter").expectOk();
    resolveChain(s);
    const bird = cardsNamed(s, "p1", "base", "Bird")[0]!;
    expect(combatKeywordProfile(s.room, bird.id, s.host).tank).toBe(true);
    expect(combatKeywordProfile(s.room, lillia.id, s.host).tank).toBe(false);
    expect(effectiveMight(s.room, lillia.id, s.host)).toBe(5);
  });

  it("[C:Petal Pixie][R479.4][R816] +1 Might per friendly Temporary unit at my battlefield; Pixie has no Temporary", () => {
    const s = withCards(["Petal Pixie"]);
    const pixie = place(s, "p1", "Petal Pixie", "base");
    expect(effectiveKeywords(s.room, pixie.id, s.host)).not.toContain("Temporary");
    run(s, { op: "create", token: { name: "Sprite", play: true }, zone: "battlefieldA" });
    expect(effectiveMight(s.room, pixie.id, s.host)).toBe(2);
    s.host.moveCard(s.room, "p1", "base", "battlefieldA", pixie.id);
    expect(effectiveMight(s.room, pixie.id, s.host)).toBe(3);
  });
});
