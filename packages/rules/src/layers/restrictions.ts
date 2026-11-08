/**
 * Restrictions ("can't …") — rules 475–479 (restriction layer), 467.2.c.10.
 *
 * Owner: R2-effects. Consumers: R2-play (play/activate/move/targets) and R2-combat
 * (467.2.c.10 “can't be dealt damage”).
 * Semantics: returns the active restriction for the query, or `null` when the action is allowed.
 *
 * Signature is a cross-agent contract: keep it stable.
 */
import type { Room, RuleRef } from "@rift/protocol";
import type { RulesHost } from "../host";

export type RestrictionKind =
  | "play"
  | "activate"
  | "move"
  | "be-targeted"
  | "be-dealt-damage"
  | "attack"
  | "defend"
  | "ready"
  | "score";

export interface RestrictionQuery {
  kind: RestrictionKind;
  playerId?: string;
  objectId?: string;
  cardId?: string;
  sourceObjectId?: string;
  to?: string;
}

export function restrictionFor(
  room: Room,
  host: RulesHost,
  query: RestrictionQuery,
): { rule?: RuleRef; sourceObjectId?: string; note?: string } | null {
  // Stub (R2-effects): no restriction effects are evaluated yet.
  void room;
  void host;
  void query;
  return null;
}
