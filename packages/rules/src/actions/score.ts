/** Scoring primitives — rules 469–472. */
import type { BattlefieldZone, Room } from "@rift/protocol";
import type { RulesStepContext } from "../types";
import { pushEvent } from "../types";
import { scoreBattlefield } from "../scoring/score";
import { establishControl } from "./control";
import { interceptAction } from "../timing/hooks";

export function conquer(
  room: Room,
  playerId: string,
  zone: BattlefieldZone,
  step: RulesStepContext,
): boolean {
  // 367–375: Conquer is one game action; its nested Establish Control action is intercepted
  // separately inside `establishControl` (which owns the single 348.2.a event).
  if (!interceptAction(room, step, { type: "conquer", playerId, zone })) return false;
  // 348.2.a / 468.5.d: Conquering requires establishing Control first. If another player's
  // Units are still present the process is undone and no Scoring occurs (358.5 / 190.4).
  if (!establishControl(room, playerId, zone, step)) {
    pushEvent(step.events, {
      type: "conquer_result",
      playerId,
      zone,
      amount: 0,
      data: { scored: false, drew: false, establishControl: false },
    });
    return false;
  }
  // 469–472: the Scoring process is its own action for replacement effects.
  if (!interceptAction(room, step, { type: "score", playerId, zone, data: { kind: "conquer" } })) {
    pushEvent(step.events, {
      type: "conquer_result",
      playerId,
      zone,
      amount: 0,
      data: { scored: false, drew: false },
    });
    return false;
  }
  const result = scoreBattlefield(room, playerId, zone, "conquer", step);
  pushEvent(step.events, {
    type: "conquer_result",
    playerId,
    zone,
    amount: result.points,
    data: { scored: result.scored, drew: result.drew },
  });
  return result.scored;
}

export function hold(
  room: Room,
  playerId: string,
  zone: BattlefieldZone,
  step: RulesStepContext,
): boolean {
  if (!interceptAction(room, step, { type: "hold", playerId, zone })) return false;
  if (!interceptAction(room, step, { type: "score", playerId, zone, data: { kind: "hold" } })) return false;
  return scoreBattlefield(room, playerId, zone, "hold", step).scored;
}

/** 470.2: "Score X points" on card text means Gain X points, not the Scoring process. */
export function gainPoints(room: Room, playerId: string, amount: number, step: RulesStepContext): number {
  const proposal = interceptAction(room, step, {
    type: "gain_points",
    playerId,
    amount: Math.max(0, Math.trunc(amount)),
  });
  if (!proposal) return 0;
  const gained = step.host.gainPoints(room, playerId, Math.max(0, Math.trunc(proposal.amount ?? amount)));
  pushEvent(step.events, { type: "gain_points", playerId, amount: gained });
  return gained;
}

/**
 * 194.4: players cannot have less than 0 points. 194.4.a: losing points at 0 does nothing;
 * 194.4.b: and emits no `lose_points` event (loss triggers do not trigger). In 2v2 the team's
 * shared score is reduced (491.8.d.2, through the host). Returns the points actually lost.
 */
export function losePoints(room: Room, playerId: string, amount: number, step: RulesStepContext): number {
  const proposal = interceptAction(room, step, {
    type: "lose_points",
    playerId,
    amount: Math.max(0, Math.trunc(amount)),
  });
  if (!proposal) return 0;
  const current = Math.max(0, step.host.score(room, playerId));
  const lost = Math.min(current, Math.max(0, Math.trunc(proposal.amount ?? amount)));
  if (lost <= 0) return 0;
  step.host.setScore(room, playerId, current - lost);
  pushEvent(step.events, { type: "lose_points", playerId, amount: lost });
  return lost;
}
