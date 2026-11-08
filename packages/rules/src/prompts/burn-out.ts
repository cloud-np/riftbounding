/**
 * 432.2.c–432.3.c.1: Burn Out opponent choice.
 *
 * The chosen opponent gains 1 point and wins immediately when the point reaches the Victory
 * Score (no cleanup needed). 432.2.d: after the Burn Out, the remainder of the action that
 * caused it completes; R1's Burn Out is always caused by a draw, so the prompt carries
 * `remainingDraws` and this handler completes (or schedules) that draw.
 */
import { drawCards } from "../actions/draw";
import { fail, pushEvent } from "../types";
import { queueTask } from "../timing/tasks";
import { chosenPromptOption, registerPromptHandler } from "./handlers";
import { PROMPT_REASONS } from "./reasons";

registerPromptHandler(PROMPT_REASONS.burnOut, ({ room, prompt, actorId, answer, step }) => {
  const rules = room.rules;
  if (!rules) return fail("rules_require_strict", "contract:§1");
  const option = chosenPromptOption(prompt, answer);
  const opponentId = option?.playerId ?? option?.id;
  if (!opponentId) return fail("invalid_choice", prompt.rule ?? "432.2.c");
  const gained = step.host.gainPoints(room, opponentId, 1);
  pushEvent(step.events, {
    type: "gain_points",
    playerId: opponentId,
    amount: gained,
    data: { burnOut: true },
  });
  // 432.3.c / 432.3.c.1: points from a Burn Out that reach/surpass the Victory Score with a
  // strict lead win the game immediately, without waiting for the next cleanup.
  const winners = step.host.settleVictory(room);
  if (winners.length > 0) {
    pushEvent(step.events, { type: "game_over", data: { winnerPlayerIds: winners } });
    return { ok: true };
  }
  // 432.2.d: complete the rest of the action that caused the Burn Out. The remainder is stored
  // on the prompt, so a draw for N never loses N-1 cards (the Draw Phase resumes via a task).
  const rawRemaining = prompt.data?.remainingDraws;
  const remaining = typeof rawRemaining === "number" ? Math.max(0, Math.trunc(rawRemaining)) : 0;
  if (remaining > 0) {
    if (prompt.data?.resumeViaTask === true) {
      // Draw Phase: resume as a continuation task so the phase advances only after the draw is
      // complete (and a further Burn Out can pause it again).
      queueTask(
        room,
        { kind: "draw", playerId: prompt.playerId, data: { resumeDraws: remaining } },
        step,
      );
    } else {
      // Effect/score draw: finish the remainder before the resolution continues. Another empty
      // deck triggers another Burn Out (432.3); its prompt stays pending because
      // `recordPromptAnswer` only clears the prompt it is answering.
      drawCards(room, actorId, remaining, step);
    }
  }
  return { ok: true };
});
