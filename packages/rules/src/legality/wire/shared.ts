/**
 * Shared wire-shape helpers (design contract §3/§5).
 *
 * Kept separate from `../intent.ts` so the per-intent validators in this directory can import
 * them without a runtime cycle back into the dispatcher.
 */
import type { RulesFailure } from "../../types";
import { fail } from "../../types";

export const CONTRACT_3 = "contract:§3";
export const CONTRACT_5 = "contract:§5";

export const INTENT_TYPES = [
  "rules_play",
  "rules_activate",
  "rules_move",
  "rules_pass",
  "rules_end_turn",
  "rules_choose",
  "rules_manual_done",
  "rules_concede",
  "rules_set_auto_pass",
] as const;

export type IntentType = (typeof INTENT_TYPES)[number];

/** A validator checks payload fields only; shared type/hold checks run in the dispatcher. */
export type WireValidator = (value: Record<string, unknown>) => RulesFailure | null;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

/** Rule ref used for wire-shape failures of a given intent family. */
export function shapeRule(type: IntentType): string {
  switch (type) {
    case "rules_choose":
      return "411.2";
    case "rules_move":
      return "144";
    case "rules_pass":
      return "338.1.b";
    case "rules_end_turn":
      return "316.9";
    case "rules_manual_done":
      return "contract:§6.4";
    case "rules_concede":
      return "650";
    case "rules_set_auto_pass":
      return "contract:auto-pass";
    case "rules_play":
    case "rules_activate":
    default:
      return "349";
  }
}

export function validateChoiceRecord(
  value: unknown,
  field: string,
  type: IntentType,
): RulesFailure | null {
  if (value === undefined) return null;
  if (!isRecord(value)) return fail("illegal_action", shapeRule(type), `${field} must be an object`);
  return null;
}
