/**
 * Vendetta units: play effects, combat/conquer/hold triggers, move and phase triggers.
 */
import { describe, expect, it } from "vitest";
import { getCardScript, lookupAbility, requiredChoices } from "../../../src";
import { fund } from "../../rules/effects/helpers";
import {
  answer,
  boardOf,
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

/** Answer the pending "you may" (403.1) with yes. */
function yes(s: ReturnType<typeof withCards>): void {
  const prompt = s.room.rules!.prompt!;
  s.as(prompt.playerId)
    .choose({ optionIds: ["yes"] })
    .expectOk();
}

describe("Vendetta units — play effects", () => {
  it("[C:Cloud Drake][R383.4.a] when you play me, draw 1", () => {
    const s = withCards(["Cloud Drake"]);
    fund(s, "p1", "Cloud Drake");
    s.as("p1").play("Cloud Drake").expectOk();
    settle(s);
    expect(boardOf(s, "p1").hand).toHaveLength(1);
  });

  it("[C:Field Musicians][R383.4.a] when you play me, give a unit +3 Might this turn", () => {
    const s = withCards(["Field Musicians"]);
    const unit = place(s, "p1", "Caitlyn, Patrolling", "base");
    fund(s, "p1", "Field Musicians");
    s.as("p1").play("Field Musicians").expectOk();
    if (s.room.rules!.prompt) answer(s, [unit.id]);
    settle(s);
    const musicians = s.findBoardCardAnywhere("Field Musicians")!;
    expect(might(s, unit.id) + might(s, musicians.id)).toBe(3 + 3 + 3);
  });

  it("[C:Reluctant Leader][R420.4.a] when you play another unit, +2 Might this turn", () => {
    const s = withCards(["Reluctant Leader", "Treasure Hunter"]);
    fund(s, "p1", "Reluctant Leader");
    s.as("p1").play("Reluctant Leader").expectOk();
    settle(s);
    const leader = s.findBoardCardAnywhere("Reluctant Leader")!;
    expect(might(s, leader.id)).toBe(3);
    fund(s, "p1", "Treasure Hunter");
    s.as("p1").play("Treasure Hunter").expectOk();
    settle(s);
    expect(might(s, leader.id)).toBe(5);
  });

  it("[C:Patched Porobot][R383.2.a.1] when you play me with 3+ other gear, draw 1", () => {
    const s = withCards([
      "Patched Porobot",
      "Patched Porobot",
      "Tools of Empire",
      "Tools of Empire",
      "Hextech Formula",
    ]);
    place(s, "p1", "Tools of Empire", "base");
    place(s, "p1", "Tools of Empire", "base");
    fund(s, "p1", "Patched Porobot");
    s.as("p1").play("Patched Porobot").expectOk();
    settle(s);
    expect(boardOf(s, "p1").hand).toHaveLength(2);
    place(s, "p1", "Hextech Formula", "base");
    fund(s, "p1", "Patched Porobot");
    s.as("p1").play("Patched Porobot").expectOk();
    settle(s);
    // The first Porobot is a gear too: 4 other gear → draw 1 (one Porobot left the hand, one drawn).
    expect(boardOf(s, "p1").hand).toHaveLength(1);
  });

  it("[C:Morgana, Vindictive][R418] when you play me, deal damage equal to the damage marked on a unit", () => {
    const s = withCards(["Morgana, Vindictive"]);
    const enemy = place(s, "p2", "Whiteflame Protector", "battlefieldA");
    s.room.rules!.objects[enemy.id] = { baseMight: 8, damage: 3 };
    fund(s, "p1", "Morgana, Vindictive");
    s.as("p1").play("Morgana, Vindictive").expectOk();
    if (s.room.rules!.prompt) answer(s, [enemy.id]);
    settle(s);
    expect(s.room.rules!.objects[enemy.id]?.damage).toBe(6);
  });

  it("[C:Illaoi, Prophet of the Great Kraken][R440.2.c][R383.4.c] Tentacle when played and when I score; +1 Might per token unit", () => {
    const s = withCards(["Illaoi, Prophet of the Great Kraken"]);
    fund(s, "p1", "Illaoi, Prophet of the Great Kraken");
    s.as("p1").play("Illaoi, Prophet of the Great Kraken").expectOk();
    settle(s);
    const illaoi = s.findBoardCardAnywhere("Illaoi, Prophet of the Great Kraken")!;
    expect(boardOf(s, "p1").base.filter((card) => card.name === "Tentacle")).toHaveLength(1);
    expect(might(s, illaoi.id)).toBe(5);
    s.host.setExhausted(s.room, illaoi.id, false);
    s.as("p1").move("Illaoi, Prophet of the Great Kraken", "battlefieldB").expectOk();
    settle(s);
    expect(boardOf(s, "p1").base.filter((card) => card.name === "Tentacle")).toHaveLength(2);
    expect(might(s, illaoi.id)).toBe(6);
  });

  it("[C:Horns of the Dragon][C:Soulspinner][R815][R822] keyword-only units", () => {
    const s = withCards(["Horns of the Dragon", "Soulspinner"]);
    const horns = place(s, "p1", "Horns of the Dragon", "base");
    const spinner = place(s, "p1", "Soulspinner", "base");
    expect(keywords(s, horns.id)).toContain("Tank");
    expect(keywords(s, spinner.id)).toContain("Ambush");
  });
});

describe("Vendetta units — combat, conquer and hold triggers", () => {
  it("[C:Twilight Reveler][R383.4.e] when I attack, ready another friendly unit", () => {
    const s = withCards(["Twilight Reveler"], [], { battlefields: { p2: "Bandle Tree" } });
    place(s, "p2", "Treasure Hunter", "battlefieldA");
    setControl(s, "battlefieldA", "p2");
    place(s, "p1", "Twilight Reveler", "base");
    const tired = place(s, "p1", "Caitlyn, Patrolling", "base", { exhausted: true });
    s.as("p1").move("Twilight Reveler", "battlefieldA").expectOk();
    if (
      s.room.rules!.prompt?.playerId === "p1" &&
      s.room.rules!.prompt.kind !== "damage-assignment"
    )
      answer(s, [tired.id]);
    settle(s);
    expect(s.host.isExhausted(s.room, tired.id)).toBe(false);
  });

  it("[C:Shen, Scourge of Shadows][C:Shen, Leader of the Kinkou Order][R383.4.d] when I hold with exactly one other friendly unit: draw 1 / score 1", () => {
    const s = withCards(["Shen, Scourge of Shadows"], [], {});
    place(s, "p1", "Shen, Scourge of Shadows", "battlefieldA");
    place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    setControl(s, "battlefieldA", "p1");
    s.as("p1").endTurn().expectOk();
    settle(s);
    s.as("p2").endTurn().expectOk();
    const hand = boardOf(s, "p1").hand.length;
    settle(s);
    // Hold point + the draw step's draw + Shen's draw.
    expect(boardOf(s, "p1").hand.length).toBe(hand + 2);
    s.expectScore("p1", 1);

    const t = withCards(["Shen, Leader of the Kinkou Order"]);
    place(t, "p1", "Shen, Leader of the Kinkou Order", "battlefieldA");
    place(t, "p1", "Caitlyn, Patrolling", "battlefieldA");
    setControl(t, "battlefieldA", "p1");
    t.as("p1").endTurn().expectOk();
    settle(t);
    t.as("p2").endTurn().expectOk();
    settle(t);
    t.expectScore("p1", 2);
  });

  it("[C:Shen, Leader of the Kinkou Order] no extra point with two other friendly units there", () => {
    const s = withCards(["Shen, Leader of the Kinkou Order"]);
    place(s, "p1", "Shen, Leader of the Kinkou Order", "battlefieldA");
    place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    setControl(s, "battlefieldA", "p1");
    s.as("p1").endTurn().expectOk();
    settle(s);
    s.as("p2").endTurn().expectOk();
    settle(s);
    s.expectScore("p1", 1);
  });

  it("[C:Nasus, Guardian of Knowledge][R383.3.e] once each turn, when an enemy unit here dies, channel 1 rune exhausted", () => {
    const s = withCards(["Nasus, Guardian of Knowledge", "Firestorm"]);
    place(s, "p1", "Nasus, Guardian of Knowledge", "battlefieldA");
    const a = place(s, "p2", "Treasure Hunter", "battlefieldA");
    const b = place(s, "p2", "Treasure Hunter", "battlefieldA");
    const runes = boardOf(s, "p1").runeArea.length;
    fund(s, "p1", "Firestorm");
    s.as("p1")
      .play("Firestorm", { choices: { "target:0": "battlefield:battlefieldA" } })
      .expectOk();
    s.as("p2").pass().expectOk();
    settle(s);
    expect([zoneOf(s, a.id), zoneOf(s, b.id)]).toEqual(["trash", "trash"]);
    // Two enemy units died here at once: the once-each-turn trigger channels one rune.
    expect(boardOf(s, "p1").runeArea).toHaveLength(runes + 1);
    expect(boardOf(s, "p1").runeArea[runes]!.exhausted).toBe(true);
  });

  it("[C:Noxian Demolitionist][R383.4.c] when I conquer, may kill a gear with Energy cost no more than my Might", () => {
    const s = withCards(["Noxian Demolitionist"], ["Hextech Formula", "Tools of Empire"]);
    const unit = place(s, "p1", "Noxian Demolitionist", "base");
    s.room.rules!.objects[unit.id] = { baseMight: 3 };
    const cheap = place(s, "p2", "Hextech Formula", "base");
    const pricey = place(s, "p2", "Tools of Empire", "base");
    s.as("p1").move("Noxian Demolitionist", "battlefieldB").expectOk();
    settle(s);
    yes(s);
    settle(s);
    expect(zoneOf(s, cheap.id)).toBe("trash");
    expect(zoneOf(s, pricey.id)).toBe("base");
  });

  it("[C:Renekton, Rage Fueled][R383.2.a.1] when I attack with 4 or fewer runes, deal 2 to all enemy units here", () => {
    const s = withCards(["Renekton, Rage Fueled"], [], { battlefields: { p2: "Bandle Tree" } });
    const a = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    const b = place(s, "p2", "Whiteflame Protector", "battlefieldA");
    setControl(s, "battlefieldA", "p2");
    place(s, "p1", "Renekton, Rage Fueled", "base");
    s.as("p1").move("Renekton, Rage Fueled", "battlefieldA").expectOk();
    expect(s.room.rules!.chain.some((item) => item.cardName === "Renekton, Rage Fueled")).toBe(
      true,
    );
    passBoth(s);
    expect(s.room.rules!.objects[a.id]?.damage).toBe(2);
    expect(s.room.rules!.objects[b.id]?.damage).toBe(2);
  });

  it("[C:Baccai Reaper][R740.4.a.2][R383.3.b] when I attack, may pay [Fury] to give me Assault 2 this turn", () => {
    const s = withCards(["Baccai Reaper"], [], { battlefields: { p2: "Bandle Tree" } });
    place(s, "p2", "Whiteflame Protector", "battlefieldA");
    setControl(s, "battlefieldA", "p2");
    const reaper = place(s, "p1", "Baccai Reaper", "base");
    expect(keywordValue(s, reaper.id, "Assault")).toBe(0);
    s.room.rules!.pools.p1!.power.Fury = 1;
    s.as("p1").move("Baccai Reaper", "battlefieldA").expectOk();
    yes(s);
    expect(s.room.rules!.pools.p1!.power.Fury ?? 0).toBe(0);
    passBoth(s);
    expect(keywordValue(s, reaper.id, "Assault")).toBe(2);
    expect(might(s, reaper.id)).toBe(6);
  });

  it("[C:Kennen, Keeper of Balance][R424] when played, may pay [2] to stun a unit; +2 Might while a stunned enemy unit is here", () => {
    const s = withCards(["Kennen, Keeper of Balance"]);
    const enemy = place(s, "p2", "Caitlyn, Patrolling", "base");
    fund(s, "p1", "Kennen, Keeper of Balance");
    s.room.rules!.pools.p1!.energy += 2;
    s.as("p1").play("Kennen, Keeper of Balance").expectOk();
    // 403.2 target first, then the 405 decision to pay the leading cost.
    answer(s, [enemy.id]);
    yes(s);
    settle(s);
    expect(s.room.rules!.objects[enemy.id]?.stunned).toBe(true);
    const kennen = s.findBoardCardAnywhere("Kennen, Keeper of Balance")!;
    expect(might(s, kennen.id)).toBe(4);
  });

  it("[C:Corrupted Dragon][R369.3][R383.4.e] enters ready when not within 3 points; on attack moves enemies with 5 Might or less to base", () => {
    const s = withCards(["Corrupted Dragon", "Corrupted Dragon"], [], {
      battlefields: { p2: "Bandle Tree" },
    });
    fund(s, "p1", "Corrupted Dragon");
    s.as("p1").play("Corrupted Dragon").expectOk();
    settle(s);
    expect(s.findBoardCardAnywhere("Corrupted Dragon")!.exhausted).toBe(false);
    const small = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    const big = place(s, "p2", "Whiteflame Protector", "battlefieldA");
    setControl(s, "battlefieldA", "p2");
    s.as("p1").move("Corrupted Dragon", "battlefieldA").expectOk();
    if (s.room.rules!.prompt?.kind === "choose-target") answer(s, [small.id]);
    passBoth(s);
    expect(zoneOf(s, small.id)).toBe("base");
    expect(zoneOf(s, big.id)).toBe("battlefieldA");
  });

  it("[C:Corrupted Dragon] enters exhausted when your score is within 3 points of the Victory Score", () => {
    const s = withCards(["Corrupted Dragon"]);
    boardOf(s, "p1").score = 6;
    fund(s, "p1", "Corrupted Dragon");
    s.as("p1").play("Corrupted Dragon").expectOk();
    settle(s);
    expect(s.findBoardCardAnywhere("Corrupted Dragon")!.exhausted).toBe(true);
  });
});

describe("Vendetta units — move, ready and Beginning Phase triggers", () => {
  it("[C:Eclipse Dragon][R383.2.a.1] when I move with 4 or fewer runes, draw 1", () => {
    const s = withCards(["Eclipse Dragon"]);
    place(s, "p1", "Eclipse Dragon", "battlefieldA");
    s.as("p1").move("Eclipse Dragon", "base").expectOk();
    settle(s);
    expect(boardOf(s, "p1").hand).toHaveLength(1);
  });

  it("[C:Minah Swiftfoot][R355.3] when I move to a battlefield, choose one: each player draws 1", () => {
    const s = withCards(["Minah Swiftfoot"]);
    place(s, "p1", "Minah Swiftfoot", "base");
    const before = [boardOf(s, "p1").hand.length, boardOf(s, "p2").hand.length];
    s.as("p1").move("Minah Swiftfoot", "battlefieldA").expectOk();
    if (s.room.rules!.prompt?.kind === "choose-mode") answer(s, ["draw"]);
    settle(s);
    expect([boardOf(s, "p1").hand.length, boardOf(s, "p2").hand.length]).toEqual([
      before[0]! + 1,
      before[1]! + 1,
    ]);
  });

  it("[C:Akali, Silent][R757.1][R740.2.c] can't be chosen by enemies out of combat; +2 Might when moving to a battlefield", () => {
    const s = withCards(["Akali, Silent"], ["Hextech Ray"]);
    const akali = place(s, "p1", "Akali, Silent", "base");
    const ability = lookupAbility("Hextech Ray", "spell")!.ability;
    const options = (player: string) =>
      requiredChoices(s.room, s.host, ability, { controller: player, choices: {} })[0]!.options.map(
        (o) => o.id,
      );
    s.as("p1").move("Akali, Silent", "battlefieldA").expectOk();
    settle(s);
    expect(might(s, akali.id)).toBe(6);
    expect(options("p2")).not.toContain(akali.id);
    expect(options("p1")).toContain(akali.id);
  });

  it("[C:Fretful Feline][R416] when an effect readies me, +2 Might this turn", () => {
    const s = withCards(["Fretful Feline", "Perfect Execution"]);
    const feline = place(s, "p1", "Fretful Feline", "base", { exhausted: true });
    fund(s, "p1", "Perfect Execution");
    s.as("p1")
      .play("Perfect Execution", { choices: { "target:0": feline.id } })
      .expectOk();
    s.as("p2").pass().expectOk();
    settle(s);
    expect(might(s, feline.id)).toBe(7);
    expect(getCardScript("Fretful Feline")?.status).toBe("partial");
  });

  it("[C:Forsaken Baccai][C:Oasis Raider][R315.2] fewer runes than an opponent at the start of your Beginning Phase: +1 / +2 and Ganking", () => {
    const s = withCards(["Forsaken Baccai", "Oasis Raider"]);
    const baccai = place(s, "p1", "Forsaken Baccai", "base");
    const raider = place(s, "p1", "Oasis Raider", "base");
    s.room.rules!.objects[baccai.id] = { baseMight: 2 };
    s.room.rules!.objects[raider.id] = { baseMight: 4 };
    expect(keywords(s, raider.id)).not.toContain("Ganking");
    s.as("p1").endTurn().expectOk();
    settle(s);
    setRunes(s, "p1", 2);
    setRunes(s, "p2", 6);
    s.as("p2").endTurn().expectOk();
    settle(s);
    expect(s.room.rules!.turn.player).toBe("p1");
    expect(might(s, baccai.id)).toBe(3);
    expect(might(s, raider.id)).toBe(6);
    expect(keywords(s, raider.id)).toContain("Ganking");
  });
});
