/**
 * Normalized play/activation request — the parts of `rules_play` / `rules_activate` the
 * process of play consumes (355 choices, 355.1.a optional costs, 357 payment selection).
 *
 * `choices` is canonical; the convenience aliases are copied in only when the key is unbound
 * (`x` → "x", `modes` → "mode", `targets[i]` → "target:<i>"). Chosen optional additional costs
 * are also recorded as `choices["cost:<id>"] = true` so effects can check "if you paid the
 * additional cost" (135.2.b.7) and Repeat choices (820.2) see the decision.
 */
import type { ChoiceRecord, PaymentPlanWire, PlayChoiceAliasFields } from "@rift/protocol";

export interface PlayRequest {
  choices: ChoiceRecord;
  optionalCosts: string[];
  /**
   * 355.1.a: whether the wire intent carried `optionalCosts` (including an explicit `[]`). When
   * absent, the engine prompts for each affordable optional additional cost instead of assuming
   * a decline.
   */
  optionalCostsDeclared?: boolean;
  plan?: PaymentPlanWire;
  baseCost?: number;
  hold: boolean;
  location?: unknown;
}

export function optionalCostMarker(id: string): string {
  return `cost:${id}`;
}

export function requestFromIntent(
  intent: PlayChoiceAliasFields & { choices?: ChoiceRecord; hold?: boolean; location?: unknown },
): PlayRequest {
  const choices: ChoiceRecord = intent.choices && typeof intent.choices === "object" ? { ...intent.choices } : {};
  if (typeof intent.x === "number" && choices.x === undefined) choices.x = Math.max(0, Math.trunc(intent.x));
  if (Array.isArray(intent.modes) && intent.modes.length > 0 && choices.mode === undefined) {
    choices.mode = intent.modes.length === 1 ? intent.modes[0]! : [...intent.modes];
  }
  if (Array.isArray(intent.targets)) {
    intent.targets.forEach((target, index) => {
      const key = `target:${index}`;
      if (choices[key] === undefined) choices[key] = target;
    });
  }
  const optionalCostsDeclared = intent.optionalCosts !== undefined;
  const optionalCosts = Array.isArray(intent.optionalCosts) ? [...intent.optionalCosts] : [];
  for (const id of optionalCosts) choices[optionalCostMarker(id)] = true;
  return {
    choices,
    optionalCosts,
    optionalCostsDeclared,
    ...(intent.plan ? { plan: intent.plan } : {}),
    ...(typeof intent.baseCost === "number" ? { baseCost: intent.baseCost } : {}),
    hold: intent.hold === true,
    ...(intent.location !== undefined ? { location: intent.location } : {}),
  };
}
