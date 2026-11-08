/** Spell destination — rules 340/348.2: a resolved spell goes to its owner's Trash. */
import type { ChainItem, Room } from "@rift/protocol";
import type { RulesStepContext } from "../../types";
import { pushEvent } from "../../types";

export function pushSpellToTrash(room: Room, item: ChainItem, step: RulesStepContext): void {
  const snapshot = item.cardSnapshot;
  if (!snapshot) return;
  const owner = snapshot.ownerPlayerId ?? item.controller;
  step.host.putCard(room, owner, "trash", snapshot);
  pushEvent(step.events, {
    type: "spell_resolved",
    cardId: snapshot.id,
    playerId: item.controller,
    cardName: snapshot.name,
  });
}
