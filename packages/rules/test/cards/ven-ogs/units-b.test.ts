/**
 * Vendetta passives, cost reductions, battlefields, gear, legends and optional-cost units.
 */
import { describe, expect, it } from "vitest";
import { costAdjustments, getCardScript } from "../../../src";
import { fund } from "../../rules/effects/helpers";
import {
  activate,
  answer,
  boardOf,
  exhaustRunes,
  keywordValue,
  keywords,
  might,
  passBoth,
  place,
  setControl,
  setRunes,
  settle,
  withCards,
  zoneOf,
} from "./helpers";

type S = ReturnType<typeof withCards>;

function yes(s: S): void {
  const prompt = s.room.rules!.prompt!;
  s.as(prompt.playerId)
    .choose({ optionIds: ["yes"] })
    .expectOk();
}

function energyDelta(s: S, player: string, cardId: string): number {
  return costAdjustments(s.room, s.host, { playerId: player, cardId }).reduce(
    (sum, entry) => sum + (entry.energy ?? 0),
    0,
  );
}

describe("Vendetta passives and cost reductions", () => {
  it("[C:Disciple of Shen][R364.3.a] Shield 3 while at a battlefield with exactly one other friendly unit", () => {
    const s = withCards(["Disciple of Shen"]);
    const disciple = place(s, "p1", "Disciple of Shen", "battlefieldA");
    expect(keywordValue(s, disciple.id, "Shield")).toBe(0);
    place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    expect(keywordValue(s, disciple.id, "Shield")).toBe(3);
    place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    expect(keywordValue(s, disciple.id, "Shield")).toBe(0);
  });

  it("[C:Repair Specialist][R807.2] Assault equal to the number of gear you control", () => {
    const s = withCards(["Repair Specialist", "Tools of Empire", "Hextech Formula"]);
    const unit = place(s, "p1", "Repair Specialist", "base");
    expect(keywordValue(s, unit.id, "Assault")).toBe(0);
    place(s, "p1", "Tools of Empire", "base");
    place(s, "p1", "Hextech Formula", "base");
    expect(keywordValue(s, unit.id, "Assault")).toBe(2);
  });

  it("[C:Spiderling] +1 Might for each other unit you control here named Spiderling", () => {
    const s = withCards(["Spiderling", "Spiderling", "Spiderling"]);
    const a = place(s, "p1", "Spiderling", "battlefieldA");
    place(s, "p1", "Spiderling", "battlefieldA");
    place(s, "p1", "Spiderling", "base");
    expect(might(s, a.id)).toBe(2);
  });

  it("[C:Shadow Assassin][R369.3] enters ready if a card with my name is in your trash", () => {
    const s = withCards(["Shadow Assassin", "Shadow Assassin", "Shadow Assassin"]);
    fund(s, "p1", "Shadow Assassin");
    s.as("p1").play("Shadow Assassin").expectOk();
    expect(s.findBoardCardAnywhere("Shadow Assassin")!.exhausted).toBe(true);
    place(s, "p1", "Shadow Assassin", "trash");
    fund(s, "p1", "Shadow Assassin");
    s.as("p1").play("Shadow Assassin").expectOk();
    const ready = boardOf(s, "p1").base.filter(
      (card) => card.name === "Shadow Assassin" && !card.exhausted,
    );
    expect(ready).toHaveLength(1);
  });

  it("[C:Shadowcloaked Lurker][R366.2.a] costs [2] less for each card with my name in your trash", () => {
    const s = withCards(["Shadowcloaked Lurker", "Shadowcloaked Lurker", "Shadowcloaked Lurker"]);
    place(s, "p1", "Shadowcloaked Lurker", "trash");
    place(s, "p1", "Shadowcloaked Lurker", "trash");
    const lurker = s.handCard("p1", "Shadowcloaked Lurker")!;
    expect(energyDelta(s, "p1", lurker.id)).toBe(-4);
    exhaustRunes(s, "p1");
    s.room.rules!.pools.p1!.energy = 1;
    s.as("p1").play("Shadowcloaked Lurker").expectOk();
  });

  it("[C:Plaza Guardian][R366.2.a] costs [1] less for each gear you control", () => {
    const s = withCards(["Plaza Guardian", "Tools of Empire", "Hextech Formula", "Rage Amplifier"]);
    for (const name of ["Tools of Empire", "Hextech Formula", "Rage Amplifier"])
      place(s, "p1", name, "base");
    expect(energyDelta(s, "p1", s.handCard("p1", "Plaza Guardian")!.id)).toBe(-3);
  });

  it("[C:Keeper of Law][R366.2.a] costs [2][Order] less if you control a battlefield with exactly two units", () => {
    const s = withCards(["Keeper of Law"]);
    const keeper = s.handCard("p1", "Keeper of Law")!;
    place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    setControl(s, "battlefieldA", "p1");
    expect(costAdjustments(s.room, s.host, { playerId: "p1", cardId: keeper.id })).toEqual([]);
    place(s, "p1", "Treasure Hunter", "battlefieldA");
    expect(costAdjustments(s.room, s.host, { playerId: "p1", cardId: keeper.id })).toEqual([
      expect.objectContaining({ energy: -2, power: { Order: -1 } }),
    ]);
  });

  it("[C:Esteemed Hierophant][R438.3.c] with 7+ runes, damage from enemy spells and abilities is prevented", () => {
    const s = withCards(["Hextech Ray", "Hextech Ray"], ["Esteemed Hierophant"]);
    const priest = place(s, "p2", "Esteemed Hierophant", "battlefieldA");
    setRunes(s, "p2", 7);
    fund(s, "p1", "Hextech Ray");
    s.as("p1")
      .play("Hextech Ray", { choices: { "target:0": priest.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(s.room.rules!.objects[priest.id]?.damage).toBeUndefined();
    setRunes(s, "p2", 6);
    fund(s, "p1", "Hextech Ray");
    s.as("p1")
      .play("Hextech Ray", { choices: { "target:0": priest.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(s.room.rules!.objects[priest.id]?.damage).toBe(3);
  });

  it("[C:Kinkou Temple][R053.3] units here with Tank have +1 Might", () => {
    const s = withCards(["Horns of the Dragon"], [], { battlefields: { p1: "Kinkou Temple" } });
    const horns = place(s, "p1", "Horns of the Dragon", "battlefieldA");
    const plain = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    expect(might(s, horns.id)).toBe(7);
    expect(might(s, plain.id)).toBe(3);
  });

  it("[C:Hand Hammer][R718.4] +1 Might, and +2 more while the unit is at a battlefield with exactly one other friendly unit", () => {
    const s = withCards(["Hand Hammer"]);
    const unit = place(s, "p1", "Treasure Hunter", "base");
    const hammer = place(s, "p1", "Hand Hammer", "base");
    hammer.attachedToCardId = unit.id;
    expect(might(s, unit.id)).toBe(2);
    s.host.moveCard(s.room, "p1", "base", "battlefieldA", unit.id);
    s.host.moveCard(s.room, "p1", "base", "battlefieldA", hammer.id);
    place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    expect(might(s, unit.id)).toBe(4);
  });

  it("[C:Pendulum Blade][C:Jagged Cutlass][R718.4] Might bonuses of the attached Equipment", () => {
    const s = withCards(["Pendulum Blade", "Jagged Cutlass"]);
    const unit = place(s, "p1", "Treasure Hunter", "base");
    place(s, "p1", "Pendulum Blade", "base").attachedToCardId = unit.id;
    place(s, "p1", "Jagged Cutlass", "base").attachedToCardId = unit.id;
    expect(might(s, unit.id)).toBe(4);
    expect(getCardScript("Pendulum Blade")?.status).toBe("partial");
    expect(getCardScript("Jagged Cutlass")?.status).toBe("partial");
  });
});

describe("Vendetta battlefields, legends and gear", () => {
  it("[C:Shadow Temple][R383.4.d.2.b][R441] when you hold here, burn 3", () => {
    const s = withCards([], [], { battlefields: { p1: "Shadow Temple" } });
    place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    setControl(s, "battlefieldA", "p1");
    s.as("p1").endTurn().expectOk();
    settle(s);
    s.as("p2").endTurn().expectOk();
    const trash = boardOf(s, "p1").trash.length;
    settle(s);
    expect(boardOf(s, "p1").trash.length).toBe(trash + 3);
  });

  it("[C:Protective Sands][R740.4.a.2] when you conquer here with 4 or fewer runes, may pay [1] to draw 1", () => {
    const s = withCards([], [], { battlefields: { p2: "Protective Sands" } });
    place(s, "p1", "Caitlyn, Patrolling", "base");
    s.room.rules!.pools.p1!.energy = 1;
    const hand = boardOf(s, "p1").hand.length;
    s.as("p1").move("Caitlyn, Patrolling", "battlefieldB").expectOk();
    settle(s);
    yes(s);
    settle(s);
    expect(boardOf(s, "p1").hand.length).toBe(hand + 1);
    expect(s.room.rules!.pools.p1!.energy).toBe(0);
  });

  it("[C:Threshold of the Gray][R466.2] when combat starts here, the attacker and defender each add [1]", () => {
    const s = withCards([], [], { battlefields: { p2: "Threshold of the Gray" } });
    place(s, "p2", "Whiteflame Protector", "battlefieldB");
    setControl(s, "battlefieldB", "p2");
    place(s, "p1", "Caitlyn, Patrolling", "base");
    s.as("p1").move("Caitlyn, Patrolling", "battlefieldB").expectOk();
    expect(s.room.rules!.combat?.battlefield).toBe("battlefieldB");
    passBoth(s);
    expect(s.room.rules!.pools.p1!.energy).toBe(1);
    expect(s.room.rules!.pools.p2!.energy).toBe(1);
  });

  it("[C:Shen, Eye of Twilight][R806] [Action][Tap]: give a friendly unit Tank this turn", () => {
    const s = withCards(["Shen, Eye of Twilight"]);
    const shen = place(s, "p1", "Shen, Eye of Twilight", "legend");
    const unit = place(s, "p1", "Caitlyn, Patrolling", "base");
    activate(s, "p1", shen, "activated:0", { "target:0": unit.id }).expectOk();
    s.as("p2").pass().expectOk();
    expect(keywords(s, unit.id)).toContain("Tank");
  });

  it("[C:Bottled Constellation][R316.4][R383.3.b] at the start of your Main Phase, may kill 3 other friendly units/gear to score 1", () => {
    const s = withCards(["Bottled Constellation", "Tools of Empire"]);
    place(s, "p1", "Bottled Constellation", "base");
    const victims = [
      place(s, "p1", "Caitlyn, Patrolling", "base"),
      place(s, "p1", "Treasure Hunter", "base"),
      place(s, "p1", "Tools of Empire", "base"),
    ];
    s.as("p1").endTurn().expectOk();
    settle(s);
    s.as("p2").endTurn().expectOk();
    settle(s);
    expect(s.room.rules!.turn.player).toBe("p1");
    yes(s);
    settle(s);
    for (const victim of victims) expect(zoneOf(s, victim.id)).toBe("trash");
    s.expectScore("p1", 1);
  });
});

describe("Vendetta optional additional costs and Shadow Clones", () => {
  it("[C:Masa, Crashing Thunder][R356.4.f.1] paid [Order]: stun an enemy unit at a battlefield", () => {
    const s = withCards(["Masa, Crashing Thunder", "Masa, Crashing Thunder"]);
    const enemy = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    exhaustRunes(s, "p1");
    // Declined (paid from the pool only): no stun.
    fund(s, "p1", "Masa, Crashing Thunder");
    s.as("p1").play("Masa, Crashing Thunder").expectOk();
    settle(s);
    expect(s.room.rules!.objects[enemy.id]?.stunned).toBeUndefined();
    fund(s, "p1", "Masa, Crashing Thunder");
    s.room.rules!.pools.p1!.power.Order = 1;
    const masa = s.handCard("p1", "Masa, Crashing Thunder")!;
    s.as("p1")
      .apply({ type: "rules_play", cardId: masa.id, optionalCosts: ["optional:0"] })
      .expectOk();
    settle(s);
    expect(s.room.rules!.objects[enemy.id]?.stunned).toBe(true);
  });

  it("[C:Gust Monk][R356.4.f.1] paid [1]: banish a card from any trash to give a unit Assault 2 this turn", () => {
    const s = withCards(["Gust Monk", "Hextech Ray"]);
    const banished = place(s, "p1", "Hextech Ray", "trash");
    const unit = place(s, "p1", "Caitlyn, Patrolling", "base");
    exhaustRunes(s, "p1");
    fund(s, "p1", "Gust Monk");
    s.room.rules!.pools.p1!.energy += 1;
    const monk = s.handCard("p1", "Gust Monk")!;
    s.as("p1")
      .apply({ type: "rules_play", cardId: monk.id, optionalCosts: ["optional:0"] })
      .expectOk();
    if (s.room.rules!.prompt?.kind === "choose-target") answer(s, [unit.id]);
    settle(s);
    const trashPrompt = s.room.rules!.prompt;
    if (trashPrompt) answer(s, [banished.id]);
    settle(s);
    expect(zoneOf(s, banished.id)).toBe("banished");
    expect(keywordValue(s, unit.id, "Assault")).toBe(2);
    expect(keywordValue(s, s.findBoardCardAnywhere("Gust Monk")!.id, "Assault")).toBe(0);
  });

  it("[C:Zed, From the Shadows][C:Shadow Clone][R440.2.c] paid discard: a 0 Might Shadow Clone; its attack banishes a unit for Assault 4", () => {
    const s = withCards(["Zed, From the Shadows", "Rebuke", "Caitlyn, Patrolling"], [], {
      battlefields: { p2: "Bandle Tree" },
    });
    const dead = place(s, "p1", "Caitlyn, Patrolling", "trash");
    exhaustRunes(s, "p1");
    fund(s, "p1", "Zed, From the Shadows");
    const zed = s.handCard("p1", "Zed, From the Shadows")!;
    s.as("p1")
      .apply({ type: "rules_play", cardId: zed.id, optionalCosts: ["optional:0"] })
      .expectOk();
    // 423.1.a: choose the card to discard for the additional cost.
    s.as("p1")
      .choose({ optionIds: [s.room.rules!.prompt!.options![0]!.id] })
      .expectOk();
    settle(s);
    const clone = boardOf(s, "p1").base.find((card) => card.name === "Shadow Clone")!;
    expect(clone).toBeTruthy();
    expect(might(s, clone.id)).toBe(0);
    expect(keywordValue(s, clone.id, "Assault")).toBe(0);
    place(s, "p2", "Whiteflame Protector", "battlefieldA");
    setControl(s, "battlefieldA", "p2");
    s.host.setExhausted(s.room, clone.id, false);
    s.as("p1").move("Shadow Clone", "battlefieldA").expectOk();
    yes(s);
    settle(s);
    // 355.18: choose the unit to banish from the trash.
    answer(s, [dead.id]);
    settle(s);
    expect(zoneOf(s, dead.id)).toBe("banished");
  });

  it("[C:Swain, Visionary][R383.2.a.1] conquering after playing a non-token unit, gear and spell this turn scores 1 more", () => {
    const s = withCards(["Swain, Visionary", "Tools of Empire", "Hextech Ray"]);
    const enemy = place(s, "p2", "Treasure Hunter", "battlefieldA");
    fund(s, "p1", "Hextech Ray");
    s.as("p1")
      .play("Hextech Ray", { choices: { "target:0": enemy.id } })
      .expectOk();
    settle(s);
    fund(s, "p1", "Tools of Empire");
    s.as("p1").play("Tools of Empire").expectOk();
    settle(s);
    fund(s, "p1", "Swain, Visionary");
    s.as("p1").play("Swain, Visionary").expectOk();
    settle(s);
    // Vision (817): keep the looked-at card.
    if (s.room.rules!.prompt) s.as("p1").choose({ optionIds: [] }).expectOk();
    settle(s);
    const swain = s.findBoardCardAnywhere("Swain, Visionary")!;
    s.host.setExhausted(s.room, swain.id, false);
    s.as("p1").move("Swain, Visionary", "battlefieldB").expectOk();
    settle(s);
    s.expectScore("p1", 2);
  });

  it("[C:Riven, Shattered][R383.4.e] when I attack, deal 2 to an enemy unit here for each Equipment attached to me", () => {
    const s = withCards(["Riven, Shattered", "Pendulum Blade", "Jagged Cutlass"], [], {
      battlefields: { p2: "Bandle Tree" },
    });
    const enemy = place(s, "p2", "Whiteflame Protector", "battlefieldA");
    setControl(s, "battlefieldA", "p2");
    const riven = place(s, "p1", "Riven, Shattered", "base");
    place(s, "p1", "Pendulum Blade", "base").attachedToCardId = riven.id;
    place(s, "p1", "Jagged Cutlass", "base").attachedToCardId = riven.id;
    s.as("p1").move("Riven, Shattered", "battlefieldA").expectOk();
    expect(s.room.rules!.chain.some((item) => item.cardName === "Riven, Shattered")).toBe(true);
    passBoth(s);
    expect(s.room.rules!.objects[enemy.id]?.damage).toBe(4);
  });
});
