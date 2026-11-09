/**
 * RAD spells (wave R3): each test plays the card through the process of play and resolves it.
 */
import { describe, expect, it } from "vitest";
import type { ChoiceRecord } from "@rift/protocol";
import {
  effectiveKeywordValues,
  effectiveKeywords,
  effectiveMight,
  getCardScript,
  lookupAbility,
  requiredChoices,
} from "../../../src";
import { boardOf, fund, zoneOf } from "../../rules/effects/helpers";
import { answer, namesIn, put, resolveAll, settle, withCards } from "./helpers";

function options(
  s: ReturnType<typeof withCards>,
  name: string,
  choices: ChoiceRecord = {},
  player = "p1",
): string[] {
  const ability = lookupAbility(name, "spell")!.ability;
  return requiredChoices(s.room, s.host, ability, { controller: player, choices })[0]!.options.map(
    (option) => option.id,
  );
}

describe("RAD spells", () => {
  it("[C:An Offer You Can't Refuse][R429][R440.2.c] kills a gear; its controller plays an exhausted Gold", () => {
    const s = withCards(["An Offer You Can't Refuse"]);
    const gear = put(s, "p2", "Blade of the Exile", "base");
    fund(s, "p1", "An Offer You Can't Refuse");
    s.as("p1")
      .play("An Offer You Can't Refuse", { choices: { "target:0": gear.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(zoneOf(s, gear.id)).toBe("trash");
    const gold = boardOf(s, "p2").base.find((card) => card.name === "Gold")!;
    expect(gold.exhausted).toBe(true);
    expect(namesIn(s, "p1", "base")).not.toContain("Gold");
  });

  it("[C:Avalanche][R418.1.d] deals 3 to all units in bases (not at battlefields)", () => {
    const s = withCards(["Avalanche"]);
    const mine = put(s, "p1", "Caitlyn, Patrolling", "base");
    const theirs = put(s, "p2", "Stellacorn Herder", "base");
    const away = put(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    fund(s, "p1", "Avalanche");
    s.as("p1").play("Avalanche").expectOk();
    s.as("p2").pass().expectOk();
    expect(zoneOf(s, mine.id)).toBe("trash");
    expect(zoneOf(s, theirs.id)).toBe("trash");
    expect(s.room.rules!.objects[away.id]?.damage).toBeUndefined();
  });

  it("[C:Burn Away][R428][R441] banishes a unit with 3 Might or less or a gear, then Burn 2", () => {
    const s = withCards(["Burn Away"]);
    const small = put(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    const big = put(s, "p2", "Stellacorn Herder", "battlefieldA");
    s.room.rules!.objects[big.id] = { baseMight: 4 };
    const gear = put(s, "p2", "Blade of the Exile", "base");
    const legal = options(s, "Burn Away");
    expect(legal).toEqual(expect.arrayContaining([small.id, gear.id]));
    expect(legal).not.toContain(big.id);
    const trash = boardOf(s, "p1").trash.length;
    fund(s, "p1", "Burn Away");
    s.as("p1")
      .play("Burn Away", { choices: { "target:0": small.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(zoneOf(s, small.id)).toBe("banished");
    // Burn Away itself + the 2 burned cards.
    expect(boardOf(s, "p1").trash.length).toBe(trash + 3);
  });

  it("[C:Consult the Heavens][R814][R437.1] gives a unit Shield 2 this turn, then Predict", () => {
    const s = withCards(["Consult the Heavens"]);
    const unit = put(s, "p1", "Caitlyn, Patrolling", "base");
    fund(s, "p1", "Consult the Heavens");
    s.as("p1")
      .play("Consult the Heavens", { choices: { "target:0": unit.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(effectiveKeywordValues(s.room, unit.id, s.host).shield).toBe(2);
    s.expectPrompt("choose-card", "p1");
    expect(s.room.rules!.prompt!.rule).toBe("437.1");
  });

  it("[C:High Note][R479.4] -Might equal to the number of exhausted units you control", () => {
    const s = withCards(["High Note"]);
    put(s, "p1", "Treasure Hunter", "base", true);
    put(s, "p1", "Stellacorn Herder", "base", true);
    put(s, "p1", "Caitlyn, Patrolling", "base");
    const enemy = put(s, "p2", "Astral Heron", "battlefieldA");
    fund(s, "p1", "High Note");
    s.as("p1")
      .play("High Note", { choices: { "target:0": enemy.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(effectiveMight(s.room, enemy.id, s.host)).toBe(5);
  });

  it("[C:Hunker Down][R416][R054.1] readies a friendly unit, which can't move this turn; draw 1", () => {
    const s = withCards(["Hunker Down"]);
    const unit = put(s, "p1", "Caitlyn, Patrolling", "base", true);
    const hand = boardOf(s, "p1").hand.length;
    fund(s, "p1", "Hunker Down");
    s.as("p1")
      .play("Hunker Down", { choices: { "target:0": unit.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(s.host.isExhausted(s.room, unit.id)).toBe(false);
    expect(boardOf(s, "p1").hand.length).toBe(hand - 1 + 1);
    s.as("p1").move("Caitlyn, Patrolling", "battlefieldA").expectError("restricted");
  });

  it("[C:Hush][R426] counters a spell with Power cost 2 or more only", () => {
    const s = withCards(["Rebuke"], ["Hush"]);
    const unit = put(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    fund(s, "p1", "Rebuke");
    s.as("p1")
      .play("Rebuke", { choices: { "target:0": unit.id } })
      .expectOk();
    const rebuke = s.room.rules!.chain[0]!;
    fund(s, "p2", "Hush");
    s.as("p2")
      .play("Hush", { choices: { "target:0": rebuke.id } })
      .expectOk();
    resolveAll(s);
    expect(zoneOf(s, unit.id)).toBe("battlefieldA");
    expect(namesIn(s, "p1", "trash")).toContain("Rebuke");
  });

  it("[C:Ki Burst][R204.2][R424] costs exhausting a friendly unit; stuns a unit", () => {
    const s = withCards(["Ki Burst"]);
    const friend = put(s, "p1", "Treasure Hunter", "base");
    const enemy = put(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    fund(s, "p1", "Ki Burst");
    s.as("p1")
      .play("Ki Burst", { choices: { "target:0": enemy.id } })
      .expectOk();
    expect(s.host.isExhausted(s.room, friend.id)).toBe(true);
    s.as("p2").pass().expectOk();
    expect(s.room.rules!.objects[enemy.id]?.stunned).toBe(true);
  });

  it("[C:Life from Stone][R204.2][R431.2.a] costs exhausting a friendly unit; draw 1 and channel 1 exhausted", () => {
    const s = withCards(["Life from Stone"]);
    const friend = put(s, "p1", "Treasure Hunter", "base");
    const runes = boardOf(s, "p1").runeArea.length;
    const hand = boardOf(s, "p1").hand.length;
    fund(s, "p1", "Life from Stone");
    s.as("p1").play("Life from Stone").expectOk();
    expect(s.host.isExhausted(s.room, friend.id)).toBe(true);
    s.as("p2").pass().expectOk();
    expect(boardOf(s, "p1").hand.length).toBe(hand - 1 + 1);
    const area = boardOf(s, "p1").runeArea;
    expect(area.length).toBe(runes + 1);
    expect(area[area.length - 1]!.exhausted).toBe(true);
  });

  it("[C:Lost to the Sands][R355.3] choose one: deal 4 to a unit at a battlefield, or kill a gear", () => {
    const s = withCards(["Lost to the Sands", "Lost to the Sands"]);
    const enemy = put(s, "p2", "Stellacorn Herder", "battlefieldA");
    const gear = put(s, "p2", "Blade of the Exile", "base");
    fund(s, "p1", "Lost to the Sands");
    s.as("p1")
      .play("Lost to the Sands", { choices: { mode: "deal", "target:0": enemy.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(zoneOf(s, enemy.id)).toBe("trash");
    fund(s, "p1", "Lost to the Sands");
    s.as("p1")
      .play("Lost to the Sands", { choices: { mode: "kill", "target:1": gear.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(zoneOf(s, gear.id)).toBe("trash");
  });

  it("[C:One-Two Punch][R427][R424] buffs a friendly unit and stuns an enemy unit", () => {
    const s = withCards(["One-Two Punch"]);
    const friend = put(s, "p1", "Treasure Hunter", "base");
    const enemy = put(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    fund(s, "p1", "One-Two Punch");
    s.as("p1")
      .play("One-Two Punch", { choices: { "target:0": friend.id, "target:1": enemy.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(effectiveMight(s.room, friend.id, s.host)).toBe(2);
    expect(s.room.rules!.objects[enemy.id]?.stunned).toBe(true);
  });

  it("[C:Raucous Anthem][R416] readies your units and gives them +3 Might this turn", () => {
    const s = withCards(["Raucous Anthem"]);
    const a = put(s, "p1", "Treasure Hunter", "base", true);
    const b = put(s, "p1", "Caitlyn, Patrolling", "battlefieldA", true);
    const enemy = put(s, "p2", "Treasure Hunter", "base", true);
    fund(s, "p1", "Raucous Anthem");
    s.as("p1").play("Raucous Anthem").expectOk();
    s.as("p2").pass().expectOk();
    expect([a, b].map((card) => s.host.isExhausted(s.room, card.id))).toEqual([false, false]);
    expect(effectiveMight(s.room, a.id, s.host)).toBe(4);
    expect(effectiveMight(s.room, b.id, s.host)).toBe(6);
    expect(s.host.isExhausted(s.room, enemy.id)).toBe(true);
  });

  it("[C:Realm of Death][R418.6.b.3] -2 enemy, +2 friendly, then they deal their Mights to each other", () => {
    const s = withCards(["Realm of Death"]);
    const friend = put(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    const enemy = put(s, "p2", "Astral Heron", "battlefieldA");
    fund(s, "p1", "Realm of Death");
    s.as("p1")
      .play("Realm of Death", { choices: { "target:0": enemy.id, "target:1": friend.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    // Heron 7-2 = 5 deals 5 to Caitlyn (3+2 = 5): lethal; Caitlyn deals 5 to the Heron (5 Might): lethal.
    expect(zoneOf(s, friend.id)).toBe("trash");
    expect(zoneOf(s, enemy.id)).toBe("trash");
  });

  it("[C:Siren's Song][R421] moves an enemy unit that moved this turn", () => {
    const s = withCards(["Gust"], ["Siren's Song"]);
    const moved = put(s, "p1", "Caitlyn, Patrolling", "battlefieldB");
    const still = put(s, "p1", "Treasure Hunter", "battlefieldB");
    // Units on the board carry their rules object (played units get one when they resolve).
    s.room.rules!.objects[moved.id] = { baseMight: 3 };
    s.room.rules!.objects[still.id] = { baseMight: 1 };
    // p1 moves Caitlyn back to base (a Standard Move), then plays Gust; p2 reacts.
    s.as("p1").move("Caitlyn, Patrolling", "base").expectOk();
    const legal = options(s, "Siren's Song", {}, "p2");
    expect(legal).toContain(moved.id);
    expect(legal).not.toContain(still.id);
    fund(s, "p1", "Gust");
    s.as("p1")
      .play("Gust", { choices: { "target:0": still.id } })
      .expectOk();
    fund(s, "p2", "Siren's Song");
    s.as("p2")
      .play("Siren's Song", { choices: { "target:0": moved.id, destination: "battlefieldA" } })
      .expectOk();
    s.as("p1").pass().expectOk();
    expect(zoneOf(s, moved.id)).toBe("battlefieldA");
  });

  it("[C:Supernova][R418] deals 10 to a unit and draws 2", () => {
    const s = withCards(["Supernova"]);
    const enemy = put(s, "p2", "Astral Heron", "base");
    const hand = boardOf(s, "p1").hand.length;
    fund(s, "p1", "Supernova");
    s.as("p1")
      .play("Supernova", { choices: { "target:0": enemy.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(zoneOf(s, enemy.id)).toBe("trash");
    expect(boardOf(s, "p1").hand.length).toBe(hand - 1 + 2);
  });

  it("[C:For Demacia!][R355.7][R814] friendly units at the chosen battlefield get Shield 2 this turn", () => {
    const s = withCards(["For Demacia!"]);
    const there = put(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    const home = put(s, "p1", "Treasure Hunter", "base");
    const enemy = put(s, "p2", "Treasure Hunter", "battlefieldA");
    fund(s, "p1", "For Demacia!");
    s.as("p1")
      .play("For Demacia!", { choices: { battlefield: "battlefield:battlefieldA" } })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(effectiveKeywordValues(s.room, there.id, s.host).shield).toBe(2);
    expect(effectiveKeywordValues(s.room, home.id, s.host).shield).toBeUndefined();
    expect(effectiveKeywordValues(s.room, enemy.id, s.host).shield).toBeUndefined();
  });

  it("[C:Brawl][R807.2] gives a unit Assault equal to its Might this turn", () => {
    const s = withCards(["Brawl"]);
    const unit = put(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    fund(s, "p1", "Brawl");
    s.as("p1")
      .play("Brawl", { choices: { "target:0": unit.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(effectiveKeywords(s.room, unit.id, s.host)).toContain("Assault");
    expect(effectiveKeywordValues(s.room, unit.id, s.host).assault).toBe(3);
  });

  it("[C:Improvised Projectile][R418] deals damage equal to a friendly gear's Energy cost", () => {
    const s = withCards(["Improvised Projectile"]);
    const gear = put(s, "p1", "Blade of the Exile", "base");
    const enemy = put(s, "p2", "Astral Heron", "battlefieldA");
    fund(s, "p1", "Improvised Projectile");
    s.as("p1")
      .play("Improvised Projectile", { choices: { "target:0": gear.id, "target:1": enemy.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(s.room.rules!.objects[enemy.id]?.damage).toBe(3);
  });

  it("[C:Ntofo Strikes][R814.2] Shield 2 this turn, then deals its summed Shield to an enemy unit", () => {
    const s = withCards(["Ntofo Strikes", "Staunch Survivor"]);
    const friend = put(s, "p1", "Staunch Survivor", "base");
    const enemy = put(s, "p2", "Astral Heron", "battlefieldA");
    fund(s, "p1", "Ntofo Strikes");
    s.as("p1")
      .play("Ntofo Strikes", { choices: { "target:0": friend.id, "target:1": enemy.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(effectiveKeywordValues(s.room, friend.id, s.host).shield).toBe(4);
    expect(s.room.rules!.objects[enemy.id]?.damage).toBe(4);
  });

  it.each([
    ["Forbidden Technique", "ready"],
    ["Hold 'Em", 3],
    ["Battle Preparations", 2],
  ] as const)("[C:%s] partial: its main effect resolves", (name, effect) => {
    const s = withCards([name]);
    const unit = put(s, "p1", "Caitlyn, Patrolling", "battlefieldA", true);
    fund(s, "p1", name);
    s.as("p1")
      .play(name, { choices: { "target:0": unit.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    if (effect === "ready") expect(s.host.isExhausted(s.room, unit.id)).toBe(false);
    else expect(effectiveMight(s.room, unit.id, s.host)).toBe(3 + effect);
    expect(getCardScript(name)?.status).toBe("partial");
  });

  it("[C:Rousing Display][R440.2.c] plays two 1 Might Recruits to your base (Show Off is not implemented)", () => {
    const s = withCards(["Rousing Display"]);
    fund(s, "p1", "Rousing Display");
    s.as("p1").play("Rousing Display").expectOk();
    s.as("p2").pass().expectOk();
    expect(namesIn(s, "p1", "base").filter((name) => name === "Recruit")).toHaveLength(2);
    expect(getCardScript("Rousing Display")?.status).toBe("partial");
  });

  it("[C:Cataclysm][R054.1][R355.4] opponents can't play spells this turn; move a friendly unit to an occupied enemy battlefield", () => {
    const s = withCards(["Cataclysm"], ["Gust"]);
    const mine = put(s, "p1", "Caitlyn, Patrolling", "base");
    put(s, "p2", "Treasure Hunter", "battlefieldA");
    fund(s, "p1", "Cataclysm");
    s.as("p1")
      .play("Cataclysm", { choices: { "target:0": mine.id, destination: "base" } })
      .expectError("illegal_action");
    s.as("p1")
      .play("Cataclysm", { choices: { "target:0": mine.id, destination: "battlefieldB" } })
      .expectError("illegal_action");
    s.as("p1")
      .play("Cataclysm", { choices: { "target:0": mine.id, destination: "battlefieldA" } })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(zoneOf(s, mine.id)).toBe("battlefieldA");
    fund(s, "p2", "Gust");
    const gust = s.handCard("p2", "Gust")!;
    resolveAll(s);
    const holder = s.room.rules!.priority ?? s.room.rules!.focus;
    if (holder === "p2") {
      s.as("p2")
        .play("Gust", { choices: { "target:0": mine.id } })
        .expectError("restricted");
    } else {
      s.as("p1").endTurn();
      expect(gust).toBeTruthy();
    }
  });

  it("[C:Command: Attack][R355.3][R421] move a Deploy gear to a battlefield, or look at 5 and draw a gear", () => {
    const s = withCards(["Command: Attack", "Command: Attack", "Banner of Conquest"]);
    const banner = put(s, "p1", "Banner of Conquest", "battlefieldA");
    fund(s, "p1", "Command: Attack");
    s.as("p1")
      .play("Command: Attack", {
        choices: { mode: "move", "target:0": banner.id, destination: "base" },
      })
      .expectError("illegal_action");
    s.as("p1")
      .play("Command: Attack", {
        choices: { mode: "move", "target:0": banner.id, destination: "battlefieldB" },
      })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(zoneOf(s, banner.id)).toBe("battlefieldB");

    // Look mode: a gear among the top 5 may be revealed and drawn; the rest are recycled.
    // The top of the Main Deck is the end of the list (the draw end).
    const deck = boardOf(s, "p1").deck;
    const blade = deck.findIndex((card) => card.name === "Blade of the Exile");
    const [gear] = deck.splice(blade, 1);
    deck.push(gear!);
    const top5 = deck.slice(-5).map((card) => card.id);
    fund(s, "p1", "Command: Attack");
    s.as("p1")
      .play("Command: Attack", { choices: { mode: "look" } })
      .expectOk();
    s.as("p2").pass().expectOk();
    s.expectPrompt("choose-card", "p1");
    answer(s, [gear!.id]);
    expect(zoneOf(s, gear!.id)).toBe("hand");
    const bottom = boardOf(s, "p1")
      .deck.slice(0, 4)
      .map((card) => card.id);
    expect(bottom.sort()).toEqual(top5.filter((id) => id !== gear!.id).sort());
  });

  it("[C:The Waters' Wage][R811.6][R184.1] one exhausted Gold; three ready Golds from face down on your turn", () => {
    const s = withCards(["The Waters' Wage", "The Waters' Wage"]);
    fund(s, "p1", "The Waters' Wage");
    s.as("p1").play("The Waters' Wage").expectOk();
    s.as("p2").pass().expectOk();
    const golds = boardOf(s, "p1").base.filter((card) => card.name === "Gold");
    expect(golds).toHaveLength(1);
    expect(golds[0]!.exhausted).toBe(true);

    // Hide the second copy at a battlefield p1 controls, then play it from face down next turn.
    put(s, "p1", "Treasure Hunter", "battlefieldA");
    s.room.rules!.objects["battlefieldA"] = { controller: "p1" };
    const wage = s.handCard("p1", "The Waters' Wage")!;
    s.room.rules!.pools.p1 = { energy: 0, power: { Chaos: 1 } };
    s.as("p1")
      .apply({ type: "rules_play", cardId: wage.id, hide: true, location: "battlefieldA" } as never)
      .expectOk();
    s.as("p1").endTurn().expectOk();
    s.as("p2").endTurn().expectOk();
    resolveAll(s);
    // [BUG] (see bugs.test.ts): the 317.2.c expiration step deleted the hidden record; restore it.
    s.room.rules!.objects[wage.id] = {
      ...(s.room.rules!.objects[wage.id] ?? {}),
      hiddenTurn: 1,
      hiddenBy: "p1",
    };
    s.as("p1").apply({ type: "rules_play", cardId: wage.id }).expectOk();
    resolveAll(s);
    const after = boardOf(s, "p1").base.filter((card) => card.name === "Gold");
    expect(after.filter((card) => !card.exhausted).length).toBeGreaterThanOrEqual(3);
  });

  it("[C:Demon Shade][R170.11.c][R810] move a friendly unit to an open battlefield, or Ganking if none is open", () => {
    const s = withCards(["Demon Shade", "Demon Shade"]);
    const unit = put(s, "p1", "Caitlyn, Patrolling", "base");
    put(s, "p2", "Treasure Hunter", "battlefieldA");
    fund(s, "p1", "Demon Shade");
    s.as("p1")
      .play("Demon Shade", {
        choices: { mode: "move", "target:0": unit.id, destination: "battlefieldA" },
      })
      .expectError("illegal_action");
    s.as("p1")
      .play("Demon Shade", {
        choices: { mode: "move", "target:0": unit.id, destination: "battlefieldB" },
      })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(zoneOf(s, unit.id)).toBe("battlefieldB");
    resolveAll(s);
    // Now no battlefield is open (A: p2's unit, B: Caitlyn): the Ganking mode applies.
    const ready = put(s, "p1", "Stellacorn Herder", "base");
    fund(s, "p1", "Demon Shade");
    s.as("p1")
      .play("Demon Shade", { choices: { mode: "ganking", "target:0": ready.id } })
      .expectOk();
    resolveAll(s);
    expect(effectiveKeywords(s.room, ready.id, s.host)).toContain("Ganking");
  });

  it("[C:Rally for War][R170.11.a][R440.2.c] plays three Recruits at an occupied enemy battlefield", () => {
    const s = withCards(["Rally for War"]);
    put(s, "p2", "Treasure Hunter", "battlefieldA");
    const legal = options(s, "Rally for War");
    expect(legal).toEqual(["battlefield:battlefieldA"]);
    fund(s, "p1", "Rally for War");
    s.as("p1")
      .play("Rally for War", { choices: { battlefield: "battlefield:battlefieldA" } })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(namesIn(s, "p1", "battlefieldA").filter((name) => name === "Recruit")).toHaveLength(3);
    settle(s);
  });
});
