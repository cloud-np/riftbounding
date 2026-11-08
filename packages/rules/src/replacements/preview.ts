/**
 * Damage preview — rules 467.2.c.4, 467.2.c.4.a, 467.2.c.5.
 *
 * Owner: R2-effects. Consumer: R2-combat (lethal values for damage assignment).
 * Semantics: the damage `amount` would become after passive and replacement effects. Pure:
 * no state change.
 *
 * Signature is a cross-agent contract: keep it stable.
 */
import type { Room } from "@rift/protocol";
import type { RulesHost } from "../host";

export function previewDamage(
  room: Room,
  host: RulesHost,
  query: { targetId: string; amount: number; sourceObjectId?: string; combat?: boolean },
): number {
  // Stub (R2-effects): no passive/replacement modifiers are applied yet.
  void room;
  void host;
  return query.amount;
}
