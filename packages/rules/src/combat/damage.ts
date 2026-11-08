/**
 * Combat damage — rule 467.
 *
 * R1 ships the minimal simultaneous resolution so strict rooms never deadlock; R2 replaces
 * `runCombatDamage` with the official damage-assignment prompt.
 */
import type { CardInstance, Room } from "@rift/protocol";
import type { RulesStepContext } from "../types";
import { effectiveMight, pushEvent } from "../types";
import { dealDamage } from "../actions/damage";

export function runCombatDamage(room: Room, step: RulesStepContext): boolean {
  const rules = room.rules;
  const combat = rules?.combat;
  if (!rules || !combat) return false;
  const attackerUnits = step.host.unitsAt(room, combat.battlefield, combat.attacker);
  const defenderUnits = step.host.unitsAt(room, combat.battlefield, combat.defender);
  // 424.1.b: a Stunned Unit does not contribute its Might.
  const attackerDamage = attackerUnits.reduce(
    (sum, card) => sum + (rules.objects[card.id]?.stunned ? 0 : effectiveMight(room, card.id, step.host)),
    0,
  );
  const defenderDamage = defenderUnits.reduce(
    (sum, card) => sum + (rules.objects[card.id]?.stunned ? 0 : effectiveMight(room, card.id, step.host)),
    0,
  );
  distribute(room, defenderUnits, attackerDamage, step);
  distribute(room, attackerUnits, defenderDamage, step);
  combat.step = "resolution";
  pushEvent(step.events, {
    type: "combat_damage",
    zone: combat.battlefield,
    data: { attackerDamage, defenderDamage },
  });
  return true;
}

function distribute(room: Room, units: CardInstance[], damage: number, step: RulesStepContext): void {
  let remaining = damage;
  for (const unit of units) {
    if (remaining <= 0) break;
    const amount = Math.min(remaining, Math.max(1, effectiveMight(room, unit.id, step.host)));
    dealDamage(room, unit.id, amount, step);
    remaining -= amount;
  }
}
