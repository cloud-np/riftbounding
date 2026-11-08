/**
 * Cost adjustments — rules 356, 475–479 (cost layer).
 *
 * Owner: R2-effects. Consumer: R2-play (356 total cost and cost modifiers).
 * Semantics: negative values are discounts, positive values are increases. One entry per
 * applicable modifier; `sourceObjectId`/`rule` identify where it comes from.
 *
 * Signature is a cross-agent contract: keep it stable.
 */
import type { Room, RuleRef, RulesDomain } from "@rift/protocol";
import type { RulesHost } from "../host";

export interface CostAdjustment {
  energy?: number;
  power?: Partial<Record<RulesDomain | "any", number>>;
  sourceObjectId?: string;
  rule?: RuleRef;
  note?: string;
}

export function costAdjustments(
  room: Room,
  host: RulesHost,
  query: { playerId: string; cardId?: string; objectId?: string; abilityRef?: string },
): CostAdjustment[] {
  // Stub (R2-effects): no continuous cost modifiers are computed yet.
  void room;
  void host;
  void query;
  return [];
}
