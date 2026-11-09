/**
 * Small builders for card scripts (§6.1/§6.2). Pure data helpers — no registration here.
 */
import type { Condition, Selector, TokenSpec, Trigger, ZoneSelector } from "@rift/protocol";

export const SELF: Selector = { targetRef: "self" };
export const EVENT_SUBJECT: Selector = { targetRef: "event" };
export const HERE: ZoneSelector = { kind: "chosen", ref: "here" };

/** "When I move" (421, 447–455). */
export const WHEN_I_MOVE: Trigger = { kind: "event", event: { type: "move", subject: SELF } };

/** "When you play me / this" — a Play Effect (383.4.a). */
export const WHEN_PLAYED: Trigger = {
  kind: "event",
  event: { type: ["unit_played", "gear_played"], subject: SELF },
};

/** "When I die" / [Deathknell] (808.1.c). */
export const WHEN_I_DIE: Trigger = { kind: "event", event: { type: "die", subject: SELF } };

/** "When I become exhausted" (415). */
export const WHEN_I_BECOME_EXHAUSTED: Trigger = { kind: "event", event: { type: "exhaust", subject: SELF } };

/** "When you hold here" (battlefield, 383.4.d.2.b). */
export const WHEN_YOU_HOLD_HERE: Trigger = { kind: "event", event: { type: "hold", zone: HERE, player: "self" } };

/** "When you conquer here" (battlefield, 383.4.c.2.b). */
export const WHEN_YOU_CONQUER_HERE: Trigger = { kind: "event", event: { type: "conquer", zone: HERE, player: "self" } };

/** "When you defend here" (battlefield, 383.4.f). */
export const WHEN_YOU_DEFEND_HERE: Trigger = {
  kind: "event",
  event: { type: "defend_declared", zone: HERE, player: "self" },
};

/** "When a unit moves from here" (battlefield). */
export const WHEN_A_UNIT_MOVES_FROM_HERE: Trigger = {
  kind: "event",
  event: { type: "move", from: HERE, cardType: "unit" },
};

export function custom(id: string, params?: Record<string, unknown>): Condition {
  return { kind: "custom", id, ...(params ? { params } : {}) };
}

export const PAID_ADDITIONAL: Condition = custom("paid-additional");
export const SELF_AT_BATTLEFIELD: Condition = custom("self-at-battlefield");

export function marked(key: string, value: string): Condition {
  return custom("marked", { key, value });
}

export function not(condition: Condition): Condition {
  return { kind: "not", condition };
}

/** A chosen unit with extra filters (355.7 target). */
export function aUnit(extra: Partial<Selector> = {}): Selector {
  return { chosen: true, cardType: "unit", ...extra };
}

/** A token spec (187); built through a helper so card-coverage only sees card names. */
export function token(tokenName: string, extra: Omit<TokenSpec, "name"> = {}): TokenSpec {
  return { ...extra, name: tokenName };
}
