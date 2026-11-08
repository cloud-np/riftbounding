/**
 * Shared wire checks for the R2-play payload extras of `rules_play` / `rules_activate`
 * (`PlayChoiceAliasFields`: plan, optionalCosts, targets, x, modes, baseCost).
 *
 * Shape only (contract §3/F10): every malformed value is a Verdict, never a thrown TypeError.
 * Whether the values are legal is decided by the process of play (355–357).
 */
import type { RulesFailure } from "../../types";
import { fail } from "../../types";
import { isRecord, isStringArray } from "./shared";

const PLAN_ID_LISTS = ["exhaustRunes", "recycleRunes", "exhaust", "discard", "kill"] as const;
const PLAN_KEYS = new Set<string>(["poolEnergy", "poolPower", ...PLAN_ID_LISTS]);

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

/** `PaymentPlanWire` shape (357). */
export function validatePlanShape(value: unknown, rule: string): RulesFailure | null {
  if (value === undefined) return null;
  if (!isRecord(value)) return fail("illegal_action", rule, "plan must be an object");
  for (const key of Object.keys(value)) {
    if (!PLAN_KEYS.has(key)) return fail("illegal_action", rule, `plan.${key} is not a payment field`);
  }
  if (value.poolEnergy !== undefined && !isNonNegativeInteger(value.poolEnergy)) {
    return fail("illegal_action", rule, "plan.poolEnergy must be a non-negative integer");
  }
  if (value.poolPower !== undefined) {
    if (!isRecord(value.poolPower)) return fail("illegal_action", rule, "plan.poolPower must be an object");
    for (const [domain, amount] of Object.entries(value.poolPower)) {
      if (!isNonNegativeInteger(amount)) return fail("illegal_action", rule, `plan.poolPower.${domain} must be a non-negative integer`);
    }
  }
  for (const key of PLAN_ID_LISTS) {
    if (value[key] !== undefined && !isStringArray(value[key])) {
      return fail("illegal_action", rule, `plan.${key} must be an array of strings`);
    }
  }
  return null;
}

/** `PlayChoiceAliasFields` shape. */
export function validateChoiceAliases(value: Record<string, unknown>, rule: string): RulesFailure | null {
  const plan = validatePlanShape(value.plan, "357");
  if (plan) return plan;
  for (const field of ["optionalCosts", "targets", "modes"] as const) {
    if (value[field] !== undefined && !isStringArray(value[field])) {
      return fail("illegal_action", rule, `${field} must be an array of strings`);
    }
  }
  if (value.x !== undefined && !isNonNegativeInteger(value.x)) return fail("illegal_action", rule, "x must be a non-negative integer");
  if (value.baseCost !== undefined && !isNonNegativeInteger(value.baseCost)) {
    return fail("illegal_action", "204.1.b", "baseCost must be a non-negative integer");
  }
  return null;
}
