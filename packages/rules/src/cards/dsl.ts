/**
 * Small builders for card scripts (§6.1/§6.2). Pure data helpers — no registration here.
 */
import type { Ability, Condition, Selector, TokenSpec, Trigger, ZoneSelector } from "@rift/protocol";

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

/**
 * "When you defend here" (battlefield, 383.4.f): the player gains the Defender designation
 * (R2-combat's player-level `defend` event, 466.2.c.3).
 */
export const WHEN_YOU_DEFEND_HERE: Trigger = {
  kind: "event",
  event: { type: "defend", zone: HERE, player: "self", data: { player: true } },
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

/** R3 — 832.1.c.1: "if you showed off" (linked to the card's [Show Off]). */
export const SHOWED_OFF: Condition = custom("showed-off");

/**
 * R3 — "[Show Off] [Object]" (832): a passive the play layer turns into the `showOff` play-time
 * choice. `selector` filters the hand/board candidates (zone and controller are set for you);
 * `count` > 1 for sets ("five units …").
 */
export function showOff(selector: Selector, count?: number): Extract<Ability, { kind: "passive" }> {
  return {
    kind: "passive",
    modifier: { kind: "custom", id: "show-off", params: { selector: selector as never, ...(count ? { count } : {}) } },
  };
}
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
