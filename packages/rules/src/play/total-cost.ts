/**
 * Determine Total Cost — rules 356.1–356.7, 404.
 *
 * 356.1 base cost modifications ("for [Cost]" replaces, "ignoring" zeroes) → 356.2 additional
 * costs (mandatory always, optional only when chosen in step 2) → 356.3 increases → 356.4
 * discounts → 356.5 total-cost modifications ("any and all costs" → 0) → 356.6 floor at 0.
 * Increases/discounts come from R2-effects' `costAdjustments` (negative = discount).
 */
import type { ChoiceRecord, Room } from "@rift/protocol";
import type { RulesHost } from "../host";
import type { RulesFailure } from "../types";
import { fail } from "../types";
import { costAdjustments } from "../layers/costs";
import type { AdditionalCostSpec } from "./additional-costs";
import {
  addCosts,
  applyCostDeltas,
  emptyCost,
  ignoreCost,
  resolveCost,
  type PowerDomain,
  type ResolvedCost,
} from "./cost-model";
import type { PlayPermission } from "./permissions";

export interface TotalCostInput {
  playerId: string;
  /** The printed / ability Base Cost (after the 204.1.b alternative was chosen). */
  base: ResolvedCost;
  domains: readonly PowerDomain[];
  permission?: Pick<PlayPermission, "cost" | "ignore" | "ignoreAll"> | undefined;
  additional: readonly AdditionalCostSpec[];
  optionalCosts: readonly string[];
  choices: ChoiceRecord;
  /** Query handed to `costAdjustments` (extra fields are additive context for R2-effects). */
  adjustment: { playerId: string; cardId?: string; objectId?: string; abilityRef?: string };
}

export interface TotalCost {
  cost: ResolvedCost;
  /** Additional-cost ids included in the total (mandatory + chosen optional). */
  included: string[];
}

/** 355.1.a: chosen optional additional costs must exist and be optional (no duplicates). */
export function validateOptionalCosts(
  specs: readonly AdditionalCostSpec[],
  chosen: readonly string[],
): RulesFailure | null {
  if (new Set(chosen).size !== chosen.length) return fail("invalid_choice", "820.1.c.3", "an optional cost is chosen twice");
  for (const id of chosen) {
    const spec = specs.find((entry) => entry.id === id);
    if (!spec || !spec.optional) return fail("invalid_choice", "355.1.a", `no optional additional cost ${id}`);
  }
  return null;
}

export function determineTotalCost(room: Room, host: RulesHost, input: TotalCostInput): TotalCost {
  const context = { choices: input.choices };
  // 356.1.a: "for [Cost]" replaces the Base Cost.
  let cost = input.permission?.cost ? resolveCost(input.permission.cost, input.domains, context) : input.base;
  // 356.1.b: ignoring costs sets the appropriate Base Cost(s) to zero.
  if (input.permission?.ignore === "base") cost = ignoreCost(cost, "all");
  else if (input.permission?.ignore === "energy") cost = ignoreCost(cost, "energy");
  else if (input.permission?.ignore === "power") cost = ignoreCost(cost, "power");
  // 356.2: additional costs (356.1.b.3: may raise an ignored cost above zero again).
  const included: string[] = [];
  for (const spec of input.additional) {
    if (spec.optional && !input.optionalCosts.includes(spec.id)) continue;
    cost = addCosts(cost, resolveCost(spec.cost, input.domains, context));
    included.push(spec.id);
  }
  // 356.3 / 356.4 / 356.6 via the cost layer.
  const query = {
    ...input.adjustment,
    optionalCosts: [...input.optionalCosts],
    choices: input.choices,
  };
  cost = applyCostDeltas(cost, costAdjustments(room, host, query));
  // 356.5.a: "ignoring any and all costs" sets the total cost to 0, non-standard costs included.
  if (input.permission?.ignoreAll) cost = emptyCost();
  return { cost, included };
}
