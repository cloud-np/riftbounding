/**
 * Wave R4 — Vendetta [Flow] spells freed by R3-engine's 829 implementation: they may be played
 * from the trash for their Flow cost and are banished instead of going to the trash.
 */
import { describe, expect, it } from "vitest";
import { getCardScript, legalIntents } from "../../../src";
import {
  addPool,
  boardOf,
  exhaustRunes,
  passBoth,
  place,
  settle,
  withCards,
  zoneOf,
} from "./helpers";

describe("Flow upgrades [R829]", () => {
  it("[C:Brittle Steel][R829.1.b][R829.1.c.1] play from trash for [4][Fury], then banish it", () => {
    const s = withCards(["Brittle Steel"], ["Rage Amplifier"]);
    const steel = place(s, "p1", "Brittle Steel", "trash");
    const gear = place(s, "p2", "Rage Amplifier", "base");
    exhaustRunes(s, "p1");
    addPool(s, "p1", 4, { Fury: 1 });
    s.as("p1")
      .apply({ type: "rules_play", cardId: steel.id, choices: { "target:0": gear.id } as never })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(zoneOf(s, gear.id)).toBe("trash");
    expect(zoneOf(s, steel.id)).toBe("banished");
  });

  it("[C:Dredge Up][R829.1.b] play from trash for [2], draw 1 and banish it", () => {
    const s = withCards(["Dredge Up"]);
    const dredge = place(s, "p1", "Dredge Up", "trash");
    exhaustRunes(s, "p1");
    addPool(s, "p1", 2);
    const hand = boardOf(s, "p1").hand.length;
    s.as("p1").apply({ type: "rules_play", cardId: dredge.id }).expectOk();
    s.as("p2").pass().expectOk();
    expect(boardOf(s, "p1").hand.length).toBe(hand + 1);
    expect(zoneOf(s, dredge.id)).toBe("banished");
  });

  it("[C:Onslaught][C:Lacerate][C:Shadow Dash][C:Death Mark][C:Lightning Rush][R829] the Flow scripts are implemented", () => {
    for (const name of [
      "Brittle Steel",
      "Dredge Up",
      "Onslaught",
      "Iterative Design",
      "Up from the Deep",
      "Twilight Shroud",
      "Twilight Step",
      "Perfect Execution",
      "Public Execution",
      "Shuriken Flip",
      "Death Mark",
      "Lightning Rush",
      "Lacerate",
      "Shadow Dash",
      "Kennen, Storm of Shuriken",
    ])
      expect(getCardScript(name)?.status, name).toBe("implemented");
  });

  it("[C:Dragon Form][R829] keeps its base-Might limitation but the Flow cost now works", () => {
    const s = withCards(["Dragon Form"]);
    const spell = place(s, "p1", "Dragon Form", "trash");
    const unit = place(s, "p1", "Treasure Hunter", "base");
    exhaustRunes(s, "p1");
    addPool(s, "p1", 3);
    s.as("p1")
      .apply({ type: "rules_play", cardId: spell.id, choices: { "target:0": unit.id } as never })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(zoneOf(s, spell.id)).toBe("banished");
    expect(getCardScript("Dragon Form")?.status).toBe("partial");
  });

  it("[C:Kennen, Storm of Shuriken][R829.2] conquer grants [Flow] to a spell in the trash", () => {
    const s = withCards(["Kennen, Storm of Shuriken", "Dredge Up"]);
    const dredge = place(s, "p1", "Dredge Up", "trash");
    place(s, "p1", "Kennen, Storm of Shuriken", "base");
    s.as("p1").move("Kennen, Storm of Shuriken", "battlefieldA").expectOk();
    settle(s);
    if (s.room.rules!.prompt) {
      const options = s.room.rules!.prompt.options ?? [];
      const wanted = options.find((option) => option.id === dredge.id);
      s.as(s.room.rules!.prompt.playerId)
        .choose({ optionIds: wanted ? [wanted.id] : options.slice(0, 1).map((option) => option.id) })
        .expectOk();
    }
    settle(s);
    exhaustRunes(s, "p1");
    addPool(s, "p1", 2);
    expect(legalIntents(s.room, "p1", s.host).playableCardIds).toContain(dredge.id);
  });
});
