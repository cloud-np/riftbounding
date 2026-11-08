/**
 * Prompt reasons owned by R2-combat (411.2).
 *
 * Empty in R1 so `PROMPT_REASONS` stays byte-identical. R2-combat adds string constants here
 * and registers the matching handler under the same value.
 */
export const COMBAT_PROMPT_REASONS = {} as const;

export type CombatPromptReason = (typeof COMBAT_PROMPT_REASONS)[keyof typeof COMBAT_PROMPT_REASONS];
