/**
 * Group targeting requirements — rules 355.11, 355.11.a, 355.11.b, 355.11.b.1.
 *
 * Some cards identify a group of Targets whose requirement is met by the group as a whole
 * (355.11): "units at the same location", "with total Might 4 or less", "with the same
 * controller". On play any group that collectively fulfills it may be chosen (355.11.a). On
 * resolution, when the remaining legal targets no longer fulfill it, the controller chooses a
 * legal subset of the original targets (355.11.b) that cannot be extended by another of them
 * (355.11.b.1: "the maximum number of legal targets possible for that subset" — the official
 * examples accept subsets of different sizes, so the subset is maximal by inclusion, not by
 * size).
 *
 * Pure reads only.
 */
import type { SelectorGroupRequirement } from "@rift/protocol";
import type { EvalContext } from "./env";
import { compare, evaluateAmount, mightOf } from "./evaluate";
import { controllerOf, locationOf } from "./objects";
import { lkiOf } from "./env";

/** Does the chosen group `ids` collectively fulfill `group` (355.11.a)? The empty group does. */
export function groupSatisfied(ctx: EvalContext, group: SelectorGroupRequirement | undefined, ids: readonly string[]): boolean {
  if (!group || ids.length === 0) return true;
  const { room, host, env } = ctx;
  if (group.sameLocation) {
    const locations = new Set(ids.map((id) => locationOf(room, host, id) ?? lkiOf(env, id)?.zone ?? `?${id}`));
    if (locations.size > 1) return false;
  }
  if (group.sameController) {
    const controllers = new Set(ids.map((id) => controllerOf(room, host, id) ?? lkiOf(env, id)?.controller ?? `?${id}`));
    if (controllers.size > 1) return false;
  }
  if (group.totalMight) {
    let total = 0;
    for (const id of ids) {
      // 143.2.c: a negative Might is treated as 0 when referenced.
      const might = mightOf(ctx, id);
      if (might === null) return false;
      total += might;
    }
    const value = evaluateAmount(ctx, group.totalMight.value);
    if (value === null || !compare(total, group.totalMight.op, value)) return false;
  }
  return true;
}

/** Subset enumeration bound: 2^12 combinations; larger groups fall back to a greedy subset. */
const MAX_ENUMERATED = 12;

/**
 * 355.11.b / 355.11.b.1: every subset of `ids` that fulfills `group` and cannot be extended by
 * another id of `ids` (maximal by inclusion), in a stable order (larger first, then by the
 * order of `ids`). Always contains at least one entry (possibly the empty subset).
 */
export function maximalGroupSubsets(
  ctx: EvalContext,
  group: SelectorGroupRequirement | undefined,
  ids: readonly string[],
): string[][] {
  if (groupSatisfied(ctx, group, ids)) return [[...ids]];
  if (ids.length > MAX_ENUMERATED) return [greedySubset(ctx, group, ids)];
  const valid: number[] = [];
  const total = 1 << ids.length;
  for (let mask = 0; mask < total; mask += 1) {
    const subset = ids.filter((_, index) => (mask & (1 << index)) !== 0);
    if (groupSatisfied(ctx, group, subset)) valid.push(mask);
  }
  const maximal = valid.filter((mask) => !valid.some((other) => other !== mask && (other & mask) === mask));
  const subsets = maximal.map((mask) => ids.filter((_, index) => (mask & (1 << index)) !== 0));
  subsets.sort((a, b) => b.length - a.length || orderKey(ids, a).localeCompare(orderKey(ids, b)));
  return subsets.length > 0 ? subsets : [[]];
}

function orderKey(ids: readonly string[], subset: readonly string[]): string {
  return subset.map((id) => String(ids.indexOf(id)).padStart(3, "0")).join(",");
}

function greedySubset(ctx: EvalContext, group: SelectorGroupRequirement | undefined, ids: readonly string[]): string[] {
  const out: string[] = [];
  for (const id of ids) if (groupSatisfied(ctx, group, [...out, id])) out.push(id);
  return out;
}

/** Is `chosen` (as a set) one of `subsets`? */
export function isOneOfSubsets(subsets: readonly (readonly string[])[], chosen: readonly string[]): boolean {
  const wanted = new Set(chosen);
  if (wanted.size !== chosen.length) return false;
  return subsets.some((subset) => subset.length === wanted.size && subset.every((id) => wanted.has(id)));
}
