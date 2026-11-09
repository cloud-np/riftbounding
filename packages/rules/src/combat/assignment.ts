/**
 * Combat damage assignment — rule 467.2.c (c.1–c.10), 815 Tank, 826 Backline, 424.1.c.
 *
 * Pure functions: targets are computed from the room (lethal values through R2-effects'
 * `previewDamage`, immunity through `restrictionFor`), then validation and enumeration work on
 * the `CombatDamageTarget[]` contract alone so the prompt handler, the auto-assign path, the
 * property answerers and the UI agree.
 */
import type { CombatDamageTarget, Room, RuleRef } from "@rift/protocol";
import type { RulesHost } from "../host";
import { previewDamage } from "../replacements/preview";
import { restrictionFor } from "../layers/restrictions";
import { combatKeywordProfile, combatMight } from "./keywords";

export type DamageAssignment = Array<{ targetId: string; amount: number }>;

/** 467.2.c.8: exclusionary requirement → assignment tier (contract: 0 first, 1 normal, 2 last). */
export const EXCLUSIVE_TIERS: Readonly<Record<string, number>> = { tank: 0, backline: 2 };

/** Search bound above the assigner's total when a lethal value is out of reach. */
const LETHAL_SEARCH_SLACK = 64;

/**
 * 467.2.c.4 / 467.2.c.4.a / 467.2.c.5 / 142.4.b: the minimum amount to assign so the unit would
 * have lethal damage marked — the smallest x ≥ 1 with `marked + previewDamage(x) ≥ max(Might, 1)`
 * (lethal damage is non-zero, 142.4.b; a Stunned unit still needs its full Might, 424.1.c).
 * Replacement and prevention effects apply to the assignment (467.2.c.5), so the search runs
 * through `previewDamage`. `null` = the unit can't be dealt damage (467.2.c.10).
 *
 * When no x within `budget + might + 64` is lethal (e.g. "prevent all damage"), the result is
 * one more than the search bound: more than any assignable amount, so the unit can only take
 * the remainder (467.2.c.3).
 */
export function lethalAssignment(
  room: Room,
  host: RulesHost,
  targetId: string,
  budget: number,
): number | null {
  if (restrictionFor(room, host, { kind: "be-dealt-damage", objectId: targetId })) return null;
  const marked = Math.max(0, room.rules?.objects[targetId]?.damage ?? 0);
  const need = Math.max(1, combatMight(room, targetId, host));
  if (marked >= need) return 0;
  const limit = Math.max(0, budget) + need + LETHAL_SEARCH_SLACK;
  for (let amount = 1; amount <= limit; amount += 1) {
    const dealt = Math.max(0, Math.trunc(previewDamage(room, host, { targetId, amount, combat: true })));
    if (marked + dealt >= need) return amount;
  }
  return limit + 1;
}

/**
 * 467.2.c.2 / 467.2.c.6 / 815 / 826: the assignment tier of a unit, plus the 467.2.c.8
 * exclusionary choices when it has both Tank and Backline.
 */
export function assignmentTier(
  room: Room,
  host: RulesHost,
  targetId: string,
): { tier: number; exclusiveChoices?: string[] } {
  const profile = combatKeywordProfile(room, targetId, host);
  if (profile.tank && profile.backline) return { tier: EXCLUSIVE_TIERS.tank!, exclusiveChoices: ["tank", "backline"] };
  if (profile.tank) return { tier: 0 };
  if (profile.backline) return { tier: 2 };
  return { tier: 1 };
}

/** The `CombatDamageTarget[]` for one assigner (467.2.c: "among the other's Units"). */
export function damageTargets(
  room: Room,
  host: RulesHost,
  targetIds: readonly string[],
  budget: number,
): CombatDamageTarget[] {
  return targetIds.map((objectId) => {
    const { tier, exclusiveChoices } = assignmentTier(room, host, objectId);
    const located = host.findCard(room, objectId);
    const target: CombatDamageTarget = {
      objectId,
      lethal: lethalAssignment(room, host, objectId, budget),
      tier,
      ...(exclusiveChoices ? { exclusiveChoices } : {}),
      ...(located ? { controllerId: located.playerId } : {}),
      damage: Math.max(0, room.rules?.objects[objectId]?.damage ?? 0),
      might: combatMight(room, objectId, host),
    };
    return target;
  });
}

/* ---------------------------------------------------------------- validation */

export type AssignmentVerdict =
  | { ok: true; amounts: Record<string, number>; choices: Record<string, string> }
  | { ok: false; rule: RuleRef; detail: string };

/** Every combination of 467.2.c.8 exclusionary choices (467.2.c.9: each unit individually). */
function choiceCombos(
  targets: readonly CombatDamageTarget[],
  fixed: Record<string, string> = {},
): Array<Record<string, string>> {
  let combos: Array<Record<string, string>> = [{}];
  for (const target of targets) {
    const options = target.exclusiveChoices;
    if (!options || options.length === 0) continue;
    const allowed = fixed[target.objectId] !== undefined ? [fixed[target.objectId]!] : options;
    const next: Array<Record<string, string>> = [];
    for (const combo of combos) {
      for (const option of allowed) next.push({ ...combo, [target.objectId]: option });
      if (next.length > 256) break; // RULES-QUESTION(467.2.c.9): bound pathological boards.
    }
    combos = next;
  }
  return combos;
}

function tierOf(target: CombatDamageTarget, choices: Record<string, string>): number {
  const choice = choices[target.objectId];
  if (choice !== undefined && EXCLUSIVE_TIERS[choice] !== undefined) return EXCLUSIVE_TIERS[choice]!;
  return target.tier;
}

/**
 * The legality of one assignment under one set of exclusive choices.
 *
 * Let K be the units that can be dealt damage (lethal ≠ null) and L = Σ lethal over K.
 * - total ≥ L: every unit in K gets at least its lethal value; the excess may go to any unit
 *   (467.2.c.4 "unless no further units remain").
 * - total < L: units that can't be dealt damage get nothing (467.2.c.10); no unit gets more than
 *   its lethal value (467.2.c.4); at most one unit gets a non-lethal, non-zero amount
 *   (467.2.c.3); and a unit may only receive damage once every unit of a lower tier has its
 *   lethal value (467.2.c.6 / 467.2.c.7 / 815.1.c.2 / 826.4.b).
 */
function checkUnderChoices(
  targets: readonly CombatDamageTarget[],
  total: number,
  amounts: Record<string, number>,
  choices: Record<string, string>,
): { ok: true } | { ok: false; rule: RuleRef; detail: string } {
  const killable = targets.filter((target) => target.lethal !== null);
  const lethalSum = killable.reduce((sum, target) => sum + (target.lethal ?? 0), 0);
  const amount = (target: CombatDamageTarget) => amounts[target.objectId] ?? 0;
  if (total >= lethalSum) {
    for (const target of killable) {
      if (amount(target) < (target.lethal ?? 0)) {
        return {
          ok: false,
          rule: "467.2.c.3",
          detail: `${target.objectId} must be assigned lethal damage (${target.lethal}) before any excess`,
        };
      }
    }
    return { ok: true };
  }
  for (const target of targets) {
    if (target.lethal === null && amount(target) > 0) {
      return {
        ok: false,
        rule: "467.2.c.10",
        detail: `${target.objectId} can't be dealt damage; it only takes damage once every other unit has lethal damage`,
      };
    }
  }
  let partial: CombatDamageTarget | null = null;
  for (const target of killable) {
    const value = amount(target);
    if (value > (target.lethal ?? 0)) {
      return {
        ok: false,
        rule: "467.2.c.4",
        detail: `${target.objectId} may not be assigned more than ${target.lethal} while other units remain`,
      };
    }
    if (value > 0 && value < (target.lethal ?? 0)) {
      if (partial) {
        return {
          ok: false,
          rule: "467.2.c.3",
          detail: `${partial.objectId} and ${target.objectId} both have non-lethal damage assigned`,
        };
      }
      partial = target;
    }
  }
  for (const receiver of killable) {
    if (amount(receiver) <= 0) continue;
    for (const other of killable) {
      if (other === receiver) continue;
      if (tierOf(other, choices) < tierOf(receiver, choices) && amount(other) < (other.lethal ?? 0)) {
        return {
          ok: false,
          rule: "467.2.c.6",
          detail: `${other.objectId} must be assigned lethal damage before ${receiver.objectId}`,
        };
      }
    }
  }
  return { ok: true };
}

/**
 * 467.2.c: validate a damage assignment answer strictly. Amounts must be non-negative integers,
 * only offered targets may appear (once each), and they must sum to `total`; then some
 * combination of 467.2.c.8 exclusive choices (or the given one) must make it legal.
 */
export function validateAssignment(
  targets: readonly CombatDamageTarget[],
  total: number,
  assignments: unknown,
  exclusiveChoices?: unknown,
): AssignmentVerdict {
  if (!Array.isArray(assignments)) {
    return { ok: false, rule: "467.2.c", detail: "assignments must be an array" };
  }
  const byId = new Map(targets.map((target) => [target.objectId, target]));
  const amounts: Record<string, number> = {};
  let sum = 0;
  for (const entry of assignments as unknown[]) {
    if (!entry || typeof entry !== "object") {
      return { ok: false, rule: "467.2.c", detail: "each assignment must be { targetId, amount }" };
    }
    const { targetId, amount } = entry as { targetId?: unknown; amount?: unknown };
    if (typeof targetId !== "string" || !byId.has(targetId)) {
      return { ok: false, rule: "467.2.c", detail: `target ${String(targetId)} is not one of the other player's units` };
    }
    if (typeof amount !== "number" || !Number.isInteger(amount) || amount < 0) {
      return { ok: false, rule: "418.1.e", detail: `amount for ${targetId} must be a non-negative integer` };
    }
    if (targetId in amounts) {
      return { ok: false, rule: "467.2.c", detail: `target ${targetId} appears twice` };
    }
    amounts[targetId] = amount;
    sum += amount;
  }
  if (sum !== total) {
    return { ok: false, rule: "467.2.c", detail: `assigned ${sum}, but exactly ${total} must be assigned` };
  }
  let fixed: Record<string, string> = {};
  if (exclusiveChoices !== undefined) {
    if (!exclusiveChoices || typeof exclusiveChoices !== "object" || Array.isArray(exclusiveChoices)) {
      return { ok: false, rule: "467.2.c.8", detail: "exclusiveChoices must be an object" };
    }
    for (const [id, choice] of Object.entries(exclusiveChoices as Record<string, unknown>)) {
      const target = byId.get(id);
      if (!target?.exclusiveChoices || typeof choice !== "string" || !target.exclusiveChoices.includes(choice)) {
        return { ok: false, rule: "467.2.c.8", detail: `${id} has no exclusive requirement ${String(choice)}` };
      }
    }
    fixed = exclusiveChoices as Record<string, string>;
  }
  let firstFailure: { ok: false; rule: RuleRef; detail: string } | null = null;
  for (const choices of choiceCombos(targets, fixed)) {
    const verdict = checkUnderChoices(targets, total, amounts, choices);
    if (verdict.ok) return { ok: true, amounts, choices };
    firstFailure ??= verdict;
  }
  return firstFailure ?? { ok: false, rule: "467.2.c", detail: "no legal assignment" };
}

/* ---------------------------------------------------------------- enumeration */

function vectorKey(targets: readonly CombatDamageTarget[], amounts: Record<string, number>): string {
  return targets.map((target) => amounts[target.objectId] ?? 0).join(",");
}

function toAssignment(targets: readonly CombatDamageTarget[], amounts: Record<string, number>): DamageAssignment {
  return targets.map((target) => ({ targetId: target.objectId, amount: amounts[target.objectId] ?? 0 }));
}

/**
 * Up to `limit` distinct legal assignments (467.2.c), in the 467.2.c.3 greedy order: the lowest
 * tier first, then list order. Used to auto-assign when exactly one legal assignment exists and
 * to pre-fill the prompt.
 */
export function enumerateAssignments(
  targets: readonly CombatDamageTarget[],
  total: number,
  limit = 2,
): DamageAssignment[] {
  const results = new Map<string, DamageAssignment>();
  const budget = Math.max(0, Math.trunc(total));
  const killable = targets.filter((target) => target.lethal !== null);
  const lethalSum = killable.reduce((sum, target) => sum + (target.lethal ?? 0), 0);
  if (targets.length === 0) return budget === 0 ? [[]] : [];

  if (budget >= lethalSum) {
    // Every killable unit gets its lethal value; the excess can go anywhere (467.2.c.4).
    const base: Record<string, number> = {};
    for (const target of killable) base[target.objectId] = target.lethal ?? 0;
    const excess = budget - lethalSum;
    const receivers = excess > 0 ? targets : targets.slice(0, 1);
    for (const receiver of receivers) {
      const amounts = { ...base, [receiver.objectId]: (base[receiver.objectId] ?? 0) + excess };
      results.set(vectorKey(targets, amounts), toAssignment(targets, amounts));
      if (results.size >= limit) break;
    }
    return [...results.values()];
  }

  for (const choices of choiceCombos(targets)) {
    const visited = new Set<string>();
    const walk = (full: string[], remaining: number): boolean => {
      const key = [...full].sort().join("|");
      if (visited.has(key)) return false;
      visited.add(key);
      const pending = killable.filter((target) => !full.includes(target.objectId));
      if (remaining <= 0 || pending.length === 0) {
        const amounts: Record<string, number> = {};
        for (const id of full) amounts[id] = targets.find((target) => target.objectId === id)?.lethal ?? 0;
        results.set(vectorKey(targets, amounts), toAssignment(targets, amounts));
        return results.size >= limit;
      }
      const lowest = Math.min(...pending.map((target) => tierOf(target, choices)));
      for (const candidate of pending.filter((target) => tierOf(target, choices) === lowest)) {
        const lethal = candidate.lethal ?? 0;
        if (remaining >= lethal) {
          if (walk([...full, candidate.objectId], remaining - lethal)) return true;
        } else {
          const amounts: Record<string, number> = {};
          for (const id of full) amounts[id] = targets.find((target) => target.objectId === id)?.lethal ?? 0;
          amounts[candidate.objectId] = remaining;
          results.set(vectorKey(targets, amounts), toAssignment(targets, amounts));
          if (results.size >= limit) return true;
        }
      }
      return false;
    };
    if (walk([], budget)) break;
  }
  return [...results.values()];
}

/** A legal assignment in 467.2.c.3 greedy order (null when none exists). */
export function defaultAssignment(targets: readonly CombatDamageTarget[], total: number): DamageAssignment | null {
  return enumerateAssignments(targets, total, 1)[0] ?? null;
}
