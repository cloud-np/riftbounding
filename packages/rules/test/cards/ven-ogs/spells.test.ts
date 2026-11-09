/**
 * Vendetta spells (non-Empower).
 */
import { describe, expect, it } from "vitest";
import { getCardScript, lookupAbility, requiredChoices } from "../../../src";
import { fund } from "../../rules/effects/helpers";
import {
  answer,
  boardOf,
  exhaustRunes,
  keywordValue,
  might,
  place,
  setControl,
  setRunes,
  settle,
  withCards,
  zoneOf,
} from "./helpers";

function optionIds(s: ReturnType<typeof withCards>, card: string, player = "p1"): string[] {
  const ability = lookupAbility(card, "spell")!.ability;
  return requiredChoices(s.room, s.host, ability, {
    controller: player,
    choices: {},
  })[0]!.options.map((o) => o.id);
}

describe("Vendetta spells", () => {
  it("[C:Clairvoyance][R437][R414] Predict 5, then draw 2", () => {
    const s = withCards(["Clairvoyance"]);
    fund(s, "p1", "Clairvoyance");
    s.as("p1").play("Clairvoyance").expectOk();
    s.as("p2").pass().expectOk();
    s.expectPrompt("choose-card", "p1");
    expect(s.room.rules!.prompt!.options).toHaveLength(5);
    s.as("p1").choose({ optionIds: [] }).expectOk();
    settle(s);
    expect(boardOf(s, "p1").hand).toHaveLength(2);
  });

  it("[C:Consuming Curse][R712][R715] deals 2 plus 1 Bonus Damage per Consuming Curse in your trash", () => {
    const s = withCards(["Consuming Curse", "Consuming Curse", "Consuming Curse"]);
    place(s, "p1", "Consuming Curse", "trash");
    place(s, "p1", "Consuming Curse", "trash");
    const enemy = place(s, "p2", "Whiteflame Protector", "battlefieldA");
    fund(s, "p1", "Consuming Curse");
    s.as("p1")
      .play("Consuming Curse", { choices: { "target:0": enemy.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(s.room.rules!.objects[enemy.id]?.damage).toBe(4);
  });

  it("[C:Decree of Rage][R131] deals 4 to an enemy Calm unit only", () => {
    const s = withCards(["Decree of Rage"]);
    const calm = place(s, "p2", "Caitlyn, Patrolling", "base");
    const chaos = place(s, "p2", "Treasure Hunter", "base");
    const options = optionIds(s, "Decree of Rage");
    expect(options).toContain(calm.id);
    expect(options).not.toContain(chaos.id);
    fund(s, "p1", "Decree of Rage");
    s.as("p1")
      .play("Decree of Rage", { choices: { "target:0": calm.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(zoneOf(s, calm.id)).toBe("trash");
    expect(getCardScript("Decree of Rage")?.status).toBe("partial");
  });

  it("[C:Decree of Unity][R429] kills an enemy Chaos unit or gear (not a friendly or non-Chaos one)", () => {
    const s = withCards(["Decree of Unity"], ["Rage Amplifier"]);
    const chaos = place(s, "p2", "Treasure Hunter", "base");
    const calm = place(s, "p2", "Caitlyn, Patrolling", "base");
    const mine = place(s, "p1", "Treasure Hunter", "base");
    const gear = place(s, "p2", "Rage Amplifier", "base");
    const options = optionIds(s, "Decree of Unity");
    expect(options).toContain(chaos.id);
    expect(options).not.toContain(calm.id);
    expect(options).not.toContain(mine.id);
    expect(options).not.toContain(gear.id);
    fund(s, "p1", "Decree of Unity");
    s.as("p1")
      .play("Decree of Unity", { choices: { "target:0": chaos.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(zoneOf(s, chaos.id)).toBe("trash");
  });

  it("[C:Decree of Insight][R131] gives an enemy Body unit -5 Might this turn", () => {
    const s = withCards(["Decree of Insight"], ["Brutal Hunter"]);
    const body = place(s, "p2", "Brutal Hunter", "base");
    const calm = place(s, "p2", "Caitlyn, Patrolling", "base");
    expect(optionIds(s, "Decree of Insight")).not.toContain(calm.id);
    fund(s, "p1", "Decree of Insight");
    s.as("p1")
      .play("Decree of Insight", { choices: { "target:0": body.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(might(s, body.id)).toBe(-1);
  });

  it("[C:Decree of Strength][R425][R417] the opponent reveals their hand; you pick a Mind card; they recycle it", () => {
    const s = withCards(["Decree of Strength"], ["Clairvoyance", "Hextech Ray"]);
    const mind = s.handCard("p2", "Clairvoyance")!;
    const fury = s.handCard("p2", "Hextech Ray")!;
    fund(s, "p1", "Decree of Strength");
    s.as("p1")
      .play("Decree of Strength", { choices: { opponent: "p2" } })
      .expectOk();
    s.as("p2").pass().expectOk();
    settle(s);
    expect(zoneOf(s, mind.id)).toBe("deck");
    expect(s.host.lookAtTop(s.room, "p2", "deck", 1)[0]!.id).not.toBe(mind.id);
    expect(zoneOf(s, fury.id)).toBe("hand");
  });

  it("[C:Mesmerize][R355.3] choose one: return a friendly unit, or give an enemy unit -2 Might", () => {
    const s = withCards(["Mesmerize", "Mesmerize"]);
    const mine = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    const theirs = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    fund(s, "p1", "Mesmerize");
    s.as("p1")
      .play("Mesmerize", { choices: { mode: "might", "target:1": theirs.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(might(s, theirs.id)).toBe(1);
    fund(s, "p1", "Mesmerize");
    s.as("p1")
      .play("Mesmerize", { choices: { mode: "return", "target:0": mine.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(zoneOf(s, mine.id)).toBe("hand");
  });

  it("[C:Ki Barrier][R438.1.b.1] prevents the next 7 damage dealt to the unit this turn", () => {
    const s = withCards(["Ki Barrier", "Final Spark"]);
    const unit = place(s, "p1", "Whiteflame Protector", "battlefieldA");
    fund(s, "p1", "Ki Barrier");
    s.as("p1")
      .play("Ki Barrier", { choices: { "target:0": unit.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    fund(s, "p1", "Final Spark");
    s.as("p1")
      .play("Final Spark", { choices: { "target:0": unit.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(s.room.rules!.objects[unit.id]?.damage).toBe(1);
  });

  it("[C:Wind and Ghosts][R428][R056] banishes a unit with 3 Might or less, otherwise returns it to hand", () => {
    const s = withCards(["Wind and Ghosts", "Wind and Ghosts"]);
    const small = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    const big = place(s, "p2", "Whiteflame Protector", "battlefieldA");
    fund(s, "p1", "Wind and Ghosts");
    s.as("p1")
      .play("Wind and Ghosts", { choices: { "target:0": small.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    fund(s, "p1", "Wind and Ghosts");
    s.as("p1")
      .play("Wind and Ghosts", { choices: { "target:0": big.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(zoneOf(s, small.id)).toBe("banished");
    expect(zoneOf(s, big.id)).toBe("hand");
  });

  it("[C:Shadows of the Past][R056] returns up to 2 units from any trashes to their owners' hands", () => {
    const s = withCards(["Shadows of the Past"]);
    const mine = place(s, "p1", "Caitlyn, Patrolling", "trash");
    const theirs = place(s, "p2", "Treasure Hunter", "trash");
    fund(s, "p1", "Shadows of the Past");
    s.as("p1")
      .play("Shadows of the Past", { choices: { "target:0": [mine.id, theirs.id] } })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(zoneOf(s, mine.id)).toBe("hand");
    expect(s.host.findCard(s.room, theirs.id)?.playerId).toBe("p2");
    expect(zoneOf(s, theirs.id)).toBe("hand");
  });

  it("[C:Siphoning Strike][R391.2] deals 4 (7 with 7+ runes); when it dies this turn, channel 1 rune exhausted", () => {
    const s = withCards(["Siphoning Strike", "Siphoning Strike"]);
    const big = place(s, "p2", "Whiteflame Protector", "battlefieldA");
    const small = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    exhaustRunes(s, "p1");
    fund(s, "p1", "Siphoning Strike");
    s.as("p1")
      .play("Siphoning Strike", { choices: { "target:0": big.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(s.room.rules!.objects[big.id]?.damage).toBe(4);
    setRunes(s, "p1", 7);
    exhaustRunes(s, "p1");
    fund(s, "p1", "Siphoning Strike");
    s.as("p1")
      .play("Siphoning Strike", { choices: { "target:0": small.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(zoneOf(s, small.id)).toBe("trash");
    settle(s);
    expect(boardOf(s, "p1").runeArea).toHaveLength(8);
    expect(boardOf(s, "p1").runeArea[7]!.exhausted).toBe(true);
  });

  it("[C:Brittle Steel][C:Dredge Up][C:Onslaught][R829] Flow spells: kill a gear; draw 1; +6 Might", () => {
    const s = withCards(["Brittle Steel", "Dredge Up", "Onslaught"], ["Rage Amplifier"]);
    const gear = place(s, "p2", "Rage Amplifier", "base");
    const unit = place(s, "p1", "Caitlyn, Patrolling", "base");
    fund(s, "p1", "Brittle Steel");
    s.as("p1")
      .play("Brittle Steel", { choices: { "target:0": gear.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(zoneOf(s, gear.id)).toBe("trash");
    const hand = boardOf(s, "p1").hand.length;
    fund(s, "p1", "Dredge Up");
    s.as("p1").play("Dredge Up").expectOk();
    s.as("p2").pass().expectOk();
    expect(boardOf(s, "p1").hand.length).toBe(hand);
    fund(s, "p1", "Onslaught");
    s.as("p1")
      .play("Onslaught", { choices: { "target:0": unit.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(might(s, unit.id)).toBe(9);
    for (const name of ["Brittle Steel", "Dredge Up", "Onslaught"])
      expect(getCardScript(name)?.status).toBe("partial");
  });

  it("[C:Iterative Design][C:Up from the Deep][R440.2.c] play a 3 Might Mech; play two 1 Might Tentacles", () => {
    const s = withCards(["Iterative Design", "Up from the Deep"]);
    fund(s, "p1", "Iterative Design");
    s.as("p1").play("Iterative Design").expectOk();
    s.as("p2").pass().expectOk();
    fund(s, "p1", "Up from the Deep");
    s.as("p1").play("Up from the Deep").expectOk();
    s.as("p2").pass().expectOk();
    const base = boardOf(s, "p1").base;
    const mech = base.find((card) => card.name === "Mech")!;
    expect(might(s, mech.id)).toBe(3);
    const tentacles = base.filter((card) => card.name === "Tentacle");
    expect(tentacles).toHaveLength(2);
    expect(might(s, tentacles[0]!.id)).toBe(1);
  });

  it("[C:Twilight Shroud][R757.1] +1 Might and can't be chosen by enemy spells and abilities this turn", () => {
    const s = withCards(["Twilight Shroud"], ["Hextech Ray"]);
    const unit = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    fund(s, "p1", "Twilight Shroud");
    s.as("p1")
      .play("Twilight Shroud", { choices: { "target:0": unit.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(might(s, unit.id)).toBe(4);
    expect(optionIds(s, "Hextech Ray", "p2")).not.toContain(unit.id);
    expect(optionIds(s, "Hextech Ray", "p1")).toContain(unit.id);
  });

  it("[C:Twilight Step][R421] moves a unit with 3 Might or less", () => {
    const s = withCards(["Twilight Step"]);
    const small = place(s, "p1", "Caitlyn, Patrolling", "base");
    const big = place(s, "p1", "Whiteflame Protector", "base");
    expect(optionIds(s, "Twilight Step")).not.toContain(big.id);
    fund(s, "p1", "Twilight Step");
    s.as("p1")
      .play("Twilight Step", { choices: { "target:0": small.id, destination: "battlefieldA" } })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(zoneOf(s, small.id)).toBe("battlefieldA");
  });

  it("[C:Perfect Execution][R416][R807] readies a unit and gives it Assault 3 this turn", () => {
    const s = withCards(["Perfect Execution"]);
    const unit = place(s, "p1", "Caitlyn, Patrolling", "base", { exhausted: true });
    fund(s, "p1", "Perfect Execution");
    s.as("p1")
      .play("Perfect Execution", { choices: { "target:0": unit.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(s.host.isExhausted(s.room, unit.id)).toBe(false);
    expect(keywordValue(s, unit.id, "Assault")).toBe(3);
  });

  it("[C:Public Execution][R429] kills an enemy unit with less Might than the chosen friendly unit", () => {
    const s = withCards(["Public Execution"]);
    const mine = place(s, "p1", "Caitlyn, Patrolling", "base");
    const weak = place(s, "p2", "Treasure Hunter", "base");
    const strong = place(s, "p2", "Whiteflame Protector", "base");
    const ability = lookupAbility("Public Execution", "spell")!.ability;
    const specs = requiredChoices(s.room, s.host, ability, {
      controller: "p1",
      choices: { "target:0": mine.id },
    });
    const second = specs.find((spec) => spec.key === "target:1")!;
    expect(second.options.map((o) => o.id)).toContain(weak.id);
    expect(second.options.map((o) => o.id)).not.toContain(strong.id);
    fund(s, "p1", "Public Execution");
    s.as("p1")
      .play("Public Execution", { choices: { "target:0": mine.id, "target:1": weak.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(zoneOf(s, weak.id)).toBe("trash");
  });

  it("[C:Shuriken Flip][R355.13][R421] deals 2 to up to one enemy unit at a battlefield, then moves a friendly unit", () => {
    const s = withCards(["Shuriken Flip"]);
    const enemy = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    const mine = place(s, "p1", "Treasure Hunter", "base");
    fund(s, "p1", "Shuriken Flip");
    s.as("p1")
      .play("Shuriken Flip", {
        choices: { "target:0": [enemy.id], "target:1": mine.id, destination: "battlefieldB" },
      })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(s.room.rules!.objects[enemy.id]?.damage).toBe(2);
    expect(zoneOf(s, mine.id)).toBe("battlefieldB");
  });

  it("[C:Ruthless Strike][R355.1.a][R356.4.f.1] deals 3, or 5 if the optional discard was paid", () => {
    const s = withCards(["Ruthless Strike", "Ruthless Strike", "Rebuke"]);
    const a = place(s, "p2", "Whiteflame Protector", "battlefieldA");
    const b = place(s, "p2", "Whiteflame Protector", "battlefieldA");
    fund(s, "p1", "Ruthless Strike");
    s.as("p1")
      .play("Ruthless Strike", { choices: { "target:0": a.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(s.room.rules!.objects[a.id]?.damage).toBe(3);
    fund(s, "p1", "Ruthless Strike");
    const strike = s.handCard("p1", "Ruthless Strike")!;
    const rebuke = s.handCard("p1", "Rebuke")!;
    s.as("p1")
      .apply({
        type: "rules_play",
        cardId: strike.id,
        choices: { "target:0": b.id } as never,
        optionalCosts: ["optional:0"],
      })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(zoneOf(s, rebuke.id)).toBe("trash");
    expect(s.room.rules!.objects[b.id]?.damage).toBe(5);
  });

  it("[C:Rampage][R355.1.a][R418.6.b.3] optional [Body]: +2 to the friendly unit; then they deal their Mights to each other", () => {
    const s = withCards(["Rampage", "Rampage"]);
    const mine = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    const theirs = place(s, "p2", "Stellacorn Herder", "battlefieldA");
    exhaustRunes(s, "p1");
    fund(s, "p1", "Rampage");
    s.room.rules!.pools.p1!.power.Body = (s.room.rules!.pools.p1!.power.Body ?? 0) + 1;
    const card = s.handCard("p1", "Rampage")!;
    s.as("p1")
      .apply({
        type: "rules_play",
        cardId: card.id,
        choices: { "target:0": mine.id, "target:1": theirs.id } as never,
        optionalCosts: ["optional:0"],
      })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(zoneOf(s, theirs.id)).toBe("trash");
    expect(s.room.rules!.objects[mine.id]?.damage).toBe(3);
    expect(zoneOf(s, mine.id)).toBe("battlefieldA");
  });

  it("[C:Rampage] without the additional cost the friendly unit gets no +2", () => {
    const s = withCards(["Rampage"]);
    const mine = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    const theirs = place(s, "p2", "Stellacorn Herder", "battlefieldA");
    fund(s, "p1", "Rampage");
    s.as("p1")
      .play("Rampage", { choices: { "target:0": mine.id, "target:1": theirs.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(zoneOf(s, mine.id)).toBe("trash");
    expect(zoneOf(s, theirs.id)).toBe("trash");
  });

  it("[C:Resonating Strike][R355.7][R421] move a unit you control to a battlefield you control and give it +2", () => {
    const s = withCards(["Resonating Strike"]);
    place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    setControl(s, "battlefieldA", "p1");
    const unit = place(s, "p1", "Treasure Hunter", "base");
    fund(s, "p1", "Resonating Strike");
    s.as("p1")
      .play("Resonating Strike", {
        choices: { "target:0": "battlefield:battlefieldA", "target:1": unit.id },
      })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(zoneOf(s, unit.id)).toBe("battlefieldA");
    expect(might(s, unit.id)).toBe(3);
  });

  it("[C:Shadow Dash][R421] moves an enemy unit to a battlefield where you have units; exactly two units: +1 each", () => {
    const s = withCards(["Shadow Dash"]);
    const a = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    const b = place(s, "p1", "Treasure Hunter", "battlefieldA");
    const enemy = place(s, "p2", "Caitlyn, Patrolling", "base");
    fund(s, "p1", "Shadow Dash");
    s.as("p1")
      .play("Shadow Dash", {
        choices: { "target:0": "battlefield:battlefieldA", "target:1": enemy.id },
      })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(zoneOf(s, enemy.id)).toBe("battlefieldA");
    expect(might(s, a.id)).toBe(4);
    expect(might(s, b.id)).toBe(2);
  });

  it("[C:Dominus][R433] doubles a unit's Might this turn", () => {
    const s = withCards(["Dominus"]);
    const unit = place(s, "p1", "Caitlyn, Patrolling", "base");
    fund(s, "p1", "Dominus");
    s.as("p1")
      .play("Dominus", { choices: { "target:0": unit.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(might(s, unit.id)).toBe(6);
    expect(getCardScript("Dominus")?.status).toBe("partial");
  });

  it("[C:Crumbling Sands][R426][R359.3.f.2] counters a spell only if an opponent played another spell this turn", () => {
    const s = withCards(["Crumbling Sands", "Crumbling Sands"], ["Hextech Ray", "Hextech Ray"]);
    const unit = place(s, "p1", "Whiteflame Protector", "battlefieldA");
    s.as("p1").endTurn().expectOk();
    settle(s);
    expect(s.room.rules!.turn.player).toBe("p2");
    // First spell of the turn: not countered.
    fund(s, "p2", "Hextech Ray");
    s.as("p2")
      .play("Hextech Ray", { choices: { "target:0": unit.id } })
      .expectOk();
    const first = s.room.rules!.chain[0]!.id;
    fund(s, "p1", "Crumbling Sands");
    s.as("p1")
      .play("Crumbling Sands", { choices: { "target:0": first } })
      .expectOk();
    settle(s);
    expect(s.room.rules!.objects[unit.id]?.damage).toBe(3);
    // Second spell: p2 has played another spell this turn, so it is countered.
    fund(s, "p2", "Hextech Ray");
    s.as("p2")
      .play("Hextech Ray", { choices: { "target:0": unit.id } })
      .expectOk();
    const second = s.room.rules!.chain[0]!.id;
    fund(s, "p1", "Crumbling Sands");
    s.as("p1")
      .play("Crumbling Sands", { choices: { "target:0": second } })
      .expectOk();
    settle(s);
    expect(s.room.rules!.objects[unit.id]?.damage).toBe(3);
  });

  it("[C:Cataclysmic Duel][R355.18][R429] each player keeps one unit they control; the rest die", () => {
    const s = withCards(["Cataclysmic Duel"]);
    const keep1 = place(s, "p1", "Caitlyn, Patrolling", "base");
    const lose1 = place(s, "p1", "Treasure Hunter", "battlefieldA");
    const keep2 = place(s, "p2", "Whiteflame Protector", "base");
    const lose2 = place(s, "p2", "Caitlyn, Patrolling", "battlefieldB");
    fund(s, "p1", "Cataclysmic Duel");
    s.as("p1").play("Cataclysmic Duel").expectOk();
    s.as("p2").pass().expectOk();
    s.expectPrompt("choose-card", "p1");
    answer(s, [keep1.id]);
    s.expectPrompt("choose-card", "p2");
    answer(s, [keep2.id]);
    settle(s);
    expect([zoneOf(s, keep1.id), zoneOf(s, keep2.id)]).toEqual(["base", "base"]);
    expect([zoneOf(s, lose1.id), zoneOf(s, lose2.id)]).toEqual(["trash", "trash"]);
  });

  it("[C:Dragon Form][R479] the chosen unit's base Might becomes 5 this turn (other modifiers still apply)", () => {
    const s = withCards(["Dragon Form", "Dragon Form"]);
    const small = place(s, "p1", "Treasure Hunter", "base");
    const big = place(s, "p2", "Whiteflame Protector", "base");
    s.room.rules!.objects[small.id] = { baseMight: 1, buffs: 1 };
    fund(s, "p1", "Dragon Form");
    s.as("p1")
      .play("Dragon Form", { choices: { "target:0": small.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    fund(s, "p1", "Dragon Form");
    s.as("p1")
      .play("Dragon Form", { choices: { "target:0": big.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(might(s, small.id)).toBe(6);
    expect(might(s, big.id)).toBe(5);
  });
});
