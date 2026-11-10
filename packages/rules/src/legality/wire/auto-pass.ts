/** `rules_set_auto_pass` payload shape — auto-pass preferences (`docs/rules/auto-pass.md`). */
import type { RulesFailure } from "../../types";
import { fail } from "../../types";
import { isRecord, type WireValidator } from "./shared";

const RULE = "contract:auto-pass";
const RESPONSE_MODES = ["stop", "safe", "no_response"];
const RESOLVE_MODES = ["off", "safe", "all"];
const END_TURN_MODES = ["manual", "safe", "no_action"];
const UNTIL_KINDS = ["end_of_turn", "opponent_action"];
const KNOWN_FIELDS = new Set([
  "ownItems",
  "responses",
  "forcedPrompts",
  "endTurn",
  "hold",
  "passUntil",
  "clearStanding",
]);

export const validateSetAutoPassIntent: WireValidator = (value): RulesFailure | null => {
  const prefs = value.prefs;
  if (!isRecord(prefs)) return fail("illegal_action", RULE, "prefs must be an object");
  for (const key of Object.keys(prefs)) {
    if (!KNOWN_FIELDS.has(key)) return fail("illegal_action", RULE, `unknown preference ${key}`);
  }
  for (const field of ["ownItems", "hold", "clearStanding"] as const) {
    if (prefs[field] !== undefined && typeof prefs[field] !== "boolean") {
      return fail("illegal_action", RULE, `${field} must be a boolean`);
    }
  }
  if (prefs.responses !== undefined && !RESPONSE_MODES.includes(prefs.responses as string)) {
    return fail("illegal_action", RULE, `responses must be one of ${RESPONSE_MODES.join(", ")}`);
  }
  if (prefs.forcedPrompts !== undefined && !RESOLVE_MODES.includes(prefs.forcedPrompts as string)) {
    return fail("illegal_action", RULE, `forcedPrompts must be one of ${RESOLVE_MODES.join(", ")}`);
  }
  if (prefs.endTurn !== undefined && !END_TURN_MODES.includes(prefs.endTurn as string)) {
    return fail("illegal_action", RULE, `endTurn must be one of ${END_TURN_MODES.join(", ")}`);
  }
  const until = prefs.passUntil;
  if (until !== undefined && until !== null) {
    if (!isRecord(until) || !UNTIL_KINDS.includes(until.kind as string)) {
      return fail("illegal_action", RULE, `passUntil.kind must be one of ${UNTIL_KINDS.join(", ")}`);
    }
    if (until.turn !== undefined && (typeof until.turn !== "number" || !Number.isInteger(until.turn))) {
      return fail("illegal_action", RULE, "passUntil.turn must be an integer");
    }
  }
  return null;
};
