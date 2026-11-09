/**
 * Payment — rules 165–167, 203, 356, 357, 403+.
 *
 * Owner: R2-play. Consumer: R2-effects (the `pay` op and "you may pay …" costs).
 * Semantics: `canPayCost` answers whether `playerId` can pay `cost` now from the Rune Pool plus
 * their Basic Runes' Add abilities (164.2, 357.1.a) and the board/hand for non-standard costs.
 * `payCost` pays with the canonical plan (or `opts.plan`, a `PaymentPlanWire`) and mutates only
 * the given draft; it is atomic (357/358.5): on any failure the draft and the step's events are
 * restored and a Verdict (`insufficient_resources`/`invalid_payment`/`invalid_choice`, rule
 * "357.x"/"203.3") is returned.
 *
 * A non-standard cost with more candidates than owed (e.g. "kill a friendly unit" with two
 * friendly units) is a real choice: without an explicit plan `payCost` returns `invalid_choice`
 * (rule 357.2) and `costObjectChoice` reports the candidates so the caller can prompt.
 *
 * Signature is a cross-agent contract: keep it stable.
 */
import type { ChoiceRecord, Cost, PaidCost, PaymentPlanWire, Room, Verdict } from "@rift/protocol";
import type { RulesHost } from "../host";
import type { RulesFailure, RulesStepContext } from "../types";
import { fail, pushEvent } from "../types";
import { addResources } from "../actions/resources";
import { exhaust, kill } from "../actions/primitives";
import { cardDomains, resolveCost, totalPower, type ResolvedCost } from "./cost-model";
import { legendXp, objectPlanIds, planObjectCosts, type CostObjectChoice, type ObjectPlan } from "./cost-objects";
import { resourcePlanFor, type ResourcePlan } from "./planner";
import { paymentSources, poolOf } from "./sources";

export interface PaymentPlan {
  resources: ResourcePlan;
  objects: ObjectPlan;
}

export type PaymentPlanResult =
  | { ok: true; plan: PaymentPlan; pending: null }
  | { ok: true; plan: null; pending: CostObjectChoice }
  | RulesFailure;

export interface PaymentContext {
  sourceObjectId?: string;
  /** Cards that cannot pay (the card being played while it is still in hand). */
  excludeIds?: readonly string[];
  plan?: PaymentPlanWire;
  /** 357.3: chosen targets a kill cost should avoid when another choice exists. */
  avoidIds?: readonly string[];
}

function objectContext(playerId: string, context: PaymentContext): Parameters<typeof planObjectCosts>[3] {
  return {
    playerId,
    ...(context.sourceObjectId ? { sourceObjectId: context.sourceObjectId } : {}),
    ...(context.excludeIds ? { excludeIds: context.excludeIds } : {}),
    ...(context.plan ? { plan: context.plan } : {}),
    ...(context.avoidIds ? { avoidIds: context.avoidIds } : {}),
  };
}

/** 357.1: the Energy/Power part, with the runes an object plan consumes removed from the sources. */
function resourcePlan(
  room: Room,
  host: RulesHost,
  playerId: string,
  cost: ResolvedCost,
  context: PaymentContext,
  objects: ObjectPlan,
): { ok: true; plan: ResourcePlan } | RulesFailure {
  const sources = paymentSources(room, host, playerId);
  // A rune consumed by a non-standard cost (or recycled as "Recycle this") cannot also pay.
  const consumed = new Set(objectPlanIds(objects));
  const usable = { ...sources, runes: sources.runes.filter((rune) => !consumed.has(rune.id)) };
  return resourcePlanFor(usable, cost, context.plan);
}

/** At most this many candidate selections before the pending check falls back to worst case. */
const MAX_PENDING_SELECTIONS = 100;

/** Every `count`-sized selection of `candidates` (null when there are too many). */
function selections(candidates: readonly string[], count: number): string[][] | null {
  if (count <= 0) return [[]];
  if (candidates.length < count) return null;
  const out: string[][] = [];
  const pick = (start: number, chosen: string[]): void => {
    if (out.length > MAX_PENDING_SELECTIONS) return;
    if (chosen.length === count) {
      out.push([...chosen]);
      return;
    }
    for (let index = start; index < candidates.length; index += 1) {
      chosen.push(candidates[index]!);
      pick(index + 1, chosen);
      chosen.pop();
      if (out.length > MAX_PENDING_SELECTIONS) return;
    }
  };
  pick(0, []);
  return out.length > MAX_PENDING_SELECTIONS ? null : out;
}

/**
 * 420.2.a: a pending non-standard choice (357.2) must not skip the resource check. Probe each
 * candidate selection with an explicit plan and keep the play only when at least one selection
 * leaves a complete object plan and a payable Energy/Power plan. Returns the original pending
 * choice so the caller still prompts.
 */
function pendingPayment(
  room: Room,
  host: RulesHost,
  playerId: string,
  cost: ResolvedCost,
  context: PaymentContext,
  pending: CostObjectChoice,
): PaymentPlanResult {
  const options = selections(pending.candidates, pending.count);
  if (options) {
    let first: RulesFailure | null = null;
    for (const selection of options) {
      const plan: PaymentPlanWire = { ...(context.plan ?? {}), [pending.category]: selection };
      const planned = planPayment(room, host, playerId, cost, { ...context, plan });
      if (planned.ok) return { ok: true, plan: null, pending };
      first ??= planned;
    }
    if (first) return first;
    return { ok: true, plan: null, pending };
  }
  // Too many selections to enumerate: exclude every candidate from the rune sources (worst case).
  const objects = planObjectCosts(room, host, cost, objectContext(playerId, context));
  if (!objects.ok) return objects;
  const sources = paymentSources(room, host, playerId);
  const consumed = new Set([
    ...(objects.plan ? objectPlanIds(objects.plan) : []),
    ...pending.candidates,
  ]);
  const usable = { ...sources, runes: sources.runes.filter((rune) => !consumed.has(rune.id)) };
  const resources = resourcePlanFor(usable, cost, context.plan);
  if (!resources.ok) return resources;
  return { ok: true, plan: null, pending };
}

/** 357: plan the whole payment (non-standard objects first, then Energy/Power). Pure. */
export function planPayment(
  room: Room,
  host: RulesHost,
  playerId: string,
  cost: ResolvedCost,
  context: PaymentContext = {},
): PaymentPlanResult {
  const objects = planObjectCosts(room, host, cost, objectContext(playerId, context));
  if (!objects.ok) return objects;
  // 420.2.a / 357.1: the resource part still has to be payable while an object choice is pending.
  if (objects.pending) return pendingPayment(room, host, playerId, cost, context, objects.pending);
  const resources = resourcePlan(room, host, playerId, cost, context, objects.plan);
  if (!resources.ok) return resources;
  return { ok: true, plan: { resources: resources.plan, objects: objects.plan }, pending: null };
}

/** Undo point for atomic payment (357/358.5): the draft and the events collected so far. */
export interface RoomCheckpoint {
  room: Room;
  events: number;
}

export function checkpoint(room: Room, step: RulesStepContext): RoomCheckpoint {
  return { room: step.host.cloneRoom(room), events: step.events.length };
}

function replaceContents(target: Record<string, unknown>, source: Record<string, unknown>): void {
  for (const key of Object.keys(target)) delete target[key];
  Object.assign(target, source);
}

/**
 * 358.5: put the draft back exactly as it was at `point`. The room object and its `rules`
 * object keep their identity, so callers holding either reference keep working.
 */
export function rollback(room: Room, step: RulesStepContext, point: RoomCheckpoint): void {
  const restored = step.host.cloneRoom(point.room);
  const rules = room.rules;
  replaceContents(room as unknown as Record<string, unknown>, restored as unknown as Record<string, unknown>);
  if (rules && restored.rules) {
    replaceContents(rules as unknown as Record<string, unknown>, restored.rules as unknown as Record<string, unknown>);
    room.rules = rules;
  }
  step.events.length = point.events;
}

function spendFromPool(
  room: Room,
  playerId: string,
  energy: number,
  power: Partial<Record<string, number>>,
): boolean {
  const rules = room.rules;
  if (!rules) return false;
  const pool = (rules.pools[playerId] ??= { energy: 0, power: {} });
  if (pool.energy < energy) return false;
  for (const [key, value] of Object.entries(power)) {
    if ((pool.power[key as keyof typeof pool.power] ?? 0) < (value ?? 0)) return false;
  }
  pool.energy -= energy;
  for (const [key, value] of Object.entries(power)) {
    const domain = key as keyof typeof pool.power;
    const next = (pool.power[domain] ?? 0) - (value ?? 0);
    if (next > 0) pool.power[domain] = next;
    else delete pool.power[domain];
  }
  return true;
}

/** 417.1.b: a recycled rune goes to the bottom of its owner's Rune Deck. */
function recycleRune(room: Room, step: RulesStepContext, playerId: string, runeId: string): boolean {
  const located = step.host.findCard(room, runeId);
  if (!located || located.zone !== "runeArea") return false;
  const owner = located.card.ownerPlayerId ?? located.playerId;
  const moved =
    owner === located.playerId
      ? step.host.moveCardTo(room, located.playerId, "runeArea", "runeDeck", runeId, "bottom")
      : step.host.moveCardToOwnerZone(room, runeId, "runeDeck", "bottom");
  if (!moved) return false;
  step.host.setExhausted(room, runeId, false);
  pushEvent(step.events, { type: "recycle", cardId: runeId, playerId, zone: "runeDeck" });
  return true;
}

/**
 * 357.1/357.2: perform the planned payment on the draft. Not atomic by itself — callers use
 * `checkpoint`/`rollback` (or `payCost`, which does). Basic-rune Add abilities resolve
 * immediately (430.2) and their resources are then spent from the pool (166.2).
 */
export function applyPayment(
  room: Room,
  step: RulesStepContext,
  playerId: string,
  cost: ResolvedCost,
  plan: PaymentPlan,
): Verdict {
  const { resources, objects } = plan;
  const runeDomains = new Map<string, string | null>();
  for (const rune of paymentSources(room, step.host, playerId).runes) runeDomains.set(rune.id, rune.domain);
  // 164.2.a: exhaust for [1] (Add resolves immediately, 430.2).
  for (const runeId of resources.exhaustRunes) {
    if (step.host.isExhausted(room, runeId) !== false) {
      return fail("insufficient_resources", "415.4", `${runeId} cannot be exhausted`);
    }
    exhaust(room, runeId, step);
    addResources(room, playerId, { energy: 1 }, step);
  }
  // 164.2.b: recycle for one Power of the rune's Domain.
  for (const runeId of resources.recycleRunes) {
    const domain = runeDomains.get(runeId);
    if (!domain || !recycleRune(room, step, playerId, runeId)) {
      return fail("insufficient_resources", "417.3", `${runeId} cannot be recycled`);
    }
    addResources(room, playerId, { power: { [domain]: 1 } }, step);
  }
  const spendPower: Partial<Record<string, number>> = { ...resources.poolPower };
  for (const runeId of resources.recycleRunes) {
    const domain = runeDomains.get(runeId)!;
    spendPower[domain] = (spendPower[domain] ?? 0) + 1;
  }
  // 357.1: pay the combined Energy and Power cost from the pool.
  if (!spendFromPool(room, playerId, cost.energy, spendPower)) {
    return fail("insufficient_resources", "357.1", "the Rune Pool no longer covers the cost");
  }
  // 357.2: non-standard costs in any order. A replaced action still counts as paid (203.2/357.2.a).
  for (const id of objects.exhaust) exhaust(room, id, step);
  for (const id of objects.kill) kill(room, id, step);
  if (objects.recycleSelf && !recycleRune(room, step, playerId, objects.recycleSelf)) {
    return fail("insufficient_resources", "417.3", "cannot recycle the source");
  }
  for (const id of objects.discard) {
    if (!step.host.moveCardTo(room, playerId, "hand", "trash", id)) {
      return fail("insufficient_resources", "423.1", `${id} cannot be discarded`);
    }
    pushEvent(step.events, { type: "discard", cardId: id, playerId });
  }
  if (objects.payPoints > 0) {
    const score = step.host.score(room, playerId);
    if (score < objects.payPoints) return fail("insufficient_resources", "203.3", "not enough points");
    step.host.setScore(room, playerId, score - objects.payPoints);
    pushEvent(step.events, { type: "pay_points", playerId, amount: objects.payPoints });
  }
  if (objects.spendXp > 0) {
    const board = room.players.find((player) => player.id === playerId)?.board;
    if (!board || legendXp(room, playerId) < objects.spendXp) {
      return fail("insufficient_resources", "203.3", "not enough XP");
    }
    board.legendXp = legendXp(room, playerId) - objects.spendXp;
    pushEvent(step.events, { type: "spend_xp", playerId, amount: objects.spendXp });
  }
  pushEvent(step.events, {
    type: "cost_paid",
    playerId,
    amount: cost.energy,
    data: {
      energy: cost.energy,
      power: totalPower(cost),
      exhaustedRunes: resources.exhaustRunes,
      recycledRunes: resources.recycleRunes,
      exhausted: objects.exhaust,
      killed: objects.kill,
      discarded: objects.discard,
    },
  });
  return { ok: true };
}

/** The `PaidCost` record stored on a chain item (what was actually paid). */
export function paidCostRecord(cost: ResolvedCost, plan: PaymentPlan, optionalCosts: readonly string[] = []): PaidCost {
  const power: NonNullable<PaidCost["power"]> = {};
  for (const [key, value] of Object.entries(plan.resources.poolPower)) {
    if (value) power[key as keyof typeof power] = value;
  }
  const paid: PaidCost = {
    energy: cost.energy,
    ...(plan.objects.exhaust.length ? { exhausted: [...plan.objects.exhaust] } : {}),
    ...(plan.objects.discard.length ? { discarded: [...plan.objects.discard] } : {}),
    ...(plan.objects.kill.length ? { killed: [...plan.objects.kill] } : {}),
  };
  const additional: Record<string, string[] | number> = {};
  if (plan.resources.exhaustRunes.length) additional.exhaustedRunes = [...plan.resources.exhaustRunes];
  if (plan.resources.recycleRunes.length) additional.recycledRunes = [...plan.resources.recycleRunes];
  if (optionalCosts.length) additional.optionalCosts = [...optionalCosts];
  if (totalPower(cost) > 0) additional.power = totalPower(cost);
  if (Object.keys(power).length > 0) paid.power = power;
  if (Object.keys(additional).length > 0) paid.additional = additional;
  return paid;
}

function resolveForSource(
  room: Room,
  host: RulesHost,
  cost: Cost,
  sourceObjectId: string | undefined,
  choices?: ChoiceRecord,
): ResolvedCost {
  const info = sourceObjectId ? host.cardInfo(room, sourceObjectId) : null;
  return resolveCost(cost, cardDomains(info), choices ? { choices } : {});
}

/** The candidates still to choose for `cost`, or null when no choice is open. */
export function costObjectChoice(
  room: Room,
  host: RulesHost,
  playerId: string,
  cost: Cost,
  opts?: { sourceObjectId?: string; plan?: PaymentPlanWire },
): CostObjectChoice | null {
  const resolved = resolveForSource(room, host, cost, opts?.sourceObjectId);
  const planned = planPayment(room, host, playerId, resolved, {
    ...(opts?.sourceObjectId ? { sourceObjectId: opts.sourceObjectId } : {}),
    ...(opts?.plan ? { plan: opts.plan } : {}),
  });
  return planned.ok && planned.pending ? planned.pending : null;
}

export function canPayCost(
  room: Room,
  host: RulesHost,
  playerId: string,
  cost: Cost,
  opts?: { sourceObjectId?: string },
): boolean {
  const resolved = resolveForSource(room, host, cost, opts?.sourceObjectId);
  // A pending choice still means the cost can be paid (some choice of objects works).
  return planPayment(room, host, playerId, resolved, opts?.sourceObjectId ? { sourceObjectId: opts.sourceObjectId } : {}).ok;
}

function isPlanWire(value: unknown): value is PaymentPlanWire {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function payCost(
  room: Room,
  step: RulesStepContext,
  playerId: string,
  cost: Cost,
  opts?: { plan?: unknown; sourceObjectId?: string },
): Verdict {
  const wire = isPlanWire(opts?.plan) ? opts?.plan : undefined;
  const resolved = resolveForSource(room, step.host, cost, opts?.sourceObjectId);
  const planned = planPayment(room, step.host, playerId, resolved, {
    ...(opts?.sourceObjectId ? { sourceObjectId: opts.sourceObjectId } : {}),
    ...(wire ? { plan: wire } : {}),
  });
  if (!planned.ok) return planned;
  if (planned.pending) {
    return fail(
      "invalid_choice",
      planned.pending.rule,
      `choose ${planned.pending.count} to ${planned.pending.category} from ${planned.pending.candidates.join(",")}`,
    );
  }
  const point = checkpoint(room, step);
  const applied = applyPayment(room, step, playerId, resolved, planned.plan);
  if (!applied.ok) {
    rollback(room, step, point);
    return applied;
  }
  return { ok: true };
}

/** Floating resources a player has (for UI/tests). */
export function poolTotal(room: Room, playerId: string): { energy: number; power: number } {
  const pool = poolOf(room, playerId);
  return {
    energy: pool.energy,
    power: Object.values(pool.power).reduce((sum: number, value) => sum + (value ?? 0), 0),
  };
}
