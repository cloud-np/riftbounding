/**
 * Edge cases: fixture/preset-deck cards whose `partial` status was stale — docs/rules/edge-cases-audit.md
 * ("Most-played unfinished cards").
 */
import { describe, expect, it } from "vitest";
import { boardOf, controllerOf, placeUnit } from "../rules/combat/helpers";
import { scenario } from "../scenarios/dsl";
import { drive } from "./helpers";

describe("Accelerate on a preset-deck unit [R805]", () => {
  it("[R805.1.b][R805.6][R805.6.a][C:Reckless Innovator] paying [1][Chaos] makes it enter ready, without a \"becomes ready\" event", () => {
    const s = scenario({ p1: { hand: ["Reckless Innovator"] } });
    s.room.rules!.pools.p1 = { energy: 4, power: { Chaos: 1 } };
    s.as("p1").play("Reckless Innovator", { optionalCosts: ["accelerate"] }).expectOk();
    drive(s);
    const innovator = s.findBoardCard("Reckless Innovator")!;
    expect(innovator.exhausted).toBe(false);
    expect(s.events().some((event) => event.type === "ready" && event.cardId === innovator.id)).toBe(false);
    // Ready, it can move at once; exhausting it for the move triggers its "choose one".
    s.as("p1").move("Reckless Innovator", "battlefieldA").expectOk();
    s.expectPrompt("choose-mode", "p1");
  });

  it("[R805.2][C:Reckless Innovator] without the optional cost it enters exhausted", () => {
    const s = scenario({ p1: { hand: ["Reckless Innovator"] } });
    s.room.rules!.pools.p1 = { energy: 3, power: {} };
    s.as("p1").play("Reckless Innovator", { optionalCosts: [] }).expectOk();
    drive(s);
    expect(s.findBoardCard("Reckless Innovator")!.exhausted).toBe(true);
  });
});

describe("a Victory Score modifier [R194.3.a][R473.1.b]", () => {
  it("[R194.3.a][R194.2][C:Aspirant's Climb] with Aspirant's Climb in play the Victory Score is 9: a Conquer from 7 to 8 is a normal point and does not win", () => {
    // The scenario's default battlefields: p1 Altar to Unity (A), p2 Aspirant's Climb (B).
    const s = scenario();
    expect(s.host.victoryScore(s.room)).toBe(9);
    boardOf(s, "p1").score = 7;
    placeUnit(s, "p1", "Clockwork Keeper", "base", "conqueror");
    s.as("p1").move("Clockwork Keeper", "battlefieldA").expectOk();
    drive(s);
    expect(controllerOf(s.room, "battlefieldA")).toBe("p1");
    s.expectScore("p1", 8);
    expect(s.room.gameOutcome).toBeFalsy();
  });

  it("[R473.1.b][R473.1.b.1][C:Aspirant's Climb] at 8 of 9 the Final Point rule applies: a single Conquer draws instead", () => {
    const s = scenario();
    boardOf(s, "p1").score = 8;
    placeUnit(s, "p1", "Clockwork Keeper", "base", "conqueror");
    const hand = boardOf(s, "p1").hand.length;
    s.as("p1").move("Clockwork Keeper", "battlefieldA").expectOk();
    drive(s);
    expect(controllerOf(s.room, "battlefieldA")).toBe("p1");
    s.expectScore("p1", 8);
    expect(boardOf(s, "p1").hand.length).toBe(hand + 1);
    expect(s.room.gameOutcome).toBeFalsy();
  });
});
