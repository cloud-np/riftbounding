/**
 * Battlefields and control helpers — 170.11, 190.6, 194.4, 195, 464.1 / 464.2.
 */
import { describe, expect, it } from "vitest";
import type { GameVariant } from "@rift/protocol";
import {
  battlefieldAbilityController,
  battlefieldStates,
  combatBarsDestination,
  losePoints,
  playerLoses,
  playerWins,
  runCleanup,
} from "../../../src";
import { scenario } from "../../scenarios/dsl";
import { boardOf, placeUnit, setControl, stepOf, table } from "./helpers";

describe("battlefield states and ability control [R170.11][R190.6]", () => {
  it("[R170.11.a][R170.11.b][R170.11.c] occupied / uncontrolled / open", () => {
    const s = scenario();
    setControl(s.room, "battlefieldA", null);
    expect(battlefieldStates(s.room, "battlefieldA", s.host)).toMatchObject({ occupied: false, uncontrolled: true, open: true });
    placeUnit(s, "p1", "Clockwork Keeper", "battlefieldA");
    expect(battlefieldStates(s.room, "battlefieldA", s.host)).toMatchObject({ occupied: true, uncontrolled: true, open: false });
    setControl(s.room, "battlefieldB", "p2");
    expect(battlefieldStates(s.room, "battlefieldB", s.host)).toMatchObject({
      occupied: false,
      uncontrolled: false,
      open: false,
      controller: "p2",
    });
  });

  it("[R190.6.a][EX:190.6.b] a battlefield's abilities belong to its controller, or the Turn Player while Uncontrolled", () => {
    const s = scenario();
    setControl(s.room, "battlefieldA", null);
    expect(battlefieldAbilityController(s.room, "battlefieldA", s.host)).toBe("p1");
    setControl(s.room, "battlefieldA", "p2");
    expect(battlefieldAbilityController(s.room, "battlefieldA", s.host)).toBe("p2");
  });
});

describe("points and winning by effect [R194.4][R195]", () => {
  it("[R194.4][R194.4.a][R194.4.b] points never drop below 0; losing at 0 does nothing", () => {
    const s = scenario({ battlefields: { p2: "Bandle Tree" } });
    boardOf(s, "p1").score = 2;
    const step = stepOf(s);
    expect(losePoints(s.room, "p1", 5, step)).toBe(2);
    s.expectScore("p1", 0);
    const quiet = stepOf(s);
    expect(losePoints(s.room, "p1", 1, quiet)).toBe(0);
    expect(quiet.events.some((event) => event.type === "lose_points")).toBe(false);
  });

  it("[R195][R195.1] an effect can make a player lose (removed) or win the game", () => {
    const s = scenario();
    const step = stepOf(s);
    expect(playerLoses(s.room, "p1", step).winners).toEqual(["p2"]);
    expect(s.room.gameOutcome?.winnerPlayerIds).toEqual(["p2"]);
    const t = table("teams_2v2" as GameVariant);
    expect(playerWins(t.room, "p2", t.step()).slice().sort()).toEqual(["p2", "p4"]);
  });
});

describe("FFA invalid destinations [R464.1][R464.2]", () => {
  it("[R464.1][R464.2] a third player can't move or play to a battlefield with a Combat in progress", () => {
    const t = table("free_for_all_3" as GameVariant);
    t.place("p1", "Clockwork Keeper", "battlefieldA", "a");
    t.place("p2", "Clockwork Keeper", "battlefieldA", "b");
    setControl(t.room, "battlefieldA", "p2");
    t.room.rules!.contested.battlefieldA = "p1";
    runCleanup(t.room, t.step());
    expect(t.room.rules?.combat).toMatchObject({ attacker: "p1", defender: "p2" });
    expect(combatBarsDestination(t.room, "p3", "battlefieldA", "move", t.host)).toBe(true);
    expect(combatBarsDestination(t.room, "p3", "battlefieldA", "play", t.host)).toBe(true);
    expect(combatBarsDestination(t.room, "p2", "battlefieldA", "move", t.host)).toBe(false);
    expect(combatBarsDestination(t.room, "p3", "battlefieldB", "move", t.host)).toBe(false);
  });

  it("[R464] the restriction only exists with more than two players", () => {
    const s = scenario();
    placeUnit(s, "p1", "Clockwork Keeper", "battlefieldA");
    placeUnit(s, "p2", "Clockwork Keeper", "battlefieldA");
    s.room.rules!.staged.combats = ["battlefieldA"];
    expect(combatBarsDestination(s.room, "p1", "battlefieldA", "move", s.host)).toBe(false);
  });
});
