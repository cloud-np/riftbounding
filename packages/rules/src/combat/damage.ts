/**
 * The Combat Damage Step — rule 467 (467.1, 467.2.a–d, 467.3); 418.1.a, 424.1.b, 143.2.c.
 *
 * Starting with the Attacker, each player assigns damage equal to their side's summed Might
 * among the other side's units (467.2.c). A single legal assignment is made automatically;
 * otherwise the assigner answers a `damage-assignment` prompt (`CombatDamageAssignmentData`).
 * Assigned damage is marked on the target (`assignedDamage`, 467.2.c.1) and dealt to every unit
 * simultaneously once both sides have assigned (467.2.c.1.a / 467.2.d).
 */
import type { CombatDamageAssignmentData, Prompt, Room } from "@rift/protocol";
import type { RulesStepContext } from "../types";
import { pushEvent } from "../types";
import { dealDamage } from "../actions/damage";
import { COMBAT_PROMPT_REASONS } from "../prompts/combat/reasons";
import {
  damageTargets,
  enumerateAssignments,
  type DamageAssignment,
} from "./assignment";
import { combatContribution } from "./keywords";
import { unitsPresentAt } from "../state/presence";

/** Units at the combat battlefield holding `designation` (467.2.a / 467.2.b). */
export function combatSideUnits(room: Room, step: RulesStepContext, side: "attacker" | "defender"): string[] {
  const rules = room.rules;
  const combat = rules?.combat;
  if (!rules || !combat) return [];
  return unitsPresentAt(room, step.host, combat.battlefield)
    .filter((card) => rules.objects[card.id]?.designation === side)
    .map((card) => card.id);
}

/** 467.1: both Attacking and Defending units remain at the battlefield. */
export function bothSidesRemain(room: Room, step: RulesStepContext): boolean {
  return combatSideUnits(room, step, "attacker").length > 0 && combatSideUnits(room, step, "defender").length > 0;
}

/** 467.2.a / 467.2.b: the summed Might of a side (stunned units contribute 0, 424.1.b). */
export function combatSideTotal(room: Room, step: RulesStepContext, side: "attacker" | "defender"): number {
  return combatSideUnits(room, step, side).reduce(
    (sum, unitId) => sum + combatContribution(room, unitId, step.host),
    0,
  );
}

/** The assignment problem for `assignerId` (467.2.c): their total and the other side's units. */
export function assignmentDataFor(room: Room, step: RulesStepContext, assignerId: string): CombatDamageAssignmentData | null {
  const combat = room.rules?.combat;
  if (!combat) return null;
  const side = assignerId === combat.attacker ? "attacker" : assignerId === combat.defender ? "defender" : null;
  if (!side) return null;
  const total = combatSideTotal(room, step, side);
  const targetIds = combatSideUnits(room, step, side === "attacker" ? "defender" : "attacker");
  const targets = damageTargets(room, step.host, targetIds, total);
  const suggested = enumerateAssignments(targets, total, 1)[0];
  return {
    reason: COMBAT_PROMPT_REASONS.damageAssignment,
    battlefield: combat.battlefield,
    assignerId,
    total,
    targets,
    ...(suggested ? { suggested } : {}),
  };
}

/** 467.2.c / 467.2.c.1: mark the assignment on the targets (assigning is not dealing). */
export function recordAssignment(
  room: Room,
  step: RulesStepContext,
  assignerId: string,
  total: number,
  assignment: DamageAssignment,
  auto: boolean,
): void {
  const rules = room.rules;
  const progress = rules?.history.combatProgress;
  if (!rules || !progress) return;
  for (const { targetId, amount } of assignment) {
    if (amount <= 0) continue;
    const object = (rules.objects[targetId] ??= {});
    object.assignedDamage = (object.assignedDamage ?? 0) + amount;
    object.assignedBy = assignerId;
  }
  progress.assigned = [...(progress.assigned ?? []), assignerId];
  progress.totals = { ...(progress.totals ?? {}), [assignerId]: total };
  pushEvent(step.events, {
    type: "damage_assigned",
    playerId: assignerId,
    zone: progress.battlefield,
    amount: total,
    data: { rule: "467.2.c", auto, assignments: assignment.filter((entry) => entry.amount > 0) },
  });
}

/**
 * 467.2.c: work through the assigners in order (Attacker first). Returns `"await"` when a
 * damage-assignment prompt was opened, `"done"` when every side has assigned.
 */
export function runAssignments(room: Room, step: RulesStepContext): "await" | "done" {
  const rules = room.rules;
  const combat = rules?.combat;
  const progress = rules?.history.combatProgress;
  if (!rules || !combat || !progress) return "done";
  for (const assignerId of [combat.attacker, combat.defender]) {
    if (progress.assigned?.includes(assignerId)) continue;
    const data = assignmentDataFor(room, step, assignerId);
    if (!data) continue;
    const legal = enumerateAssignments(data.targets, data.total, 2);
    if (legal.length === 1) {
      // Contract: exactly one legal assignment → assign automatically, no prompt.
      recordAssignment(room, step, assignerId, data.total, legal[0]!, true);
      continue;
    }
    if (legal.length === 0) {
      // Defensive: no legal assignment can only mean there is nothing to assign to.
      recordAssignment(room, step, assignerId, data.total, [], true);
      continue;
    }
    openAssignmentPrompt(room, step, data);
    return "await";
  }
  return "done";
}

/** 411.2 / 467.2.c: the assigner chooses the distribution. */
export function openAssignmentPrompt(room: Room, step: RulesStepContext, data: CombatDamageAssignmentData): Prompt | null {
  const rules = room.rules;
  const combat = rules?.combat;
  if (!rules || !combat) return null;
  const prompt: Prompt = {
    id: step.host.nextId("prompt"),
    kind: "damage-assignment",
    playerId: data.assignerId,
    promptKey: "rules.prompt.combatDamageAssignment",
    rule: "467.2.c",
    options: data.targets.map((target) => ({ id: target.objectId, objectId: target.objectId, cardId: target.objectId })),
    min: 0,
    max: data.targets.length,
    data: { ...data },
  };
  rules.prompt = prompt;
  combat.step = "damage-assignment";
  pushEvent(step.events, {
    type: "prompt",
    playerId: data.assignerId,
    zone: combat.battlefield,
    data: { kind: prompt.kind, reason: data.reason },
  });
  return prompt;
}

/**
 * 467.2.d / 467.2.c.1.a: deal every unit the damage assigned to it, simultaneously. The
 * assignment already reflects replacement effects (467.2.c.5); dealing runs the amount through
 * the `deal_damage` interceptors once, so the replaced amount is dealt exactly once (the
 * doubling "has already happened during damage assignment") and prevention applies (438.5).
 */
export function dealAssignedDamage(room: Room, step: RulesStepContext): { dealt: Record<string, number> } {
  const rules = room.rules;
  const combat = rules?.combat;
  const dealt: Record<string, number> = {};
  if (!rules || !combat) return { dealt };
  const assigned = Object.entries(rules.objects)
    .filter(([, object]) => (object.assignedDamage ?? 0) > 0)
    .map(([id, object]) => ({ id, amount: object.assignedDamage ?? 0, by: object.assignedBy }));
  for (const object of Object.values(rules.objects)) {
    delete object.assignedDamage;
    delete object.assignedBy;
  }
  for (const entry of assigned) {
    dealt[entry.id] = dealDamage(room, entry.id, entry.amount, step, {
      combat: true,
      ...(entry.by ? { playerId: entry.by } : {}),
    });
  }
  const progress = rules.history.combatProgress;
  pushEvent(step.events, {
    type: "combat_damage",
    zone: combat.battlefield,
    data: {
      rule: "467.2.d",
      attackerDamage: progress?.totals?.[combat.attacker] ?? 0,
      defenderDamage: progress?.totals?.[combat.defender] ?? 0,
      dealt,
    },
  });
  return { dealt };
}

/**
 * Legacy entry point (R1 API): run the Combat Damage Step as far as it can go — 467.1, the
 * assignments (467.2.c; stops at a prompt) and the simultaneous deal (467.2.d). Returns true
 * when the step made progress. The full Steps of Combat are driven by `continueCombat`.
 */
export function runCombatDamage(room: Room, step: RulesStepContext): boolean {
  const rules = room.rules;
  const combat = rules?.combat;
  if (!rules || !combat) return false;
  const progress = (rules.history.combatProgress ??= { battlefield: combat.battlefield, stage: "damage" });
  if (progress.stage === "damage") {
    combat.step = "damage";
    progress.stage = bothSidesRemain(room, step) ? "assign" : "cleanup";
  }
  if (progress.stage === "assign") {
    if (runAssignments(room, step) === "await") return true;
    progress.stage = "deal";
  }
  if (progress.stage === "deal") {
    combat.step = "damage";
    dealAssignedDamage(room, step);
    // 467.3: skip the FEPR process, cancel outstanding tasks, proceed to the Resolution Step.
    rules.tasks = [];
    progress.stage = "cleanup";
    combat.step = "resolution";
  }
  return true;
}
