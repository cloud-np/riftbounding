/** Recall / Kill / Move — rules 456–457, 429, 449–455. */
import type { BattlefieldZone, Room } from "@rift/protocol";
import type { RulesStepContext } from "../types";
import { pushEvent } from "../types";
import { interceptAction } from "../timing/hooks";

export function recall(room: Room, cardId: string, step: RulesStepContext): boolean {
  const located = step.host.findCard(room, cardId);
  if (!located) return false;
  if (located.zone === "base") return false;
  if (!interceptAction(room, step, { type: "recall", cardId, playerId: located.playerId })) return false;
  const moved = step.host.moveCard(room, located.playerId, located.zone, "base", cardId);
  if (moved) pushEvent(step.events, { type: "recall", cardId, playerId: located.playerId });
  return moved;
}

/** 429: Kill → the object leaves the board and goes to its owner's Trash. */
export function kill(room: Room, cardId: string, step: RulesStepContext): boolean {
  const located = step.host.findCard(room, cardId);
  if (!located) return false;
  if (!interceptAction(room, step, { type: "kill", cardId, playerId: located.playerId })) return false;
  const moved = step.host.moveCard(room, located.playerId, located.zone, "trash", cardId);
  if (!moved) return false;
  delete room.rules?.objects[cardId];
  pushEvent(step.events, {
    type: "kill",
    cardId,
    playerId: located.playerId,
    zone: located.zone,
    cardName: located.card.name,
  });
  return true;
}

/**
 * Primitive Move. Applies Contested status when a unit arrives at an uncontested battlefield
 * its controller did not already control (452 / 190.3.a.1). Cleanup (455) starts the showdown.
 */
export function movePrimitive(
  room: Room,
  cardId: string,
  to: string,
  step: RulesStepContext,
): boolean {
  const located = step.host.findCard(room, cardId);
  if (!located) return false;
  if (located.zone === to) return false;
  const proposal = interceptAction(room, step, {
    type: "move",
    cardId,
    playerId: located.playerId,
    zone: to,
    data: { from: located.zone },
  });
  if (!proposal) return false;
  const destination = proposal.zone ?? to;
  const rules = room.rules;
  const battlefield = step.host.battlefieldZones(room).includes(destination as BattlefieldZone)
    ? (destination as BattlefieldZone)
    : null;
  const controlledBefore = battlefield ? step.host.hasUnitAt(room, located.playerId, battlefield) : false;
  const moved = step.host.moveCard(room, located.playerId, located.zone, destination, cardId);
  if (!moved) return false;
  const info = step.host.cardInfo(room, cardId);
  if (info?.type.toLowerCase().includes("unit") && battlefield && !controlledBefore) {
    if (!rules) return true;
    if (!rules.contested[battlefield]) rules.contested[battlefield] = located.playerId;
  }
  const object = room.rules?.objects[cardId];
  if (object) {
    object.movedThisTurn = true;
    if (battlefield) object.enteredThisTurn = true;
  }
  pushEvent(step.events, {
    type: "move",
    cardId,
    playerId: located.playerId,
    zone: destination,
    data: { from: located.zone },
  });
  return true;
}
