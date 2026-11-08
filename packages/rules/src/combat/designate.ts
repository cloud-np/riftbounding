/** Attacker/Defender designations — rules 323.2 / 323.2.c / 468.7.a. */
import type { Room } from "@rift/protocol";
import type { RulesStepContext } from "../types";

/**
 * 323.2 / 468.7.a: keep Attacker/Defender designations correct. Units at the combat battlefield
 * gain their controller's designation; units elsewhere lose any designation (323.2.c). With no
 * combat in progress every lingering designation is removed.
 */
export function designateCombatants(room: Room, step: RulesStepContext): boolean {
  const rules = room.rules;
  if (!rules) return false;
  const combat = rules.combat;
  let changed = false;
  if (!combat) {
    for (const object of Object.values(rules.objects)) {
      if (object.designation) {
        delete object.designation;
        changed = true;
      }
    }
    return changed;
  }
  const atBattlefield = new Set(step.host.unitsAt(room, combat.battlefield).map((card) => card.id));
  for (const [cardId, object] of Object.entries(rules.objects)) {
    if (object.designation && !atBattlefield.has(cardId)) {
      delete object.designation;
      changed = true;
    }
  }
  for (const player of room.players) {
    const designation = player.id === combat.attacker ? "attacker" : player.id === combat.defender ? "defender" : undefined;
    for (const card of step.host.unitsAt(room, combat.battlefield, player.id)) {
      const object = (rules.objects[card.id] ??= {});
      if (designation && object.designation !== designation) {
        object.designation = designation;
        changed = true;
      } else if (!designation && object.designation) {
        delete object.designation;
        changed = true;
      }
    }
  }
  return changed;
}
