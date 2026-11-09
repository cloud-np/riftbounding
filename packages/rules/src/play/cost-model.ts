/**
 * Normalized costs — rules 131, 135.2.e.4–6, 163–164, 201–206, 356.
 *
 * Every cost the play layer handles (a card's printed cost, an activated ability's `Cost`, an
 * additional cost, a cost within instructions paid through `payCost`) is first turned into a
 * `ResolvedCost`: plain numbers plus Power requirements that list which Domains may pay them.
 * The 356 total-cost arithmetic and the 357 payment planner only ever see this shape.
 *
 * Pure: nothing here reads or mutates a room.
 */
import type { Amount, ChoiceRecord, Cost, RuleRef, Selector } from "@rift/protocol";
import type { CardInfo } from "../host";

/** The six Domains that Power can have (134.1); "Unknown" is never a payable Domain. */
export const POWER_DOMAINS = ["Fury", "Calm", "Mind", "Body", "Chaos", "Order"] as const;
export type PowerDomain = (typeof POWER_DOMAINS)[number];

/** One Power slot group: `count` Power, each of one of `domains` (or any Domain, 135.2.e.5.a). */
export interface PowerRequirement {
  domains: PowerDomain[] | "any";
  count: number;
}

/** A non-standard object cost (357.2): exhaust or kill `count` objects matching `selector`. */
export interface ObjectCostRequirement {
  kind: "exhaust" | "kill";
  selector: Selector;
  count: number;
  /** "self" when the cost names the source itself ([E], "Kill this"). */
  self?: boolean;
}

export interface ResolvedCost {
  energy: number;
  power: PowerRequirement[];
  objects: ObjectCostRequirement[];
  discard: number;
  payPoints: number;
  spendXp: number;
  /** "Recycle this" (164.2.b): the source rune is recycled as the cost. */
  recycleSelf?: boolean;
  /** Cost parts the engine cannot pay automatically (always unpayable, 203.3). */
  unsupported: string[];
}

export function emptyCost(): ResolvedCost {
  return { energy: 0, power: [], objects: [], discard: 0, payPoints: 0, spendXp: 0, unsupported: [] };
}

export function normalizeDomain(value: unknown): PowerDomain | null {
  if (typeof value !== "string") return null;
  const lower = value.trim().toLowerCase();
  return POWER_DOMAINS.find((domain) => domain.toLowerCase() === lower) ?? null;
}

/** 134.1: the payable Domains of a card (unknown/neutral entries dropped, de-duplicated). */
export function cardDomains(info: Pick<CardInfo, "domains" | "name"> | null | undefined): PowerDomain[] {
  const out: PowerDomain[] = [];
  for (const raw of info?.domains ?? []) {
    const domain = normalizeDomain(raw);
    if (domain && !out.includes(domain)) out.push(domain);
  }
  if (out.length === 0 && info?.name) {
    // Basic Runes are named after their Domain (164.1) even when the catalog omits it.
    const match = /^(\w+)\s+rune$/i.exec(info.name.trim());
    const domain = normalizeDomain(match?.[1]);
    if (domain) out.push(domain);
  }
  return out;
}

/**
 * 135.2.e.6: [C] is one Power of the card's own Domain; a card with several Domains accepts any
 * of them (135.2.e.6.c) and a card with none processes [C] as [A] (135.2.e.6.b).
 */
export function selfPower(domains: readonly PowerDomain[], count: number): PowerRequirement {
  return { domains: domains.length > 0 ? [...domains] : "any", count };
}

/**
 * 131 / 204.1.a: a Main Deck card's printed Base Cost. The catalog lists the Power cost as a
 * count; each symbol is treated as [C] of the card's Domains.
 * RULES-QUESTION(131.3.a): mixed-symbol costs (e.g. one [R] and one [P] on a Fury/Chaos card) are
 * not distinguishable in the catalog data; they are processed as [C][C].
 */
export function printedCardCost(info: CardInfo | null): ResolvedCost {
  const cost = emptyCost();
  cost.energy = nonNegative(info?.energyCost);
  const power = nonNegative(info?.powerCost);
  if (power > 0) cost.power.push(selfPower(cardDomains(info), power));
  return cost;
}

function nonNegative(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

export interface AmountContext {
  choices?: ChoiceRecord;
  points?: number;
  cardsInHand?: number;
}

/**
 * Minimal `Amount` evaluation for costs: literals, `fixed`, `x` (the X bound in step 2, 355) and
 * the arithmetic combinators. Anything that needs the effect interpreter returns `null`.
 * TODO(R2-play): delegate to the R2-effects amount evaluator once it is exported.
 */
export function evalCostAmount(amount: Amount | undefined, context: AmountContext = {}): number | null {
  if (amount === undefined) return 0;
  if (typeof amount === "number") return nonNegative(amount);
  switch (amount.kind) {
    case "fixed":
      return nonNegative(amount.value);
    case "x": {
      const x = context.choices?.x;
      return typeof x === "number" ? nonNegative(x) : null;
    }
    case "points":
      return context.points ?? null;
    case "cards-in-hand":
      return context.cardsInHand ?? null;
    case "sum": {
      let total = 0;
      for (const part of amount.amounts) {
        const value = evalCostAmount(part, context);
        if (value === null) return null;
        total += value;
      }
      return total;
    }
    case "min": {
      const values = amount.amounts.map((part) => evalCostAmount(part, context));
      if (values.some((value) => value === null)) return null;
      let result = Math.min(...(values as number[]));
      if (amount.cap !== undefined) {
        const cap = evalCostAmount(amount.cap, context);
        if (cap === null) return null;
        result = Math.min(result, cap);
      }
      return result;
    }
    case "max": {
      const values = amount.amounts.map((part) => evalCostAmount(part, context));
      if (values.some((value) => value === null)) return null;
      return Math.max(...(values as number[]));
    }
    default:
      return null;
  }
}

/** `Selector` convention for costs that name the source itself ([E], "Kill this"). */
export function isSelfSelector(selector: Selector | undefined): boolean {
  return !!selector && (selector.targetRef === "self" || selector.targetRef === "source");
}

/**
 * Supported `Cost.additional` keys (non-standard costs the protocol `Cost` has no field for):
 *
 * | key | value | meaning |
 * |---|---|---|
 * | `power:self` | number | N × [C] of the source card's Domains (135.2.e.6) |
 * | `recycle:self` | true | "Recycle this" (164.2.b) |
 *
 * Any other key is unsupported and makes the cost unpayable (203.3) rather than free.
 */
export const ADDITIONAL_COST_KEYS = ["power:self", "recycle:self"] as const;

/**
 * Turn a protocol `Cost` into a `ResolvedCost`. `domains` are the source card's Domains (for
 * `power:self`); `context` provides X for `{ kind: "x" }` amounts.
 */
export function resolveCost(
  cost: Cost | undefined,
  domains: readonly PowerDomain[],
  context: AmountContext = {},
): ResolvedCost {
  const out = emptyCost();
  if (!cost) return out;
  const energy = evalCostAmount(cost.energy, context);
  if (energy === null) out.unsupported.push("energy");
  else out.energy = energy;
  for (const [key, raw] of Object.entries(cost.power ?? {})) {
    const count = nonNegative(raw);
    if (count === 0) continue;
    if (key === "any") {
      out.power.push({ domains: "any", count });
      continue;
    }
    const domain = normalizeDomain(key);
    if (!domain) {
      out.unsupported.push(`power:${key}`);
      continue;
    }
    out.power.push({ domains: [domain], count });
  }
  if (cost.exhaust) {
    const count = evalCostAmount(cost.exhaust.count ?? 1, context);
    if (count === null) out.unsupported.push("exhaust");
    else if (count > 0) {
      out.objects.push({
        kind: "exhaust",
        selector: cost.exhaust,
        count,
        ...(isSelfSelector(cost.exhaust) ? { self: true } : {}),
      });
    }
  }
  if (cost.kill) {
    const count = evalCostAmount(cost.kill.count ?? 1, context);
    if (count === null) out.unsupported.push("kill");
    else if (count > 0) {
      out.objects.push({
        kind: "kill",
        selector: cost.kill,
        count,
        ...(isSelfSelector(cost.kill) ? { self: true } : {}),
      });
    }
  }
  for (const [field, target] of [
    ["discard", "discard"],
    ["payPoints", "payPoints"],
    ["spendXp", "spendXp"],
  ] as const) {
    const value = evalCostAmount(cost[field], context);
    if (value === null) out.unsupported.push(field);
    else out[target] = value;
  }
  for (const [key, value] of Object.entries(cost.additional ?? {})) {
    if (key === "power:self") {
      const count = nonNegative(value);
      if (count > 0) out.power.push(selfPower(domains, count));
    } else if (key === "recycle:self") {
      if (value === true) out.recycleSelf = true;
    } else {
      out.unsupported.push(`additional:${key}`);
    }
  }
  return out;
}

/** 356.2: add an additional cost to a running total (component lists are concatenated). */
export function addCosts(a: ResolvedCost, b: ResolvedCost): ResolvedCost {
  return {
    energy: a.energy + b.energy,
    power: mergePower([...a.power, ...b.power]),
    objects: [...a.objects, ...b.objects],
    discard: a.discard + b.discard,
    payPoints: a.payPoints + b.payPoints,
    spendXp: a.spendXp + b.spendXp,
    ...(a.recycleSelf || b.recycleSelf ? { recycleSelf: true } : {}),
    unsupported: [...a.unsupported, ...b.unsupported],
  };
}

function sameDomains(a: PowerRequirement["domains"], b: PowerRequirement["domains"]): boolean {
  if (a === "any" || b === "any") return a === b;
  if (a.length !== b.length) return false;
  return a.every((domain) => b.includes(domain));
}

/** Combine requirements that accept exactly the same Domains (display/planning only). */
export function mergePower(requirements: readonly PowerRequirement[]): PowerRequirement[] {
  const out: PowerRequirement[] = [];
  for (const requirement of requirements) {
    if (requirement.count <= 0) continue;
    const existing = out.find((entry) => sameDomains(entry.domains, requirement.domains));
    if (existing) existing.count += requirement.count;
    else out.push({ domains: requirement.domains === "any" ? "any" : [...requirement.domains], count: requirement.count });
  }
  return out;
}

export function totalPower(cost: Pick<ResolvedCost, "power">): number {
  return cost.power.reduce((sum, requirement) => sum + requirement.count, 0);
}

/** 356.1.b: set the base Energy and/or Power cost to zero. */
export function ignoreCost(cost: ResolvedCost, which: "all" | "energy" | "power"): ResolvedCost {
  return {
    ...cost,
    energy: which === "power" ? cost.energy : 0,
    power: which === "energy" ? cost.power : [],
  };
}

export function isFreeCost(cost: ResolvedCost): boolean {
  return (
    cost.energy === 0 &&
    totalPower(cost) === 0 &&
    cost.objects.length === 0 &&
    cost.discard === 0 &&
    cost.payPoints === 0 &&
    cost.spendXp === 0 &&
    !cost.recycleSelf &&
    cost.unsupported.length === 0
  );
}

/** Restrictiveness order: single-Domain requirements first, [A] last. */
function restrictiveness(requirement: PowerRequirement): number {
  return requirement.domains === "any" ? POWER_DOMAINS.length + 1 : requirement.domains.length;
}

/**
 * 356.3/356.4/356.6: apply cost increases, then discounts, never below 0. `energy`/`power` deltas
 * follow `CostAdjustment` (negative = discount). A Domain discount reduces a requirement that
 * accepts that Domain; an [A] discount reduces any requirement. Discounts are applied to the most
 * restrictive requirement first (the player's best choice for affordability).
 * RULES-QUESTION(356.4.c): `CostAdjustment` does not say which cost component a discount belongs
 * to, so every discount is applied to the total (356.4.d).
 */
export function applyCostDeltas(
  cost: ResolvedCost,
  deltas: ReadonlyArray<{ energy?: number; power?: Partial<Record<string, number>> }>,
): ResolvedCost {
  let energy = cost.energy;
  const power = cost.power.map((requirement) => ({
    domains: requirement.domains === "any" ? ("any" as const) : [...requirement.domains],
    count: requirement.count,
  }));
  // 356.3 increases first.
  for (const delta of deltas) {
    if ((delta.energy ?? 0) > 0) energy += Math.trunc(delta.energy ?? 0);
    for (const [key, raw] of Object.entries(delta.power ?? {})) {
      const value = Math.trunc(raw ?? 0);
      if (value <= 0) continue;
      if (key === "any") power.push({ domains: "any", count: value });
      else {
        const domain = normalizeDomain(key);
        if (domain) power.push({ domains: [domain], count: value });
      }
    }
  }
  // 356.4 discounts.
  for (const delta of deltas) {
    if ((delta.energy ?? 0) < 0) energy += Math.trunc(delta.energy ?? 0);
    for (const [key, raw] of Object.entries(delta.power ?? {})) {
      let remaining = -Math.trunc(raw ?? 0);
      if (remaining <= 0) continue;
      const domain = key === "any" ? null : normalizeDomain(key);
      if (key !== "any" && !domain) continue;
      const order = power
        .map((requirement, index) => ({ requirement, index }))
        .filter(({ requirement }) =>
          domain === null
            ? true
            : requirement.domains === "any" || requirement.domains.includes(domain),
        )
        .sort((a, b) => restrictiveness(a.requirement) - restrictiveness(b.requirement) || a.index - b.index);
      for (const { requirement } of order) {
        if (remaining <= 0) break;
        const used = Math.min(requirement.count, remaining);
        requirement.count -= used;
        remaining -= used;
      }
    }
  }
  // 356.6: Energy and Power costs can't be reduced below 0.
  return { ...cost, energy: Math.max(0, energy), power: mergePower(power.filter((entry) => entry.count > 0)) };
}

/** Short summary for chain items / legalIntents. */
export function costSummary(cost: ResolvedCost): { energy: number; power: number } {
  return { energy: cost.energy, power: totalPower(cost) };
}

export interface CostDescription {
  rule: RuleRef;
  cost: ResolvedCost;
}
