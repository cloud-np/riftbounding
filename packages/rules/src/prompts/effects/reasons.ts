/**
 * Prompt reasons owned by R2-effects (411.2).
 *
 * The emitters (`effects/machine.ts`, `triggers/*`) and the handlers (`prompts/effects/*`)
 * import these constants, so the wire strings cannot drift.
 */
export const EFFECTS_PROMPT_REASONS = {
  /** 355.18 / 411.2: a decision made while a spell or ability resolves (may, pick, mode, …). */
  resume: "effects.resume",
  /** 383.3.d / 383.3.d.1: a player orders their simultaneous triggered abilities. */
  orderTriggers: "effects.order_triggers",
} as const;

export type EffectsPromptReason = (typeof EFFECTS_PROMPT_REASONS)[keyof typeof EFFECTS_PROMPT_REASONS];
