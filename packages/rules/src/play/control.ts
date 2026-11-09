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
import { hasUnitPresentAt, playersPresentAt, unitsPresentAt } from "../state/presence";

/** Units a player has at a location (facedown cards excluded, 107.3; `state/presence.ts`). */
export function visibleUnitsAt(room: Room, host: RulesHost, playerId: string, zone: string): CardInstance[] {
  return unitsPresentAt(room, host, zone, playerId);
}

export function hasVisibleUnitAt(room: Room, host: RulesHost, playerId: string, zone: string): boolean {
  return hasUnitPresentAt(room, host, playerId, zone);
}

/** Players with Units at a battlefield (451.2 counts them). */
export function playersWithUnitsAt(room: Room, host: RulesHost, zone: string): string[] {
  return playersPresentAt(room, host, zone);
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
