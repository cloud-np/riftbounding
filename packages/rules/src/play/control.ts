/**
 * Battlefield presence and control — rules 107.3, 170.11, 190.2–190.4, 451.2.
 *
 * Control itself is R2-combat's stored model (`actions/control.ts`, 190.2/190.5); this module
 * keeps the play layer's presence helpers. Facedown cards (107.3) are never Units present at a
 * location.
 */
import type { CardInstance, Room } from "@rift/protocol";
import type { RulesHost } from "../host";
import { battlefieldController } from "../actions/control";

function isUnit(room: Room, host: RulesHost, card: CardInstance): boolean {
  if (card.hidden) return false;
  const type = (host.cardInfo(room, card.id)?.type ?? card.type ?? "").toLowerCase();
  return type.includes("unit");
}

/** Units a player has at a location (facedown cards excluded). */
export function visibleUnitsAt(room: Room, host: RulesHost, playerId: string, zone: string): CardInstance[] {
  return host.zoneCards(room, playerId, zone).filter((card) => isUnit(room, host, card));
}

export function hasVisibleUnitAt(room: Room, host: RulesHost, playerId: string, zone: string): boolean {
  return visibleUnitsAt(room, host, playerId, zone).length > 0;
}

/** Players with Units at a battlefield (451.2 counts them). */
export function playersWithUnitsAt(room: Room, host: RulesHost, zone: string): string[] {
  return host.activePlayerIds(room).filter((id) => hasVisibleUnitAt(room, host, id, zone));
}

/** 190.2.b: delegates to the stored control model (`actions/control.ts`). */
export function controlsBattlefield(room: Room, host: RulesHost, playerId: string, zone: string): boolean {
  return battlefieldController(room, zone, host) === playerId;
}

/** 107.3.a/b: the card in a battlefield's Facedown Zone (max occupancy one), if any. */
export function facedownCardAt(room: Room, host: RulesHost, zone: string): { card: CardInstance; playerId: string } | null {
  for (const playerId of host.activePlayerIds(room)) {
    const card = host.zoneCards(room, playerId, zone).find((entry) => entry.hidden === true);
    if (card) return { card, playerId };
  }
  return null;
}

export function isBattlefield(room: Room, host: RulesHost, zone: string): boolean {
  return (host.battlefieldZones(room) as string[]).includes(zone);
}
