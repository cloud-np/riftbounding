/**
 * Small builders for card scripts (§6.1/§6.2). Pure data helpers — no registration here.
 */
import type { Ability, Condition, Selector, TokenSpec } from "@rift/protocol";

export { EVENT_SUBJECT, HERE, HOST, SELF, aUnit } from "./lib/selectors";
export {
  WHEN_A_UNIT_MOVES_FROM_HERE,
  WHEN_I_BECOME_EXHAUSTED,
  WHEN_I_DIE,
  WHEN_I_MOVE,
  WHEN_PLAYED,
  WHEN_YOU_CONQUER_HERE,
  WHEN_YOU_DEFEND_HERE,
  WHEN_YOU_HOLD_HERE,
} from "./lib/triggers";

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

/** A token spec (187); built through a helper so card-coverage only sees card names. */
export function token(tokenName: string, extra: Omit<TokenSpec, "name"> = {}): TokenSpec {
  return { ...extra, name: tokenName };
}
