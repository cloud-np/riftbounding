/**
 * After a Chain Item resolves — rules 340.2–340.4 / 346.
 *
 * - chain not empty + pending → finalize next (advance loop)
 * - chain not empty + no pending → controller of newest item (340.4)
 * - chain empty + Showdown → pass Focus unless the chain opened from trigger/add (346.1)
 * - chain empty + Main → the Turn Player (312.2.a)
 */
import type { ChainItemOrigin, Room } from "@rift/protocol";
import type { RulesStepContext } from "../../types";
import { pushEvent } from "../../types";
import { clearPasses, grantFocus, grantPriority, nextPlayerInTurnOrder } from "../../state";
import { runCleanup } from "../../cleanup/cleanup";
import { queueTask } from "../tasks";

export function afterChainItemResolved(
  room: Room,
  step: RulesStepContext,
  openedBy?: ChainItemOrigin,
): void {
  const rules = room.rules;
  if (!rules) return;
  clearPasses(rules);
  rules.priority = null;
  if (rules.chain.length > 0) {
    if (rules.chain.some((item) => item.status === "pending")) return;
    const newest = rules.chain[rules.chain.length - 1];
    grantPriority(rules, newest?.controller ?? null);
    return;
  }
  if (rules.showdown) {
    if (openedBy === "trigger" || openedBy === "add") {
      // 346.1: Focus does not pass.
      if (rules.focus) grantPriority(rules, rules.focus);
      return;
    }
    // 346 / 340.2.a: Focus passes, and the next player gains both Focus and Priority.
    const current = rules.focus ?? rules.showdown.startedBy;
    const next = nextPlayerInTurnOrder(room, current, step.host);
    if (next) {
      grantFocus(rules, next);
      pushEvent(step.events, { type: "focus_passes", playerId: next, zone: rules.showdown.battlefield });
    }
    return;
  }
  if (rules.turn.phase === "main") grantPriority(rules, rules.turn.player);
}

/**
 * 319.4/319.5 + 321/321.1: run a Cleanup now, or defer it as an Outstanding Task while a Chain
 * Item is Resolving (the §6.4 manual window or a resolution-time prompt is open). The queued
 * task runs right after `rules_manual_done`/the prompt answer completes the resolution.
 */
export function runCleanupOrQueue(room: Room, step: RulesStepContext): "ran" | "queued" {
  const rules = room.rules;
  if (!rules) return "ran";
  if (rules.manual || rules.prompt) {
    if (!rules.tasks.some((task) => task.kind === "cleanup")) {
      queueTask(room, { kind: "cleanup" }, step);
    }
    return "queued";
  }
  runCleanup(room, step);
  return "ran";
}
