/**
 * Prompt reasons owned by R2-play (411.2).
 *
 * Empty in R1 so `PROMPT_REASONS` stays byte-identical. R2-play adds string constants here and
 * registers the matching handler under the same value.
 */
export const PLAY_PROMPT_REASONS = {} as const;

export type PlayPromptReason = (typeof PLAY_PROMPT_REASONS)[keyof typeof PLAY_PROMPT_REASONS];
