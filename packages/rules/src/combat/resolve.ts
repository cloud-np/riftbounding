/** Combat resolution — rule 468. */
import type { Room } from "@rift/protocol";
import type { RulesStepContext } from "../types";
import { effectiveMight, pushEvent } from "../types";
import { kill } from "../actions/primitives";
import { dropFocus } from "../state";

/** 468: combat cleanup, then control is established by the remaining side. */
export function runCombatResolution(room: Room, step: RulesStepContext): boolean {
  const rules = room.rules;
  const combat = rules?.combat;
  if (!rules || !combat) return false;
  // 468.1 combat cleanup: lethal damage kills, damage heals.
  for (const card of [...step.host.unitsAt(room, combat.battlefield)]) {
    const object = rules.objects[card.id];
    if (!object?.damage) continue;
    if (object.damage >= effectiveMight(room, card.id, step.host)) {
      // 323.4 / 429: place the Unit in its OWNER's Trash from wherever its controller has it;
      // the kill primitive moves first and only then deletes the rules object (NEW-5).
      kill(room, card.id, step);
    } else {
      delete object.damage;
    }
  }
  // 468.5.a: clear the Contested status once control is established.
  delete rules.contested[combat.battlefield];
  // 468.7.a: remove Attacker and Defender designations from all Units.
  for (const object of Object.values(rules.objects)) delete object.designation;
  // 468.7.c: "this combat" effects expire.
  rules.effects = rules.effects.filter((effect) => effect.duration !== "this-combat");
  rules.combat = null;
  dropFocus(rules);
  rules.priority = null;
  pushEvent(step.events, { type: "combat_end", zone: combat.battlefield });
  return true;
}
