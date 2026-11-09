/**
 * Edge cases: showdown Focus order, Conquer scoring and the Final Point in live flows —
 * docs/rules/edge-cases-audit.md.
 */
import { describe, expect, it } from "vitest";
import { table } from "../rules/combat/helpers";
import { controllerOf, passUntilSettled } from "../rules/combat/helpers";
import { boardOf, drive, duel, placeUnit, setControl } from "./helpers";

describe("showdown Focus in a 3-player game [R345][R347][R348]", () => {
  it("[R345][R347.2.b][R347.2.a][R348.2.a.1] Focus goes around in Turn Order from the Contested applier; all passing once ends it and the mover conquers", () => {
    const t = table("free_for_all_3");
    const mover = t.place("p1", "Treasure Hunter", "base", "mover");
    mover.exhausted = false;
    expect(t.apply("p1", { type: "rules_move", unitIds: [mover.id], to: "battlefieldB" }).ok).toBe(true);
    // Treasure Hunter's move trigger resolves first (every player passes Priority once).
    for (const player of ["p1", "p2", "p3"]) expect(t.apply(player, { type: "rules_pass" }).ok).toBe(true);
    expect(t.room.rules!.showdown).toMatchObject({ battlefield: "battlefieldB", kind: "non_combat", startedBy: "p1" });
    const focusOrder: string[] = [];
    let events: string[] = [];
    for (let index = 0; index < 4 && t.room.rules!.showdown; index += 1) {
      const holder = t.room.rules!.focus!;
      focusOrder.push(holder);
      const result = t.apply(holder, { type: "rules_pass" });
      expect(result.ok).toBe(true);
      events = result.events.map((event) => event.type);
    }
    expect(focusOrder).toEqual(["p1", "p2", "p3"]);
    expect(events).toEqual(expect.arrayContaining(["showdown_end", "establish_control", "score", "conquer"]));
    expect(t.room.rules!.objects.battlefieldB?.controller).toBe("p1");
  });
});

describe("Conquer and the Final Point in a live turn [R471.1][R472][R473.1.b.1]", () => {
  it("[R473.1.b.1] one point short: the first Conquer draws instead; conquering the second battlefield the same turn gains the Final Point and wins", () => {
    const s = duel();
    boardOf(s, "p1").score = 7;
    const first = placeUnit(s, "p1", "Clockwork Keeper", "base", "first");
    const second = placeUnit(s, "p1", "Stellacorn Herder", "base", "second");
    const hand = boardOf(s, "p1").hand.length;
    s.as("p1").move("Clockwork Keeper", "battlefieldA").expectOk();
    drive(s);
    expect(controllerOf(s.room, "battlefieldA")).toBe("p1");
    s.expectScore("p1", 7);
    expect(boardOf(s, "p1").hand.length).toBe(hand + 1);
    expect(s.room.gameOutcome).toBeFalsy();
    s.as("p1").move("Stellacorn Herder", "battlefieldB").expectOk();
    drive(s);
    s.expectScore("p1", 8);
    expect(s.room.gameOutcome?.winnerPlayerIds).toEqual(["p1"]);
    void first;
    void second;
  });

  it("[R472][R323.5] leaving a held battlefield and coming back the same turn re-establishes control but scores nothing", () => {
    const s = duel();
    const unit = placeUnit(s, "p1", "Clockwork Keeper", "battlefieldA", "keeper");
    setControl(s.room, "battlefieldA", "p1");
    s.host.markScored(s.room, "p1", "battlefieldA"); // held at this turn's Scoring Step
    s.as("p1").move("Clockwork Keeper", "base").expectOk();
    expect(controllerOf(s.room, "battlefieldA")).toBe(null);
    s.host.setExhausted(s.room, unit.id, false);
    s.as("p1").move("Clockwork Keeper", "battlefieldA").expectOk();
    drive(s);
    expect(controllerOf(s.room, "battlefieldA")).toBe("p1");
    s.expectScore("p1", 0);
  });
});

describe("recalls and tokens [R458.1][R186.1]", () => {
  it("[R468.1.a.2][R458.1][C:Treasure Hunter] an Attacker recalled by the Combat Cleanup does not trigger \"When I move\"", () => {
    const s = duel();
    placeUnit(s, "p2", "Stellacorn Herder", "battlefieldA", "def");
    setControl(s.room, "battlefieldA", "p2");
    s.room.rules!.objects.def = { stunned: true };
    placeUnit(s, "p1", "Treasure Hunter", "base", "atk");
    s.as("p1").move("Treasure Hunter", "battlefieldA").expectOk();
    const events = passUntilSettled(s);
    expect(events.some((event) => event.type === "recall" && event.cardId === "atk")).toBe(true);
    // Exactly one Gold: from the Standard Move, none from the recall.
    expect(boardOf(s, "p1").base.filter((card) => card.name === "Gold")).toHaveLength(1);
    expect(boardOf(s, "p1").base.some((card) => card.id === "atk")).toBe(true);
  });

  it("[R186.1][C:Rebuke] a unit token returned to its owner's hand ceases to exist", () => {
    const s = duel();
    placeUnit(s, "p1", "Clockwork Keeper", "battlefieldA", "holder");
    setControl(s.room, "battlefieldA", "p1");
    s.as("p1").endTurn().expectOk();
    drive(s);
    s.as("p2").endTurn().expectOk();
    drive(s);
    const token = boardOf(s, "p1").base.find((card) => card.name === "Recruit")!;
    expect(token).toBeTruthy();
    s.host.moveCard(s.room, "p1", "base", "battlefieldA", token.id);
    s.moveDeckCardToHand("p1", "Rebuke");
    s.room.rules!.pools.p1 = { energy: 2, power: { Chaos: 2 } };
    s.as("p1").play("Rebuke", { choices: { "target:0": [token.id] } }).expectOk();
    drive(s);
    expect(s.host.findCard(s.room, token.id)).toBeFalsy();
    expect(boardOf(s, "p1").hand.some((card) => card.id === token.id)).toBe(false);
  });
});
