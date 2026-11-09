/**
 * Shared conditions for card scripts (F2/F5): the typed engine conditions under their printed
 * wording. Prefer these (and the core `Condition` members) over writing a custom condition.
 */
import type { ChoiceValue, Condition, CustomId, Selector } from "@rift/protocol";

/** "If you do" (359.3.f): the previous instruction happened. */
export const DID: Condition = { kind: "did" };

/** 356.4.f.1: "if you paid the additional cost". */
export const PAID_ADDITIONAL: Condition = { kind: "paid-additional" };

/** 832.1.c.1: "if you showed off" (linked to the card's [Show Off]). */
export const SHOWED_OFF: Condition = { kind: "showed-off" };

/** "While I'm at a battlefield". */
export const SELF_AT_BATTLEFIELD: Condition = { kind: "self-state", state: "at-battlefield" };

/** 828.1.b: "[Empowered]" — while the source is Empowered. */
export const SELF_EMPOWERED: Condition = { kind: "self-state", state: "empowered" };

/** 706–711: while the source is Mighty (5+ Might). */
export const SELF_MIGHTY: Condition = { kind: "self-state", state: "mighty" };

/** 702: while the source has a buff. */
export const SELF_BUFFED: Condition = { kind: "self-state", state: "buffed" };

/** 824.1.b.1: "[Level N]" — while you have N or more XP. */
export function xpAtLeast(amount: number): Condition {
  return { kind: "xp-at-least", amount };
}

/** `it` is one of the objects bound to `ref` (default: the looked-at cards). */
export function inRef(ref = "looked"): Condition {
  return { kind: "in-ref", ref };
}

/** A per-turn marker set with the `mark` op exists / equals `value`. */
export function marked(key: string, value?: ChoiceValue): Condition {
  return { kind: "marked", key, ...(value !== undefined ? { value } : {}) };
}

/** At least `amount` objects match `selector`. */
export function countAtLeast(selector: Selector, amount: number): Condition {
  return { kind: "count", selector, comparison: { op: "gte", value: amount } };
}

export function not(condition: Condition): Condition {
  return { kind: "not", condition };
}

export function and(...conditions: Condition[]): Condition {
  return { kind: "and", conditions };
}

export function or(...conditions: Condition[]): Condition {
  return { kind: "or", conditions };
}

/** A registered card-specific condition (`<set>:` or `core:` id). */
export function custom(id: CustomId, params?: Record<string, unknown>): Condition {
  return { kind: "custom", id, ...(params ? { params } : {}) };
}

/** 107: "you control N or more / fewer runes" (runes are in the Rune Area). */
export function runesControlled(op: "lte" | "gte", value: number): Condition {
  return { kind: "count", selector: { cardType: "rune", controller: "self" }, comparison: { op, value } };
}
