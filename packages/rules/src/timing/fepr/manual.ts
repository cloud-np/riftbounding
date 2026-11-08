/** Manual window — §6.4 (contract). */
import type { ChainItem, Room } from "@rift/protocol";
import type { RulesStepContext } from "../../types";
import { pushEvent } from "../../types";
import { afterChainItemResolved } from "./after";
import { noteExpirationFepr, removeChainItem } from "./chain";
import { pushSpellToTrash } from "./spell";

/** §6.4: no script (or `status:"manual"`) → the controller gets sandbox board actions. */
export function openManual(
  room: Room,
  item: ChainItem,
  step: RulesStepContext,
  reason?: string,
): void {
  const rules = room.rules;
  if (!rules) return;
  rules.manual = {
    itemId: item.id,
    player: item.controller,
    cardName: item.cardName ?? item.abilityRef ?? "Ability",
  };
  rules.priority = null;
  pushEvent(step.events, {
    type: "manual_window",
    playerId: item.controller,
    data: { itemId: item.id, reason: reason ?? "no_script" },
  });
}

/** §6.4: close the manual window, clear the item and continue. */
export function completeManual(room: Room, playerId: string, step: RulesStepContext): boolean {
  const rules = room.rules;
  if (!rules?.manual || rules.manual.player !== playerId) return false;
  const itemId = rules.manual.itemId;
  const item = rules.chain.find((entry) => entry.id === itemId);
  rules.manual = null;
  // 317.2.f: closing an item's manual resolution during the Expiration Step restarts the step.
  noteExpirationFepr(rules);
  if (item) {
    if (item.kind === "card") pushSpellToTrash(room, item, step);
    const openedBy = rules.history.chainOpenedBy;
    removeChainItem(room, item.id);
    afterChainItemResolved(room, step, openedBy);
  }
  pushEvent(step.events, { type: "manual_done", playerId, data: { itemId } });
  return true;
}
