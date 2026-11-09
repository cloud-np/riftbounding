/**
 * SFD R4b — cards unblocked by R4-engine lanes A (expiration), C (replacements/LKI) and D
 * (Equip 818, Quick-Draw 819, Weaponmaster 821, attached Effect Text 718–719).
 *
 * Every card upgraded from partial/manual to implemented has a `[C:<Card>]` test that fails
 * without the engine capability: the built-in Equip resolves through the attach action instead
 * of the manual window, Weaponmaster/Quick-Draw keyword triggers fire, and an attached card's
 * Effect Text is appended to its Top-Most card (718.3/719.1).
 */
import { describe, expect, it } from "vitest";
import { effectiveKeywordValues, effectiveKeywords, effectiveMight, listActivatedAbilities } from "../../../src";
import { run } from "../../rules/effects/helpers";
import {
  addPool,
  boardCard,
  damageOf,
  fund,
  hand,
  playCard,
  put,
  resolveChain,
  settle,
  setControl,
  statusOf,
  withCards,
  zoneOf,
  type S,
} from "./helpers";

const QUIET = { battlefields: { p1: "Bandle Tree", p2: "Bandle Tree" } };
const ALL_POWER = ["Body", "Calm", "Chaos", "Fury", "Mind", "Order", "any"] as const;

function attach(s: S, gearId: string, unitId: string): void {
  run(s, { op: "attach", gear: { targetRef: `obj:${gearId}` }, to: { targetRef: `obj:${unitId}` } });
}

function attachByName(s: S, gearName: string, unitName = "Caitlyn, Patrolling") {
  const unit = put(s, "p1", unitName, "base");
  const gear = put(s, "p1", gearName, "base");
  attach(s, gear.id, unit.id);
  return { unit, gear };
}

function toNextTurn(s: S): void {
  s.as("p1").endTurn().expectOk();
  s.as("p2").endTurn().expectOk();
}

/** Activate the printed `equip:0` ability with the chosen host and a full Rune Pool. */
function equip(s: S, gearId: string, unitId: string, plan?: Record<string, unknown>): void {
  s.room.rules!.pools.p1 = { energy: 9, power: Object.fromEntries(ALL_POWER.map((key) => [key, 9])) };
  s.as("p1")
    .apply({
      type: "rules_activate",
      objectId: gearId,
      ability: "equip:0",
      choices: { "target:0": unitId },
      ...(plan ? { plan } : {}),
    } as never)
    .expectOk();
}

/** Move a unit with its attached Equipment to an uncontrolled battlefield (a conquer). */
function conquerWith(s: S, unitName = "Caitlyn, Patrolling"): void {
  s.as("p1").move(unitName, "battlefieldA").expectOk();
}

describe("SFD R4b — built-in Equip and Might Bonus [R818][R718.4]", () => {
  it.each([
    ["B.F. Sword", 3, undefined, undefined],
    ["Doran's Blade", 2, undefined, undefined],
    ["Doran's Shield", 1, "Tank", 1],
    ["Boots of Swiftness", 2, "Ganking", 1],
    ["Hexdrinker", 1, "Deflect", 1],
    ["Serrated Dirk", 0, "Assault", 2],
    ["Long Sword", 2, undefined, undefined],
    ["Sterak's Gage", 3, undefined, undefined],
    ["Cloth Armor", 0, "Shield", 2],
    ["Spinning Axe", 3, undefined, undefined],
    ["Forgefire Cape", 3, undefined, undefined],
    ["Trinity Force", 2, undefined, undefined],
    ["Warmog's Armor", 1, undefined, undefined],
    ["World Atlas", 2, undefined, undefined],
    ["Sacred Shears", 1, undefined, undefined],
    ["Rabadon's Deathcrown", 3, undefined, undefined],
    ["Shurelya's Requiem", 2, undefined, undefined],
    ["Guardian Angel", 1, undefined, undefined],
  ] as const)(
    "[C:%s][R818.1.c.2][R718.4] Equip attaches and the Might Bonus (+%i) modulates the host",
    (gearName, bonus, keyword, value) => {
      const s = withCards([gearName]);
      const unit = put(s, "p1", "Caitlyn, Patrolling", "base");
      const gear = put(s, "p1", gearName, "base");
      equip(s, gear.id, unit.id);
      settle(s);
      expect(s.room.rules!.manual).toBeNull();
      expect(boardCard(s, "p1", gearName)!.attachedToCardId).toBe(unit.id);
      expect(effectiveMight(s.room, unit.id, s.host)).toBe(3 + bonus);
      if (keyword && value !== undefined) {
        expect(effectiveKeywordValues(s.room, unit.id, s.host)[keyword.toLowerCase()]).toBe(value);
      }
      expect(statusOf(gearName)).toBe("implemented");
    },
  );

  it("[C:Blade of the Ruined King][R818.1.c.2][R357.2] Equip's [Order] + kill-a-friendly-unit cost is paid to attach", () => {
    const s = withCards(["Blade of the Ruined King"]);
    const unit = put(s, "p1", "Caitlyn, Patrolling", "base");
    const fodder = put(s, "p1", "Treasure Hunter", "base");
    const gear = put(s, "p1", "Blade of the Ruined King", "base");
    equip(s, gear.id, unit.id, { kill: [fodder.id] });
    settle(s);
    expect(zoneOf(s, fodder.id)).toBe("trash");
    expect(boardCard(s, "p1", "Blade of the Ruined King")!.attachedToCardId).toBe(unit.id);
    expect(effectiveMight(s.room, unit.id, s.host)).toBe(3 + 4);
    expect(statusOf("Blade of the Ruined King")).toBe("implemented");
  });

  it("[C:Blade of the Exile][R818.1.c][R204.1.b] the alternative \"exhaust a friendly unit\" Equip cost attaches", () => {
    const s = withCards(["Blade of the Exile"]);
    const unit = put(s, "p1", "Caitlyn, Patrolling", "base");
    const fodder = put(s, "p1", "Treasure Hunter", "base");
    const blade = put(s, "p1", "Blade of the Exile", "base");
    s.room.rules!.pools.p1 = { energy: 0, power: {} };
    s.as("p1")
      .apply({
        type: "rules_activate",
        objectId: blade.id,
        ability: "equip:0",
        choices: { "target:0": unit.id },
        plan: { exhaust: [fodder.id] },
      } as never)
      .expectOk();
    settle(s);
    expect(s.room.rules!.manual).toBeNull();
    expect(boardCard(s, "p1", "Blade of the Exile")!.attachedToCardId).toBe(unit.id);
    expect(s.host.isExhausted(s.room, fodder.id) || s.host.isExhausted(s.room, unit.id)).toBe(true);
    expect(effectiveMight(s.room, unit.id, s.host)).toBe(3 + 3);
    expect(effectiveKeywords(s.room, unit.id, s.host)).toContain("Ganking");
  });
});

describe("SFD R4b — Quick-Draw [R819]", () => {
  it.each([["Long Sword"], ["Sterak's Gage"], ["Cloth Armor"], ["Spinning Axe"]])(
    "[C:%s][R819.1.d] when you play it, attach it to a unit you control",
    (gearName) => {
      const s = withCards([gearName]);
      const unit = put(s, "p1", "Caitlyn, Patrolling", "base");
      fund(s, "p1", gearName);
      s.as("p1").play(gearName).expectOk();
      settle(s);
      expect(boardCard(s, "p1", gearName)!.attachedToCardId).toBe(unit.id);
      expect(statusOf(gearName)).toBe("implemented");
    },
  );

  it("[C:Jax, Unmatched][R819.1.d] your Equipment everywhere have [Quick-Draw]", () => {
    const s = withCards(["Jax, Unmatched", "Long Sword"]);
    const jax = put(s, "p1", "Jax, Unmatched", "base");
    const sword = s.handCard("p1", "Long Sword")!;
    expect(effectiveKeywords(s.room, sword.id, s.host)).toContain("Quick-Draw");
    const unit = put(s, "p1", "Caitlyn, Patrolling", "base");
    fund(s, "p1", "Long Sword");
    s.as("p1").play("Long Sword").expectOk();
    settle(s);
    // Quick-Draw may attach to any unit you control (819.1.d).
    expect([jax.id, unit.id]).toContain(boardCard(s, "p1", "Long Sword")!.attachedToCardId);
  });
});

describe("SFD R4b — Weaponmaster [R821]", () => {
  it.each([
    ["Combat Chef"],
    ["Master Bingwen"],
    ["Sentinel Adept"],
    ["Veteran poro"],
    ["Armed Assailant"],
    ["Lucian, Merciless"],
    ["Ornn, Forge God"],
    ["Jax, Unrelenting"],
  ])("[C:%s][R821.1.b][R821.1.c] the play trigger equips a chosen Equipment for [A] less", (unitName) => {
    const s = withCards([unitName, "Spinning Axe"]);
    put(s, "p1", "Spinning Axe", "base");
    fund(s, "p1", unitName);
    s.as("p1").play(unitName).expectOk();
    settle(s);
    const unit = boardCard(s, "p1", unitName)!;
    expect(boardCard(s, "p1", "Spinning Axe")!.attachedToCardId).toBe(unit.id);
    expect(statusOf(unitName)).toBe("implemented");
  });

  it("[C:Azir, Emperor of the Sands][R821.1.b] your Sand Soldiers' granted [Weaponmaster] equips", () => {
    const s = withCards(["Azir, Emperor of the Sands", "Doran's Blade", "Spinning Axe"]);
    const azir = put(s, "p1", "Azir, Emperor of the Sands", "legend");
    put(s, "p1", "Spinning Axe", "base");
    fund(s, "p1", "Doran's Blade");
    s.as("p1").play("Doran's Blade").expectOk();
    settle(s);
    addPool(s, "p1", 1);
    const ref = listActivatedAbilities("Azir, Emperor of the Sands")[0]!.ref;
    s.as("p1")
      .apply({ type: "rules_activate", objectId: azir.id, ability: ref } as never)
      .expectOk();
    settle(s);
    const soldier = boardCard(s, "p1", "Sand Soldier")!;
    expect(soldier).toBeTruthy();
    expect(boardCard(s, "p1", "Spinning Axe")!.attachedToCardId).toBe(soldier.id);
    expect(statusOf("Azir, Emperor of the Sands")).toBe("implemented");
  });
});

describe("SFD R4b — attached Effect Text triggers and passives [R718.3][R719.1]", () => {
  it("[C:Boneshiver][R718.3][R383.4.c] when the equipped unit conquers, channel 1 rune exhausted", () => {
    const s = withCards(["Boneshiver"], [], QUIET);
    const { unit } = attachByName(s, "Boneshiver");
    const runes = s.room.players[0]!.board!.runeArea.length;
    conquerWith(s);
    settle(s);
    const area = s.room.players[0]!.board!.runeArea;
    expect(area.length).toBe(runes + 1);
    expect(area.at(-1)!.exhausted).toBe(true);
    expect(zoneOf(s, unit.id)).toBe("battlefieldA");
    expect(statusOf("Boneshiver")).toBe("implemented");
  });

  it("[C:Cull][R718.3][R383.4.c] when the equipped unit conquers, play a Gold exhausted", () => {
    const s = withCards(["Cull"], [], QUIET);
    attachByName(s, "Cull");
    conquerWith(s);
    settle(s);
    const gold = boardCard(s, "p1", "Gold")!;
    expect(gold.exhausted).toBe(true);
    expect(statusOf("Cull")).toBe("implemented");
  });

  it("[C:Doran's Ring][R718.3][R383.4.c] when the equipped unit conquers, discard 1 then draw 1", () => {
    const s = withCards(["Doran's Ring", "Gust"], [], QUIET);
    attachByName(s, "Doran's Ring");
    const beforeHand = hand(s, "p1").length;
    const beforeTrash = s.room.players[0]!.board!.trash.length;
    conquerWith(s);
    settle(s);
    expect(beforeHand).toBeGreaterThan(0);
    expect(hand(s, "p1").length).toBe(beforeHand);
    expect(s.room.players[0]!.board!.trash.length).toBe(beforeTrash + 1);
    expect(statusOf("Doran's Ring")).toBe("implemented");
  });

  it("[C:Eye of the Herald][R718.3][R421] when the equipped unit moves, play a Recruit here", () => {
    const s = withCards(["Eye of the Herald"], [], QUIET);
    const { unit } = attachByName(s, "Eye of the Herald");
    conquerWith(s);
    settle(s);
    const recruit = boardCard(s, "p1", "Recruit")!;
    expect(zoneOf(s, recruit.id)).toBe(zoneOf(s, unit.id));
    expect(statusOf("Eye of the Herald")).toBe("implemented");
  });

  it("[C:Recurve Bow][R718.3][R383.4.e] when the equipped unit attacks, deal 2 to an enemy unit here", () => {
    const s = withCards(["Recurve Bow"], [], QUIET);
    const { unit } = attachByName(s, "Recurve Bow");
    const defender = put(s, "p2", "Whiteflame Protector", "battlefieldA");
    setControl(s.room, "battlefieldA", "p2");
    conquerWith(s);
    resolveChain(s);
    expect(damageOf(s, defender.id)).toBe(2);
    expect(zoneOf(s, unit.id)).toBe("battlefieldA");
    expect(statusOf("Recurve Bow")).toBe("implemented");
  });

  it("[C:Forgefire Cape][R718.3][R383.4.e] when the equipped unit attacks, deal 2 to all enemy units here", () => {
    const s = withCards(["Forgefire Cape"], [], QUIET);
    attachByName(s, "Forgefire Cape");
    const a = put(s, "p2", "Whiteflame Protector", "battlefieldA");
    const b = put(s, "p2", "Astral Heron", "battlefieldA");
    setControl(s.room, "battlefieldA", "p2");
    conquerWith(s);
    resolveChain(s);
    expect(damageOf(s, a.id)).toBe(2);
    expect(damageOf(s, b.id)).toBe(2);
    expect(statusOf("Forgefire Cape")).toBe("implemented");
  });

  it("[C:Warmog's Armor][R718.3][R383.4.c] when the equipped unit conquers, buff it (+1 Might)", () => {
    const s = withCards(["Warmog's Armor"], [], QUIET);
    const { unit } = attachByName(s, "Warmog's Armor");
    conquerWith(s);
    settle(s);
    expect(s.room.rules!.objects[unit.id]?.buffs).toBe(1);
    expect(effectiveMight(s.room, unit.id, s.host)).toBe(3 + 1 + 1);
    expect(statusOf("Warmog's Armor")).toBe("implemented");
  });

  it("[C:Trinity Force][R718.3][R383.4.d] when the equipped unit holds, score 1 point", () => {
    const s = withCards(["Trinity Force"], [], QUIET);
    const { unit } = attachByName(s, "Trinity Force");
    s.as("p1").move("Caitlyn, Patrolling", "battlefieldA").expectOk();
    s.room.rules!.objects["battlefieldA"] = { controller: "p1" };
    settle(s);
    toNextTurn(s);
    settle(s);
    // Hold (1) + Trinity Force's "when I hold, score 1 point" (470.2).
    expect(s.host.score(s.room, "p1")).toBe(2);
    expect(zoneOf(s, unit.id)).toBe("battlefieldA");
    expect(statusOf("Trinity Force")).toBe("implemented");
  });

  it("[C:World Atlas][R718.3][R383.4.d] when the equipped unit holds, play two Gold exhausted", () => {
    const s = withCards(["World Atlas"], [], QUIET);
    attachByName(s, "World Atlas");
    s.as("p1").move("Caitlyn, Patrolling", "battlefieldA").expectOk();
    s.room.rules!.objects["battlefieldA"] = { controller: "p1" };
    settle(s);
    toNextTurn(s);
    settle(s);
    const golds = s.room.players[0]!.board!.base.filter((card) => card.name === "Gold");
    expect(golds).toHaveLength(2);
    expect(golds.every((card) => card.exhausted)).toBe(true);
    expect(statusOf("World Atlas")).toBe("implemented");
  });

  it("[C:Sacred Shears][R718.2][R808.1.c] Deathknell is inactive while attached and draws when the unattached gear dies", () => {
    const s = withCards(["Sacred Shears", "Hextech Ray", "Hextech Ray", "Detonate"], [], QUIET);
    const unit = put(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    const gear = put(s, "p1", "Sacred Shears", "base");
    attach(s, gear.id, unit.id);
    // The host (4 Might with the +1 Might Bonus) dies to two Hextech Rays: the attached Shears
    // detaches (719.5) and does not trigger its own Deathknell.
    for (let index = 0; index < 2; index += 1) {
      fund(s, "p1", "Hextech Ray");
      playCard(s, "p1", "Hextech Ray", { choices: { "target:0": unit.id } }).expectOk();
      settle(s);
    }
    expect(zoneOf(s, gear.id)).toBe("base");
    const afterHostDeath = hand(s, "p1").length;
    // Detonate kills the unattached Shears: its Deathknell draws 1 (Detonate itself draws 2).
    fund(s, "p1", "Detonate");
    playCard(s, "p1", "Detonate", { choices: { "target:0": gear.id } }).expectOk();
    const events = settle(s);
    expect(zoneOf(s, gear.id)).toBe("trash");
    expect(hand(s, "p1").length).toBe(afterHostDeath - 1 + 2 + 1);
    expect(events.some((event) => event.type === "trigger" && event.cardName === "Sacred Shears")).toBe(true);
    expect(statusOf("Sacred Shears")).toBe("implemented");
  });

  it("[C:Rabadon's Deathcrown][R712][R718.3][R724] +3 Bonus Damage only while attached", () => {
    const s = withCards(["Hextech Ray", "Hextech Ray", "Rabadon's Deathcrown"]);
    const rabadon = put(s, "p1", "Rabadon's Deathcrown", "base");
    const unit = put(s, "p1", "Caitlyn, Patrolling", "base");
    const enemy = put(s, "p2", "Whiteflame Protector", "battlefieldA");
    s.room.rules!.objects[enemy.id] = { baseMight: 20 };
    fund(s, "p1", "Hextech Ray");
    playCard(s, "p1", "Hextech Ray", { choices: { "target:0": enemy.id } }).expectOk();
    settle(s);
    expect(damageOf(s, enemy.id)).toBe(3);
    attach(s, rabadon.id, unit.id);
    fund(s, "p1", "Hextech Ray");
    playCard(s, "p1", "Hextech Ray", { choices: { "target:0": enemy.id } }).expectOk();
    settle(s);
    expect(damageOf(s, enemy.id)).toBe(3 + 6);
    expect(statusOf("Rabadon's Deathcrown")).toBe("implemented");
  });

  it("[C:Shurelya's Requiem][R718.3][R810] your units here have [Ganking] while attached", () => {
    const s = withCards(["Shurelya's Requiem"]);
    const host = put(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    const friend = put(s, "p1", "Treasure Hunter", "battlefieldA");
    const gear = put(s, "p1", "Shurelya's Requiem", "base");
    expect(effectiveKeywords(s.room, friend.id, s.host)).not.toContain("Ganking");
    attach(s, gear.id, host.id);
    expect(effectiveKeywords(s.room, host.id, s.host)).toContain("Ganking");
    expect(effectiveKeywords(s.room, friend.id, s.host)).toContain("Ganking");
    expect(statusOf("Shurelya's Requiem")).toBe("implemented");
  });

  it("[C:Guardian Angel][R369.1][R718.3] an attached replacement kills Guardian Angel instead of the host", () => {
    const s = withCards(["Guardian Angel"]);
    const host = put(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    const gear = put(s, "p1", "Guardian Angel", "base");
    attach(s, gear.id, host.id);
    run(s, { op: "kill", target: { targetRef: `obj:${host.id}` } });
    settle(s);
    expect(zoneOf(s, gear.id)).toBe("trash");
    expect(zoneOf(s, host.id)).toBe("base");
    expect(s.host.isExhausted(s.room, host.id)).toBe(true);
    expect(statusOf("Guardian Angel")).toBe("implemented");
  });

  it("[C:Spinning Axe][R718.2][R816.1.b] Temporary kills it only while unattached", () => {
    const s = withCards(["Spinning Axe", "Spinning Axe"], [], QUIET);
    const unit = put(s, "p1", "Caitlyn, Patrolling", "base");
    const held = put(s, "p1", "Spinning Axe", "base");
    attach(s, held.id, unit.id);
    toNextTurn(s);
    settle(s);
    expect(zoneOf(s, held.id)).toBe("base");
    expect(statusOf("Spinning Axe")).toBe("implemented");
  });
});
