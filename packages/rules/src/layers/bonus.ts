/**
 * Bonus Damage — rules 712–715, 418.4/418.5.
 *
 * `{ kind: "bonus-damage", amount, from? }` modifiers grant Bonus
 * Damage to deal actions whose source the modifier's controller controls. `from` restricts the
 * category: "spells", "abilities" or "spells-and-abilities" (default); `nextSpell: true` limits it
 * to the next spell its controller plays (bound on play, EX[179]). 714: all instances are summed
 * and applied once; 714.2: a negative total applies no Bonus Damage.
 */
import type { Room } from "@rift/protocol";
import type { RulesHost } from "../host";
import { activeModifiers } from "./passives";

export interface BonusQuery {
  controller: string;
  sourceObjectId?: string;
  /** Ability kind of the dealing effect ("spell", "activated", "triggered", …). */
  kind?: string;
}

export function bonusDamage(room: Room, host: RulesHost, query: BonusQuery): number {
  let total = 0;
  const category = query.kind === "spell" ? "spells" : query.kind ? "abilities" : "other";
  for (const active of activeModifiers(room, host)) {
    const modifier = active.modifier;
    if (modifier.kind !== "bonus-damage") continue;
    if (active.controller !== query.controller) continue;
    const from = modifier.from ?? "spells-and-abilities";
    if (from === "spells" && category !== "spells") continue;
    if (from === "abilities" && category !== "abilities") continue;
    if (from === "spells-and-abilities" && category === "other") continue;
    // 392 / EX[179]: a "next spell" bonus applies only to the spell it bound to.
    if (modifier.nextSpell && modifier.boundCardId !== query.sourceObjectId) continue;
    const amount = modifier.amount;
    total += typeof amount === "number" ? amount : 0;
  }
  return Math.max(0, total);
}
