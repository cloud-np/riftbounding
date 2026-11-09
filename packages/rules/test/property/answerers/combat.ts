// owner: R2-combat; register domain answerers here
import type { CombatDamageAssignmentData, CombatDamageTarget } from "@rift/protocol";
import { enumerateAssignments } from "../../../src";
import { registerPromptAnswerer } from "./registry";

/**
 * 467.2.c: answer a damage-assignment prompt with a legal assignment. The suggested assignment
 * (467.2.c.3 greedy order) is used when present; otherwise one is enumerated from the targets.
 */
registerPromptAnswerer("combat.damage_assignment", (prompt) => {
  const data = prompt.data as Partial<CombatDamageAssignmentData> | undefined;
  if (!data || !Array.isArray(data.targets) || typeof data.total !== "number") return undefined;
  const assignment =
    data.suggested ?? enumerateAssignments(data.targets as CombatDamageTarget[], data.total, 1)[0];
  if (!assignment) return undefined;
  return { assignments: assignment };
});
