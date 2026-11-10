/**
 * @rift/protocol — strict auto-pass / auto-resolve preferences (additive).
 *
 * Players should not have to click Pass over and over through long chains, trigger loops or
 * prompts that have exactly one legal answer. Each seat stores its own preferences on
 * `RulesState.autoPass[playerId]`; the rules layer applies them after every accepted intent,
 * through the same handlers a manual `rules_pass` / `rules_choose` / `rules_end_turn` uses, so
 * an automatic action is always one the player could legally have taken.
 *
 * Design, defaults and the hidden-information analysis: `docs/rules/auto-pass.md`.
 */

/**
 * Response windows (an opponent's item on top of the chain, or showdown Focus with an empty
 * chain):
 * - `"stop"` — always stop and wait for the player;
 * - `"safe"` — pass automatically only when public information alone proves the player has no
 *   legal response (empty hand, no facedown card, and no legal play/activation). Leaks nothing.
 * - `"no_response"` — pass automatically whenever the player has no legal response. **Leaks
 *   hand information**: the opponent sees an instant pass exactly when no response existed.
 */
export type AutoPassResponseMode = "stop" | "safe" | "no_response";

/**
 * Prompts with exactly one legal answer (411.2):
 * - `"off"` — always ask;
 * - `"safe"` — answer automatically only when the single answer follows from public
 *   information (every option is a public object/player/value, or the options are the whole of
 *   a hidden zone whose size is public). Leaks nothing.
 * - `"all"` — also answer when the single answer depends on hidden cards (e.g. only one card in
 *   hand qualifies). **Leaks hand information.**
 */
export type AutoResolveMode = "off" | "safe" | "all";

/**
 * Ending the player's own turn (316.9) when they reach a Neutral Open Main Phase with nothing
 * legal to do:
 * - `"manual"` — always wait for End turn;
 * - `"safe"` — end it automatically only when public information proves there is nothing to do
 *   (empty hand, no facedown card, no legal play/activation/move). Leaks nothing.
 * - `"no_action"` — end it automatically whenever no play, activation or move is legal.
 *   **Leaks hand information** (the turn ends instantly exactly when nothing was playable).
 * At most one turn is ended automatically per transition.
 */
export type AutoEndTurnMode = "manual" | "safe" | "no_action";

/** A one-shot "pass until …" stop override (cleared when it ends). */
export interface AutoPassUntil {
  /**
   * - `"end_of_turn"` — pass every Priority/Focus window until turn `turn` ends; on the
   *   player's own turn this also ends the turn once they reach a Neutral Open state;
   * - `"opponent_action"` — pass every window until an opponent takes a Discretionary Action
   *   (plays a card, activates an ability or moves a unit) or turn `turn` ends.
   */
  kind: "end_of_turn" | "opponent_action";
  /** The turn number the override was set on (`RulesState.turn.number`). */
  turn: number;
}

/** A remembered "yes to all" answer for repeated identical prompts (cleared at turn end). */
export interface AutoPassStandingAnswer {
  /** Stable prompt signature (`reason|promptKey|kind|source|options`). */
  signature: string;
  /** The answer replayed for every later identical prompt. */
  answer: { optionIds?: string[] };
  /** Turn the answer was given on; it expires when the turn ends. */
  turn: number;
}

export interface AutoPassPrefs {
  /**
   * 337.4 / 340.4: pass Priority automatically when the player's own item is on top of the
   * chain (their triggered abilities, and their spells/abilities after a response resolved).
   * Plays and activations already auto-pass unless held (owner decision 3). Leaks nothing:
   * it never depends on the player's cards.
   */
  ownItems: boolean;
  /** Response windows (see `AutoPassResponseMode`). */
  responses: AutoPassResponseMode;
  /** Prompts with exactly one legal answer (see `AutoResolveMode`). */
  forcedPrompts: AutoResolveMode;
  /** Ending one's own turn when nothing is legal (see `AutoEndTurnMode`). */
  endTurn: AutoEndTurnMode;
  /**
   * Full control (the "hold priority" override): never pass on this player's behalf — not even
   * the owner-decision-3 pass after their own play/activation. Forced prompts still follow
   * `forcedPrompts`.
   */
  hold: boolean;
  /** Optional one-shot stop override. */
  passUntil?: AutoPassUntil | null;
  /** "Yes to all" answers for repeated identical prompts this turn. */
  standing?: AutoPassStandingAnswer[];
}

/** `rules_set_auto_pass` payload: a partial update merged into the player's preferences. */
export type AutoPassPrefsUpdate = Partial<Omit<AutoPassPrefs, "standing">> & {
  /** `true` clears every remembered "yes to all" answer. */
  clearStanding?: boolean;
};
