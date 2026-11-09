/**
 * Prompt reasons owned by R2-play (411.2).
 *
 * The emitter (`play/prompting.ts`) and the handlers (`prompts/play/handlers.ts`) import these
 * constants, so the wire strings cannot drift.
 */
export const PLAY_PROMPT_REASONS = {
  /** 355.3–355.5 / 403.2: a play-time choice (mode, target, X) of a Pending item. */
  choice: "play.choice",
  /** 357.2: which objects pay a non-standard cost (exhaust/discard/kill) of a Pending item. */
  cost: "play.cost",
  /** 403.1 "you may" / 405.2 pay or decline: a Pending triggered ability's yes/no decision. */
  trigger: "play.trigger",
} as const;

export type PlayPromptReason = (typeof PLAY_PROMPT_REASONS)[keyof typeof PLAY_PROMPT_REASONS];
