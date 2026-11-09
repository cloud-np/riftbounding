/**
 * Units present at a location — rule 107.3 (Facedown Zones).
 *
 * A facedown card in a battlefield's Facedown Zone is not a Unit present at that battlefield: it
 * contributes nothing to presence, control, Contested, combat, scoring or crowding (107.3,
 * 107.3.e, 451.2). The frozen host's `unitsAt`/`hasUnitAt` count every Unit card in the zone list
 * (facedown ones included), so every rules-layer presence check goes through these helpers.
 *
 * Pure: reads the room only.
 */
import type { CardInstance, Room } from "@rift/protocol";
import type { RulesHost } from "../host";

/** Face-up Units at `zone` (optionally only `playerId`'s). */
export function unitsPresentAt(room: Room, host: RulesHost, zone: string, playerId?: string): CardInstance[] {
  return host.unitsAt(room, zone, playerId).filter((card) => card.hidden !== true);
}

/** Does `playerId` have a face-up Unit at `zone`? */
export function hasUnitPresentAt(room: Room, host: RulesHost, playerId: string, zone: string): boolean {
  return unitsPresentAt(room, host, zone, playerId).length > 0;
}

/** Active players with face-up Units at `zone`, in `activePlayerIds` order. */
export function playersPresentAt(room: Room, host: RulesHost, zone: string): string[] {
  return host.activePlayerIds(room).filter((id) => hasUnitPresentAt(room, host, id, zone));
}
