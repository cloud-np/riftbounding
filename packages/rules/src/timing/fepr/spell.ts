/** Spell destination — rules 340/348.2: a resolved spell goes to its owner's Trash. */
import type { ChainItem, Room } from "@rift/protocol";
import type { RulesStepContext } from "../../types";
import { pushEvent } from "../../types";

export function pushSpellToTrash(room: Room, item: ChainItem, step: RulesStepContext): void {
  const snapshot = item.cardSnapshot;
  if (!snapshot) return;
  const owner = snapshot.ownerPlayerId ?? item.controller;
  const zone = spellLeavesChainTo(item);
  step.host.putCard(room, owner, zone, snapshot);
  if (zone === "banished") {
    pushEvent(step.events, { type: "banish", cardId: snapshot.id, playerId: owner, cardName: snapshot.name, data: { rule: "829.1.b.1" } });
  }
  pushEvent(step.events, {
    type: "spell_resolved",
    cardId: snapshot.id,
    playerId: item.controller,
    cardName: snapshot.name,
  });
}

/**
 * Where a card leaving the chain goes (340/348.2: its owner's trash). R3 — 829.1.b.1: a spell
 * played for its Flow cost is banished instead (a delayed replacement effect).
 */
export function spellLeavesChainTo(item: ChainItem): "trash" | "banished" {
  return item.leaveChainTo === "banished" ? "banished" : "trash";
}
