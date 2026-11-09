/**
 * Wave R4 — Vendetta spells: group targeting, resolution-time choices and effect-driven plays.
 */
import { describe, expect, it } from "vitest";
import { getCardScript } from "../../../src";

import { fund } from "../../rules/effects/helpers";
import {
  addPool,
  answer,
  boardOf,
  exhaustRunes,
  might,
  place,
  settle,
  withCards,
  zoneOf,
} from "./helpers";

describe("Wave R4 Vendetta spells", () => {
  it("[C:Acceleration Gate][R416][R355.13] readies up to 4 units, gear and/or runes", () => {
    const s = withCards(["Acceleration Gate", "Rage Amplifier"]);
    const a = place(s, "p1", "Caitlyn, Patrolling", "base", { exhausted: true });
    const b = place(s, "p1", "Treasure Hunter", "base", { exhausted: true });
    const gear = place(s, "p1", "Rage Amplifier", "base", { exhausted: true });
    exhaustRunes(s, "p1");
    fund(s, "p1", "Acceleration Gate");
    s.as("p1").play("Acceleration Gate").expectOk();
    settle(s);
    expect(s.room.rules!.prompt?.kind).toBe("choose-card");
    const ids = s.room.rules!.prompt!.options!.slice(0, 4).map((option) => option.id);
    answer(s, ids);
    settle(s);
    for (const id of [a.id, b.id, gear.id]) expect(s.host.isExhausted(s.room, id)).toBe(false);
  });

  it("[C:Decree of Discord][R355.11][R355.13] returns any number of enemy Order units with total Might 5 or less", () => {
    const s = withCards(["Decree of Discord"], ["Daring Poro", "Vanguard Captain", "Trifarian Gloryseeker"]);
    const poro = place(s, "p2", "Daring Poro", "battlefieldA");
    const captain = place(s, "p2", "Vanguard Captain", "battlefieldA");
    const glory = place(s, "p2", "Trifarian Gloryseeker", "battlefieldA");
    fund(s, "p1", "Decree of Discord");
    s.as("p1")
      .play("Decree of Discord", { choices: { "target:0": [poro.id, captain.id, glory.id] } })
      .expectError("illegal_target");
    s.as("p1")
      .play("Decree of Discord", { choices: { "target:0": [poro.id, captain.id] } })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(zoneOf(s, poro.id)).toBe("hand");
    expect(zoneOf(s, captain.id)).toBe("hand");
    expect(zoneOf(s, glory.id)).toBe("battlefieldA");
  });

  it("[C:Decree of Focus][R806][R418] +4 Might to a friendly unit chosen by an enemy Fury spell", () => {
    const s = withCards(["Decree of Focus"], ["Incinerate"]);
    const unit = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    s.as("p1").endTurn().expectOk();
    settle(s);
    fund(s, "p2", "Incinerate");
    s.as("p2").play("Incinerate", { choices: { "target:0": unit.id } }).expectOk();
    fund(s, "p1", "Decree of Focus");
    s.as("p1")
      .play("Decree of Focus", { choices: { "target:0": unit.id } })
      .expectOk();
    settle(s);
    expect(might(s, unit.id)).toBe(7);
    expect(s.room.rules!.objects[unit.id]?.damage).toBe(2);
  });

  it("[C:Rebuttal][R435][R445] pay [Rune] to gain control of a cheap spell and choose a new target", () => {
    const s = withCards(["Rebuttal", "Whiteflame Protector"], ["Incinerate", "Whiteflame Protector"]);
    const mine = place(s, "p1", "Whiteflame Protector", "battlefieldA");
    const theirs = place(s, "p2", "Whiteflame Protector", "battlefieldB");
    s.as("p1").endTurn().expectOk();
    settle(s);
    fund(s, "p2", "Incinerate");
    s.as("p2").play("Incinerate", { choices: { "target:0": mine.id } }).expectOk();
    const spell = s.room.rules!.chain.find((item) => item.cardName === "Incinerate")!;
    exhaustRunes(s, "p1");
    addPool(s, "p1", 1, { Mind: 1 });
    addPool(s, "p1", 0, { any: 1 });
    fund(s, "p1", "Rebuttal");
    s.as("p1")
      .play("Rebuttal", { choices: { "target:0": spell.id } })
      .expectOk();
    settle(s);
    // Rebuttal asks whether to pay [Rune].
    expect(s.room.rules!.prompt?.kind).toBe("yes-no");
    answer(s, ["yes"]);
    settle(s);
    // The stolen spell chooses new targets when it resolves.
    if (s.room.rules!.prompt) answer(s, [theirs.id]);
    settle(s);
    expect(s.room.rules!.objects[theirs.id]?.damage).toBe(2);
    expect(s.room.rules!.objects[mine.id]?.damage).toBeUndefined();
    expect(getCardScript("Rebuttal")?.status).toBe("partial");
  });

  it("[C:Temporal Breach][R420.3][R428] banishes a unit and its owner plays it back to the same location", () => {
    const s = withCards(["Temporal Breach"]);
    const unit = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    fund(s, "p1", "Temporal Breach");
    s.as("p1")
      .play("Temporal Breach", { choices: { "target:0": unit.id } })
      .expectOk();
    settle(s);
    expect(zoneOf(s, unit.id)).toBe("battlefieldA");
    expect(s.host.findCard(s.room, unit.id)?.playerId).toBe("p2");
    expect(s.room.rules!.objects[unit.id]?.enteredThisTurn).toBe(true);
  });

  it("[C:Wild Claw][R420.3][R356.4] plays a unit from the top 5 for [5] less and recycles the rest", () => {
    const s = withCards([
      "Wild Claw",
      "Rage Amplifier",
      "Treasure Hunter",
      "Caitlyn, Patrolling",
      "Hextech Ray",
      "Whiteflame Protector",
    ]);
    place(s, "p1", "Rage Amplifier", "deck");
    place(s, "p1", "Treasure Hunter", "deck");
    place(s, "p1", "Caitlyn, Patrolling", "deck");
    place(s, "p1", "Hextech Ray", "deck");
    const dragon = place(s, "p1", "Whiteflame Protector", "deck");
    fund(s, "p1", "Wild Claw");
    addPool(s, "p1", 3, { Calm: 2 });
    const deck = boardOf(s, "p1").deck.length;
    s.as("p1").play("Wild Claw").expectOk();
    settle(s);
    expect(s.room.rules!.prompt?.kind).toBe("choose-card");
    answer(s, [dragon.id]);
    settle(s);
    // The delayed optional empowerment waits for the played card's play event.
    if (s.room.rules!.prompt?.kind === "yes-no") {
      answer(s, ["yes"]);
      settle(s);
    }
    expect(zoneOf(s, dragon.id)).toBe("base");
    expect((s.room.rules!.objects[dragon.id]?.empowered ?? 0) > 0).toBe(true);
    // Four looked-at cards were recycled: only the played card left the deck.
    expect(boardOf(s, "p1").deck.length).toBe(deck - 1);
    expect(boardOf(s, "p1").trash.some((card) => card.name === "Caitlyn, Patrolling")).toBe(false);
  });
});
