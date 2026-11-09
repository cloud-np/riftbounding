/**
 * Spiritforged (SFD) wave R3 batch 5 — cost passives, control changes, play-from-elsewhere,
 * reveal-and-banish cards, and the partial / manual remainder.
 */
import { describe, expect, it } from "vitest";
import { costAdjustments, effectiveKeywords, getCardScript } from "../../../src";
import { run } from "../../rules/effects/helpers";
import {
  addPool,
  attack,
  boardCard,
  boardOf,
  countNamed,
  damageOf,
  hand,
  onTop,
  playCard,
  put,
  resolveChain,
  setControl,
  settle,
  statusOf,
  withCards,
  zoneOf,
  type S,
} from "./helpers";

function activate(
  s: S,
  objectId: string,
  ability: string,
  choices: Record<string, unknown> = {},
): S {
  return s.as("p1").apply({ type: "rules_activate", objectId, ability, choices } as never);
}

function attachTo(s: S, gearId: string, unitId: string): void {
  run(
    s,
    { op: "attach", gear: { targetRef: `obj:${gearId}` }, to: { targetRef: `obj:${unitId}` } },
    { controller: "p1" },
  );
}

const QUIET = { battlefields: { p1: "Bandle Tree", p2: "Bandle Tree" } };

function energyDelta(s: S, playerId: string, cardId: string): number {
  return costAdjustments(s.room, s.host, { playerId, cardId }).reduce(
    (sum, entry) => sum + (entry.energy ?? 0),
    0,
  );
}

describe("SFD batch 5 — cost passives and battlefields", () => {
  it("[C:Ornn's Forge][R356.4] while you control it, the first friendly non-token gear played each turn costs [1] less", () => {
    const s = withCards(["Doran's Blade", "Doran's Blade"], [], {
      battlefields: { p1: "Ornn's Forge", p2: "Bandle Tree" },
    });
    const first = s.handCard("p1", "Doran's Blade")!;
    // Not controlled (no friendly unit there): the passive is inactive for p1.
    expect(energyDelta(s, "p1", first.id)).toBe(0);
    put(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    expect(energyDelta(s, "p1", first.id)).toBe(-1);
    playCard(s, "p1", "Doran's Blade", {
      fund: false,
      extraEnergy: 10,
      extraPower: { Body: 4 },
    }).expectOk();
    settle(s);
    const second = s.handCard("p1", "Doran's Blade")!;
    expect(energyDelta(s, "p1", second.id)).toBe(0);
  });

  it("[C:Card Sharp][R445.2][R440.2.c] when played: you and each opponent may play a Gold token exhausted; you play one more for each opponent who did", () => {
    const s = withCards(["Card Sharp"], [], QUIET);
    playCard(s, "p1", "Card Sharp").expectOk();
    settle(s, (prompt) =>
      prompt.kind === "yes-no"
        ? { optionIds: [prompt.playerId === "p2" ? "yes" : "yes"] }
        : undefined,
    );
    expect(countNamed(s, "p1", "base", "Gold")).toBe(2);
    expect(countNamed(s, "p2", "base", "Gold")).toBe(1);
  });

  it("[C:Card Sharp][R445.2] an opponent who declines gives you nothing extra", () => {
    const s = withCards(["Card Sharp"], [], QUIET);
    playCard(s, "p1", "Card Sharp").expectOk();
    settle(s, (prompt) =>
      prompt.kind === "yes-no"
        ? { optionIds: [prompt.playerId === "p2" ? "no" : "yes"] }
        : undefined,
    );
    expect(countNamed(s, "p1", "base", "Gold")).toBe(1);
    expect(countNamed(s, "p2", "base", "Gold")).toBe(0);
  });

  it("[C:Hostile Takeover][R359.3.e.16][R416] take control of an enemy unit at a battlefield and ready it; at end of turn it is recalled to its owner's base", () => {
    const s = withCards(["Hostile Takeover"], [], QUIET);
    const victim = put(s, "p2", "Astral Heron", "battlefieldA", { exhausted: true });
    expect(victim.exhausted).toBe(true);
    playCard(s, "p1", "Hostile Takeover", { choices: { "target:0": victim.id } }).expectOk();
    resolveChain(s);
    expect(s.host.findCard(s.room, victim.id)?.playerId).toBe("p1");
    expect(s.host.findCard(s.room, victim.id)?.card.exhausted ?? false).toBe(false);
    s.as("p1").endTurn().expectOk();
    settle(s);
    const back = s.host.findCard(s.room, victim.id);
    expect(back?.playerId).toBe("p2");
    expect(back?.zone).toBe("base");
  });

  it("[C:Arcane Shift][R428][R420.3] banish a friendly unit and replay it free; deal 3 to an enemy unit at a battlefield; banish this", () => {
    const s = withCards(["Arcane Shift"], [], QUIET);
    const mine = put(s, "p1", "Caitlyn, Patrolling", "base");
    const enemy = put(s, "p2", "Astral Heron", "battlefieldA");
    playCard(s, "p1", "Arcane Shift", {
      choices: { "target:0": mine.id, "target:1": enemy.id },
    }).expectOk();
    const events = resolveChain(s);
    expect(damageOf(s, enemy.id)).toBe(3);
    expect(events.some((event) => event.type === "banish" && event.cardId === mine.id)).toBe(true);
    expect(events.some((event) => event.type === "card_played" && event.cardId === mine.id)).toBe(
      true,
    );
    expect(boardCard(s, "p1", "Caitlyn, Patrolling")).toBeDefined();
    expect(boardOf(s, "p1").banished.map((card) => card.name)).toContain("Arcane Shift");
    expect(boardOf(s, "p1").trash.map((card) => card.name)).not.toContain("Arcane Shift");
  });

  it("[C:Azir, Ascendant][R421][R436] [Calm]: Action — swap places with a unit you control; may attach one of its Equipment to me; once per turn", () => {
    const s = withCards(["Azir, Ascendant", "Caitlyn, Patrolling", "Doran's Blade"], [], QUIET);
    const azir = put(s, "p1", "Azir, Ascendant", "base");
    const ally = put(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    const blade = put(s, "p1", "Doran's Blade", "base");
    attachTo(s, blade.id, ally.id);
    addPool(s, "p1", 0, { Calm: 2 });
    activate(s, azir.id, "activated:0", { "target:0": ally.id }).expectOk();
    settle(s);
    expect(zoneOf(s, azir.id)).toBe("battlefieldA");
    expect(zoneOf(s, ally.id)).toBe("base");
    expect(boardCard(s, "p1", "Doran's Blade")!.attachedToCardId).toBe(azir.id);
    // Once per turn.
    activate(s, azir.id, "activated:0", { "target:0": ally.id }).expectError("illegal_action");
  });

  it("[C:Rell, Magnetic][R435][R387] when I attack: may play an Equipment costing ≤[2] ignoring its cost; then attach it to me", () => {
    const s = withCards(["Doran's Blade", "Rell, Magnetic"], [], QUIET);
    const blade = s.handCard("p1", "Doran's Blade")!;
    const { attacker } = attack(s, "Rell, Magnetic", ["Astral Heron"]);
    resolveChain(s, (prompt) =>
      prompt.kind === "choose-card" ? { optionIds: [blade.id] } : undefined,
    );
    expect(boardCard(s, "p1", "Doran's Blade")?.attachedToCardId).toBe(attacker.id);
  });

  it("[C:Here to Help][R355.2.a][R356.4] play a unit from hand to a battlefield you control, reducing its cost by [3]", () => {
    const s = withCards(["Here to Help", "Astral Heron"], [], QUIET);
    put(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    const heron = s.handCard("p1", "Astral Heron")!;
    playCard(s, "p1", "Here to Help", { extraEnergy: 4 }).expectOk();
    settle(s, (prompt) => (prompt.kind === "choose-card" ? { optionIds: [heron.id] } : undefined));
    expect(zoneOf(s, heron.id)).toBe("battlefieldA");
    // Astral Heron costs 7: 3 less = 4, exactly what was added.
    expect(s.room.rules!.pools.p1!.energy).toBe(0);
  });

  it("[C:Void Rush][R425][R428][R414] reveal 2: banish one and play it for [2] less; draw the other", () => {
    const s = withCards(["Void Rush", "Treasure Hunter", "Stellacorn Herder"], [], QUIET);
    const other = onTop(s, "p1", "Stellacorn Herder");
    const picked = onTop(s, "p1", "Treasure Hunter");
    playCard(s, "p1", "Void Rush").expectOk();
    resolveChain(s, (prompt) =>
      prompt.kind === "choose-card" ? { optionIds: [picked.id] } : undefined,
    );
    expect(zoneOf(s, picked.id)).toBe("base");
    expect(zoneOf(s, other.id)).toBe("hand");
  });

  it("[C:Rek'Sai, Void Burrower][R383.4][R417] when you conquer: may exhaust me, reveal 2, banish one and play it; recycle the rest", () => {
    const s = withCards(
      ["Treasure Hunter", "Stellacorn Herder", "Rek'Sai, Void Burrower", "Caitlyn, Patrolling"],
      [],
      QUIET,
    );
    const burrower = put(s, "p1", "Rek'Sai, Void Burrower", "legend");
    const rest = onTop(s, "p1", "Stellacorn Herder");
    const picked = onTop(s, "p1", "Treasure Hunter");
    addPool(s, "p1", 2);
    put(s, "p1", "Caitlyn, Patrolling", "base");
    s.as("p1").move("Caitlyn, Patrolling", "battlefieldA").expectOk();
    settle(s, (prompt) => (prompt.kind === "choose-card" ? { optionIds: [picked.id] } : undefined));
    expect(zoneOf(s, picked.id)).toBe("base");
    expect(zoneOf(s, rest.id)).toBe("deck");
    expect(boardOf(s, "p1").deck[0]!.id).toBe(rest.id);
    expect(boardCard(s, "p1", "Rek'Sai, Void Burrower")?.exhausted).toBe(true);
    void burrower;
  });

  it("[C:Rek'Sai, Swarm Queen][R383.4][R355.2.b] when I attack: reveal 2, banish one and play it (a unit here); recycle the rest", () => {
    const s = withCards(
      ["Treasure Hunter", "Stellacorn Herder", "Rek'Sai, Swarm Queen"],
      [],
      QUIET,
    );
    const rest = onTop(s, "p1", "Stellacorn Herder");
    const picked = onTop(s, "p1", "Treasure Hunter");
    addPool(s, "p1", 2);
    attack(s, "Rek'Sai, Swarm Queen", ["Astral Heron"]);
    resolveChain(s, (prompt) =>
      prompt.kind === "choose-card" ? { optionIds: [picked.id] } : undefined,
    );
    expect(zoneOf(s, picked.id)).toBe("battlefieldA");
    expect(zoneOf(s, rest.id)).toBe("deck");
  });

  it("[C:Fizz, Trickster][R420.3][R356.1.b] when played: may play a spell costing ≤[3] energy from your trash, ignoring its Energy cost (Power still paid)", () => {
    const s = withCards(["Fizz, Trickster", "Premonition"], [], QUIET);
    const spell = put(s, "p1", "Premonition", "trash");
    playCard(s, "p1", "Fizz, Trickster").expectOk();
    addPool(s, "p1", 0, { Mind: 3 });
    settle(s, (prompt) => (prompt.kind === "choose-card" ? { optionIds: [spell.id] } : undefined));
    expect(s.room.rules!.history.cardsPlayedThisTurn.p1).toBeGreaterThanOrEqual(2);
    expect(Object.values(s.room.rules!.pools.p1!.power).reduce((a, b) => a + (b ?? 0), 0)).toBe(0);
  });

  it("[C:Jayce, Man of Progress][R429][R420.3] when played: may kill a friendly gear; if you do, play a gear costing ≤[7] from hand ignoring its Energy cost", () => {
    const s = withCards(["Jayce, Man of Progress", "Doran's Blade", "Long Sword"], [], QUIET);
    const old = put(s, "p1", "Long Sword", "base");
    const blade = s.handCard("p1", "Doran's Blade")!;
    playCard(s, "p1", "Jayce, Man of Progress", { choices: { "target:0": old.id } }).expectOk();
    addPool(s, "p1", 0, { Body: 1 });
    settle(s, (prompt) => (prompt.kind === "choose-card" ? { optionIds: [blade.id] } : undefined));
    expect(zoneOf(s, old.id)).toBe("trash");
    expect(zoneOf(s, blade.id)).toBe("base");
  });

  it("[C:Vex, Cheerless][R356.4] while I'm in combat, friendly spells cost [1][Rune] less", () => {
    const s = withCards(["Hextech Ray", "Vex, Cheerless"], [], QUIET);
    const spell = s.handCard("p1", "Hextech Ray")!;
    const { attacker } = attack(s, "Vex, Cheerless", ["Astral Heron"]);
    void attacker;
    const adjust = costAdjustments(s.room, s.host, { playerId: "p1", cardId: spell.id });
    expect(adjust.some((entry) => entry.energy === -1 && entry.power?.any === -1)).toBe(true);
  });

  it("[C:Jax, Unmatched][R727.1.b] your Equipment have Quick-Draw", () => {
    const s = withCards(["Jax, Unmatched", "Doran's Blade"], [], QUIET);
    put(s, "p1", "Jax, Unmatched", "base");
    const blade = put(s, "p1", "Doran's Blade", "base");
    expect(effectiveKeywords(s.room, blade.id, s.host)).toContain("Quick-Draw");
  });
});

const PARTIAL = [
  ["Hostile Takeover", "R463"],
  ["Fizz, Trickster", "R417"],
  ["Jayce, Man of Progress", "R420.3"],
  ["Rek'Sai, Swarm Queen", "R355.2.b"],
  ["Vex, Cheerless", "R356.6"],
  ["Rek'Sai, Breacher", "R727.1.b"],
  ["Sivir, Mercenary", "R165"],
  ["Sivir, Ambitious", "R467.2"],
  ["Tianna Crownguard", "R470"],
  ["Yone, Blademaster", "R468.5"],
  ["Akshan, Mischievous", "R357.2"],
  ["Rengar, Pouncing", "R355.2.b"],
  ["Gearhead", "R718.4"],
  ["Needlessly Large Yordle", "R472"],
] as const;

const MANUAL = [
  ["Ancient Henge", "R357"],
  ["Hextech Anomaly", "R357"],
  ["Assembly Rig", "R203.3"],
  ["Black Market Broker", "R811.1.b"],
  ["Dauntless Vanguard", "R355.2.b"],
  ["Ezreal, Prodigal Explorer", "R355.7"],
  ["Forge of the Fluft", "R718"],
  ["Forgotten Monument", "R054.1"],
  ["Irelia, Graceful", "R356.4"],
  ["Jae Medarda", "R355.7"],
  ["Legion Quartermaster", "R357.2"],
  ["Marai Spire", "R820.1"],
  ["Minotaur Reckoner", "R421"],
  ["Ornn, Fire Below the Mountain", "R165"],
  ["Perched Grimwyrm", "R355.17"],
  ["Rockfall Path", "R355.2"],
  ["Spirit Wheel", "R355.7"],
  ["Temporal Portal", "R820.1"],
  ["Void Hatchling", "R425"],
] as const;

describe("SFD batch 5 — partial and manual cards name the missing capability", () => {
  it.each(PARTIAL)("[C:%s][%s] partial: notes name what is not automated", (name, rule) => {
    expect(statusOf(name)).toBe("partial");
    expect(getCardScript(name)!.notes).toContain(rule.slice(1));
  });

  it.each(MANUAL)("[C:%s][%s] manual: notes name the missing capability", (name, rule) => {
    expect(statusOf(name)).toBe("manual");
    expect(getCardScript(name)!.notes).toContain(rule.slice(1));
  });

  it("[C:Gearhead][R727.1.b] keywords printed on the catalog card stay intrinsic (Accelerate)", () => {
    const s = withCards(["Gearhead"], [], QUIET);
    const card = put(s, "p1", "Gearhead", "base");
    expect(effectiveKeywords(s.room, card.id, s.host)).toContain("Accelerate");
  });
});
