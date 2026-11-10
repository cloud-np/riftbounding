/**
 * Wire-shape validation for every `rules_*` intent (design contract §3/§5).
 *
 * `applyRulesIntent` runs this before touching any state, so a malformed realtime payload is a
 * Verdict (`illegal_action`/`invalid_choice`/`unknown_intent`) and never a thrown TypeError.
 *
 * This file is the **stable dispatcher**: it keeps the shared checks (object shape, known intent
 * type, `hold` boolean) and delegates every payload check to the matching validator in
 * `./wire/{play,activate,move,pass,end-turn,choose,manual,concede}.ts`. R2 agents only touch their own
 * wire file; the dispatcher and its exported `validateRulesIntent` signature stay frozen.
 */
import type { RulesIntent } from "@rift/protocol";
import type { RulesFailure } from "../types";
import { fail } from "../types";
import { validateActivateIntent } from "./wire/activate";
import { validateChooseIntent } from "./wire/choose";
import { validateConcedeIntent } from "./wire/concede";
import { validateEndTurnIntent } from "./wire/end-turn";
import { validateManualIntent } from "./wire/manual";
import { validateMoveIntent } from "./wire/move";
import { validatePassIntent } from "./wire/pass";
import { validatePlayIntent } from "./wire/play";
import { validateSetAutoPassIntent } from "./wire/auto-pass";
import {
  CONTRACT_3,
  CONTRACT_5,
  INTENT_TYPES,
  isRecord,
  shapeRule,
  type IntentType,
  type WireValidator,
} from "./wire/shared";

/** One payload validator per intent type; exposed for tests and wire-coverage tooling. */
export const WIRE_VALIDATORS: Record<IntentType, WireValidator> = {
  rules_play: validatePlayIntent,
  rules_activate: validateActivateIntent,
  rules_move: validateMoveIntent,
  rules_pass: validatePassIntent,
  rules_end_turn: validateEndTurnIntent,
  rules_choose: validateChooseIntent,
  rules_manual_done: validateManualIntent,
  rules_concede: validateConcedeIntent,
  rules_set_auto_pass: validateSetAutoPassIntent,
};

/**
 * Validate the JSON wire shape. Returns the narrowed intent on success, or a Verdict carrying a
 * ReasonCode and rule ref on failure. Never throws for any JSON value.
 */
export function validateRulesIntent(value: unknown): { ok: true; intent: RulesIntent } | RulesFailure {
  if (!isRecord(value)) return fail("illegal_action", CONTRACT_3, "intent must be an object");
  const type = value.type;
  if (typeof type !== "string") return fail("illegal_action", CONTRACT_3, "intent type must be a string");
  if (!(INTENT_TYPES as readonly string[]).includes(type)) {
    return fail("unknown_intent", CONTRACT_5, type);
  }
  const intentType = type as IntentType;
  if (value.hold !== undefined && typeof value.hold !== "boolean") {
    return fail("illegal_action", shapeRule(intentType), "hold must be a boolean");
  }

  const payloadFailure = WIRE_VALIDATORS[intentType](value);
  if (payloadFailure) return payloadFailure;

  return { ok: true, intent: value as unknown as RulesIntent };
}
