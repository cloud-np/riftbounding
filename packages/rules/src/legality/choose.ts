/** Prompt-answer verdict — rule 411.2. Shared by `rules_choose`, `explainIllegal` and the handler. */
import type { Prompt, PromptAnswer, Room } from "@rift/protocol";
import type { RulesFailure } from "../types";
import { fail } from "../types";
import { promptAnswerVerdict } from "../prompts/handlers";
import { COMBAT_PROMPT_REASONS } from "../prompts/combat/reasons";
import { damageAssignmentVerdict } from "../prompts/combat/damage-assignment";

export type ChooseVerdict = { ok: true; prompt: Prompt } | RulesFailure;

/** 411.2: the instructed player answers a pending Limited-Action prompt. */
export function chooseVerdict(
  room: Room,
  playerId: string,
  promptId: string,
  answer: PromptAnswer,
): ChooseVerdict {
  const rules = room.rules;
  if (!rules) return fail("rules_require_strict", "contract:§1");
  const prompt = rules.prompt;
  if (!prompt) return fail("no_pending_prompt", "411.2");
  if (prompt.id !== promptId) return fail("no_pending_prompt", "411.2");
  if (prompt.playerId !== playerId) return fail("not_your_priority", "411.2");
  const answerVerdict = promptAnswerVerdict(prompt, answer);
  if (!answerVerdict.ok) return answerVerdict;
  // 467.2.c: a damage assignment is checked against the assignment rules here too, so
  // `explainIllegal` answers exactly what the handler would reject (R2-combat's verdict).
  if (prompt.data?.reason === COMBAT_PROMPT_REASONS.damageAssignment) {
    const assignment = damageAssignmentVerdict(room, prompt, answer);
    if (!assignment.ok) return assignment;
  }
  return { ok: true, prompt };
}
