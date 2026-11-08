/**
 * Battlefield presence and control — rules 107.3, 170.11, 190.2–190.4, 451.2.
 *
 * `RulesState` has no stored battlefield controller yet, so control uses the presence proxy R1
 * already relies on, refined by Contested status (190.3.a): a player controls a battlefield
 * while they have Units there (190.4.a), unless they are the player who applied Contested and
 * control has not been established yet (190.3.b/190.4). Facedown cards (107.3) are never Units
 * present at a location.
 *
 * TODO(R2-play): replace with R2-combat's control model once battlefield control is stored.
 */
import type { CardInstance, Room } from "@rift/protocol";
import type { RulesHost } from "../host";

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

/** 190.2–190.4 (presence proxy refined by Contested status). */
export function controlsBattlefield(room: Room, host: RulesHost, playerId: string, zone: string): boolean {
  if (!hasVisibleUnitAt(room, host, playerId, zone)) return false;
  const contester = room.rules?.contested[zone as keyof NonNullable<Room["rules"]>["contested"]];
  if (contester === playerId) {
    // The player who applied Contested has not established control yet (190.3.b/190.4), unless
    // nobody else is there to hold it.
    return playersWithUnitsAt(room, host, zone).every((id) => id === playerId) && !room.rules?.showdown;
  }
  return true;
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
