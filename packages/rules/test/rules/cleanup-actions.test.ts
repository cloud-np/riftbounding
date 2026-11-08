import { describe, expect, it } from "vitest";
import {
  conquer,
  dealDamage,
  kill,
  runCleanup,
  scoreBattlefield,
  type RulesStepContext,
} from "../../src";
import { scenario } from "../scenarios/dsl";

function step(s: ReturnType<typeof scenario>): RulesStepContext {
  return { ctx: s.ctx, host: s.host, events: [] };
}

function readyUnit(s: ReturnType<typeof scenario>, name: string): void {
  const unit = s.findBoardCard(name);
  if (!unit) throw new Error(`unit ${name} not on board`);
  unit.exhausted = false;
}

describe("cleanups and primitive actions [R318–R324][R412–R448]", () => {
  it("[R418][R323.4] lethal damage is killed by the cleanup", () => {
    const s = scenario({ p1: { hand: ["Treasure Hunter"], energy: 2 } });
    s.as("p1").play("Treasure Hunter").expectOk();
    const unit = s.findBoardCard("Treasure Hunter")!;
    const ctx = step(s);
    dealDamage(s.room, unit.id, 1, ctx);
    expect(s.room.rules?.objects[unit.id]?.damage).toBe(1);
    runCleanup(s.room, ctx);
    expect(s.room.rules?.objects[unit.id]).toBeUndefined();
    const board = s.room.players[0]?.board;
    expect(board?.trash.some((card) => card.id === unit.id)).toBe(true);
  });

  it("[R317.2.b][R419] the Expiration Step heals non-lethal damage after 3a", () => {
    const s = scenario({ p1: { hand: ["Stellacorn Herder"], energy: 4 } });
    s.as("p1").play("Stellacorn Herder").expectOk();
    const unit = s.findBoardCard("Stellacorn Herder")!;
    dealDamage(s.room, unit.id, 1, step(s));
    expect(s.room.rules?.objects[unit.id]?.damage).toBe(1);
    s.as("p1").endTurn().expectOk();
    s.as("p2").endTurn().expectOk();
    expect(s.room.rules?.objects[unit.id]?.damage).toBeUndefined();
  });

  it("[R432.2] an empty Main Deck burns out: recycle trash, opponent gains 1, then draw", () => {
    const s = scenario({ p1: { hand: ["Treasure Hunter"], energy: 2 } });
    s.as("p1").play("Treasure Hunter").expectOk();
    const unit = s.findBoardCard("Treasure Hunter")!;
    const ctx = step(s);
    kill(s.room, unit.id, ctx);
    s.room.players[0]!.board!.deck = [];

    s.as("p1").endTurn().expectOk();
    s.as("p2").endTurn().expectOk();

    expect(s.room.players[1]?.board?.score).toBe(1);
    expect(s.handCard("p1", "Treasure Hunter")).toBeTruthy();
  });

  it("[R472] a battlefield can only be scored once per turn, from either method", () => {
    const s = scenario({ p1: { hand: ["Treasure Hunter"], energy: 2 } });
    s.as("p1").play("Treasure Hunter").expectOk();
    readyUnit(s, "Treasure Hunter");
    s.as("p1").move("Treasure Hunter", "battlefieldA").expectOk();
    s.as("p1").pass().expectOk();
    s.as("p2").pass().expectOk();
    expect(s.room.players[0]?.board?.score).toBe(1);

    const again = scoreBattlefield(s.room, "p1", "battlefieldA", "conquer", step(s));
    expect(again.scored).toBe(false);
    expect(conquer(s.room, "p1", "battlefieldA", step(s))).toBe(false);
    expect(s.room.players[0]?.board?.score).toBe(1);
  });

  it("[R315.2][R471.2] Hold scores at the beginning of the next turn", () => {
    const s = scenario({ p1: { hand: ["Treasure Hunter"], energy: 2 } });
    s.as("p1").play("Treasure Hunter").expectOk();
    readyUnit(s, "Treasure Hunter");
    s.as("p1").move("Treasure Hunter", "battlefieldA").expectOk();
    s.as("p1").pass().expectOk();
    s.as("p2").pass().expectOk();
    expect(s.room.players[0]?.board?.score).toBe(1);

    s.as("p1").endTurn().expectOk();
    s.as("p2").endTurn().expectOk();
    expect(s.room.players[0]?.board?.score).toBe(2);
    expect(s.room.rules?.scoredThisTurn.p1).toContain("battlefieldA");
  });

  it("[R144.2][R449] a standard move exhausts the Unit and applies Contested", () => {
    const s = scenario({ p1: { hand: ["Treasure Hunter"], energy: 2 } });
    s.as("p1").play("Treasure Hunter").expectOk();
    readyUnit(s, "Treasure Hunter");
    s.as("p1").move("Treasure Hunter", "battlefieldA").expectOk();
    const unit = s.findBoardCard("Treasure Hunter")!;
    expect(unit.exhausted).toBe(true);
    expect(s.room.rules?.contested.battlefieldA).toBe("p1");
  });

  it("[R473.1.b.1][R432] the final-point replacement draw Burns Out instead of drawing nothing", () => {
    const s = scenario({ p1: { hand: ["Treasure Hunter"], energy: 2 } });
    s.as("p1").play("Treasure Hunter").expectOk();
    const board = s.room.players[0]!.board!;
    // One recyclable card in the trash and an empty Main Deck: the replacement draw must Burn
    // Out (432.2) and then complete the draw rather than silently skipping it.
    const recyclable = board.deck.pop()!;
    expect(recyclable).toBeTruthy();
    board.trash.push(recyclable);
    board.deck = [];
    board.score = s.host.victoryScore(s.room) - 1;

    const ctx = step(s);
    const result = scoreBattlefield(s.room, "p1", "battlefieldA", "conquer", ctx);

    expect(result.scored).toBe(true);
    expect(result.points).toBe(0);
    expect(result.drew).toBe(true);
    expect(board.hand.some((card) => card.id === recyclable.id)).toBe(true);
    // 432.2.c: the chosen opponent gains the Burn Out point.
    expect(s.room.players[1]?.board?.score).toBe(1);
    expect(ctx.events.some((event) => event.type === "burn_out")).toBe(true);
    expect(ctx.events.some((event) => event.type === "score_draw_instead")).toBe(true);
  });
});
