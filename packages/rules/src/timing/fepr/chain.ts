/** Chain storage — rules 333/354.1. */
import type { ChainItem, Room, RulesState } from "@rift/protocol";
import type { RulesStepContext } from "../../types";
import { pushEvent } from "../../types";
import { clearPasses } from "../../state";

/**
 * 317.2.f: remember FEPR work that happens while the Expiration Step is running, including in a
 * later intent (a trigger may hand out priority and resolve after the pass returned). The count
 * lives in plain JSON on `RulesState.turn.expirationFepr` so it survives intent boundaries.
 */
export function noteExpirationFepr(rules: RulesState): void {
  if (rules.turn.phase !== "ending" || rules.turn.step !== "expiration") return;
  rules.turn.expirationFepr = (rules.turn.expirationFepr ?? 0) + 1;
}

/** Add an item to the chain (oldest-first storage). 354.1 closes the state. */
export function appendChainItem(room: Room, item: ChainItem, step: RulesStepContext): void {
  const rules = room.rules;
  if (!rules) return;
  if (rules.chain.length === 0) {
    rules.history.chainOpenedBy = item.origin;
  }
  rules.chain.push(item);
  clearPasses(rules);
  // 317.2.f: a new item entering FEPR during the Expiration Step restarts the step.
  noteExpirationFepr(rules);
  pushEvent(step.events, {
    type: "chain_append",
    cardName: item.cardName,
    playerId: item.controller,
    data: { itemId: item.id, kind: item.kind, origin: item.origin },
  });
}

export function removeChainItem(room: Room, itemId: string): void {
  const rules = room.rules;
  if (!rules) return;
  rules.chain = rules.chain.filter((entry) => entry.id !== itemId);
  if (rules.chain.length === 0) delete rules.history.chainOpenedBy;
  clearPasses(rules);
}
