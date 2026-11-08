/**
 * Scoring 469–474, winning 193–196, modes 487–491, conceding 649–652.
 */
import { describe, expect, it } from "vitest";
import type { GameVariant } from "@rift/protocol";
import {
  checkVictory,
  concede,
  conquer,
  holdBattlefields,
  runCleanup,
  scoreBattlefield,
  snapshotScoringStep,
} from "../../../src";
import { scenario } from "../../scenarios/dsl";
import { boardOf, placeUnit, setControl, stepOf, table } from "./helpers";

function duel() {
  return scenario({ battlefields: { p2: "Bandle Tree" } });
}

describe("the Final Point [R473.1][R473.2]", () => {
  it("[R473.1.b][R473.1.b.1][R473.2.a][R383.4.d.2.c] one point short without every battlefield scored: draw instead, Conquer still triggers", () => {
    const s = duel();
    const victory = s.host.victoryScore(s.room);
    expect(victory).toBe(8);
    boardOf(s, "p1").score = victory - 1;
    placeUnit(s, "p1", "Clockwork Keeper", "battlefieldA");
    const hand = boardOf(s, "p1").hand.length;
    const step = stepOf(s);
    expect(conquer(s.room, "p1", "battlefieldA", step)).toBe(true);
    s.expectScore("p1", victory - 1);
    expect(boardOf(s, "p1").hand.length).toBe(hand + 1);
    expect(step.events.map((event) => event.type)).toEqual(
      expect.arrayContaining(["establish_control", "score_draw_instead", "conquer"]),
    );
    expect(s.room.rules?.scoredThisTurn.p1).toContain("battlefieldA");
  });

  it("[R473.1.b.1][R474][R194.2] having scored every battlefield this turn, the Conquer gains the Final Point and the player wins", () => {
    const s = duel();
    const victory = s.host.victoryScore(s.room);
    boardOf(s, "p1").score = victory - 1;
    s.host.markScored(s.room, "p1", "battlefieldB");
    placeUnit(s, "p1", "Clockwork Keeper", "battlefieldA");
    const step = stepOf(s);
    expect(conquer(s.room, "p1", "battlefieldA", step)).toBe(true);
    s.expectScore("p1", victory);
    runCleanup(s.room, step);
    expect(s.room.gameOutcome?.winnerPlayerIds).toEqual(["p1"]);
    expect(step.events.some((event) => event.type === "game_over")).toBe(true);
  });

  it("[R473.1.a.1][R471.2][R315.2.b] a Hold point is not restricted by the Final Point rule", () => {
    const s = duel();
    const victory = s.host.victoryScore(s.room);
    boardOf(s, "p1").score = victory - 1;
    placeUnit(s, "p1", "Clockwork Keeper", "battlefieldA");
    setControl(s.room, "battlefieldA", "p1");
    const step = stepOf(s);
    expect(holdBattlefields(s.room, "p1", step)).toBe(1);
    s.expectScore("p1", victory);
    expect(step.events.some((event) => event.type === "hold")).toBe(true);
  });

  it("[R315.2.b][R190.2] Hold uses battlefield control, not mere unit presence", () => {
    const s = duel();
    placeUnit(s, "p1", "Clockwork Keeper", "battlefieldA");
    setControl(s.room, "battlefieldA", null);
    expect(holdBattlefields(s.room, "p1", stepOf(s))).toBe(0);
    setControl(s.room, "battlefieldB", "p1");
    // 190.4.c: control without units only lasts until the next Open-state cleanup; Hold reads it.
    expect(holdBattlefields(s.room, "p1", stepOf(s))).toBe(1);
  });

  it("[R472] a battlefield is scored once per turn, from either method", () => {
    const s = duel();
    placeUnit(s, "p1", "Clockwork Keeper", "battlefieldA");
    setControl(s.room, "battlefieldA", "p1");
    expect(holdBattlefields(s.room, "p1", stepOf(s))).toBe(1);
    expect(scoreBattlefield(s.room, "p1", "battlefieldA", "conquer", stepOf(s))).toMatchObject({
      scored: false,
      blockedBy: "472",
    });
  });
});

describe("winning [R193–R196][R474]", () => {
  it("[R194.2.b] tied players at or above the Victory Score keep playing", () => {
    const s = duel();
    boardOf(s, "p1").score = 8;
    boardOf(s, "p2").score = 8;
    expect(checkVictory(s.room, stepOf(s))).toEqual([]);
    expect(s.room.gameOutcome).toBeUndefined();
  });

  it("[R194.2.a] with both at or above the Victory Score the higher score wins", () => {
    const s = duel();
    boardOf(s, "p1").score = 9;
    boardOf(s, "p2").score = 8;
    expect(checkVictory(s.room, stepOf(s))).toEqual(["p1"]);
  });

  it("[R487.3][R489.3][R490.3][R491.3][R194.3] Victory Score per Mode of Play", () => {
    const scores: Record<string, number> = {};
    for (const variant of ["free_for_all_3", "free_for_all_4", "teams_2v2"] as GameVariant[]) {
      const t = table(variant);
      scores[variant] = t.host.victoryScore(t.room);
    }
    expect(scores).toEqual({ free_for_all_3: 8, free_for_all_4: 8, teams_2v2: 11 });
    expect(duel().host.victoryScore(duel().room)).toBe(8);
    // 194.3.a: a battlefield may alter the Victory Score (Aspirant's Climb, +1).
    const climb = scenario({ battlefields: { p2: "Aspirant's Climb" } });
    expect(climb.host.victoryScore(climb.room)).toBe(9);
  });
});

describe("2v2 team scoring and victory [R491]", () => {
  // Implicit teams by seat parity: p1 + p3 vs p2 + p4.
  it("[R491.8.d][R491.8.d.1][R491.8.d.2] points are shared by a team", () => {
    const t = table("teams_2v2" as GameVariant);
    t.host.gainPoints(t.room, "p1", 2);
    expect(t.host.score(t.room, "p3")).toBe(2);
    expect(t.host.score(t.room, "p2")).toBe(0);
  });

  it("[R491.8.b] a battlefield can be scored only once per team per turn", () => {
    const t = table("teams_2v2" as GameVariant);
    t.host.markScored(t.room, "p3", "battlefieldB");
    t.place("p1", "Clockwork Keeper", "battlefieldB");
    expect(scoreBattlefield(t.room, "p1", "battlefieldB", "conquer", t.step())).toMatchObject({
      scored: false,
      blockedBy: "491.8.b",
    });
    // The other team is unaffected.
    t.room.players.find((player) => player.id === "p1")!.board!.battlefieldB = [];
    t.place("p2", "Clockwork Keeper", "battlefieldB");
    expect(scoreBattlefield(t.room, "p2", "battlefieldB", "conquer", t.step()).scored).toBe(true);
  });

  it("[EX:491.8.b.1][R471.1.a][R315.2.b.3] a battlefield the teammate controlled at the Scoring Step can't be conquered by the team", () => {
    const t = table("teams_2v2" as GameVariant);
    t.place("p3", "Clockwork Keeper", "battlefieldB", "ally");
    setControl(t.room, "battlefieldB", "p3");
    snapshotScoringStep(t.room, "p1", t.step());
    // p3 "retreats", p1 moves in and would conquer.
    t.room.players.find((player) => player.id === "p3")!.board!.battlefieldB = [];
    t.place("p1", "Clockwork Keeper", "battlefieldB", "mine");
    const step = t.step();
    expect(conquer(t.room, "p1", "battlefieldB", step)).toBe(false);
    expect(t.host.score(t.room, "p1")).toBe(0);
    expect(step.events.find((event) => event.type === "conquer_result")?.data).toMatchObject({ scored: false });
  });

  it("[R491.8.g.1][R491.6.a.3] the Final Point excepts battlefields the ally occupied at the Scoring Step; the team wins together", () => {
    const t = table("teams_2v2" as GameVariant);
    expect(t.host.victoryScore(t.room)).toBe(11);
    t.host.gainPoints(t.room, "p1", 10);
    const zones = t.host.battlefieldZones(t.room);
    expect(zones).toHaveLength(3);
    const [a, b, c] = zones as [string, string, string];
    t.place("p3", "Clockwork Keeper", c as never, "ally");
    snapshotScoringStep(t.room, "p1", t.step());
    t.host.markScored(t.room, "p1", b as never);
    t.place("p1", "Clockwork Keeper", a as never, "mine");
    const step = t.step();
    expect(conquer(t.room, "p1", a as never, step)).toBe(true);
    expect(t.host.score(t.room, "p1")).toBe(11);
    runCleanup(t.room, step);
    expect(t.room.gameOutcome?.winnerPlayerIds.slice().sort()).toEqual(["p1", "p3"]);
  });

  it("[R491.8.g.1][R473.1.b.1] without the ally exception the Final Point is replaced by a draw", () => {
    const t = table("teams_2v2" as GameVariant);
    t.host.gainPoints(t.room, "p1", 10);
    const [a, b] = t.host.battlefieldZones(t.room) as [string, string, string];
    snapshotScoringStep(t.room, "p1", t.step());
    t.host.markScored(t.room, "p1", b as never);
    t.place("p1", "Clockwork Keeper", a as never, "mine");
    const step = t.step();
    expect(conquer(t.room, "p1", a as never, step)).toBe(true);
    expect(t.host.score(t.room, "p1")).toBe(10);
    expect(step.events.some((event) => event.type === "score_draw_instead")).toBe(true);
  });
});

describe("conceding [R649–R652]", () => {
  it("[R650][R651.1][R196] in a duel the remaining player wins and the game ends", () => {
    const s = duel();
    const step = stepOf(s);
    expect(concede(s.room, "p2", step)).toEqual({ removed: ["p2"], winners: ["p1"] });
    expect(s.room.gameOutcome).toMatchObject({ winnerPlayerIds: ["p1"], reason: "concession" });
    expect(step.events.some((event) => event.type === "game_over")).toBe(true);
  });

  it("[R651.4][R491.6.a.1] in 2v2 the whole team loses; the other team wins", () => {
    const t = table("teams_2v2" as GameVariant);
    const result = concede(t.room, "p3", t.step());
    expect(result.removed.slice().sort()).toEqual(["p1", "p3"]);
    expect(t.room.gameOutcome?.winnerPlayerIds.slice().sort()).toEqual(["p2", "p4"]);
  });

  it("[R651.2][R651.3][R652.1] in FFA the game continues: the player's permanents (and those they own) are banished", () => {
    const t = table("free_for_all_3" as GameVariant);
    t.place("p2", "Clockwork Keeper", "base", "p2-base");
    t.place("p2", "Stellacorn Herder", "battlefieldB", "p2-field");
    const stolen = t.place("p1", "Clockwork Keeper", "battlefieldA", "p2-owned");
    stolen.ownerPlayerId = "p2";
    t.place("p1", "Stellacorn Herder", "base", "p1-own");
    setControl(t.room, "battlefieldB", "p2");
    const step = t.step();
    expect(concede(t.room, "p2", step)).toEqual({ removed: ["p2"], winners: [] });
    expect(t.room.gameOutcome).toBeUndefined();
    const banished = t.board("p2").banished.map((card) => card.id);
    expect(banished).toEqual(expect.arrayContaining(["p2-base", "p2-field", "p2-owned"]));
    expect(t.board("p1").base.some((card) => card.id === "p1-own")).toBe(true);
    expect(t.host.activePlayerIds(t.room)).toEqual(["p1", "p3"]);
    expect(t.room.rules?.objects.battlefieldB?.controller).toBe(null);
    expect(step.events.some((event) => event.type === "player_removed" && event.playerId === "p2")).toBe(true);
  });
});
