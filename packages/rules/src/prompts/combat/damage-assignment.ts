/**
 * 467.2.c damage-assignment prompt handler (`CombatDamageAssignmentData`).
 *
 * The answer `{ assignments: Array<{ targetId, amount }>, exclusiveChoices? }` is validated
 * strictly against the prompt's targets (467.2.c.3 / c.4 / c.6–c.10); a violation returns
 * `invalid_choice` with the violated rule and the prompt stays pending (411.2 / NEW-11). A legal
 * answer is marked on the targets and the Steps of Combat continue (the Defender assigns next,
 * then damage is dealt simultaneously, 467.2.d).
 */
import type { CombatDamageAssignmentData, CombatDamageTarget, Prompt, PromptAnswer, Room, Verdict } from "@rift/protocol";
import { fail } from "../../types";
import { registerPromptHandler } from "../handlers";
import { validateAssignment } from "../../combat/assignment";
import { recordAssignment } from "../../combat/damage";
import { COMBAT_PROMPT_REASONS } from "./reasons";

function assignmentData(prompt: Prompt): CombatDamageAssignmentData | null {
  const data = prompt.data as Partial<CombatDamageAssignmentData> | undefined;
  if (!data || data.reason !== COMBAT_PROMPT_REASONS.damageAssignment) return null;
  if (typeof data.assignerId !== "string" || typeof data.total !== "number" || !Array.isArray(data.targets)) {
    return null;
  }
  return data as CombatDamageAssignmentData;
}

/**
 * Verdict for a damage-assignment answer — shared by the handler and `chooseVerdict` (the
 * `rules_choose` write path and `explainIllegal`).
 */
export function damageAssignmentVerdict(room: Room, prompt: Prompt, answer: PromptAnswer): Verdict {
  const data = assignmentData(prompt);
  if (!data) return fail("invalid_choice", prompt.rule ?? "467.2.c", "not a damage-assignment prompt");
  const combat = room.rules?.combat;
  if (!combat || combat.battlefield !== data.battlefield) {
    return fail("invalid_choice", "467.2.c", "no combat is assigning damage at this battlefield");
  }
  const verdict = validateAssignment(data.targets as CombatDamageTarget[], data.total, answer.assignments, answer.exclusiveChoices);
  if (!verdict.ok) return fail("invalid_choice", verdict.rule, verdict.detail);
  return { ok: true };
}

registerPromptHandler(COMBAT_PROMPT_REASONS.damageAssignment, ({ room, prompt, answer, step }) => {
  const data = assignmentData(prompt);
  const verdict = damageAssignmentVerdict(room, prompt, answer);
  if (!verdict.ok) return verdict;
  if (!data) return fail("invalid_choice", "467.2.c");
  const rules = room.rules!;
  const amounts = new Map((answer.assignments ?? []).map((entry) => [entry.targetId, entry.amount]));
  const assignment = data.targets.map((target) => ({
    targetId: target.objectId,
    amount: amounts.get(target.objectId) ?? 0,
  }));
  // Close this prompt before the combat continues: 321 must not see it as an open resolution.
  if (rules.prompt?.id === prompt.id) rules.prompt = null;
  recordAssignment(room, step, data.assignerId, data.total, assignment, false);
  // 467.2.c: the next assigner (or 467.2.d) runs as the combat Task.
  rules.tasks.push({
    id: step.host.nextId("task"),
    kind: "combat",
    zone: rules.combat!.battlefield,
    playerId: data.assignerId,
  });
  return { ok: true };
});
