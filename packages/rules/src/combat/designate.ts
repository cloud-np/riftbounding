/**
 * Attacker/Defender designations — rules 323.2 (a–c), 466.2.c.3 (+ .a), 468.7.a, 383.4.e.
 */
import type { Room } from "@rift/protocol";
import type { RulesStepContext } from "../types";
import { pushEvent } from "../types";

/**
 * 323.2 / 466.2.c.3: keep Attacker/Defender designations correct while a combat is in progress.
 *
 * - 323.2.a: Units at the combat battlefield without a designation gain their controller's.
 * - 323.2.b: Units with the opposite designation of their controller swap to their controller's.
 * - 323.2.c: Units elsewhere lose any designation.
 * - Units of a player who is neither Attacker nor Defender never hold a designation (464).
 * - With no combat in progress every lingering designation is removed (468.7.a).
 *
 * 383.4.e: the first time during a combat a unit gains the Attacker (Defender) designation an
 * `attack` (`defend`) event is emitted for Attack/Defend triggers; regaining it later in the same
 * combat does not emit again (383.4.e.2.a).
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
  for (const player of new Set([combat.attacker, combat.defender, ...room.players.map((entry) => entry.id)])) {
    const designation =
      player === combat.attacker ? "attacker" : player === combat.defender ? "defender" : undefined;
    for (const card of step.host.unitsAt(room, combat.battlefield, player)) {
      const object = (rules.objects[card.id] ??= {});
      if (designation && object.designation !== designation) {
        object.designation = designation;
        changed = true;
        const first = designation === "attacker" ? !object.attackedThisCombat : !object.defendedThisCombat;
        if (designation === "attacker") {
          object.attackedThisCombat = true;
          object.attackedThisTurn = true;
        } else {
          object.defendedThisCombat = true;
        }
        if (first) {
          pushEvent(step.events, {
            type: designation === "attacker" ? "attack" : "defend",
            cardId: card.id,
            playerId: player,
            zone: combat.battlefield,
            data: { rule: "383.4.e" },
          });
        }
      } else if (!designation && object.designation) {
        delete object.designation;
        changed = true;
      }
    }
  }
  return changed;
}

/** 468.7.a: remove Attacker and Defender designations (and the per-combat flags) from all Units. */
export function clearCombatDesignations(room: Room): void {
  const rules = room.rules;
  if (!rules) return;
  for (const object of Object.values(rules.objects)) {
    delete object.designation;
    delete object.attackedThisCombat;
    delete object.defendedThisCombat;
    delete object.assignedDamage;
    delete object.assignedBy;
  }
}
