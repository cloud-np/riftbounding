/**
 * Damage preview — rules 467.2.c.4, 467.2.c.4.a, 467.2.c.5, 438.5, 467.2.c.10.
 *
 * Owner: R2-effects. Consumer: R2-combat (lethal values for damage assignment).
 * Semantics: the damage `amount` would become after passive and replacement effects. Pure:
 * no state change.
 *
 * Applied (without consuming anything): "can't be dealt damage" (→ 0, 467.2.c.10), prevention
 * shields on the unit (438.2/438.5.a; "All" → 0, 438.5.b) and `{ prevent: X }` replacement
 * abilities that match the damage. Bonus Damage (712–715) belongs to non-combat deal actions and
 * is added by the `deal` op before the amount reaches this point.
 *
 * Signature is a cross-agent contract: keep it stable.
 */
import type { Room } from "@rift/protocol";
import type { RulesHost } from "../host";
import { restrictionFor } from "../layers/restrictions";
import { eventMatches } from "../triggers/match";
import { applyPreventShields, proposalEvent, replacementSources } from "./interceptor";

export function previewDamage(
  room: Room,
  host: RulesHost,
  query: { targetId: string; amount: number; sourceObjectId?: string; combat?: boolean },
): number {
  let amount = Math.max(0, Math.trunc(query.amount));
  if (amount <= 0) return 0;
  const blocked = restrictionFor(room, host, {
    kind: "be-dealt-damage",
    objectId: query.targetId,
    ...(query.sourceObjectId ? { sourceObjectId: query.sourceObjectId } : {}),
  });
  if (blocked) return 0;
  amount = applyPreventShields(room, query.targetId, amount, false);
  const event = proposalEvent({
    type: "deal_damage",
    cardId: query.targetId,
    amount,
    ...(query.sourceObjectId ? { objectId: query.sourceObjectId } : {}),
    ...(query.combat ? { data: { combat: true } } : {}),
  });
  for (const source of replacementSources(room, host)) {
    const replace = source.replace as { prevent?: unknown };
    if (!replace || typeof replace !== "object" || !("prevent" in replace) || "op" in replace) continue;
    const types = Array.isArray(source.matches.type) ? source.matches.type : [source.matches.type];
    const matcher = { ...source.matches, type: types.map((type) => (type === "deal_damage" ? "damage" : type)) };
    if (!eventMatches(room, host, matcher, event, { controller: source.controller, ...(source.sourceObjectId ? { sourceObjectId: source.sourceObjectId } : {}) })) {
      continue;
    }
    amount = Math.max(0, amount - (typeof replace.prevent === "number" ? replace.prevent : 0));
  }
  return amount;
}
