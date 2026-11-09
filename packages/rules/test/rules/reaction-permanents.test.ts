import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CardScript } from "@rift/protocol";
import { clearCardScripts, registerCardScripts, turnState } from "../../src";
import { scenario } from "../scenarios/dsl";
import { registerCardScript } from "../../src";

// R2-effects: Treasure Hunter's printed "When I move, play a Gold gear token exhausted" now
// triggers (383 / 402.1) and keeps the state Closed until it resolves. This suite uses it as a
// vanilla unit for timing/showdown mechanics, so it overrides the production script (the trigger
// itself is covered by test/cards/fixture-deck.test.ts).
beforeAll(() => registerCardScript({ name: "Treasure Hunter", text: "vanilla (test)", status: "implemented", abilities: [] }));
// R4-cards: Janna, Savior is now scripted (play trigger: heal + move). This suite uses her as a
// vanilla Reaction unit for timing/showdown mechanics, so override the production script too.
beforeAll(() => registerCardScript({ name: "Janna, Savior", text: "vanilla (test)", status: "implemented", abilities: [] }));

// 813.1.c.1: Janna, Savior has card-level [Reaction]. (Reckless Innovator, used before, only
// mentions [Reaction] in its Gold token's reminder text, 135.2.d.3, so it is not a Reaction unit.)
const REACTION_UNIT = "Janna, Savior";

function noop(name: string, text: string): CardScript {
  return {
    name,
    text,
    status: "implemented",
    abilities: [{ kind: "spell", effect: { op: "seq", effects: [] } }],
  };
}

beforeAll(() => {
  registerCardScripts([
    noop("Rebuke", "[ACTION] test no-op"),
    noop("Defy", "[REACTION] test no-op"),
  ]);
});
afterAll(() => clearCardScripts());

describe("permanents that resolve immediately [R337.2][R340.2.a][R340.4][R346]", () => {
  it("[R337.2][R340.4] a Reaction Unit resolving into an existing chain returns Priority to the newest remaining item's controller", () => {
    const s = scenario({
      p1: { hand: ["Rebuke"], energy: 2, power: { Chaos: 2 } },
      p2: { energy: 3, power: { Calm: 1 } },
      extraCards: { p2: [REACTION_UNIT] },
    });
    if (!s.handCard("p2", REACTION_UNIT)) s.moveDeckCardToHand("p2", REACTION_UNIT);

    s.as("p1").play("Rebuke").expectOk();
    expect(s.room.rules?.priority).toBe("p2");

    // 337.2: the Unit resolves immediately, but the chain still holds Rebuke.
    s.as("p2").play(REACTION_UNIT).expectOk();
    expect(s.room.rules?.chain.map((item) => item.cardName)).toEqual(["Rebuke"]);
    // 340.4: the controller of the newest remaining item gains Priority — not P2, who no longer
    // holds it, and no second auto-pass may fire on P2's behalf.
    expect(s.room.rules?.priority).toBe("p1");
    expect(s.room.rules?.passes).toEqual([]);
    expect(turnState(s.room)).toBe("neutral_closed");
    expect(s.room.rules?.manual).toBe(null);
    const who = s.expectLegal("p1");
    expect(who.canPass).toBe(true);
  });

  it("[R340.2.a][R346] a Reaction Unit in a non-combat Showdown passes Focus to the next player", () => {
    const s = scenario({
      p1: { hand: ["Treasure Hunter"], energy: 2 },
      p2: { energy: 3, power: { Calm: 1 } },
      extraCards: { p2: [REACTION_UNIT] },
    });
    if (!s.handCard("p2", REACTION_UNIT)) s.moveDeckCardToHand("p2", REACTION_UNIT);

    s.as("p1").play("Treasure Hunter").expectOk();
    s.room.players[0]!.board!.base.find((card) => card.name === "Treasure Hunter")!.exhausted =
      false;
    s.as("p1").move("Treasure Hunter", "battlefieldA").expectOk();
    expect(s.room.rules?.showdown?.kind).toBe("non_combat");
    s.expectFocus("p1").expectPriority("p1");

    // 347.2: P1 passes Focus; P2 may now respond.
    s.as("p1").pass().expectOk();
    s.expectFocus("p2").expectPriority("p2");

    // 337.2: the Reaction Unit resolves immediately. 340.2.a/346: because this Showdown's chain
    // was initiated by a played card, Focus passes from P2 to P1 and P1 gains Priority.
    s.as("p2").play(REACTION_UNIT).expectOk();
    expect(s.room.rules?.chain.length).toBe(0);
    expect(s.room.rules?.showdown?.kind).toBe("non_combat");
    s.expectFocus("p1").expectPriority("p1").expectState("showdown_open");
  });
});
