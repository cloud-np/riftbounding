/**
 * Prompt reasons owned by R2-effects (411.2).
 *
 * Empty in R1 so `PROMPT_REASONS` stays byte-identical. R2-effects adds string constants here
 * and registers the matching handler under the same value.
 */
export const EFFECTS_PROMPT_REASONS = {} as const;

export type EffectsPromptReason = (typeof EFFECTS_PROMPT_REASONS)[keyof typeof EFFECTS_PROMPT_REASONS];
