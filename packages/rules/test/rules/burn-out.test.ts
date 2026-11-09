import { describe, expect, it } from "vitest";
import type { Room } from "@rift/protocol";
import {
  applyRulesIntent,
  drawCards,
  initializeStrictRules,
  processNextTask,
  PROMPT_REASONS,
  queueTask,
  type RulesContext,
  type RulesHost,
  type RulesStepContext,
} from "../../src";
import { createInitialGameState } from "../../../engine/src/index";
import { createEngineRulesHost } from "../../../engine/src/strict/host";
import { deterministicContext } from "../scenarios/dsl";

import { loadFixtureDecks } from "../fixtures/decks";

/**
 * The scenario DSL builds a duel only, so this test builds a real 3-player FFA room directly
 * from `createInitialGameState` + the real engine host. `p1` is the Turn Player at Main Phase.
 */
function threePlayerRoom(): { room: Room; ctx: RulesContext; host: RulesHost } {
  const decks = loadFixtureDecks();
  const ctx = deterministicContext(424242);
  const room = createInitialGameState({
    roomCode: "RULES-BURN-3P",
    createdAt: ctx.now,
    phase: "in_game",
    gameVariant: "free_for_all_3",
    roomMode: "multiplayer",
    shuffleDecks: false,
    players: ["p1", "p2", "p3"].map((id, index) => ({
      id,
      name: `Player ${index + 1}`,
      submittedDeck: {
        sections: index === 0 ? decks.deckA.sections : decks.deckB.sections,
        raw: index === 0 ? decks.deckA.raw : decks.deckB.raw,
      },
    })),
  });
  room.rulesMode = "strict";
  room.firstPlayerId = "p1";
  room.turnNumber = 1;
  room.activeTurnPlayerId = "p1";
  const host = createEngineRulesHost(ctx);
  const strict = initializeStrictRules(room, ctx, host);
  return { room: strict, ctx, host };
}

function boardOf(room: Room, playerId: string) {
  const board = room.players.find((player) => player.id === playerId)?.board;
  if (!board) throw new Error(`player ${playerId} has no board`);
  return board;
}

/** Empty p1's Main Deck and put `count` cards from it into the Trash (432.2.b recycle fuel). */
function primeEmptyDeck(room: Room, playerId: string, count: number): void {
  const board = boardOf(room, playerId);
  const cards = board.deck.splice(0, Math.min(count, board.deck.length));
  board.trash.push(...cards.map((card) => ({ ...card, exhausted: true })));
  board.deck = [];
}

function stepOf(room: Room, ctx: RulesContext, host: RulesHost): RulesStepContext {
  return { ctx, host, events: [] };
}

describe("Burn Out in 3+ player games [R432.2.c][R432.2.d][R432.3.c.1]", () => {
  it("[R432.2.c][R432.2.d] the choose-opponent prompt carries the remaining draws and completes them after the answer", () => {
    const { room, ctx, host } = threePlayerRoom();
    expect(room.rules?.turn.phase).toBe("main");
    primeEmptyDeck(room, "p1", 2);
    const handBefore = boardOf(room, "p1").hand.length;

    const step = stepOf(room, ctx, host);
    const draw = drawCards(room, "p1", 2, step);
    expect(draw.awaitingPrompt).toBe(true);

    const prompt = room.rules!.prompt!;
    expect(prompt.data?.reason).toBe(PROMPT_REASONS.burnOut);
    // 432.2.d: the rest of the draw is part of the prompt/task data, not a fresh `draw 1`.
    expect(prompt.data?.remainingDraws).toBe(2);
    expect(prompt.options?.map((option) => option.id).sort()).toEqual(["p2", "p3"]);

    const result = applyRulesIntent(
      room,
      "p1",
      { type: "rules_choose", promptId: prompt.id, answer: { playerId: "p2" } },
      ctx,
      host,
    );
    expect(result.ok, result.ok ? "" : `${result.code} (${result.rule})`).toBe(true);
    if (!result.ok) return;
    const next = result.room;

    expect(next.rules?.prompt).toBe(null);
    // 432.2.c: p2 (the chosen opponent) gained the point.
    expect(host.score(next, "p2")).toBe(1);
    // 432.2.d: both remaining cards were drawn from the recycled deck.
    expect(boardOf(next, "p1").hand.length).toBe(handBefore + 2);
    expect(result.events.some((event) => event.type === "draw" && event.amount === 2)).toBe(true);
  });

  it("[R315.4.b][R432.2.d] the Draw Phase resumes exactly the remaining draws after the answer", () => {
    const { room, ctx, host } = threePlayerRoom();
    // p2 (not the FFA first player) so 489.7's first-draw skip does not apply.
    primeEmptyDeck(room, "p2", 2);
    const handBefore = boardOf(room, "p2").hand.length;
    const step = stepOf(room, ctx, host);

    // 315.4.b: the Draw Phase task pauses on the Burn Out prompt...
    queueTask(room, { kind: "draw", playerId: "p2" }, step);
    expect(processNextTask(room, step)).toBe("await");
    // ...without queueing a fresh `draw 1` (the remainder lives on the prompt and resumes later).
    expect(room.rules?.tasks).toEqual([]);
    const prompt = room.rules!.prompt!;
    expect(prompt.data?.remainingDraws).toBe(1);
    expect(prompt.data?.resumeViaTask).toBe(true);

    const result = applyRulesIntent(
      room,
      "p2",
      { type: "rules_choose", promptId: prompt.id, answer: { playerId: "p3" } },
      ctx,
      host,
    );
    expect(result.ok, result.ok ? "" : `${result.code} (${result.rule})`).toBe(true);
    if (!result.ok) return;

    // Exactly one card (the original draw) was drawn; the Draw Phase then advanced to Main and
    // emptied pools. A stale `draw 1` requeue would have produced two.
    expect(boardOf(result.room, "p2").hand.length).toBe(handBefore + 1);
    expect(result.room.rules?.turn.phase).toBe("main");
    expect(host.score(result.room, "p3")).toBe(1);
  });

  it("[R432.3.c][R432.3.c.1] a Burn Out point that reaches the Victory Score wins immediately, before any cleanup", () => {
    const { room, ctx, host } = threePlayerRoom();
    primeEmptyDeck(room, "p1", 2);
    // 432.3.c: the point must also give a strict lead; p2 has 7, p1/p3 have 0.
    boardOf(room, "p2").score = 7;

    const step = stepOf(room, ctx, host);
    expect(drawCards(room, "p1", 2, step).awaitingPrompt).toBe(true);
    expect(room.gameOutcome).toBeUndefined();

    const prompt = room.rules!.prompt!;
    const result = applyRulesIntent(
      room,
      "p1",
      { type: "rules_choose", promptId: prompt.id, answer: { playerId: "p2" } },
      ctx,
      host,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // 432.3.c.1: the win was settled inside the prompt answer; no cleanup ran in between.
    expect(result.room.gameOutcome?.winnerPlayerIds).toEqual(["p2"]);
    expect(result.events.some((event) => event.type === "game_over")).toBe(true);
    expect(host.score(result.room, "p2")).toBe(8);
  });
});
