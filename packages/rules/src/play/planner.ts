/**
 * Resource payment planner — rules 163–167, 357.1, 357.1.a, 411.2.
 *
 * Pure: given a player's sources (Rune Pool + Basic Runes) and the Energy/Power part of a total
 * cost, find a plan or explain why none exists. The plan is canonical (deterministic) so
 * `legalIntents`, `explainIllegal` and the write path always agree:
 *
 * 1. Energy comes from the Rune Pool first; the rest from exhausting ready runes (164.2.a).
 *    Any ready rune yields the same [1], so the choice among them is not a real choice (411.2).
 * 2. Power is matched slot by slot, most restrictive requirement first, preferring
 *    pool Power of a specific Domain, then pool [A], then recycling an already exhausted rune,
 *    then recycling a ready rune (164.2.b). A ready rune that is recycled is exhausted for
 *    Energy first when Energy is still owed, so one rune yields both its abilities.
 *
 * An explicit plan (`PaymentPlanWire` resource fields) is validated instead: it must pay the
 * Energy and Power exactly with sources the player actually has.
 */
import type { PaymentPlanWire } from "@rift/protocol";
import type { RulesFailure } from "../types";
import { fail } from "../types";
import { POWER_DOMAINS, type PowerDomain, type PowerRequirement, type ResolvedCost, totalPower } from "./cost-model";
import type { PaymentSources, RuneSource } from "./sources";

export interface ResourcePlan {
  poolEnergy: number;
  poolPower: Partial<Record<PowerDomain | "any", number>>;
  exhaustRunes: string[];
  recycleRunes: string[];
}

export type ResourcePlanResult = { ok: true; plan: ResourcePlan } | RulesFailure;

type Slot = PowerRequirement["domains"];

interface UnitType {
  /** pool:<domain>, pool:any, rune-x:<domain>, rune-r:<domain> */
  key: string;
  source: "pool" | "rune";
  domain: PowerDomain | "any";
  count: number;
  runeIds: string[];
}

function fits(domain: PowerDomain | "any", slot: Slot): boolean {
  return domain === "any" || slot === "any" || slot.includes(domain);
}

function expandSlots(requirements: readonly PowerRequirement[]): Slot[] {
  const slots: Slot[] = [];
  for (const requirement of requirements) {
    for (let i = 0; i < requirement.count; i += 1) slots.push(requirement.domains);
  }
  const weight = (slot: Slot) => (slot === "any" ? POWER_DOMAINS.length + 1 : slot.length);
  return slots
    .map((slot, index) => ({ slot, index }))
    .sort((a, b) => weight(a.slot) - weight(b.slot) || a.index - b.index)
    .map(({ slot }) => slot);
}

/** Rank-ordered unit types available for Power (the canonical preference order). */
function unitTypes(sources: PaymentSources, reservedReady: ReadonlySet<string> = new Set()): UnitType[] {
  const types: UnitType[] = [];
  for (const domain of POWER_DOMAINS) {
    const count = sources.pool.power[domain] ?? 0;
    if (count > 0) types.push({ key: `pool:${domain}`, source: "pool", domain, count, runeIds: [] });
  }
  const any = sources.pool.power.any ?? 0;
  if (any > 0) types.push({ key: "pool:any", source: "pool", domain: "any", count: any, runeIds: [] });
  // Domains with more runes first keeps scarce Domains on the board (deterministic tie-break).
  const byDomain = (exhausted: boolean) => {
    const groups = new Map<PowerDomain, RuneSource[]>();
    for (const rune of sources.runes) {
      if (!rune.domain || rune.exhausted !== exhausted || reservedReady.has(rune.id)) continue;
      const list = groups.get(rune.domain) ?? [];
      list.push(rune);
      groups.set(rune.domain, list);
    }
    return [...groups.entries()].sort(
      (a, b) => b[1].length - a[1].length || POWER_DOMAINS.indexOf(a[0]) - POWER_DOMAINS.indexOf(b[0]),
    );
  };
  for (const [domain, runes] of byDomain(true)) {
    types.push({ key: `rune-x:${domain}`, source: "rune", domain, count: runes.length, runeIds: runes.map((r) => r.id) });
  }
  for (const [domain, runes] of byDomain(false)) {
    types.push({ key: `rune-r:${domain}`, source: "rune", domain, count: runes.length, runeIds: runes.map((r) => r.id) });
  }
  return types;
}

/** Backtracking slot matching over unit types; returns the type index chosen per slot. */
function matchSlots(slots: readonly Slot[], types: readonly UnitType[]): number[] | null {
  const counts = types.map((type) => type.count);
  const chosen: number[] = [];
  const failed = new Set<string>();
  const search = (index: number): boolean => {
    if (index >= slots.length) return true;
    const memo = `${index}|${counts.join(",")}`;
    if (failed.has(memo)) return false;
    const slot = slots[index]!;
    for (let t = 0; t < types.length; t += 1) {
      if ((counts[t] ?? 0) <= 0 || !fits(types[t]!.domain, slot)) continue;
      counts[t] = (counts[t] ?? 0) - 1;
      chosen.push(t);
      if (search(index + 1)) return true;
      chosen.pop();
      counts[t] = (counts[t] ?? 0) + 1;
    }
    failed.add(memo);
    return false;
  };
  return search(0) ? chosen : null;
}

function describePower(requirements: readonly PowerRequirement[]): string {
  return requirements
    .map((r) => `${r.count}x${r.domains === "any" ? "any" : r.domains.join("/")}`)
    .join(", ");
}

/** 357.1: the canonical plan for the Energy/Power part of `cost`, or why it cannot be paid. */
export function planResources(sources: PaymentSources, cost: Pick<ResolvedCost, "energy" | "power">): ResourcePlanResult {
  const slots = expandSlots(cost.power);
  const types = unitTypes(sources);
  const chosen = matchSlots(slots, types);
  if (!chosen) {
    return fail("insufficient_resources", "357.1", `cannot pay Power ${describePower(cost.power)}`);
  }
  const poolPower: ResourcePlan["poolPower"] = {};
  const recycleRunes: string[] = [];
  const taken = types.map(() => 0);
  for (const t of chosen) {
    const type = types[t]!;
    if (type.source === "pool") {
      poolPower[type.domain] = (poolPower[type.domain] ?? 0) + 1;
    } else {
      const id = type.runeIds[taken[t] ?? 0];
      if (id) recycleRunes.push(id);
    }
    taken[t] = (taken[t] ?? 0) + 1;
  }
  const poolEnergy = Math.min(sources.pool.energy, cost.energy);
  const owed = cost.energy - poolEnergy;
  const ready = sources.runes.filter((rune) => !rune.exhausted);
  const recycledReady = ready.filter((rune) => recycleRunes.includes(rune.id));
  const otherReady = ready.filter((rune) => !recycleRunes.includes(rune.id));
  const exhaustOrder = [...recycledReady, ...otherReady];
  if (exhaustOrder.length < owed) {
    return fail(
      "insufficient_resources",
      "357.1",
      `cannot pay ${cost.energy} Energy (${sources.pool.energy} in pool, ${ready.length} ready runes)`,
    );
  }
  const exhaustRunes = exhaustOrder.slice(0, owed).map((rune) => rune.id);
  // A rune exhausted for Energy then recycled must be recycled after it was exhausted.
  return { ok: true, plan: { poolEnergy, poolPower, exhaustRunes, recycleRunes } };
}

export function hasResourceFields(plan: PaymentPlanWire | undefined): boolean {
  return (
    !!plan &&
    (plan.poolEnergy !== undefined ||
      plan.poolPower !== undefined ||
      plan.exhaustRunes !== undefined ||
      plan.recycleRunes !== undefined)
  );
}

function distinct(ids: readonly string[]): boolean {
  return new Set(ids).size === ids.length;
}

/** 357.1: validate an explicit resource plan against the sources and the exact cost. */
export function validateResources(
  sources: PaymentSources,
  cost: Pick<ResolvedCost, "energy" | "power">,
  wire: PaymentPlanWire,
): ResourcePlanResult {
  const plan: ResourcePlan = {
    poolEnergy: Math.max(0, Math.trunc(wire.poolEnergy ?? 0)),
    poolPower: {},
    exhaustRunes: [...(wire.exhaustRunes ?? [])],
    recycleRunes: [...(wire.recycleRunes ?? [])],
  };
  if (plan.poolEnergy > sources.pool.energy) {
    return fail("invalid_payment", "166", `pool has ${sources.pool.energy} Energy`);
  }
  for (const [key, raw] of Object.entries(wire.poolPower ?? {})) {
    const value = Math.max(0, Math.trunc(raw ?? 0));
    if (value === 0) continue;
    const domain = key as PowerDomain | "any";
    if (key !== "any" && !POWER_DOMAINS.includes(key as PowerDomain)) {
      return fail("invalid_payment", "163.2.a", `unknown Domain ${key}`);
    }
    if (value > (sources.pool.power[domain] ?? 0)) {
      return fail("invalid_payment", "166", `pool has ${sources.pool.power[domain] ?? 0} ${key} Power`);
    }
    plan.poolPower[domain] = value;
  }
  if (!distinct(plan.exhaustRunes) || !distinct(plan.recycleRunes)) {
    return fail("invalid_payment", "164.2", "a rune ability is used twice");
  }
  const runes = new Map(sources.runes.map((rune) => [rune.id, rune]));
  for (const id of plan.exhaustRunes) {
    const rune = runes.get(id);
    if (!rune) return fail("invalid_payment", "164.2.a", `${id} is not a rune you control`);
    // 415.4: an exhausted rune cannot be exhausted again to pay a cost.
    if (rune.exhausted) return fail("invalid_payment", "415.4", `${id} is already exhausted`);
  }
  for (const id of plan.recycleRunes) {
    const rune = runes.get(id);
    if (!rune?.domain) return fail("invalid_payment", "164.2.b", `${id} is not a rune you control`);
  }
  const energy = plan.poolEnergy + plan.exhaustRunes.length;
  if (energy !== cost.energy) {
    return fail("invalid_payment", "357.1", `plan pays ${energy} Energy, cost is ${cost.energy}`);
  }
  const units: UnitType[] = [];
  for (const [key, count] of Object.entries(plan.poolPower)) {
    units.push({ key: `pool:${key}`, source: "pool", domain: key as PowerDomain | "any", count: count ?? 0, runeIds: [] });
  }
  for (const id of plan.recycleRunes) {
    const domain = runes.get(id)!.domain!;
    units.push({ key: `rune:${id}`, source: "rune", domain, count: 1, runeIds: [id] });
  }
  const provided = units.reduce((sum, unit) => sum + unit.count, 0);
  if (provided !== totalPower(cost)) {
    return fail("invalid_payment", "357.1", `plan pays ${provided} Power, cost is ${totalPower(cost)}`);
  }
  if (!matchSlots(expandSlots(cost.power), units)) {
    return fail("invalid_payment", "163.2", `plan Power does not match ${describePower(cost.power)}`);
  }
  return { ok: true, plan };
}

/** The plan for `cost`: explicit when the wire plan names resources, canonical otherwise. */
export function resourcePlanFor(
  sources: PaymentSources,
  cost: Pick<ResolvedCost, "energy" | "power">,
  wire?: PaymentPlanWire,
): ResourcePlanResult {
  if (wire && hasResourceFields(wire)) return validateResources(sources, cost, wire);
  return planResources(sources, cost);
}
