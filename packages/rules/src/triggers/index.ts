/**
 * Trigger queue — rules 382+, 303.2.a, 466.2.d, 466.2.d.1.
 *
 * Owner: R2-effects. Consumer: R2-combat (466.2.d / 466.2.d.1).
 * Semantics: adds every `PendingTrigger` in `rules.triggers` to the chain. `opts.order` is the
 * player order to place them in (default: Turn Order starting with the Turn Player, 303.2.a).
 * R2-combat passes `[attacker, ...non-defender players in Turn Order, defender]` for the combat
 * chain (466.2.d.1). Returns the number of chain items added.
 *
 * Signature is a cross-agent contract: keep it stable.
 */
import type { Room } from "@rift/protocol";
import type { RulesStepContext } from "../types";

export function flushPendingTriggers(
  room: Room,
  step: RulesStepContext,
  opts?: { order?: readonly string[] },
): number {
  // Stub (R2-effects): no triggers are moved and `rules.triggers` is left untouched.
  void room;
  void step;
  void opts;
  return 0;
}
