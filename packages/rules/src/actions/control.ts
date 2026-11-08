/** Control — rules 188–190 (battlefields), 323.5, 468.5. */
import type { BattlefieldZone, Room } from "@rift/protocol";
import type { RulesStepContext } from "../types";
import { pushEvent } from "../types";
import type { RulesHost } from "../host";
import { interceptAction } from "../timing/hooks";

/**
 * 190.2: the player who controls a battlefield, or null when it is Uncontrolled.
 *
 * Control is a constant state (190.5) stored on the battlefield's object entry
 * (`rules.objects[zone].controller`, 170 / 199.1). A battlefield without a stored entry is a
 * legacy/restored room (or a synthetic fixture): control is then inferred from unit presence
 * (190.4.a) — the single player with Units there, ignoring the player who applied Contested
 * (190.3.a: they apply it precisely because they do not control the battlefield).
 */
export function battlefieldController(room: Room, zone: string, host: RulesHost): string | null {
  const rules = room.rules;
  if (!rules) return null;
  const record = rules.objects[zone];
  if (record && record.controller !== undefined) return record.controller;
  const applier = rules.contested[zone as BattlefieldZone];
  const present = host
    .activePlayerIds(room)
    .filter((id) => id !== applier && host.hasUnitAt(room, id, zone));
  return present.length === 1 ? present[0]! : null;
}

/** True when `playerId` controls `zone` (190.2.b). */
export function controlsBattlefield(room: Room, playerId: string, zone: string, host: RulesHost): boolean {
  return battlefieldController(room, zone, host) === playerId;
}

/** Store the battlefield's control state explicitly (190.2). */
export function setBattlefieldController(room: Room, zone: string, playerId: string | null): void {
  const rules = room.rules;
  if (!rules) return;
  const record = (rules.objects[zone] ??= {});
  record.controller = playerId;
}

/**
 * 323.5 / 190.4.c / 468.5.b: the battlefield becomes Uncontrolled. Emits `lose_control` when a
 * player actually loses control. Returns true when the state changed.
 */
export function loseControl(room: Room, zone: string, step: RulesStepContext, rule: string): boolean {
  const previous = battlefieldController(room, zone, step.host);
  const record = room.rules?.objects[zone];
  const explicit = record?.controller !== undefined;
  setBattlefieldController(room, zone, null);
  if (previous) {
    pushEvent(step.events, { type: "lose_control", playerId: previous, zone, data: { rule } });
    return true;
  }
  return !explicit;
}

/**
 * 190.4: control is established by having Units at the battlefield at the end of a Showdown or
 * Combat. 367–375: the action runs through replacement effects first. Establishing control
 * clears Contested (190.3.b / 468.5.a).
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
  setBattlefieldController(room, zone, playerId);
  pushEvent(step.events, { type: "establish_control", playerId, zone });
  return true;
}

/** Convenience type guard used by the move/cleanup extension points. */
export function battlefieldOf(room: Room, zone: string, host: RulesStepContext["host"]): BattlefieldZone | null {
  return host.battlefieldZones(room).includes(zone as BattlefieldZone) ? (zone as BattlefieldZone) : null;
}
