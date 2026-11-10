/**
 * Edge cases: Hide and the Facedown Zone occupancy (107.3.b / 811.1.b) — docs/rules/edge-cases-audit.md.
 */
import { describe, expect, it } from "vitest";
import type { BattlefieldZone } from "@rift/protocol";
import { effectiveMight, explainIllegal, legalIntents } from "../../src";
import { boardOf, drive, duel, placeUnit, setControl, toHand, type S } from "./helpers";

function hide(s: S, name: string, location: BattlefieldZone) {
  const card = s.handCard("p1", name) ?? (s.moveDeckCardToHand("p1", name), s.handCard("p1", name)!);
  return { card, intent: { type: "rules_play" as const, cardId: card.id, hide: true, location } };
}

describe("Facedown Zone occupancy [R107.3.b][R811.1.b]", () => {
  it("[R107.3.b][R107.3.b.1][C:Bandle Tree] \"You may hide an additional card here\": two facedown cards at Bandle Tree, still one elsewhere", () => {
    // duel(): battlefieldA is p1's Altar to Unity, battlefieldB is p2's Bandle Tree.
    const s = duel({ p1: ["Stand United", "Zhonya's Hourglass", "Sprite Call", "Smoke and Mirrors"] });
    placeUnit(s, "p1", "Stellacorn Herder", "battlefieldA", "a");
    placeUnit(s, "p1", "Clockwork Keeper", "battlefieldB", "b");
    setControl(s.room, "battlefieldA", "p1");
    setControl(s.room, "battlefieldB", "p1");
    s.room.rules!.pools.p1 = { energy: 0, power: { Calm: 6 } };

    const first = hide(s, "Stand United", "battlefieldB");
    s.as("p1").apply(first.intent).expectOk();
    const second = hide(s, "Zhonya's Hourglass", "battlefieldB");
    expect(legalIntents(s.room, "p1", s.host).hideable?.find((entry) => entry.cardId === second.card.id)?.locations).toEqual(
      expect.arrayContaining(["battlefieldA", "battlefieldB"]),
    );
    s.as("p1").apply(second.intent).expectOk();
    expect(boardOf(s, "p1").battlefieldB.filter((card) => card.hidden)).toHaveLength(2);

    // The increased occupancy is two: a third card is refused (apply = explain).
    const third = hide(s, "Sprite Call", "battlefieldB");
    expect(explainIllegal(s.room, "p1", third.intent, s.host)).toMatchObject({ code: "invalid_location", rule: "107.3.b" });
    s.as("p1").apply(third.intent).expectError("invalid_location");
    // Altar to Unity has no increase: one card, then full.
    s.as("p1").apply(hide(s, "Sprite Call", "battlefieldA").intent).expectOk();
    const fourth = hide(s, "Smoke and Mirrors", "battlefieldA");
    expect(explainIllegal(s.room, "p1", fourth.intent, s.host)).toMatchObject({ code: "invalid_location", rule: "107.3.b" });
  });

  it("[R107.3.c][R107.3.d][R323.6.a][C:Bandle Tree] both facedown cards are removed once their controller loses the battlefield", () => {
    const s = duel({ p1: ["Stand United", "Zhonya's Hourglass"] });
    const holder = placeUnit(s, "p1", "Clockwork Keeper", "battlefieldB", "b");
    setControl(s.room, "battlefieldB", "p1");
    s.room.rules!.pools.p1 = { energy: 0, power: { Calm: 2 } };
    s.as("p1").apply(hide(s, "Stand United", "battlefieldB").intent).expectOk();
    s.as("p1").apply(hide(s, "Zhonya's Hourglass", "battlefieldB").intent).expectOk();
    // The unit leaves: 323.5 removes control and 323.6.a trashes the facedown cards.
    s.host.setExhausted(s.room, holder.id, false);
    s.as("p1").move("Clockwork Keeper", "base").expectOk();
    expect(boardOf(s, "p1").battlefieldB.filter((card) => card.hidden)).toHaveLength(0);
    expect(boardOf(s, "p1").trash.map((card) => card.name)).toEqual(expect.arrayContaining(["Stand United", "Zhonya's Hourglass"]));
  });
});

describe("choices restricted to the hiding battlefield [R811.1.d]", () => {
  it("[R811.1.d.5][C:Sprite Call] a hidden spell that plays a unit plays it at the battlefield it was hidden at", () => {
    const s = duel({ p1: ["Sprite Call"] });
    placeUnit(s, "p1", "Caitlyn, Patrolling", "battlefieldA", "holder");
    setControl(s.room, "battlefieldA", "p1");
    const call = toHand(s, "p1", "Sprite Call");
    s.room.rules!.pools.p1 = { energy: 0, power: { any: 1 } };
    s.as("p1").apply({ type: "rules_play", cardId: call.id, hide: true, location: "battlefieldA" }).expectOk();
    s.as("p1").endTurn().expectOk();
    drive(s);
    s.as("p2").endTurn().expectOk();
    drive(s);
    // Next own turn: play it from face down (Reaction, ignoring its base cost).
    s.as("p1").apply({ type: "rules_play", cardId: call.id }).expectOk();
    drive(s);
    expect(boardOf(s, "p1").battlefieldA.some((card) => card.name === "Sprite")).toBe(true);
    expect(boardOf(s, "p1").base.some((card) => card.name === "Sprite")).toBe(false);
  });

  it("[R811.3][C:Sprite Call] played from hand for its cost, the same spell plays the unit to its normal location (base)", () => {
    const s = duel({ p1: ["Sprite Call"] });
    toHand(s, "p1", "Sprite Call");
    s.room.rules!.pools.p1 = { energy: 3, power: {} };
    s.as("p1").play("Sprite Call").expectOk();
    drive(s);
    expect(boardOf(s, "p1").base.some((card) => card.name === "Sprite")).toBe(true);
  });

  it("[R811.6][R417][C:Elnuk Herd] played from face down it gives +3 Might, then recycles itself", () => {
    const s = duel({ p1: ["Elnuk Herd"] });
    const friend = placeUnit(s, "p1", "Caitlyn, Patrolling", "battlefieldA", "friend");
    setControl(s.room, "battlefieldA", "p1");
    const herd = toHand(s, "p1", "Elnuk Herd");
    s.room.rules!.pools.p1 = { energy: 0, power: { any: 1 } };
    s.as("p1").apply({ type: "rules_play", cardId: herd.id, hide: true, location: "battlefieldA" }).expectOk();
    s.as("p1").endTurn().expectOk();
    drive(s);
    s.as("p2").endTurn().expectOk();
    drive(s);
    s.as("p1").apply({ type: "rules_play", cardId: herd.id }).expectOk();
    drive(s, { answer: (prompt) => (prompt.kind === "choose-target" ? [friend.id] : null) });
    expect(effectiveMight(s.room, friend.id, s.host)).toBe(6);
    expect(s.findBoardCardAnywhere("Elnuk Herd")).toBeFalsy();
    const deck = boardOf(s, "p1").deck;
    expect(deck[0]?.id).toBe(herd.id);
  });
});
