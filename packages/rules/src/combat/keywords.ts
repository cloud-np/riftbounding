/**
 * Combat keywords — Assault 807, Shield 814, Tank 815, Backline 826; 143.2.c, 424.1.b.
 *
 * The keyword profile and the Assault/Shield Might bonus live in the layers
 * (`layers/combat-keywords.ts`): 807.1.c / 814.1.c make them Might passives, so `effectiveMight`
 * already includes them while the designation is held, and combat never adds them again.
 *
 * Pure: reads the room only.
 */
import type { Room } from "@rift/protocol";
import type { RulesHost } from "../host";
import { effectiveMight, modifierTargets } from "../layers";
import { activeModifiers } from "../layers/passives";
import { designationMightBonus, printedLines } from "../layers/combat-keywords";
import { orderedRegistry } from "../registry-table";

export { combatKeywordProfile, type CombatKeywordProfile } from "../layers/combat-keywords";

/** Printed passive "I don't deal combat damage." (unconditional sentence only). */
const NO_COMBAT_DAMAGE_SENTENCE = /(?:^|[.!?]\s+)I don['’]t deal combat damage\.(?:\s|$)/i;

/**
 * 807.1.c / 814.1.c: the Assault/Shield part of the unit's current Might (0 without the
 * designation, 807.1.d.1 / 814.1.d.1). Informational: it is already inside `effectiveMight`.
 */
export function combatMightBonus(room: Room, objectId: string, host: RulesHost): number {
  return designationMightBonus(room, objectId, host);
}

/**
 * The unit's Might as combat damage and lethal-damage checks use it: effective Might (143.2,
 * layers; Assault/Shield included) clamped at 0 — a unit with negative Might contributes 0 to
 * its side (143.2.c) and needs at least 1 damage to be lethal (142.4.b).
 */
export function combatMight(room: Room, objectId: string, host: RulesHost): number {
  return Math.max(0, effectiveMight(room, objectId, host));
}

/* ---------------------------------------------------------------- contribution (424.1.b) */

/**
 * Extension point: return `false` when a unit does not contribute its Might to combat damage
 * (cards like "Enemy units here with less Might than me don't deal combat damage"). Module-level
 * registry of pure functions (N2 exemption); R2-effects registers card text here.
 */
export type CombatContributionFilter = (room: Room, unitId: string, host: RulesHost) => boolean;

const FILTER_REGISTRY = orderedRegistry<CombatContributionFilter>("combat contribution filter");
const CONTRIBUTION_FILTERS = FILTER_REGISTRY.list;

export function registerCombatContributionFilter(filter: CombatContributionFilter): () => void {
  return FILTER_REGISTRY.register(filter);
}

/**
 * 424.1.b: a Stunned Unit does not contribute its Might to damage in the Combat Damage Step.
 * Printed "I don't deal combat damage." (unconditional), `no-combat-damage` passives targeting the
 * unit (card text such as "Enemy units here with less Might than me don't deal combat damage")
 * and registered filters do the same.
 */
export function dealsCombatDamage(room: Room, unitId: string, host: RulesHost): boolean {
  if (room.rules?.objects[unitId]?.stunned) return false;
  const text = host.cardInfo(room, unitId)?.text;
  if (text && printedLines(text).some((line) => NO_COMBAT_DAMAGE_SENTENCE.test(line))) return false;
  for (const active of activeModifiers(room, host)) {
    if (active.modifier.kind === "no-combat-damage" && modifierTargets(room, host, active, unitId, 1)) return false;
  }
  return CONTRIBUTION_FILTERS.every((filter) => filter(room, unitId, host));
}

/**
 * 467.2.a / 467.2.b / 143.2.c: a unit's contribution to its side's summed Might (negative Might
 * counts as 0; `combatMight` already clamps).
 */
export function combatContribution(room: Room, unitId: string, host: RulesHost): number {
  return dealsCombatDamage(room, unitId, host) ? combatMight(room, unitId, host) : 0;
}
