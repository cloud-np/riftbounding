/**
 * Turn/priority/focus mutators — rules 304–313, 335.
 *
 * These helpers mutate the draft `RulesState` only; the intent boundary clones the room once.
 */
import type { RulesPhase, RulesState, RulesStep } from "@rift/protocol";

export function setPhase(rules: RulesState, phase: RulesPhase, step?: RulesStep): void {
  rules.turn.phase = phase;
  if (step) rules.turn.step = step;
  else delete rules.turn.step;
}

export function clearPasses(rules: RulesState): void {
  rules.passes = [];
}

export function grantPriority(rules: RulesState, playerId: string | null): void {
  rules.priority = playerId;
}

export function grantFocus(rules: RulesState, playerId: string | null): void {
  rules.focus = playerId;
  // 313.2: a player who gains Focus also gains Priority.
  rules.priority = playerId;
}

export function dropFocus(rules: RulesState): void {
  rules.focus = null;
}
