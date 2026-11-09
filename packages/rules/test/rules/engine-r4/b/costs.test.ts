/**
 * Lane B R4 proof tests — costs: 356.4.f.1 "paid the optional additional cost" and 809 Deflect.
 */
import { describe, expect, it } from "vitest";
import { effectiveKeywordValues, getCardScript } from "../../../../src";
import { boardOf, fund, place } from "../../effects/helpers";
import { addPool, exhaustRunes, settle, withCards } from "../../../cards/ven-ogs/helpers";
import { registerTestCardScript } from "../../../../src/testing";

describe("paid optional additional cost [R356.4.f.1][R355.1.a]", () => {
  it("[R356.4.f.1][R355.1.a][C:Clockwork Keeper] paying with runes is not paying the optional additional cost", () => {
    const s = withCards(["Clockwork Keeper"]);
    const before = boardOf(s, "p1").hand.length;
    // Two ready runes pay [2]; the optional [Calm] is declined (no optionalCosts).
    s.as("p1").play("Clockwork Keeper").expectOk();
    settle(s);
    expect(boardOf(s, "p1").hand).toHaveLength(before - 1);
  });

  it("[R356.4.f.1][R355.1.a][C:Clockwork Keeper] choosing the optional additional cost counts, even if a discount pays it", () => {
    const s = withCards(["Clockwork Keeper"]);
    const card = s.handCard("p1", "Clockwork Keeper")!;
    fund(s, "p1", "Clockwork Keeper");
    addPool(s, "p1", 0, { Calm: 1 });
    const before = boardOf(s, "p1").hand.length;
    s.as("p1")
      .apply({ type: "rules_play", cardId: card.id, optionalCosts: ["optional:0"] } as never)
      .expectOk();
    settle(s);
    // The unit leaves the hand (-1) and the paid optional cost draws 1 (356.4.f.1).
    expect(boardOf(s, "p1").hand).toHaveLength(before);
  });
});

describe("Deflect [R809]", () => {
  it("[R809.1.c][R809.2][C:Nasus, Ascended] a [Deflect 2] target costs [Rune][Rune] more", () => {
    const s = withCards(["Hextech Ray"], ["Nasus, Ascended"]);
    const nasus = place(s, "p2", "Nasus, Ascended", "battlefieldA");
    exhaustRunes(s, "p1");
    // An exhausted Basic Rune can still be recycled for Power (164.2.b: no Exhaust in the cost),
    // so remove the Rune Area to make the two extra Power decisive.
    boardOf(s, "p1").runeArea = [];
    fund(s, "p1", "Hextech Ray");
    addPool(s, "p1", 0, { any: 1 });
    expect(effectiveKeywordValues(s.room, nasus.id, s.host).deflect).toBe(2);
    s.as("p1")
      .play("Hextech Ray", { choices: { "target:0": nasus.id } })
      .expectError("insufficient_resources");
  });

  it("[R809.1.c][R809.2][C:Nasus, Ascended] a Deflect target chosen after the prompt is priced and can undo the play", () => {
    const s = withCards(["Hextech Ray"], ["Nasus, Ascended", "Treasure Hunter"]);
    const nasus = place(s, "p2", "Nasus, Ascended", "battlefieldA");
    place(s, "p2", "Treasure Hunter", "battlefieldB");
    exhaustRunes(s, "p1");
    boardOf(s, "p1").runeArea = [];
    fund(s, "p1", "Hextech Ray");
    addPool(s, "p1", 0, { any: 1 });
    const before = boardOf(s, "p1").hand.map((card) => card.id);
    s.as("p1").play("Hextech Ray").expectOk();
    expect(s.room.rules?.prompt?.kind).toBe("choose-target");
    // 358.5: the [Rune][Rune] surcharge makes the play unaffordable, so it is undone.
    s.as("p1").choose({ optionIds: [nasus.id] }).expectOk();
    expect(s.events().map((event) => event.type)).toContain("play_cancelled");
    expect(boardOf(s, "p1").hand.map((card) => card.id)).toEqual(before);
    expect(s.room.rules?.chain).toEqual([]);
  });

  it("[R809.1.c][R809.2] Deflect granted by a passive is charged at its value (not a bare 1)", () => {
    const original = getCardScript("Treasure Hunter")!;
    registerTestCardScript({
      ...original,
      abilities: [
        {
          kind: "passive",
          modifier: { kind: "keyword", keyword: "Deflect", value: 2, target: { targetRef: "self" } },
        },
      ],
    });
    try {
      const s = withCards(["Hextech Ray"]);
      const warded = place(s, "p2", "Treasure Hunter", "battlefieldA");
      expect(effectiveKeywordValues(s.room, warded.id, s.host).deflect).toBe(2);
      fund(s, "p1", "Hextech Ray");
      addPool(s, "p1", 0, { any: 3 });
      s.as("p1")
        .play("Hextech Ray", { choices: { "target:0": warded.id } })
        .expectOk();
      settle(s);
      // Base [1][Fury] plus Deflect [A][A]: 1 Energy and 1 Fury + 2 any consumed.
      expect(s.room.rules?.pools.p1).toEqual({ energy: 0, power: { any: 1 } });
    } finally {
      registerTestCardScript(original);
    }
  });
});
