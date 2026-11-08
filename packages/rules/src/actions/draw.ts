/**
 * Draw and Burn Out — rules 414, 432.
 *
 * Kept in its own module (rather than `primitives.ts`) so `scoring/score.ts` can invoke the
 * draw primitive for 473.1.b.1 without creating an import cycle
 * (`actions/primitives.ts` → `scoring/score.ts`).
 */
import type { Room } from "@rift/protocol";
import type { RulesStepContext } from "../types";
import { pushEvent } from "../types";
import { PROMPT_REASONS } from "../prompts/reasons";
import { interceptAction } from "../timing/hooks";

export interface DrawResult {
  drawn: string[];
  awaitingPrompt: boolean;
}

export interface DrawOptions {
  /**
   * True when the caller is the Draw Phase task: on a Burn Out prompt the remainder is carried by
   * the prompt and then resumed as a queued `draw` task (so the Draw Phase does not run twice).
   * Effect/score draws complete the remainder synchronously in the prompt handler.
   */
  resumeViaTask?: boolean;
}

/**
 * 414.4 / 432.1: draw as much as possible, Burn Out, then draw the remainder. The loop is
 * bounded per 432.3 (an empty deck + empty trash would otherwise burn out until the game ends).
 */
export function drawCards(
  room: Room,
  playerId: string,
  count: number,
  step: RulesStepContext,
  options: DrawOptions = {},
): DrawResult {
  const drawn: string[] = [];
  const proposal = interceptAction(room, step, {
    type: "draw",
    playerId,
    amount: Math.max(0, Math.trunc(count)),
    ...(options.resumeViaTask ? { data: { resumeViaTask: true } } : {}),
  });
  if (!proposal) return { drawn, awaitingPrompt: false };
  let remaining = Math.max(0, Math.trunc(proposal.amount ?? count));
  for (let guard = 0; guard < 100 && remaining > 0; guard += 1) {
    const outcome = step.host.draw(room, playerId, remaining);
    drawn.push(...outcome.drawn);
    remaining = outcome.shortfall;
    if (remaining === 0) break;
    const burn = burnOut(room, playerId, step, remaining, options);
    if (burn.awaitingPrompt) {
      if (drawn.length > 0) {
        pushEvent(step.events, { type: "draw", playerId, amount: drawn.length, data: { cardIds: drawn } });
      }
      return { drawn, awaitingPrompt: true };
    }
    // A replacement effect prevented the Burn Out (367–375): stop instead of retrying forever.
    if (burn.prevented) break;
    if (burn.gameOver) break;
    // If the trash and deck were both empty, another iteration performs another Burn Out (432.3).
  }
  if (drawn.length > 0) {
    pushEvent(step.events, { type: "draw", playerId, amount: drawn.length, data: { cardIds: drawn } });
  }
  return { drawn, awaitingPrompt: false };
}

export interface BurnOutResult {
  awaitingPrompt: boolean;
  gameOver: boolean;
  /** 367–375: a replacement effect prevented the Burn Out. */
  prevented?: boolean;
}

/**
 * 432.2: recycle trash into the Main Deck, then a chosen opponent gains 1 point. In a duel the
 * only opponent is deterministic; with 3+ players the choice becomes a `Prompt` (411.2) and the
 * caller pauses until `rules_choose` answers it. `remainingDraws` is the rest of the action that
 * caused the Burn Out (432.2.d) and is completed by the prompt handler after the answer.
 */
export function burnOut(
  room: Room,
  playerId: string,
  step: RulesStepContext,
  remainingDraws = 0,
  options: DrawOptions = {},
): BurnOutResult {
  if (!interceptAction(room, step, { type: "burn_out", playerId, amount: 1 })) {
    return { awaitingPrompt: false, gameOver: false, prevented: true };
  }
  step.host.recycleTrash(room, playerId);
  const opponents = step.host.activePlayerIds(room).filter((id) => id !== playerId);
  pushEvent(step.events, {
    type: "burn_out",
    playerId,
    amount: 1,
    data: { opponents },
  });
  if (opponents.length === 0) return { awaitingPrompt: false, gameOver: false };
  const chosen = opponents.length === 1 ? opponents[0] : null;
  if (!chosen) {
    const rules = room.rules;
    if (!rules) return { awaitingPrompt: false, gameOver: false };
    const id = step.host.nextId("prompt");
    rules.prompt = {
      id,
      kind: "choose-opponent",
      playerId,
      promptKey: "rules.prompt.burnOutOpponent",
      rule: "432.2.c",
      options: opponents.map((id) => ({ id, playerId: id })),
      min: 1,
      max: 1,
      data: {
        reason: PROMPT_REASONS.burnOut,
        remainingDraws: Math.max(0, Math.trunc(remainingDraws)),
        ...(options.resumeViaTask ? { resumeViaTask: true } : {}),
      },
    };
    return { awaitingPrompt: true, gameOver: false };
  }
  step.host.gainPoints(room, chosen, 1);
  pushEvent(step.events, { type: "gain_points", playerId: chosen, amount: 1, data: { burnOut: true } });
  const winners = step.host.settleVictory(room);
  if (winners.length > 0) {
    pushEvent(step.events, { type: "game_over", data: { winnerPlayerIds: winners } });
    return { awaitingPrompt: false, gameOver: true };
  }
  return { awaitingPrompt: false, gameOver: false };
}
