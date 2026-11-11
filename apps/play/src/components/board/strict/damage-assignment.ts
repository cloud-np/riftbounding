/**
 * Client-side mirror of the engine's 467.2.c damage-assignment validator
 * (`packages/rules/src/combat/assignment.ts` `validateAssignment`), so the dialog can stop a
 * player from building an illegal split instead of letting the server reject it. apps/play does
 * not depend on `@rift/rules`; `__tests__/damage-assignment.test.ts` cross-checks this mirror
 * against the engine on the same inputs.
 */
import type { CombatDamageTarget } from "@rift/protocol";

export type AssignTarget = Pick<CombatDamageTarget, "objectId" | "lethal" | "tier" | "exclusiveChoices">;
export type Draft = Record<string, number>;

/** 467.2.c.8: exclusionary requirement → assignment tier. */
const EXCLUSIVE_TIERS: Readonly<Record<string, number>> = { tank: 0, backline: 2 };

export type Violation =
  | { kind: "lethal-first"; rule: "467.2.c.3"; unit: string }
  | { kind: "cannot-be-dealt"; rule: "467.2.c.10"; unit: string }
  | { kind: "over-lethal"; rule: "467.2.c.4"; unit: string }
  | { kind: "two-partial"; rule: "467.2.c.3"; unit: string; other: string }
  | { kind: "tier"; rule: "467.2.c.6"; unit: string; other: string }
  | { kind: "total"; rule: "467.2.c"; assigned: number; total: number };

export type DraftVerdict = { ok: true } | { ok: false; violation: Violation };

function choiceCombos(targets: readonly AssignTarget[]): Array<Record<string, string>> {
  let combos: Array<Record<string, string>> = [{}];
  for (const target of targets) {
    const options = target.exclusiveChoices;
    if (!options || options.length === 0) continue;
    const next: Array<Record<string, string>> = [];
    for (const combo of combos) {
      for (const option of options) next.push({ ...combo, [target.objectId]: option });
      if (next.length > 256) break;
    }
    combos = next;
  }
  return combos;
}

function tierOf(target: AssignTarget, choices: Record<string, string>): number {
  const choice = choices[target.objectId];
  if (choice !== undefined && EXCLUSIVE_TIERS[choice] !== undefined) return EXCLUSIVE_TIERS[choice]!;
  return target.tier;
}

function checkUnderChoices(
  targets: readonly AssignTarget[],
  total: number,
  draft: Draft,
  choices: Record<string, string>,
): DraftVerdict {
  const killable = targets.filter((target) => target.lethal !== null);
  const lethalSum = killable.reduce((sum, target) => sum + (target.lethal ?? 0), 0);
  const amount = (target: AssignTarget) => draft[target.objectId] ?? 0;
  if (total >= lethalSum) {
    for (const target of killable) {
      if (amount(target) < (target.lethal ?? 0)) {
        return { ok: false, violation: { kind: "lethal-first", rule: "467.2.c.3", unit: target.objectId } };
      }
    }
    return { ok: true };
  }
  for (const target of targets) {
    if (target.lethal === null && amount(target) > 0) {
      return { ok: false, violation: { kind: "cannot-be-dealt", rule: "467.2.c.10", unit: target.objectId } };
    }
  }
  let partial: AssignTarget | null = null;
  for (const target of killable) {
    const value = amount(target);
    if (value > (target.lethal ?? 0)) {
      return { ok: false, violation: { kind: "over-lethal", rule: "467.2.c.4", unit: target.objectId } };
    }
    if (value > 0 && value < (target.lethal ?? 0)) {
      if (partial) {
        return {
          ok: false,
          violation: { kind: "two-partial", rule: "467.2.c.3", unit: target.objectId, other: partial.objectId },
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
          violation: { kind: "tier", rule: "467.2.c.6", unit: other.objectId, other: receiver.objectId },
        };
      }
    }
  }
  return { ok: true };
}

/** Same verdict as the engine's `validateAssignment` for a full draft (sum must equal total). */
export function validateDraft(targets: readonly AssignTarget[], total: number, draft: Draft): DraftVerdict {
  const assigned = targets.reduce((sum, target) => sum + (draft[target.objectId] ?? 0), 0);
  if (assigned !== total) {
    return { ok: false, violation: { kind: "total", rule: "467.2.c", assigned, total } };
  }
  let first: DraftVerdict | null = null;
  for (const choices of choiceCombos(targets)) {
    const verdict = checkUnderChoices(targets, total, draft, choices);
    if (verdict.ok) return verdict;
    first ??= verdict;
  }
  return first ?? { ok: true };
}

const SEARCH_NODE_LIMIT = 60_000;

/**
 * Can the (possibly partial) draft still be completed to a legal assignment by only adding
 * damage? Bounded depth-first search; when the bound is hit the answer is "yes" so the UI never
 * blocks a legal move (the engine stays the authority).
 */
export function canComplete(targets: readonly AssignTarget[], total: number, draft: Draft): boolean {
  const base = targets.map((target) => draft[target.objectId] ?? 0);
  const used = base.reduce((a, b) => a + b, 0);
  if (used > total) return false;
  let nodes = 0;
  const current = [...base];
  const visit = (index: number, left: number): boolean | "limit" => {
    if (++nodes > SEARCH_NODE_LIMIT) return "limit";
    if (index === targets.length - 1) {
      current[index] = base[index]! + left;
      const map: Draft = {};
      targets.forEach((target, i) => (map[target.objectId] = current[i]!));
      return validateDraft(targets, total, map).ok;
    }
    for (let add = 0; add <= left; add += 1) {
      current[index] = base[index]! + add;
      const result = visit(index + 1, left - add);
      if (result !== false) return result;
    }
    current[index] = base[index]!;
    return false;
  };
  if (targets.length === 0) return total === 0;
  return visit(0, total - used) !== false;
}

/** Whether "+1" on `target` keeps the assignment completable (and damage remains). */
export function canStepUp(targets: readonly AssignTarget[], total: number, draft: Draft, target: AssignTarget): boolean {
  const used = targets.reduce((sum, entry) => sum + (draft[entry.objectId] ?? 0), 0);
  if (used >= total) return false;
  return canComplete(targets, total, { ...draft, [target.objectId]: (draft[target.objectId] ?? 0) + 1 });
}

/* ------------------------------------------------------------------ plain-language hints */

const ruleSuffix = (rule: string) => ` (rule ${rule})`;
const lethalOf = (targets: readonly AssignTarget[], id: string) => targets.find((t) => t.objectId === id)?.lethal ?? 0;

function list(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** Plain sentence for an engine-style violation (no object ids). */
export function violationText(
  targets: readonly AssignTarget[],
  draft: Draft,
  violation: Violation,
  nameOf: (id: string) => string,
): string {
  const rule = ruleSuffix(violation.rule);
  switch (violation.kind) {
    case "over-lethal": {
      const needy = targets
        .filter((t) => t.lethal !== null && t.objectId !== violation.unit && (draft[t.objectId] ?? 0) < (t.lethal ?? 0))
        .map((t) => nameOf(t.objectId));
      return `${nameOf(violation.unit)} already has lethal damage (${lethalOf(targets, violation.unit)}). The rest must go to ${needy.length ? list(needy) : "another unit"}${rule}.`;
    }
    case "lethal-first":
      return `${nameOf(violation.unit)} must be assigned lethal damage (${lethalOf(targets, violation.unit)}) before any extra damage goes elsewhere${rule}.`;
    case "two-partial":
      return `Only one unit can take less than lethal damage. Finish ${nameOf(violation.other)} (lethal ${lethalOf(targets, violation.other)}) before ${nameOf(violation.unit)}${rule}.`;
    case "tier":
      return `${nameOf(violation.unit)} must be assigned lethal damage (${lethalOf(targets, violation.unit)}) before ${nameOf(violation.other)}${rule}.`;
    case "cannot-be-dealt":
      return `${nameOf(violation.unit)} can't be dealt damage; it only takes damage once every other unit has lethal damage${rule}.`;
    case "total":
      return `Assign exactly ${violation.total} damage (${violation.assigned} assigned)${rule}.`;
  }
}

/**
 * The inline hint for the current draft: why a "+" is blocked while damage remains, or why the
 * full draft is illegal. null when nothing needs explaining.
 */
export function assignmentHint(
  targets: readonly AssignTarget[],
  total: number,
  draft: Draft,
  nameOf: (id: string) => string,
): string | null {
  const used = targets.reduce((sum, t) => sum + (draft[t.objectId] ?? 0), 0);
  const left = total - used;
  if (left <= 0) {
    const verdict = validateDraft(targets, total, draft);
    return verdict.ok ? null : violationText(targets, draft, verdict.violation, nameOf);
  }
  const blocked = targets.filter((t) => !canStepUp(targets, total, draft, t));
  if (blocked.length === 0) return null;
  const allowed = targets.filter((t) => !blocked.includes(t));
  const full = blocked.filter((t) => t.lethal !== null && (draft[t.objectId] ?? 0) >= (t.lethal ?? 0) && (t.lethal ?? 0) > 0);
  if (full.length > 0 && allowed.length > 0) {
    const verb = full.length === 1 ? "already has" : "already have";
    const lethal = full.length === 1 ? ` (${full[0]!.lethal})` : "";
    return `${list(full.map((t) => nameOf(t.objectId)))} ${verb} lethal damage${lethal}. The remaining ${left} must go to ${list(allowed.map((t) => nameOf(t.objectId)))}${ruleSuffix("467.2.c.4")}.`;
  }
  if (allowed.length > 0) {
    return `${list(blocked.map((t) => nameOf(t.objectId)))} can't take more yet: lethal damage must be assigned in full before the next unit${ruleSuffix("467.2.c.3")}. Remaining ${left} must go to ${list(allowed.map((t) => nameOf(t.objectId)))}.`;
  }
  return null;
}
