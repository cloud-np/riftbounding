/**
 * Non-standard costs — rules 203.3, 356.7, 357.2, 357.3, 415.4, 417.3, 423.1.a.
 *
 * Exhaust / kill / discard / points / XP costs. Each object cost lists its candidates; when the
 * number of candidates equals what is owed the choice is forced (no prompt, 411.2), when there
 * are more the payer must choose (explicit plan or a `choose-cost` prompt), when there are fewer
 * the cost cannot be paid (203.3).
 *
 * TODO(R2-play): cost selectors are matched by the small matcher below (zone, controller,
 * cardType, name, keyword, tag, excludeSource). Swap in the R2-effects selector evaluator at
 * merge so costs and effects share one implementation.
 */
import type { CardInstance, PaymentPlanWire, Room, Selector } from "@rift/protocol";
import type { RulesHost } from "../host";
import type { RulesFailure } from "../types";
import { fail } from "../types";
import { effectiveKeywords } from "../layers";
import type { ObjectCostRequirement, ResolvedCost } from "./cost-model";

export type CostCategory = "exhaust" | "kill" | "discard";

/** A cost-object choice still owed (prompted as `choose-cost`). */
export interface CostObjectChoice {
  category: CostCategory;
  count: number;
  candidates: string[];
  rule: string;
}

export interface ObjectPlan {
  exhaust: string[];
  kill: string[];
  discard: string[];
  payPoints: number;
  spendXp: number;
  /** "Recycle this": the source rune id. */
  recycleSelf?: string;
}

export type ObjectPlanResult =
  | { ok: true; plan: ObjectPlan; pending: null }
  | { ok: true; plan: null; pending: CostObjectChoice }
  | RulesFailure;

export interface ObjectCostContext {
  playerId: string;
  sourceObjectId?: string;
  /** Cards that cannot pay (e.g. the card being played, still in hand while planning). */
  excludeIds?: readonly string[];
  plan?: PaymentPlanWire;
}

function boardLists(room: Room, host: RulesHost): string[] {
  return ["base", ...host.battlefieldZones(room), "legend", "runeArea"];
}

function zoneMatches(zone: string, selector: Selector, host: RulesHost, room: Room): boolean {
  const wanted = selector.zone;
  const battlefields = host.battlefieldZones(room) as string[];
  if (wanted === undefined) return zone === "base" || battlefields.includes(zone);
  if (typeof wanted === "object") {
    return wanted.kind === "battlefield" ? zone === wanted.id : false;
  }
  if (wanted === "battlefield") return battlefields.includes(zone);
  return zone === wanted;
}

function controllerMatches(owner: string, playerId: string, selector: Selector): boolean {
  const wanted = selector.controller ?? "self";
  if (wanted === "self") return owner === playerId;
  if (wanted === "opponent") return owner !== playerId;
  if (wanted === "any" || wanted === "all" || wanted === "each") return true;
  // TODO(R2-play): other PlayerSelector forms need the R2-effects evaluator.
  return owner === playerId;
}

/** Does a located board/hand card match a cost selector? */
export function matchesCostSelector(
  room: Room,
  host: RulesHost,
  context: ObjectCostContext,
  card: CardInstance,
  zone: string,
  owner: string,
  selector: Selector,
): boolean {
  if (card.hidden && zone !== "hand") return false; // 811/107.3: facedown cards are not objects here.
  if (!zoneMatches(zone, selector, host, room)) return false;
  if (!controllerMatches(owner, context.playerId, selector)) return false;
  if ((selector.excludeSource || selector.excludeSelf) && card.id === context.sourceObjectId) return false;
  const info = host.cardInfo(room, card.id);
  if (selector.cardType && !(info?.type ?? card.type ?? "").toLowerCase().includes(selector.cardType.toLowerCase())) {
    return false;
  }
  if (selector.name && (info?.name ?? card.name) !== selector.name) return false;
  if (selector.keyword) {
    const keywords = effectiveKeywords(room, card.id, info?.keywords ?? card.keywords ?? []);
    if (!keywords.some((keyword) => keyword.toLowerCase() === selector.keyword!.toLowerCase())) return false;
  }
  if (selector.tag && !(card.subtypes ?? []).some((tag) => tag.toLowerCase() === selector.tag!.toLowerCase())) {
    return false;
  }
  return true;
}

/** Candidates for one exhaust/kill requirement (exhaust needs a ready object, 415.4). */
export function objectCandidates(
  room: Room,
  host: RulesHost,
  context: ObjectCostContext,
  requirement: ObjectCostRequirement,
  taken: ReadonlySet<string>,
): string[] {
  const excluded = new Set([...(context.excludeIds ?? []), ...taken]);
  if (requirement.self) {
    const id = context.sourceObjectId;
    if (!id || excluded.has(id)) return [];
    const located = host.findCard(room, id);
    if (!located || !boardLists(room, host).includes(located.zone)) return [];
    if (requirement.kind === "exhaust" && located.card.exhausted) return [];
    return [id];
  }
  const out: string[] = [];
  const zones = requirement.selector.zone === "hand" ? ["hand"] : boardLists(room, host);
  for (const owner of host.activePlayerIds(room)) {
    for (const zone of zones) {
      for (const card of host.zoneCards(room, owner, zone)) {
        if (excluded.has(card.id)) continue;
        if (requirement.kind === "exhaust" && card.exhausted) continue;
        if (!matchesCostSelector(room, host, context, card, zone, owner, requirement.selector)) continue;
        out.push(card.id);
      }
    }
  }
  return out;
}

/** 423.1.a: the payer chooses which of their hand cards to discard. */
export function discardCandidates(room: Room, host: RulesHost, context: ObjectCostContext): string[] {
  const excluded = new Set(context.excludeIds ?? []);
  return host.zoneCards(room, context.playerId, "hand").map((card) => card.id).filter((id) => !excluded.has(id));
}

export function legendXp(room: Room, playerId: string): number {
  const board = room.players.find((player) => player.id === playerId)?.board;
  return Math.max(0, Math.trunc(board?.legendXp ?? 0));
}

function pick(
  category: CostCategory,
  count: number,
  candidates: readonly string[],
  explicit: readonly string[] | undefined,
  rule: string,
): { ok: true; ids: string[] } | { ok: true; pending: CostObjectChoice } | RulesFailure {
  if (count <= 0) {
    if (explicit && explicit.length > 0) return fail("invalid_payment", rule, `no ${category} cost to pay`);
    return { ok: true, ids: [] };
  }
  if (candidates.length < count) {
    return fail("insufficient_resources", rule, `needs ${count} to ${category}, ${candidates.length} available`);
  }
  if (explicit !== undefined) {
    if (explicit.length !== count || new Set(explicit).size !== explicit.length) {
      return fail("invalid_payment", rule, `choose exactly ${count} to ${category}`);
    }
    const bad = explicit.find((id) => !candidates.includes(id));
    if (bad) return fail("invalid_payment", rule, `${bad} cannot pay the ${category} cost`);
    return { ok: true, ids: [...explicit] };
  }
  // 411.2: a forced choice is made automatically; a real choice is prompted.
  if (candidates.length === count) return { ok: true, ids: [...candidates] };
  return { ok: true, pending: { category, count, candidates: [...candidates], rule } };
}

/**
 * 357.2: plan the non-standard part of `cost`. Self costs ([E], "Kill this", "Recycle this")
 * are fixed; the others draw from candidates (explicit plan > forced > prompt).
 */
export function planObjectCosts(
  room: Room,
  host: RulesHost,
  cost: ResolvedCost,
  context: ObjectCostContext,
): ObjectPlanResult {
  if (cost.unsupported.length > 0) {
    return fail("insufficient_resources", "203.3", `unsupported cost: ${cost.unsupported.join(", ")}`);
  }
  const plan: ObjectPlan = { exhaust: [], kill: [], discard: [], payPoints: cost.payPoints, spendXp: cost.spendXp };
  const taken = new Set<string>();
  // Self costs first: they are not choices.
  for (const requirement of cost.objects.filter((entry) => entry.self)) {
    const ids = objectCandidates(room, host, context, requirement, taken);
    if (ids.length === 0) {
      return fail(
        "insufficient_resources",
        requirement.kind === "exhaust" ? "415.4" : "203.3",
        `cannot ${requirement.kind} the source`,
      );
    }
    plan[requirement.kind].push(ids[0]!);
    taken.add(ids[0]!);
  }
  if (cost.recycleSelf) {
    const id = context.sourceObjectId;
    const located = id ? host.findCard(room, id) : null;
    if (!id || !located || located.zone !== "runeArea") {
      return fail("insufficient_resources", "417.3", "cannot recycle the source");
    }
    plan.recycleSelf = id;
    taken.add(id);
  }
  for (const category of ["exhaust", "kill"] as const) {
    const requirements = cost.objects.filter((entry) => !entry.self && entry.kind === category);
    const count = requirements.reduce((sum, entry) => sum + entry.count, 0);
    // Union of candidates per requirement (requirements of one category rarely coexist).
    const candidates = [
      ...new Set(requirements.flatMap((requirement) => objectCandidates(room, host, context, requirement, taken))),
    ];
    const picked = pick(category, count, candidates, context.plan?.[category], category === "exhaust" ? "415.4" : "357.2");
    if (!picked.ok) return picked;
    if ("pending" in picked) return { ok: true, plan: null, pending: picked.pending };
    for (const id of picked.ids) {
      plan[category].push(id);
      taken.add(id);
    }
  }
  const discard = pick("discard", cost.discard, discardCandidates(room, host, context), context.plan?.discard, "423.1.a");
  if (!discard.ok) return discard;
  if ("pending" in discard) return { ok: true, plan: null, pending: discard.pending };
  plan.discard = discard.ids;
  if (cost.payPoints > host.score(room, context.playerId)) {
    return fail("insufficient_resources", "203.3", `needs ${cost.payPoints} points`);
  }
  if (cost.spendXp > legendXp(room, context.playerId)) {
    return fail("insufficient_resources", "203.3", `needs ${cost.spendXp} XP`);
  }
  return { ok: true, plan, pending: null };
}

/** Ids an object plan consumes from the board (excluded from rune sources). */
export function objectPlanIds(plan: ObjectPlan): string[] {
  return [...plan.exhaust, ...plan.kill, ...(plan.recycleSelf ? [plan.recycleSelf] : [])];
}
