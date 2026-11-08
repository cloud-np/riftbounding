/**
 * Prompt reason registry — 411.2 Limited Actions + 432/323.11/323.12.
 *
 * The emitter (`cleanup/cleanup.ts`, `actions/draw.ts`) and the handler registry
 * (`prompts/handlers.ts`) import these constants, so the wire strings cannot drift again
 * (the round-1 bug was cleanup emitting "stage_showdown" while the handler was registered
 * under "staged_showdown").
 *
 * This module has no imports: both the emitter side and the handler side can depend on it
 * without creating a runtime cycle.
 */
export const PROMPT_REASONS = {
  /** 432.2.c: choose an opponent to gain 1 point after a Burn Out. */
  burnOut: "burn_out",
  /** 323.11: the Turn Player chooses one of several staged Showdowns. */
  stageShowdown: "stage_showdown",
  /** 323.12: the Turn Player chooses one of several staged Combats. */
  stageCombat: "stage_combat",
} as const;

export type PromptReason = (typeof PROMPT_REASONS)[keyof typeof PROMPT_REASONS];
