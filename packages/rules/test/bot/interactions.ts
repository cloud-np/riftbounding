/**
 * Interaction counter for the headless self-play harness (`docs/rules/auto-pass.md`).
 *
 * Every bot action in self-play is a decision a person would have had to make (a click). This
 * module classifies each one before it is applied — prompt (forced or not), a pass on one's own
 * chain item, a response window (with or without a legal response, provably or not), a Main
 * Phase decision — and counts the automatic actions the rules layer took instead
 * (`auto_pass` / `auto_choose` / `auto_end_turn` events). Running the same seeds with and
 * without auto-pass preferences gives the before/after numbers.
 */
import type { AutoPassPrefs, GameEvent, Room } from "@rift/protocol";
import { forcedPromptAnswer, hasLegalAction, provablyNoAction, provablyNoResponse } from "../../src";
import { selfplay, type SelfplayDecision, type SelfplayOutcome, type SelfplayOptions } from "./selfplay";

export type DecisionCategory =
  | "prompt_forced_public"
  | "prompt_forced_hidden"
  | "prompt_choice"
  | "own_item_pass"
  | "own_item_respond"
  | "response_pass_provable"
  | "response_pass_hidden"
  | "response_respond"
  | "main_end_turn_only_provable"
  | "main_end_turn_only_hidden"
  | "main_action"
  | "manual";

export const DECISION_CATEGORIES: readonly DecisionCategory[] = [
  "prompt_forced_public",
  "prompt_forced_hidden",
  "prompt_choice",
  "own_item_pass",
  "own_item_respond",
  "response_pass_provable",
  "response_pass_hidden",
  "response_respond",
  "main_end_turn_only_provable",
  "main_end_turn_only_hidden",
  "main_action",
  "manual",
];

/**
 * Counterfactual on the same game: the decisions each preference set would have taken
 * automatically (so the comparison is not skewed by the bot playing a different game).
 */
export const REMOVED_BY: Record<"default" | "all", readonly DecisionCategory[]> = {
  default: ["prompt_forced_public", "own_item_pass", "response_pass_provable", "main_end_turn_only_provable"],
  all: [
    "prompt_forced_public",
    "prompt_forced_hidden",
    "own_item_pass",
    "response_pass_provable",
    "response_pass_hidden",
    "main_end_turn_only_provable",
    "main_end_turn_only_hidden",
  ],
};

export interface InteractionTally {
  seed: number;
  outcome: SelfplayOutcome;
  turns: number;
  decisions: number;
  byCategory: Record<DecisionCategory, number>;
  /** Prompt decisions by `reason|kind`. */
  prompts: Record<string, number>;
  /** Automatic actions by kind (`auto_pass:<reason>`, `auto_choose:<source>`, `auto_end_turn`). */
  auto: Record<string, number>;
  /** Longest run of consecutive bot passes (a proxy for "clicking Pass over and over"). */
  longestPassRun: number;
}

function emptyCategories(): Record<DecisionCategory, number> {
  return Object.fromEntries(DECISION_CATEGORIES.map((key) => [key, 0])) as Record<DecisionCategory, number>;
}

/** Classify one bot decision on the authoritative room (the actor's own legal intents). */
export function classifyDecision(decision: SelfplayDecision): { category: DecisionCategory; prompt?: string } {
  const { room, actor, who, intent, host } = decision;
  const rules = room.rules!;
  if (who.kind === "prompt" && rules.prompt) {
    const prompt = rules.prompt;
    const key = `${String(prompt.data?.reason ?? "-")}|${prompt.kind}`;
    const forced = forcedPromptAnswer(room, prompt, host);
    if (!forced) return { category: "prompt_choice", prompt: key };
    return { category: forced.public ? "prompt_forced_public" : "prompt_forced_hidden", prompt: key };
  }
  if (who.kind === "manual") return { category: "manual" };
  const passed = intent.type === "rules_pass";
  if (rules.chain.length > 0) {
    const top = rules.chain[rules.chain.length - 1];
    if (top?.controller === actor) return { category: passed ? "own_item_pass" : "own_item_respond" };
  }
  if (rules.chain.length > 0 || (who.kind === "focus" && rules.showdown)) {
    if (!passed) return { category: "response_respond" };
    if (provablyNoResponse(room, host, actor)) return { category: "response_pass_provable" };
    return { category: "response_pass_hidden" };
  }
  if (intent.type !== "rules_end_turn") return { category: "main_action" };
  // 164.2: the Basic Runes' resource abilities are not "something to do" (src/auto/respond.ts).
  if (hasLegalAction(room, host, actor)) return { category: "main_action" };
  return { category: provablyNoAction(room, host, actor) ? "main_end_turn_only_provable" : "main_end_turn_only_hidden" };
}

function autoKey(event: GameEvent): string | null {
  if (event.type === "auto_pass") return `auto_pass:${String(event.data?.reason ?? "?")}`;
  if (event.type === "auto_choose") return `auto_choose:${String(event.data?.source ?? "?")}`;
  if (event.type === "auto_end_turn") return "auto_end_turn";
  if (event.type === "auto_paused") return "auto_paused";
  return null;
}

/** Play one seeded game and count every decision and automatic action. */
export function countInteractions(
  seed: number,
  options: Omit<SelfplayOptions, "onDecision" | "onApplied"> & { autoPass?: AutoPassPrefs } = {},
): InteractionTally {
  const tally: InteractionTally = {
    seed,
    outcome: "win",
    turns: 0,
    decisions: 0,
    byCategory: emptyCategories(),
    prompts: {},
    auto: {},
    longestPassRun: 0,
  };
  let run = 0;
  const report = selfplay(seed, {
    ...options,
    onDecision: (decision) => {
      tally.decisions += 1;
      const { category, prompt } = classifyDecision(decision);
      tally.byCategory[category] += 1;
      if (prompt) tally.prompts[prompt] = (tally.prompts[prompt] ?? 0) + 1;
      run = decision.intent.type === "rules_pass" ? run + 1 : 0;
      tally.longestPassRun = Math.max(tally.longestPassRun, run);
    },
    onApplied: ({ events }: { room: Room; events: GameEvent[] }) => {
      for (const event of events) {
        const key = autoKey(event);
        if (key) tally.auto[key] = (tally.auto[key] ?? 0) + 1;
      }
    },
  });
  tally.outcome = report.outcome;
  tally.turns = report.turn;
  return tally;
}
