/**
 * Spiritforged (SFD) wave R3 batch 2 — keyword units, Weaponmaster units, Equipment, Mech lords,
 * cost passives and Repeat spells.
 */
import { describe, expect, it } from "vitest";
import {
  costAdjustments,
  effectiveKeywordValues,
  effectiveKeywords,
  effectiveMight,
  listActivatedAbilities,
} from "../../../src";
import { run } from "../../rules/effects/helpers";
import {
  boardCard,
  countNamed,
  damageOf,
  hand,
  playCard,
  put,
  settle,
  statusOf,
  withCards,
  zoneOf,
  type S,
} from "./helpers";

const QUIET = { battlefields: { p1: "Bandle Tree", p2: "Bandle Tree" } };

function attachTo(s: S, gearId: string, unitId: string, controller = "p1"): void {
  run(
    s,
    { op: "attach", gear: { targetRef: `obj:${gearId}` }, to: { targetRef: `obj:${unitId}` } },
    { controller },
  );
}

/** End both turns: P1's next Beginning Phase triggers (hold, phase triggers) then resolve. */
function toNextTurn(s: S): void {
  s.as("p1").endTurn().expectOk();
  s.as("p2").endTurn().expectOk();
}

describe("SFD batch 2 — keyword-only and Weaponmaster units", () => {
  it.each([
    ["Laurent Bladekeeper", "Ganking", "ganking", 1],
    ["Laurent Duelist", "Assault", "assault", 2],
    ["Navori Scout", "Deflect", "deflect", 1],
  ])(
    "[C:%s][R801] playable at its cost with its printed keyword (%s)",
    (cardName, keyword, key, value) => {
      const s = withCards([cardName]);
      playCard(s, "p1", cardName).expectOk();
      const unit = boardCard(s, "p1", cardName)!;
      expect(effectiveKeywords(s.room, unit.id, s.host)).toContain(keyword);
      expect(effectiveKeywordValues(s.room, unit.id, s.host)[key]).toBe(value);
      expect(statusOf(cardName)).toBe("implemented");
    },
  );

  it.each([
    ["Combat Chef"],
    ["Master Bingwen"],
    ["Sentinel Adept"],
    ["Veteran poro"],
    ["Armed Assailant"],
  ])(
    "[C:%s][R821.1.b] playable at its cost with [Weaponmaster] (trigger is an engine gap: partial)",
    (cardName) => {
      const s = withCards([cardName]);
      playCard(s, "p1", cardName).expectOk();
      const unit = boardCard(s, "p1", cardName)!;
      expect(effectiveKeywords(s.room, unit.id, s.host)).toContain("Weaponmaster");
      expect(statusOf(cardName)).toBe("partial");
    },
  );
});

describe("SFD batch 2 — Equipment Might Bonus and effect-text keywords", () => {
  it.each([
    ["B.F. Sword", 3],
    ["Doran's Blade", 2],
    ["Blade of the Ruined King", 4],
    ["Long Sword", 2],
    ["Sterak's Gage", 3],
    ["Boneshiver", 2],
    ["Cull", 1],
    ["Doran's Ring", 1],
    ["Forgefire Cape", 3],
    ["Trinity Force", 2],
    ["Warmog's Armor", 1],
    ["World Atlas", 2],
    ["Sacred Shears", 1],
    ["Last Rites", 2],
    ["Skyfall of Areion", 2],
    ["Experimental Hexplate", 1],
    ["Brutalizer", 1],
    ["Rabadon's Deathcrown", 3],
    ["Guardian Angel", 1],
    ["The Zero Drive", 2],
    ["Edge of Night", 2],
  ] as const)(
    "[C:%s][R718.4][R479.4.d] the attached Equipment's Might Bonus (+%i) modulates the top-most card",
    (gearName, bonus) => {
      const s = withCards([gearName]);
      const unit = put(s, "p1", "Caitlyn, Patrolling", "base");
      const gear = put(s, "p1", gearName, "base");
      expect(effectiveMight(s.room, unit.id, s.host)).toBe(3);
      attachTo(s, gear.id, unit.id);
      expect(boardCard(s, "p1", gearName)!.attachedToCardId).toBe(unit.id);
      expect(effectiveMight(s.room, unit.id, s.host)).toBe(3 + bonus);
      expect(statusOf(gearName)).toBe("partial");
    },
  );

  it.each([
    ["Doran's Shield", "Tank", "tank", 1, 1],
    ["Boots of Swiftness", "Ganking", "ganking", 1, 2],
    ["Hexdrinker", "Deflect", "deflect", 1, 1],
    ["Serrated Dirk", "Assault", "assault", 2, 0],
    ["Cloth Armor", "Shield", "shield", 2, 0],
  ] as const)(
    "[C:%s][R718.3][R724] effect-text [%s] belongs to the equipped unit, not to the unattached gear",
    (gearName, keyword, key, value, bonus) => {
      const s = withCards([gearName]);
      const unit = put(s, "p1", "Caitlyn, Patrolling", "base");
      const gear = put(s, "p1", gearName, "base");
      expect(effectiveKeywords(s.room, gear.id, s.host)).not.toContain(keyword);
      expect(effectiveKeywords(s.room, unit.id, s.host)).not.toContain(keyword);
      attachTo(s, gear.id, unit.id);
      expect(effectiveKeywordValues(s.room, unit.id, s.host)[key]).toBe(value);
      expect(effectiveMight(s.room, unit.id, s.host)).toBe(3 + bonus);
    },
  );

  it("[C:Spinning Axe][R816.1.b][R718.2] killed at its controller's Beginning Phase only while unattached", () => {
    const s = withCards(["Spinning Axe", "Spinning Axe"], [], QUIET);
    const unit = put(s, "p1", "Caitlyn, Patrolling", "base");
    const loose = put(s, "p1", "Spinning Axe", "base");
    const held = put(s, "p1", "Spinning Axe", "base");
    attachTo(s, held.id, unit.id);
    expect(effectiveMight(s.room, unit.id, s.host)).toBe(6);
    expect(effectiveKeywords(s.room, loose.id, s.host)).not.toContain("Temporary");
    toNextTurn(s);
    settle(s);
    expect(zoneOf(s, loose.id)).toBe("trash");
    expect(zoneOf(s, held.id)).toBe("base");
  });

  it.each([["Eye of the Herald"], ["Recurve Bow"], ["Svellsongur"]])(
    "[C:%s][R718.3] nothing beyond Equip can be automated (manual)",
    (gearName) => {
      expect(statusOf(gearName)).toBe("manual");
    },
  );

  it("[C:Shurelya's Requiem][R383.4.a] when you play it, ready your units; +2 Might attached", () => {
    const s = withCards(["Shurelya's Requiem"]);
    const a = put(s, "p1", "Caitlyn, Patrolling", "base", { exhausted: true });
    const enemy = put(s, "p2", "Astral Heron", "battlefieldA", { exhausted: true });
    playCard(s, "p1", "Shurelya's Requiem").expectOk();
    settle(s);
    expect(s.host.isExhausted(s.room, a.id)).toBe(false);
    expect(s.host.isExhausted(s.room, enemy.id)).toBe(true);
    const gear = boardCard(s, "p1", "Shurelya's Requiem")!;
    expect(effectiveKeywords(s.room, gear.id, s.host)).not.toContain("Ganking");
    attachTo(s, gear.id, a.id);
    expect(effectiveMight(s.room, a.id, s.host)).toBe(5);
  });
});

describe("SFD batch 2 — Mech lords and passives", () => {
  it("[C:Petricite Monument][R809][R801.3] friendly units have Deflect (the gear and enemies do not)", () => {
    const s = withCards(["Petricite Monument"]);
    const mine = put(s, "p1", "Caitlyn, Patrolling", "base");
    const theirs = put(s, "p2", "Astral Heron", "battlefieldA");
    playCard(s, "p1", "Petricite Monument").expectOk();
    const monument = boardCard(s, "p1", "Petricite Monument")!;
    expect(effectiveKeywords(s.room, mine.id, s.host)).toContain("Deflect");
    expect(effectiveKeywords(s.room, theirs.id, s.host)).not.toContain("Deflect");
    expect(effectiveKeywords(s.room, monument.id, s.host)).toEqual(["Temporary"]);
  });

  it("[C:Breakneck Mech][R369.3][R801.3] your Mechs have Deflect and Ganking; enters ready with another Mech", () => {
    const s = withCards(["Breakneck Mech", "Clanging Sentry"]);
    const sentry = put(s, "p1", "Clanging Sentry", "base");
    playCard(s, "p1", "Breakneck Mech").expectOk();
    const mech = boardCard(s, "p1", "Breakneck Mech")!;
    expect(mech.exhausted).toBe(false);
    expect(effectiveKeywordValues(s.room, sentry.id, s.host)).toMatchObject({
      deflect: 1,
      ganking: 1,
    });
    expect(effectiveKeywordValues(s.room, mech.id, s.host)).toMatchObject({
      deflect: 1,
      ganking: 1,
    });
    const alone = withCards(["Breakneck Mech"]);
    playCard(alone, "p1", "Breakneck Mech").expectOk();
    expect(boardCard(alone, "p1", "Breakneck Mech")!.exhausted).toBe(true);
  });

  it("[C:Forecaster][R817] your Mechs have Vision: playing a Mech looks at the top card", () => {
    const s = withCards(["Forecaster", "Clanging Sentry"]);
    playCard(s, "p1", "Forecaster").expectOk();
    settle(s, () => ({ optionIds: [] }));
    const forecaster = boardCard(s, "p1", "Forecaster")!;
    expect(effectiveKeywordValues(s.room, forecaster.id, s.host).vision).toBe(1);
    playCard(s, "p1", "Clanging Sentry").expectOk();
    expect(s.room.rules!.chain.some((item) => item.abilityRef?.startsWith("keyword:vision"))).toBe(
      true,
    );
  });

  it("[C:Rumble, Mechanized Menace][R814] your Mechs have Shield (from the legend zone)", () => {
    const s = withCards(["Rumble, Mechanized Menace", "Clanging Sentry"]);
    const legend = put(s, "p1", "Rumble, Mechanized Menace", "legend");
    const sentry = put(s, "p1", "Clanging Sentry", "base");
    const other = put(s, "p1", "Caitlyn, Patrolling", "base");
    expect(effectiveKeywordValues(s.room, sentry.id, s.host).shield).toBe(1);
    expect(effectiveKeywords(s.room, other.id, s.host)).not.toContain("Shield");
    expect(effectiveKeywords(s.room, legend.id, s.host)).not.toContain("Shield");
  });

  it("[C:Rumble, Scrapper][R479.4][R383.4.d] your Mechs have +1 Might (incl. me); when I hold, play a Mech", () => {
    const s = withCards(["Rumble, Scrapper", "Clanging Sentry"], [], QUIET);
    const rumble = put(s, "p1", "Rumble, Scrapper", "battlefieldA");
    const sentry = put(s, "p1", "Clanging Sentry", "base");
    expect(effectiveMight(s.room, rumble.id, s.host)).toBe(5);
    expect(effectiveMight(s.room, sentry.id, s.host)).toBe(3);
    toNextTurn(s);
    settle(s);
    const token = boardCard(s, "p1", "Mech")!;
    expect(zoneOf(s, token.id)).toBe("base");
    expect(effectiveMight(s.room, token.id, s.host)).toBe(4);
  });

  it("[C:Trusty Ramhound][R364.3.a] +1 Might while you have another unit here", () => {
    const s = withCards(["Trusty Ramhound"]);
    const dog = put(s, "p1", "Trusty Ramhound", "battlefieldA");
    expect(effectiveMight(s.room, dog.id, s.host)).toBe(2);
    put(s, "p2", "Astral Heron", "battlefieldA");
    expect(effectiveMight(s.room, dog.id, s.host)).toBe(2);
    put(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    expect(effectiveMight(s.room, dog.id, s.host)).toBe(3);
  });

  it("[C:Ornn, Forge God][R479.4] +1 Might for each friendly gear (Weaponmaster: partial)", () => {
    const s = withCards(["Ornn, Forge God", "Doran's Blade", "Long Sword"], ["Doran's Shield"]);
    const ornn = put(s, "p1", "Ornn, Forge God", "base");
    put(s, "p1", "Doran's Blade", "base");
    put(s, "p1", "Long Sword", "base");
    put(s, "p2", "Doran's Shield", "base");
    expect(effectiveMight(s.room, ornn.id, s.host)).toBe(4 + 2);
    expect(effectiveKeywordValues(s.room, ornn.id, s.host).deflect).toBe(2);
  });

  it("[C:Battering Ram][R356.4.e][R356.4.g] costs [1] less per card played this turn, to a minimum of [1]", () => {
    const s = withCards(["Battering Ram", "Premonition", "Punch First"]);
    const ram = s.handCard("p1", "Battering Ram")!;
    const discount = () =>
      costAdjustments(s.room, s.host, { playerId: "p1", cardId: ram.id }).reduce(
        (sum, entry) => sum + (entry.energy ?? 0),
        0,
      );
    expect(discount()).toBe(0);
    playCard(s, "p1", "Premonition").expectOk();
    settle(s);
    expect(discount()).toBe(-1);
    s.room.rules!.history.cardsPlayedThisTurn.p1 = 9;
    expect(discount()).toBe(-4);
    // Five Energy with four played cards: exactly [1].
    s.room.rules!.pools.p1 = { energy: 1, power: {} };
    s.as("p1").play("Battering Ram").expectOk();
    expect(s.room.rules!.pools.p1!.energy).toBe(0);
  });

  it("[C:Jaull-Fish][R356.4] costs [2] less for each of your Mighty units", () => {
    const s = withCards(["Jaull-Fish"]);
    const fish = s.handCard("p1", "Jaull-Fish")!;
    const discount = () =>
      costAdjustments(s.room, s.host, { playerId: "p1", cardId: fish.id }).reduce(
        (sum, entry) => sum + (entry.energy ?? 0),
        0,
      );
    expect(discount()).toBe(0);
    put(s, "p1", "Astral Heron", "base");
    expect(discount()).toBe(-2);
    put(s, "p1", "Caitlyn, Patrolling", "base");
    expect(discount()).toBe(-2);
    put(s, "p1", "Whiteflame Protector", "base");
    const mighty = boardCard(s, "p1", "Whiteflame Protector")!;
    expect(discount()).toBe(effectiveMight(s.room, mighty.id, s.host) >= 5 ? -4 : -2);
  });

  it("[C:Heart of Dark Ice][R377] [Tap]: give a unit +3 Might this turn", () => {
    const s = withCards(["Heart of Dark Ice"]);
    const heart = put(s, "p1", "Heart of Dark Ice", "base");
    const unit = put(s, "p1", "Caitlyn, Patrolling", "base");
    s.as("p1")
      .apply({
        type: "rules_activate",
        objectId: heart.id,
        ability: "activated:0",
        choices: { "target:0": unit.id },
      } as never)
      .expectOk();
    settle(s);
    expect(effectiveMight(s.room, unit.id, s.host)).toBe(6);
    expect(s.host.isExhausted(s.room, heart.id)).toBe(true);
  });

  it("[C:Poro Snax][R383.4.a][R357.2] when played, draw 1; [1][Calm], [Tap], kill this: draw 1", () => {
    const s = withCards(["Poro Snax"]);
    const before = hand(s, "p1").length;
    playCard(s, "p1", "Poro Snax").expectOk();
    settle(s);
    expect(hand(s, "p1").length).toBe(before - 1 + 1);
    const snax = boardCard(s, "p1", "Poro Snax")!;
    expect(listActivatedAbilities("Poro Snax").map((entry) => entry.ref)).toEqual(["activated:1"]);
    s.room.rules!.pools.p1 = { energy: 1, power: { Calm: 1 } };
    s.as("p1")
      .apply({ type: "rules_activate", objectId: snax.id, ability: "activated:1" } as never)
      .expectOk();
    settle(s);
    expect(zoneOf(s, snax.id)).toBe("trash");
    expect(hand(s, "p1").length).toBe(before + 1);
  });
});

describe("SFD batch 2 — Repeat spells (first execution; Repeat is an engine gap)", () => {
  it("[C:Bellows Breath][R355.13] deals 1 to up to three units at the same location", () => {
    const s = withCards(["Bellows Breath"]);
    const a = put(s, "p2", "Astral Heron", "battlefieldA");
    const b = put(s, "p2", "Whiteflame Protector", "battlefieldA");
    const c = put(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    const far = put(s, "p2", "Treasure Hunter", "battlefieldB");
    playCard(s, "p1", "Bellows Breath", {
      choices: { "target:0": [a.id], "target:1": [b.id, far.id] },
    }).expectError("illegal_target");
    playCard(s, "p1", "Bellows Breath", {
      choices: { "target:0": [a.id], "target:1": [b.id, c.id] },
      fund: false,
    }).expectOk();
    settle(s);
    expect([damageOf(s, a.id), damageOf(s, b.id), damageOf(s, c.id), damageOf(s, far.id)]).toEqual([
      1, 1, 1, 0,
    ]);
    expect(statusOf("Bellows Breath")).toBe("partial");
  });

  it("[C:Blood Rush][R807] gives a unit [Assault 2] this turn", () => {
    const s = withCards(["Blood Rush"]);
    const unit = put(s, "p1", "Caitlyn, Patrolling", "base");
    playCard(s, "p1", "Blood Rush", { choices: { "target:0": unit.id } }).expectOk();
    settle(s);
    expect(effectiveKeywordValues(s.room, unit.id, s.host).assault).toBe(2);
  });

  it("[C:Danger Zone][R479.4] gives your Mechs +1 Might this turn", () => {
    const s = withCards(["Danger Zone", "Clanging Sentry"]);
    const sentry = put(s, "p1", "Clanging Sentry", "base");
    const other = put(s, "p1", "Caitlyn, Patrolling", "base");
    playCard(s, "p1", "Danger Zone").expectOk();
    settle(s);
    expect(effectiveMight(s.room, sentry.id, s.host)).toBe(3);
    expect(effectiveMight(s.room, other.id, s.host)).toBe(3);
  });

  it("[C:Desert's Call][R440.2.c] plays a 2 Might Sand Soldier", () => {
    const s = withCards(["Desert's Call"]);
    playCard(s, "p1", "Desert's Call").expectOk();
    settle(s);
    expect(countNamed(s, "p1", "base", "Sand Soldier")).toBe(1);
  });

  it("[C:Called Shot][R414][R417] looks at the top 2: draws one, recycles the other", () => {
    const s = withCards(["Called Shot"]);
    const deck = s.room.players[0]!.board!.deck;
    // The draw end of the array is the top of the Main Deck.
    const [first, second] = [deck[deck.length - 1]!, deck[deck.length - 2]!];
    const before = hand(s, "p1").length;
    playCard(s, "p1", "Called Shot").expectOk();
    settle(s, (prompt) => (prompt.kind === "choose-card" ? { optionIds: [second.id] } : undefined));
    expect(hand(s, "p1").map((card) => card.id)).toContain(second.id);
    expect(hand(s, "p1").length).toBe(before - 1 + 1);
    expect(s.room.players[0]!.board!.deck[0]!.id).toBe(first.id);
  });

  it("[C:Bonds of Strength] the catalog text omits the duration: manual", () => {
    expect(statusOf("Bonds of Strength")).toBe("manual");
  });
});
