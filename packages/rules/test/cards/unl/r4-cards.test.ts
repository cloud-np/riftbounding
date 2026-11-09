/**
 * Unleashed (UNL) R4 — cards newly scripted in wave R4.
 *
 * Behaviour through the real strict room. Cards whose remaining line is blocked by a capability
 * gap only exercise the automated part; the lane report names the missing piece.
 */
import { describe, expect, it } from "vitest";
import {
  combatKeywordProfile,
  effectiveKeywords,
  effectiveMight,
  getCardScript,
  xpOf,
} from "../../../src";
import { boardOf, fund, place, run, zoneOf } from "../../rules/effects/helpers";
import { cardsNamed, nextOwnTurn, resolveChain, withCards, type S } from "./helpers";

/** Create `count` Recruit unit tokens for `player` at `zone` (440 / 187); returns their ids. */
function recruits(s: S, player: string, zone: string, count: number): string[] {
  const before = new Set(boardOf(s, player)[zone as "base"].map((card) => card.id));
  run(s, { op: "create", token: { name: "Recruit", count }, zone: zone as "base" }, { controller: player });
  return boardOf(s, player)[zone as "base"].filter((card) => !before.has(card.id)).map((card) => card.id);
}

describe("Unleashed R4 — new spell scripts", () => {
  it("[C:Alpha Strike][R355.14][R418.6.b.3][R730.1] a 2 Might unit splits 2 damage among two 1 Might enemies and gains 2 XP", () => {
    const s = withCards(["Alpha Strike", "Evelynn, Entrancing"]);
    const friend = place(s, "p1", "Evelynn, Entrancing", "base"); // 2 Might
    const foes = recruits(s, "p2", "battlefieldA", 2);
    fund(s, "p1", "Alpha Strike");
    s.as("p1")
      .play("Alpha Strike", { choices: { friend: friend.id, foes } })
      .expectOk();
    resolveChain(s);
    const killed = s.events().filter((event) => event.type === "kill").map((event) => event.cardId);
    for (const id of foes) expect(killed).toContain(id);
    expect(xpOf(s.room, "p1")).toBe(2);
    const damage = s.events().filter((event) => event.type === "damage");
    expect(damage.every((event) => event.sourceObjectId === friend.id)).toBe(true);
    expect(getCardScript("Alpha Strike")?.status).toBe("partial");
  });

  it("[C:Tricksy Tentacles][R355.11][R355.13][R421] moves any number of same-controller enemies with total Might 8 or less to one location", () => {
    const s = withCards(["Tricksy Tentacles"]);
    const foes = recruits(s, "p2", "battlefieldA", 2);
    const stay = place(s, "p2", "Caitlyn, Patrolling", "base");
    fund(s, "p1", "Tricksy Tentacles");
    s.as("p1")
      .play("Tricksy Tentacles", { choices: { "target:0": foes, destination: "base" } })
      .expectOk();
    resolveChain(s);
    for (const id of foes) expect(zoneOf(s, id)).toBe("base");
    expect(zoneOf(s, stay.id)).toBe("base");
  });

  it("[C:Tricksy Tentacles][R355.11.a] a group whose total Might is over 8 is rejected on play", () => {
    const s = withCards(["Tricksy Tentacles"]);
    const a = place(s, "p2", "Whiteflame Protector", "battlefieldA"); // 5 Might
    const b = place(s, "p2", "Whiteflame Protector", "battlefieldA"); // 5 Might
    fund(s, "p1", "Tricksy Tentacles");
    s.as("p1")
      .play("Tricksy Tentacles", { choices: { "target:0": [a.id, b.id], destination: "base" } })
      .expectError("illegal_target");
    expect(s.lastError()).toMatchObject({ rule: "355.11.a" });
  });

  it("[C:Curtain Call][R355.3] the chosen mode deals 2 to a unit at a battlefield", () => {
    const s = withCards(["Curtain Call"]);
    const victim = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    fund(s, "p1", "Curtain Call");
    s.as("p1")
      .play("Curtain Call", { choices: { mode: "deal2", "target:0": victim.id } })
      .expectOk();
    resolveChain(s);
    expect(s.room.rules!.objects[victim.id]?.damage).toBe(2);
    expect(boardOf(s, "p1").trash.some((card) => card.name === "Curtain Call")).toBe(true);
  });

  it("[C:Curtain Call][R355.3] the draw mode draws 1", () => {
    const s = withCards(["Curtain Call"]);
    const before = boardOf(s, "p1").hand.length;
    fund(s, "p1", "Curtain Call");
    s.as("p1").play("Curtain Call", { choices: { mode: "draw" } }).expectOk();
    resolveChain(s);
    expect(boardOf(s, "p1").hand).toHaveLength(before);
  });

  it("[C:Repulse][R355.7][R426.1.a] counters an enemy spell that chooses the chosen friendly unit and no other friendly unit", () => {
    const s = withCards(["Repulse"], ["Moonlight Affliction"], { firstPlayer: "p2" });
    const unit = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    fund(s, "p2", "Moonlight Affliction");
    s.as("p2")
      .play("Moonlight Affliction", { choices: { "target:0": unit.id } })
      .expectOk();
    const item = s.room.rules!.chain.at(-1)!;
    fund(s, "p1", "Repulse");
    s.as("p1")
      .play("Repulse", { choices: { "target:0": unit.id, "target:1": item.id } })
      .expectOk();
    resolveChain(s);
    expect(zoneOf(s, item.cardSnapshot!.id)).toBe("trash");
    expect(effectiveMight(s.room, unit.id, s.host)).toBe(3);
  });

  it("[C:Repulse][R355.9] cannot counter an enemy spell that chooses a different friendly unit", () => {
    const s = withCards(["Repulse"], ["Moonlight Affliction"], { firstPlayer: "p2" });
    const chosen = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    const other = place(s, "p1", "Treasure Hunter", "battlefieldA");
    fund(s, "p2", "Moonlight Affliction");
    s.as("p2")
      .play("Moonlight Affliction", { choices: { "target:0": other.id } })
      .expectOk();
    const item = s.room.rules!.chain.at(-1)!;
    fund(s, "p1", "Repulse");
    s.as("p1")
      .play("Repulse", { choices: { "target:0": chosen.id, "target:1": item.id } })
      .expectError("illegal_target");
  });

  it("[C:Mirror Image][R440.2.c][R801.3.a] plays a ready Reflection token at the base; the copy line is missing", () => {
    const s = withCards(["Mirror Image"]);
    const unit = place(s, "p1", "Caitlyn, Patrolling", "base");
    fund(s, "p1", "Mirror Image");
    s.as("p1").play("Mirror Image", { choices: { "target:0": unit.id } }).expectOk();
    resolveChain(s);
    const tokens = cardsNamed(s, "p1", "base", "Reflection");
    expect(tokens).toHaveLength(1);
    expect(tokens[0]!.exhausted).toBe(false);
    expect(effectiveKeywords(s.room, tokens[0]!.id, s.host)).toContain("Temporary");
    expect(getCardScript("Mirror Image")?.status).toBe("partial");
  });
});

describe("Unleashed R4 — new unit and legend scripts", () => {
  it("[C:Undying Legion][R812.2][R420.1.a] may be played from the trash for [3][Fury] while Legion is active", () => {
    const s = withCards(["Undying Legion", "Lunar Boon"]);
    const legion = place(s, "p1", "Undying Legion", "trash");
    fund(s, "p1", "Lunar Boon");
    s.as("p1").play("Lunar Boon").expectOk();
    resolveChain(s);
    s.room.rules!.pools.p1 = { energy: 3, power: { Fury: 1 } };
    s.as("p1").apply({ type: "rules_play", cardId: legion.id }).expectOk();
    resolveChain(s);
    expect(zoneOf(s, legion.id)).toBe("base");
    expect(s.room.rules!.pools.p1!.energy).toBe(0);
    expect(s.room.rules!.pools.p1!.power.Fury ?? 0).toBe(0);
  });

  it("[C:Undying Legion][R812.1.c] cannot be played from the trash without another card played this turn", () => {
    const s = withCards(["Undying Legion"]);
    const legion = place(s, "p1", "Undying Legion", "trash");
    s.room.rules!.pools.p1 = { energy: 3, power: { Fury: 1 } };
    s.as("p1").apply({ type: "rules_play", cardId: legion.id }).expectError("not_in_hand");
    expect(zoneOf(s, legion.id)).toBe("trash");
  });

  it("[C:Keeper of Masks][R440.2.c] plays two Reflection tokens here; the copies are missing", () => {
    const s = withCards(["Keeper of Masks"]);
    fund(s, "p1", "Keeper of Masks");
    s.as("p1").play("Keeper of Masks").expectOk();
    resolveChain(s);
    const tokens = cardsNamed(s, "p1", "base", "Reflection");
    expect(tokens).toHaveLength(2);
    expect(effectiveKeywords(s.room, tokens[0]!.id, s.host)).toContain("Temporary");
  });

  it("[C:LeBlanc, Deceiver][R383.4.d][R440.2.c] on hold, discards and exhausts to play a ready Reflection token there", () => {
    const s = withCards(["LeBlanc, Deceiver", "Gust"], [], { battlefields: { p1: "Altar of Blood" } });
    place(s, "p1", "LeBlanc, Deceiver", "legend");
    place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    s.room.rules!.objects.battlefieldA = { controller: "p1" };
    nextOwnTurn(s);
    const tokens = cardsNamed(s, "p1", "battlefieldA", "Reflection");
    expect(tokens).toHaveLength(1);
    expect(tokens[0]!.exhausted).toBe(false);
    expect(effectiveKeywords(s.room, tokens[0]!.id, s.host)).toContain("Temporary");
  });
});

describe("Unleashed R4 — new gear and battlefield scripts", () => {
  it("[C:Cursed Sarcophagus][R428] when played, banishes every unit from your trash and leaves non-units", () => {
    const s = withCards(["Cursed Sarcophagus"]);
    const unit = place(s, "p1", "Treasure Hunter", "trash");
    const spell = place(s, "p1", "Gust", "trash");
    fund(s, "p1", "Cursed Sarcophagus");
    s.as("p1").play("Cursed Sarcophagus").expectOk();
    resolveChain(s);
    expect(zoneOf(s, unit.id)).toBe("banished");
    expect(zoneOf(s, spell.id)).toBe("trash");
  });

  it("[C:Altar of Blood][R371.2][R372] during combat, pays [3] to heal, exhaust and recall a dying unit", () => {
    const s = withCards([], [], { battlefields: { p1: "Altar of Blood" } });
    const unit = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    // Real strict room with a Combat in progress at the Altar's battlefield (461–468).
    s.room.rules!.combat = {
      battlefield: "battlefieldA",
      attacker: "p1",
      defender: "p2",
      step: "damage",
    };
    s.room.rules!.pools.p1 = { energy: 3, power: {} };
    expect(
      run(s, { op: "kill", target: { targetRef: `obj:${unit.id}` } }, { controller: "p1" }).status,
    ).toBe("await");
    const prompt = s.expectPrompt("yes-no", "p1").room.rules!.prompt!;
    expect(prompt.data).toMatchObject({ reason: "effects.resume" });
    s.as("p1").choose({ optionIds: ["yes"] }).expectOk();
    expect(zoneOf(s, unit.id)).toBe("base");
    expect(s.host.isExhausted(s.room, unit.id)).toBe(true);
    expect(s.room.rules!.objects[unit.id]?.damage).toBeUndefined();
    expect(s.room.rules!.pools.p1!.energy).toBe(0);
  });
});

describe("Unleashed R4 — partial keyword-only unit scripts", () => {
  it("[C:Revna the Lorekeeper][R810] is a Ganking unit; the spent-4 ready trigger is missing", () => {
    const s = withCards(["Revna the Lorekeeper"]);
    const revna = place(s, "p1", "Revna the Lorekeeper", "base");
    expect(effectiveKeywords(s.room, revna.id, s.host)).toContain("Ganking");
    expect(getCardScript("Revna the Lorekeeper")?.status).toBe("partial");
  });

  it("[C:Rengar, Trophy Hunter][R822] keeps [Ambush] and does not list the reminder [Reaction]", () => {
    const s = withCards(["Rengar, Trophy Hunter"]);
    const rengar = place(s, "p1", "Rengar, Trophy Hunter", "base");
    expect(effectiveKeywords(s.room, rengar.id, s.host)).toContain("Ambush");
    expect(effectiveKeywords(s.room, rengar.id, s.host)).not.toContain("Reaction");
    expect(getCardScript("Rengar, Trophy Hunter")?.status).toBe("partial");
  });

  it("[C:Stalking Wolf][R822] does not list the reminder [Reaction]", () => {
    const s = withCards(["Stalking Wolf"]);
    const wolf = place(s, "p1", "Stalking Wolf", "base");
    expect(effectiveKeywords(s.room, wolf.id, s.host)).not.toContain("Reaction");
    expect(getCardScript("Stalking Wolf")?.status).toBe("partial");
  });

  it("[C:Jhin, Meticulous Killer][R731] keeps [Vision]", () => {
    const s = withCards(["Jhin, Meticulous Killer"]);
    const jhin = place(s, "p1", "Jhin, Meticulous Killer", "base");
    expect(effectiveKeywords(s.room, jhin.id, s.host)).toContain("Vision");
    expect(getCardScript("Jhin, Meticulous Killer")?.status).toBe("partial");
  });

  it("[C:Arachnoid Horror][R823] keeps [Hunt 2]", () => {
    const s = withCards(["Arachnoid Horror"]);
    const horror = place(s, "p1", "Arachnoid Horror", "base");
    expect(effectiveKeywords(s.room, horror.id, s.host)).toContain("Hunt");
    expect(getCardScript("Arachnoid Horror")?.status).toBe("partial");
  });

  it("[C:Evelynn, Entrancing][R811][R826] keeps [Hidden] and [Backline]", () => {
    const s = withCards(["Evelynn, Entrancing"]);
    const evelynn = place(s, "p1", "Evelynn, Entrancing", "base");
    expect(effectiveKeywords(s.room, evelynn.id, s.host)).toContain("Hidden");
    expect(combatKeywordProfile(s.room, evelynn.id, s.host).backline).toBe(true);
    expect(getCardScript("Evelynn, Entrancing")?.status).toBe("partial");
  });

  it("[C:Poppy, Defender of the Meek][R822] keeps [Ambush] and [Tank]", () => {
    const s = withCards(["Poppy, Defender of the Meek"]);
    const poppy = place(s, "p1", "Poppy, Defender of the Meek", "base");
    const keywords = effectiveKeywords(s.room, poppy.id, s.host);
    expect(keywords).toContain("Ambush");
    expect(keywords).toContain("Tank");
    expect(keywords).not.toContain("Reaction");
    expect(getCardScript("Poppy, Defender of the Meek")?.status).toBe("partial");
  });
});
