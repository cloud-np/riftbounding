/** Control — rule 188–190.4. */
import type { BattlefieldZone, Room } from "@rift/protocol";
import type { RulesStepContext } from "../types";
import { pushEvent } from "../types";
import { interceptAction } from "../timing/hooks";

/**
 * 190.4: control is established by units at the battlefield at showdown/combat end.
 * 367–375: the action runs through replacement effects first.
 */
export function establishControl(
  room: Room,
  playerId: string,
  zone: BattlefieldZone,
  step: RulesStepContext,
): boolean {
  if (!interceptAction(room, step, { type: "establish_control", playerId, zone })) return false;
  const rules = room.rules;
  if (!rules) return false;
  const others = step.host.activePlayerIds(room).filter(
    (id) => id !== playerId && step.host.hasUnitAt(room, id, zone),
  );
  if (others.length > 0) return false;
  if (!step.host.hasUnitAt(room, playerId, zone)) return false;
  delete rules.contested[zone];
  pushEvent(step.events, { type: "establish_control", playerId, zone });
  return true;
}

/** Convenience type guard used by the move/cleanup extension points. */
export function battlefieldOf(room: Room, zone: string, host: RulesStepContext["host"]): BattlefieldZone | null {
  return host.battlefieldZones(room).includes(zone as BattlefieldZone) ? (zone as BattlefieldZone) : null;
}
