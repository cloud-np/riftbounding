/**
 * Spiritforged (SFD) wave R3 batch 3 — move / combat / conquer / hold triggers, battlefields,
 * play effects with optional additional costs and delayed effects.
 */
import type { CardInstance } from "@rift/protocol";
import { describe, expect, it } from "vitest";
import { effectiveKeywords, effectiveMight } from "../../../src";
import { run } from "../../rules/effects/helpers";
import {
  addPool,
  attack,
  boardCard,
  boardOf,
  countNamed,
  damageOf,
  hand,
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

const QUIET = { battlefields: { p1: "Bandle Tree", p2: "Bandle Tree" } };

function toNextTurn(s: S): void {
  s.as("p1").endTurn().expectOk();
  s.as("p2").endTurn().expectOk();
}

/** Put `card` on top of its owner's Main Deck (the draw end of the array). */
function onTop(s: S, playerId: string, name: string): CardInstance {
  const board = boardOf(s, playerId);
  for (const pool of [board.hand, board.deck, board.trash]) {
    const index = pool.findIndex((card) => card.name === name);
    if (index < 0) continue;
    const [card] = pool.splice(index, 1);
    board.deck.push(card!);
    return card!;
  }
  throw new Error(`onTop: ${name} not found`);
}

function score(s: S, playerId: string): number {
  return boardOf(s, playerId).score ?? 0;
}

describe("SFD batch 3 — move triggers", () => {
  it("[C:Apprentice Smith][R425][R414][R417] when I move: reveal the top card; a gear is drawn, anything else recycled", () => {
    const s = withCards(["Apprentice Smith", "Doran's Blade"], [], QUIET);
    put(s, "p1", "Apprentice Smith", "base");
    const gear = onTop(s, "p1", "Doran's Blade");
    s.as("p1").move("Apprentice Smith", "battlefieldA").expectOk();
    settle(s);
    expect(zoneOf(s, gear.id)).toBe("hand");
    const other = withCards(["Apprentice Smith", "Premonition"], [], QUIET);
    put(other, "p1", "Apprentice Smith", "base");
    const spell = onTop(other, "p1", "Premonition");
    other.as("p1").move("Apprentice Smith", "battlefieldA").expectOk();
    settle(other);
    expect(boardOf(other, "p1").deck[0]!.id).toBe(spell.id);
  });

  it("[C:Harpoon Squad][R421] when I move from a battlefield, +2 Might this turn", () => {
    const s = withCards(["Harpoon Squad"], [], QUIET);
    const squad = put(s, "p1", "Harpoon Squad", "battlefieldA");
    s.as("p1").move("Harpoon Squad", "base").expectOk();
    settle(s);
    expect(effectiveMight(s.room, squad.id, s.host)).toBe(6);
  });

  it("[C:Ribbon Dancer][R421] when I move to a battlefield, another friendly unit gets +1 Might this turn", () => {
    const s = withCards(["Ribbon Dancer"], [], QUIET);
    put(s, "p1", "Ribbon Dancer", "base");
    const friend = put(s, "p1", "Caitlyn, Patrolling", "base");
    s.as("p1").move("Ribbon Dancer", "battlefieldA").expectOk();
    settle(s);
    expect(effectiveMight(s.room, friend.id, s.host)).toBe(4);
  });

  it("[C:Corrupt Enforcer][R423][R468.3] moving to a battlefield discards 1; winning a combat draws 1", () => {
    const s = withCards(["Corrupt Enforcer", "Premonition", "Detonate"], [], QUIET);
    const before = hand(s, "p1").length - 1;
    attack(s, "Corrupt Enforcer", ["Treasure Hunter"]);
    const events = settle(s);
    expect(
      events.filter((event) => event.type === "discard" && event.playerId === "p1"),
    ).toHaveLength(1);
    expect(
      events.some((event) => event.type === "combat_result" && event.data?.winner === "p1"),
    ).toBe(true);
    expect(hand(s, "p1").length).toBe(before - 1 + 1);
  });

  it("[C:Corina Veraza][R440.2.b] when I move to a battlefield, play three 1 Might Recruits here", () => {
    const s = withCards(["Corina Veraza"], [], QUIET);
    put(s, "p1", "Corina Veraza", "base");
    s.as("p1").move("Corina Veraza", "battlefieldA").expectOk();
    settle(s);
    expect(countNamed(s, "p1", "battlefieldA", "Recruit")).toBe(3);
  });

  it("[C:Fae Porter][R740.4.a][R383.3.b] may pay [Chaos] to move a unit you control to the same battlefield", () => {
    const s = withCards(["Fae Porter"], [], QUIET);
    put(s, "p1", "Fae Porter", "base");
    const friend = put(s, "p1", "Caitlyn, Patrolling", "base");
    addPool(s, "p1", 0, { Chaos: 1 });
    s.as("p1").move("Fae Porter", "battlefieldA").expectOk();
    settle(s);
    expect(zoneOf(s, friend.id)).toBe("battlefieldA");
    expect(s.room.rules!.pools.p1!.power.Chaos ?? 0).toBe(0);
  });
});

describe("SFD batch 3 — conquer, hold and combat", () => {
  it("[C:Plundering Poro][R383.4.c.2.a] when I conquer, play a Gold token exhausted", () => {
    const s = withCards(["Plundering Poro"], [], QUIET);
    put(s, "p1", "Plundering Poro", "base");
    s.as("p1").move("Plundering Poro", "battlefieldA").expectOk();
    settle(s);
    expect(boardCard(s, "p1", "Gold")!.exhausted).toBe(true);
  });

  it("[C:Eminent Benefactor][R383.4.d.2.a] when I hold, play two Gold tokens exhausted", () => {
    const s = withCards(["Eminent Benefactor"], [], QUIET);
    put(s, "p1", "Eminent Benefactor", "battlefieldA");
    toNextTurn(s);
    settle(s);
    expect(countNamed(s, "p1", "base", "Gold")).toBe(2);
  });

  it("[C:Dunebreaker][R369.3][R383.4.d] enters ready with two or fewer cards in hand; when I hold, draw 2", () => {
    const s = withCards(["Dunebreaker"], [], QUIET);
    const board = boardOf(s, "p1");
    const keep = board.hand.find((card) => card.name === "Dunebreaker")!;
    board.deck.push(...board.hand.filter((card) => card.id !== keep.id).splice(0));
    board.hand.splice(0, board.hand.length, keep, board.deck.shift()!);
    playCard(s, "p1", "Dunebreaker").expectOk();
    expect(boardCard(s, "p1", "Dunebreaker")!.exhausted).toBe(false);
    const crowded = withCards(["Dunebreaker", "Premonition", "Detonate", "Punch First"], [], QUIET);
    playCard(crowded, "p1", "Dunebreaker").expectOk();
    expect(hand(crowded, "p1").length).toBeGreaterThan(2);
    expect(boardCard(crowded, "p1", "Dunebreaker")!.exhausted).toBe(true);
    const holder = withCards(["Dunebreaker"], [], QUIET);
    put(holder, "p1", "Dunebreaker", "battlefieldA");
    const before = hand(holder, "p1").length;
    toNextTurn(holder);
    settle(holder);
    // +2 from the hold trigger, +1 from the Draw Phase.
    expect(hand(holder, "p1").length).toBe(before + 3);
  });

  it("[C:Guardian of the Passage][R383.4.d] when I hold, may return a unit or gear from your trash to hand", () => {
    const s = withCards(["Guardian of the Passage", "Doran's Blade"], [], QUIET);
    put(s, "p1", "Guardian of the Passage", "battlefieldA");
    const gear = put(s, "p1", "Doran's Blade", "trash");
    toNextTurn(s);
    settle(s, (prompt) => (prompt.kind === "choose-card" ? { optionIds: [gear.id] } : undefined));
    expect(zoneOf(s, gear.id)).toBe("hand");
  });

  it("[C:Lucian, Merciless][R383.3.e] the first time I conquer each turn, ready me (Weaponmaster: partial)", () => {
    const s = withCards(["Lucian, Merciless"], [], QUIET);
    const lucian = put(s, "p1", "Lucian, Merciless", "base");
    s.as("p1").move("Lucian, Merciless", "battlefieldA").expectOk();
    settle(s);
    expect(s.host.isExhausted(s.room, lucian.id)).toBe(false);
    run(s, {
      op: "grant_keyword",
      keyword: "Ganking",
      target: { targetRef: `obj:${lucian.id}` },
      duration: "this-turn",
    });
    s.as("p1").move("Lucian, Merciless", "battlefieldB").expectOk();
    settle(s);
    expect(s.host.isExhausted(s.room, lucian.id)).toBe(true);
    expect(statusOf("Lucian, Merciless")).toBe("implemented");
  });

  it("[C:Draven, Vanquisher][R468.3][R383.4.e] may pay [Fury] for +2 when attacking; winning plays a Gold", () => {
    const s = withCards(["Draven, Vanquisher"], [], QUIET);
    addPool(s, "p1", 0, { Fury: 1 });
    const { attacker } = attack(s, "Draven, Vanquisher", ["Treasure Hunter"]);
    resolveChain(s);
    expect(effectiveMight(s.room, attacker.id, s.host)).toBe(6);
    settle(s);
    expect(countNamed(s, "p1", "base", "Gold")).toBe(1);
  });

  it("[C:Draven, Audacious][R468.3][R429] winning a combat scores 1 (once a turn); dying in combat gives an opponent 1", () => {
    const s = withCards(["Draven, Audacious"], [], QUIET);
    attack(s, "Draven, Audacious", ["Treasure Hunter"]);
    settle(s);
    // Conquer (1) + Draven (1).
    expect(score(s, "p1")).toBe(2);
    const loser = withCards(["Draven, Audacious"], [], QUIET);
    attack(loser, "Draven, Audacious", ["Astral Heron"]);
    settle(loser);
    expect(
      zoneOf(
        loser,
        boardOf(loser, "p1").trash.find((card) => card.name === "Draven, Audacious")!.id,
      ),
    ).toBe("trash");
    expect(score(loser, "p2")).toBe(1);
  });

  it("[C:Draven, Glorious Executioner][R468.3] when you win a combat, draw 1", () => {
    const s = withCards(["Draven, Glorious Executioner"], [], QUIET);
    put(s, "p1", "Draven, Glorious Executioner", "legend");
    const before = hand(s, "p1").length;
    attack(s, "Astral Heron", ["Treasure Hunter"]);
    settle(s);
    expect(hand(s, "p1").length).toBe(before + 1);
  });

  it("[C:Loyal Pup][R383.4.f][R466.2.c.3] when you defend at a battlefield, you may move me there", () => {
    const s = withCards(["Loyal Pup"], [], { ...QUIET, firstPlayer: "p2" });
    const pup = put(s, "p1", "Loyal Pup", "base");
    put(s, "p1", "Astral Heron", "battlefieldA");
    setControl(s.room, "battlefieldA", "p1");
    put(s, "p2", "Treasure Hunter", "base");
    s.as("p2").move("Treasure Hunter", "battlefieldA").expectOk();
    resolveChain(s);
    expect(zoneOf(s, pup.id)).toBe("battlefieldA");
  });

  it("[C:Overzealous Fan][R383.4.f][R740.4.a] when I defend, may kill me to move an attacking unit to its base", () => {
    const s = withCards(["Overzealous Fan"], [], { ...QUIET, firstPlayer: "p2" });
    const fan = put(s, "p1", "Overzealous Fan", "battlefieldA");
    setControl(s.room, "battlefieldA", "p1");
    const raider = put(s, "p2", "Astral Heron", "base");
    s.as("p2").move("Astral Heron", "battlefieldA").expectOk();
    resolveChain(s);
    expect(zoneOf(s, fan.id)).toBe("trash");
    expect(zoneOf(s, raider.id)).toBe("base");
  });

  it("[C:Fiora, Worthy][R709][R740.4.a] when a unit you control becomes Mighty, may pay [Order] to ready it", () => {
    const s = withCards(["Fiora, Worthy", "Punch First"]);
    put(s, "p1", "Fiora, Worthy", "base");
    const unit = put(s, "p1", "Caitlyn, Patrolling", "base", { exhausted: true });
    playCard(s, "p1", "Punch First", { choices: { "target:0": unit.id } }).expectOk();
    addPool(s, "p1", 0, { Order: 1 });
    settle(s);
    expect(effectiveMight(s.room, unit.id, s.host)).toBe(8);
    expect(s.host.isExhausted(s.room, unit.id)).toBe(false);
  });

  it("[C:Fiora, Grand Duelist][R709] when one of your units becomes Mighty, may exhaust me to channel 1 rune exhausted", () => {
    const s = withCards(["Fiora, Grand Duelist", "Punch First"]);
    const legend = put(s, "p1", "Fiora, Grand Duelist", "legend");
    const unit = put(s, "p1", "Caitlyn, Patrolling", "base");
    const runes = boardOf(s, "p1").runeArea.length;
    playCard(s, "p1", "Punch First", { choices: { "target:0": unit.id } }).expectOk();
    settle(s);
    expect(s.host.isExhausted(s.room, legend.id)).toBe(true);
    const area = boardOf(s, "p1").runeArea;
    expect(area.length).toBe(runes + 1);
    expect(area[area.length - 1]!.exhausted).toBe(true);
  });
});

describe("SFD batch 3 — battlefields", () => {
  function conquerAt(battlefield: string, unit = "Caitlyn, Patrolling", extra: string[] = []): S {
    const s = withCards(extra, [], { battlefields: { p1: battlefield, p2: "Bandle Tree" } });
    put(s, "p1", unit, "base");
    s.as("p1").move(unit, "battlefieldA").expectOk();
    return s;
  }

  it("[C:Hall of Legends][R383.4.c.2.b] when you conquer here, may pay [1] to ready your legend", () => {
    const s = withCards([], [], { battlefields: { p1: "Hall of Legends", p2: "Bandle Tree" } });
    const legend = boardOf(s, "p1").legend[0]!;
    legend.exhausted = true;
    put(s, "p1", "Caitlyn, Patrolling", "base");
    addPool(s, "p1", 1);
    s.as("p1").move("Caitlyn, Patrolling", "battlefieldA").expectOk();
    settle(s);
    expect(s.host.isExhausted(s.room, legend.id)).toBe(false);
  });

  it("[C:Treasure Hoard][R383.4.c.2.b] when you conquer here, may pay [1] to play a Gold token exhausted", () => {
    const s = withCards([], [], { battlefields: { p1: "Treasure Hoard", p2: "Bandle Tree" } });
    put(s, "p1", "Caitlyn, Patrolling", "base");
    addPool(s, "p1", 1);
    s.as("p1").move("Caitlyn, Patrolling", "battlefieldA").expectOk();
    settle(s);
    expect(countNamed(s, "p1", "base", "Gold")).toBe(1);
  });

  it("[C:Power Nexus][R383.4.d.2.b] when you hold here, may pay four [Rune] to score 1 point", () => {
    const s = withCards([], [], {
      battlefields: { p1: "Power Nexus", p2: "Bandle Tree" },
      p1: { runes: ["Calm Rune", "Calm Rune", "Calm Rune", "Calm Rune"] },
    });
    put(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    const before = score(s, "p1");
    toNextTurn(s);
    settle(s);
    // Hold point + Power Nexus point (paid by recycling four runes, 164.2.b).
    expect(score(s, "p1")).toBe(before + 2);
  });

  it("[C:The Papertree][R431] when you hold here, each player channels 1 rune exhausted", () => {
    const s = withCards([], [], { battlefields: { p1: "The Papertree", p2: "Bandle Tree" } });
    put(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    const runes1 = boardOf(s, "p1").runeArea.length;
    const runes2 = boardOf(s, "p2").runeArea.length;
    toNextTurn(s);
    settle(s);
    // P1 also channels 2 in its own Channel Phase after the Beginning Phase.
    expect(boardOf(s, "p1").runeArea.length).toBe(runes1 + 1 + 2);
    expect(
      boardOf(s, "p2").runeArea.filter((rune) => rune.exhausted).length,
    ).toBeGreaterThanOrEqual(1);
    expect(boardOf(s, "p2").runeArea.length).toBeGreaterThan(runes2);
  });

  it("[C:Minefield][R383.4.c.2.b] when you conquer here, the top 2 cards of your Main Deck go to your trash", () => {
    const s = withCards([], [], { battlefields: { p1: "Minefield", p2: "Bandle Tree" } });
    const deck = boardOf(s, "p1").deck;
    const top = [deck[deck.length - 1]!.id, deck[deck.length - 2]!.id];
    put(s, "p1", "Caitlyn, Patrolling", "base");
    s.as("p1").move("Caitlyn, Patrolling", "battlefieldA").expectOk();
    settle(s);
    for (const id of top) expect(zoneOf(s, id)).toBe("trash");
  });

  it("[C:Sunken Temple][R383.2.a.1][R706] conquering here with a Mighty unit: may pay [1] to draw 1", () => {
    const s = conquerAt("Sunken Temple", "Astral Heron");
    addPool(s, "p1", 1);
    const before = hand(s, "p1").length;
    settle(s);
    expect(hand(s, "p1").length).toBe(before + 1);
    const weak = conquerAt("Sunken Temple", "Caitlyn, Patrolling");
    addPool(weak, "p1", 1);
    expect(weak.room.rules!.chain.some((item) => item.cardName === "Sunken Temple")).toBe(false);
  });

  it("[C:Seat of Power][R491.2] when you conquer here, draw 1 for each other battlefield you control", () => {
    const s = withCards([], [], { battlefields: { p1: "Seat of Power", p2: "Bandle Tree" } });
    put(s, "p1", "Astral Heron", "battlefieldB");
    setControl(s.room, "battlefieldB", "p1");
    put(s, "p1", "Caitlyn, Patrolling", "base");
    const before = hand(s, "p1").length;
    s.as("p1").move("Caitlyn, Patrolling", "battlefieldA").expectOk();
    settle(s);
    expect(hand(s, "p1").length).toBe(before + 1);
  });

  it("[C:Ravenbloom Conservatory][R383.4.f][R425] when you defend here, a revealed spell goes to your hand", () => {
    const s = withCards(["Premonition"], [], {
      battlefields: { p1: "Ravenbloom Conservatory", p2: "Bandle Tree" },
      firstPlayer: "p2",
    });
    put(s, "p1", "Astral Heron", "battlefieldA");
    setControl(s.room, "battlefieldA", "p1");
    const spell = onTop(s, "p1", "Premonition");
    put(s, "p2", "Treasure Hunter", "base");
    s.as("p2").move("Treasure Hunter", "battlefieldA").expectOk();
    resolveChain(s);
    expect(zoneOf(s, spell.id)).toBe("hand");
  });

  it("[C:Veiled Temple][R416][R436] when you conquer here, may ready a friendly gear; an Equipment may be detached", () => {
    const s = withCards(["Doran's Blade"], [], {
      battlefields: { p1: "Veiled Temple", p2: "Bandle Tree" },
    });
    const unit = put(s, "p1", "Caitlyn, Patrolling", "base");
    const gear = put(s, "p1", "Doran's Blade", "base", { exhausted: true });
    s.host.attach(s.room, gear.id, unit.id);
    s.as("p1").move("Caitlyn, Patrolling", "battlefieldA").expectOk();
    settle(s);
    const after = boardCard(s, "p1", "Doran's Blade")!;
    expect(after.exhausted).toBe(false);
    expect(after.attachedToCardId).toBeUndefined();
  });

  it("[C:Emperor's Dais][R740.4.a] when you conquer here, may pay [1] and return a unit here to play a Sand Soldier here", () => {
    const s = conquerAt("Emperor's Dais");
    const unit = boardCard(s, "p1", "Caitlyn, Patrolling")!;
    addPool(s, "p1", 1);
    settle(s);
    expect(zoneOf(s, unit.id)).toBe("hand");
    expect(countNamed(s, "p1", "battlefieldA", "Sand Soldier")).toBe(1);
  });
});

describe("SFD batch 3 — delayed effects and buffs", () => {
  it("[C:Rally the Troops][R390][R701] friendly units played this turn are buffed; draw 1", () => {
    const s = withCards(["Rally the Troops", "Eager Drakehound"]);
    const before = hand(s, "p1").length;
    playCard(s, "p1", "Rally the Troops").expectOk();
    settle(s);
    expect(hand(s, "p1").length).toBe(before - 1 + 1);
    playCard(s, "p1", "Eager Drakehound").expectOk();
    settle(s);
    const dog = boardCard(s, "p1", "Eager Drakehound")!;
    expect(s.room.rules!.objects[dog.id]?.buffs).toBe(1);
  });

  it("[C:Bushwhack][R369.3][R391.4] friendly units enter ready this turn; play a Gold token exhausted", () => {
    const s = withCards(["Bushwhack", "Laurent Bladekeeper"]);
    playCard(s, "p1", "Bushwhack").expectOk();
    settle(s);
    expect(boardCard(s, "p1", "Gold")!.exhausted).toBe(true);
    playCard(s, "p1", "Laurent Bladekeeper").expectOk();
    expect(boardCard(s, "p1", "Laurent Bladekeeper")!.exhausted).toBe(false);
  });

  it("[C:Simian Ancestor][R701] when you buff me, ready me", () => {
    const s = withCards(["Rally the Troops", "Simian Ancestor"]);
    playCard(s, "p1", "Rally the Troops").expectOk();
    settle(s);
    playCard(s, "p1", "Simian Ancestor").expectOk();
    settle(s);
    const ape = boardCard(s, "p1", "Simian Ancestor")!;
    expect(s.room.rules!.objects[ape.id]?.buffs).toBe(1);
    expect(ape.exhausted).toBe(false);
  });

  it("[C:Fae Dragon][R701][R702.2] when played, buff up to four friendly units; when you spend a buff, play a Gold", () => {
    const s = withCards(["Fae Dragon"]);
    const riven = put(s, "p1", "Riven, Broken Blade", "base");
    playCard(s, "p1", "Fae Dragon").expectOk();
    settle(s, (prompt) =>
      prompt.kind === "choose-target" ? { optionIds: [riven.id] } : undefined,
    );
    expect(s.room.rules!.objects[riven.id]?.buffs).toBe(1);
    s.as("p1").move("Riven, Broken Blade", "battlefieldA").expectOk();
    settle(s, (prompt) => (prompt.kind === "choose-mode" ? { optionIds: ["ready"] } : undefined));
    expect(countNamed(s, "p1", "base", "Gold")).toBe(1);
  });
});

describe("SFD batch 3 — play effects", () => {
  it("[C:Buhru Captain][R355.3] when played, you may draw 1 or buff me", () => {
    const s = withCards(["Buhru Captain"]);
    const before = hand(s, "p1").length;
    playCard(s, "p1", "Buhru Captain").expectOk();
    settle(s, (prompt) => (prompt.kind === "choose-mode" ? { optionIds: ["draw"] } : undefined));
    expect(hand(s, "p1").length).toBe(before - 1 + 1);
  });

  it("[C:Dropboarder][R383.2.a.1] when played, ready me if you control two or more gear", () => {
    const s = withCards(["Dropboarder", "Doran's Blade", "Long Sword"]);
    put(s, "p1", "Doran's Blade", "base");
    put(s, "p1", "Long Sword", "base");
    playCard(s, "p1", "Dropboarder").expectOk();
    settle(s);
    expect(boardCard(s, "p1", "Dropboarder")!.exhausted).toBe(false);
    const few = withCards(["Dropboarder"]);
    playCard(few, "p1", "Dropboarder").expectOk();
    expect(few.room.rules!.chain).toHaveLength(0);
  });

  it("[C:Royal Entourage][R355.3] when played, ready or exhaust a legend", () => {
    const s = withCards(["Royal Entourage"]);
    const enemyLegend = boardOf(s, "p2").legend[0]!;
    playCard(s, "p1", "Royal Entourage").expectOk();
    settle(s, (prompt) => {
      if (prompt.kind === "choose-mode") return { optionIds: ["exhaust"] };
      if (prompt.kind === "choose-target") return { optionIds: [enemyLegend.id] };
      return undefined;
    });
    expect(s.host.isExhausted(s.room, enemyLegend.id)).toBe(true);
  });

  it("[C:Gem Jammer][R810][R801.3.a] when played, give a unit Ganking this turn (Gem Jammer itself has none)", () => {
    const s = withCards(["Gem Jammer"]);
    const unit = put(s, "p1", "Caitlyn, Patrolling", "base");
    playCard(s, "p1", "Gem Jammer").expectOk();
    settle(s, (prompt) => (prompt.kind === "choose-target" ? { optionIds: [unit.id] } : undefined));
    expect(effectiveKeywords(s.room, unit.id, s.host)).toContain("Ganking");
    expect(effectiveKeywords(s.room, boardCard(s, "p1", "Gem Jammer")!.id, s.host)).not.toContain(
      "Ganking",
    );
  });

  it("[C:Pickpocket][R429] when played, may kill a gear with Energy cost ≤ [1]; if you do, play a Gold", () => {
    const s = withCards(["Pickpocket"], ["Doran's Ring", "Doran's Blade"]);
    const cheap = put(s, "p2", "Doran's Ring", "base");
    put(s, "p2", "Doran's Blade", "base");
    playCard(s, "p1", "Pickpocket").expectOk();
    settle(s);
    expect(zoneOf(s, cheap.id)).toBe("trash");
    expect(countNamed(s, "p1", "base", "Gold")).toBe(1);
  });

  it("[C:Disarming Rake][R429] when played, may kill a gear", () => {
    const s = withCards(["Disarming Rake"], ["Doran's Blade"]);
    const gear = put(s, "p2", "Doran's Blade", "base");
    playCard(s, "p1", "Disarming Rake").expectOk();
    settle(s);
    expect(zoneOf(s, gear.id)).toBe("trash");
  });

  it("[C:Windsinger][R056] when played, may return another unit at a battlefield with ≤3 Might to its owner's hand", () => {
    const s = withCards(["Windsinger"]);
    const small = put(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    put(s, "p2", "Astral Heron", "battlefieldB");
    playCard(s, "p1", "Windsinger").expectOk();
    settle(s);
    expect(zoneOf(s, small.id)).toBe("hand");
  });

  it("[C:Sea Monkey][R356.4.f.1][R383.2.a.1] buffs itself only if the optional [1] was paid", () => {
    const s = withCards(["Sea Monkey", "Sea Monkey"]);
    playCard(s, "p1", "Sea Monkey").expectOk();
    expect(s.room.rules!.chain).toHaveLength(0);
    playCard(s, "p1", "Sea Monkey", { optionalCosts: ["optional:0"], extraEnergy: 1 }).expectOk();
    settle(s);
    const monkeys = boardOf(s, "p1").base.filter((card) => card.name === "Sea Monkey");
    expect(monkeys.map((card) => s.room.rules!.objects[card.id]?.buffs ?? 0)).toEqual([0, 1]);
  });

  it("[C:Blast Corps Cadet][R356.4.f.1] if the optional [1][Fury] was paid, deal 2 to a unit at a battlefield", () => {
    const s = withCards(["Blast Corps Cadet"]);
    const enemy = put(s, "p2", "Astral Heron", "battlefieldA");
    playCard(s, "p1", "Blast Corps Cadet", {
      optionalCosts: ["optional:0"],
      extraEnergy: 1,
      extraPower: { Fury: 1 },
    }).expectOk();
    resolveChain(s);
    expect(damageOf(s, enemy.id)).toBe(2);
  });

  it("[C:Frostcoat Cub][R356.4.f.1] if the optional [Mind] was paid, give a unit -2 Might this turn", () => {
    const s = withCards(["Frostcoat Cub"]);
    const enemy = put(s, "p2", "Astral Heron", "battlefieldA");
    playCard(s, "p1", "Frostcoat Cub", {
      optionalCosts: ["optional:0"],
      extraPower: { Mind: 1 },
    }).expectOk();
    settle(s, (prompt) =>
      prompt.kind === "choose-target" ? { optionIds: [enemy.id] } : undefined,
    );
    expect(effectiveMight(s.room, enemy.id, s.host)).toBe(5);
  });

  it("[C:Zaun Punk][R356.4.f.1][R357.2] killing a friendly gear as the optional cost: kill a gear", () => {
    const s = withCards(["Zaun Punk", "Doran's Ring"], ["Doran's Blade"]);
    const mine = put(s, "p1", "Doran's Ring", "base");
    const theirs = put(s, "p2", "Doran's Blade", "base");
    playCard(s, "p1", "Zaun Punk", { optionalCosts: ["optional:0"] }).expectOk();
    expect(zoneOf(s, mine.id)).toBe("trash");
    settle(s);
    expect(zoneOf(s, theirs.id)).toBe("trash");
  });

  it("[C:Aspiring Engineer][R056] when played, return a gear from your trash to your hand", () => {
    const s = withCards(["Aspiring Engineer", "Doran's Blade"]);
    const gear = put(s, "p1", "Doran's Blade", "trash");
    playCard(s, "p1", "Aspiring Engineer").expectOk();
    settle(s);
    expect(zoneOf(s, gear.id)).toBe("hand");
  });

  it("[C:Undertitan][R479.4] when played, your other units get +2 Might this turn (reveal-Add: partial)", () => {
    const s = withCards(["Undertitan"]);
    const unit = put(s, "p1", "Caitlyn, Patrolling", "base");
    const enemy = put(s, "p2", "Astral Heron", "battlefieldA");
    playCard(s, "p1", "Undertitan").expectOk();
    settle(s);
    expect(effectiveMight(s.room, unit.id, s.host)).toBe(5);
    expect(effectiveMight(s.room, enemy.id, s.host)).toBe(7);
    expect(effectiveMight(s.room, boardCard(s, "p1", "Undertitan")!.id, s.host)).toBe(5);
    expect(statusOf("Undertitan")).toBe("partial");
  });

  it("[C:Ezreal, Prodigy][R423][R414] when played, discard 1, then draw 2 (cost discount: partial)", () => {
    const s = withCards(["Ezreal, Prodigy", "Premonition"]);
    const before = hand(s, "p1").length;
    const trash = boardOf(s, "p1").trash.length;
    playCard(s, "p1", "Ezreal, Prodigy").expectOk();
    settle(s);
    expect(hand(s, "p1").length).toBe(before - 1 - 1 + 2);
    expect(boardOf(s, "p1").trash.length).toBe(trash + 1);
  });

  it("[C:Yordle Explorer][R420.4.a] when you play a card with Power cost of two or more, draw 1", () => {
    const s = withCards(["Yordle Explorer", "Premonition", "Punch First"]);
    put(s, "p1", "Yordle Explorer", "base");
    const before = hand(s, "p1").length;
    playCard(s, "p1", "Premonition").expectOk();
    settle(s);
    expect(hand(s, "p1").length).toBe(before - 1 + 3 + 1);
    const unit = put(s, "p1", "Caitlyn, Patrolling", "base");
    const mid = hand(s, "p1").length;
    playCard(s, "p1", "Punch First", { choices: { "target:0": unit.id } }).expectOk();
    settle(s);
    expect(hand(s, "p1").length).toBe(mid - 1 + 1);
  });
});
