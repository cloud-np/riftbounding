/** Recall / Kill / Move — rules 456–457, 429, 449–455. */
import type { BattlefieldZone, Room } from "@rift/protocol";
import type { RulesStepContext } from "../types";
import { effectiveMight, pushEvent } from "../types";
import { interceptAction } from "../timing/hooks";
import { controlsBattlefield } from "./control";

export function recall(room: Room, cardId: string, step: RulesStepContext): boolean {
  const located = step.host.findCard(room, cardId);
  if (!located) return false;
  if (located.zone === "base") return false;
  if (!interceptAction(room, step, { type: "recall", cardId, playerId: located.playerId })) return false;
  const moved = step.host.moveCard(room, located.playerId, located.zone, "base", cardId);
  if (moved) pushEvent(step.events, { type: "recall", cardId, playerId: located.playerId });
  return moved;
}

/**
 * 429: Kill → the object leaves the board and goes to its owner's Trash.
 *
 * R2-effects (additive): `source` attributes the kill (429.5) and the event carries last-known
 * information (808.1.d.3 / 383.2.c.3.b: Might, owner) for leave-the-board triggers. 719.5:
 * cards attached to a killed top-most card detach and stay where they are.
 */
export function kill(
  room: Room,
  cardId: string,
  step: RulesStepContext,
  source?: { objectId?: string; playerId?: string },
): boolean {
  const located = step.host.findCard(room, cardId);
  if (!located) return false;
  if (!interceptAction(room, step, { type: "kill", cardId, playerId: located.playerId, ...(source ? { data: { source } } : {}) })) {
    return false;
  }
  const might = step.host.cardInfo(room, cardId)?.type.toLowerCase().includes("unit")
    ? effectiveMight(room, cardId, step.host)
    : undefined;
  // 383.2.c.3.b / 424: note the object's state before the rules object is dropped, so
  // "When a stunned enemy unit here dies" (and buffed/empowered conditions) can be read.
  const object = room.rules?.objects[cardId];
  const stunned = object?.stunned === true;
  const buffs = object?.buffs ?? 0;
  const empowered = object?.empowered ?? 0;
  const attached = attachedCardIds(room, cardId, step);
  // 429 / 056: the engine's move routes a card to its owner's Trash (a stolen unit included).
  const moved = step.host.moveCard(room, located.playerId, located.zone, "trash", cardId);
  if (!moved) return false;
  delete room.rules?.objects[cardId];
  for (const gearId of attached) step.host.detach(room, gearId);
  pushEvent(step.events, {
    type: "kill",
    cardId,
    playerId: located.playerId,
    zone: located.zone,
    cardName: located.card.name,
    ...(source?.objectId ? { sourceObjectId: source.objectId } : {}),
    data: {
      owner: located.card.ownerPlayerId ?? located.playerId,
      ...(might !== undefined ? { might } : {}),
      ...(located.card.source === "token" ? { token: true } : {}),
      ...(source?.playerId ? { responsible: source.playerId } : {}),
      stunned,
      buffs,
      empowered,
    },
  });
  return true;
}

/** Cards attached to `cardId` (719.5), across every player's location zones. */
function attachedCardIds(room: Room, cardId: string, step: RulesStepContext): string[] {
  const out: string[] = [];
  for (const playerId of step.host.playerIds(room)) {
    for (const zone of ["base", ...step.host.battlefieldZones(room)]) {
      for (const card of step.host.zoneCards(room, playerId, zone)) {
        if (card.attachedToCardId === cardId) out.push(card.id);
      }
    }
  }
  return out;
}

/**
 * Primitive Move. Applies Contested status when a unit arrives at an uncontested battlefield
 * its controller does not control (452 / 190.3.a.1). Cleanup (455) starts the showdown.
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
  // 190.3.a.1: a Unit moving to a battlefield applies Contested unless it is already Contested or
  // its controller already controls the battlefield (R2-combat's stored control, 190.2).
  const controlledBefore = battlefield ? controlsBattlefield(room, located.playerId, battlefield, step.host) : false;
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
