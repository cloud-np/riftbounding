/**
 * Prompt reasons owned by R2-combat (411.2).
 *
 * R2-combat adds string constants here and registers the matching handler under the same value.
 */
export const COMBAT_PROMPT_REASONS = {
  /** 467.2.c: assign combat damage (`CombatDamageAssignmentData.reason`). */
  damageAssignment: "combat.damage_assignment",
} as const;

export type CombatPromptReason = (typeof COMBAT_PROMPT_REASONS)[keyof typeof COMBAT_PROMPT_REASONS];
