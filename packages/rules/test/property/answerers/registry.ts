/**
 * Property-test prompt answerers — cross-domain registry.
 *
 * Owner: R2 lead (shared test infrastructure). Domain answerers live next to this file and
 * register at import time. Consumers: `generators.ts` (`promptAnswerFor`).
 */
import type { Prompt, PromptAnswer, Room } from "@rift/protocol";

export type PromptAnswerer = (prompt: Prompt, room: Room) => PromptAnswer | undefined;

const REASON_ANSWERS = new Map<string, PromptAnswerer>();
const KIND_ANSWERS = new Map<string, PromptAnswerer>();

/**
 * Register a domain answerer. `match` is either an exact `prompt.data.reason`
 * (e.g. "combat.damage_assignment") or "kind:<PromptKind>" (e.g. "kind:choose-mode").
 */
export function registerPromptAnswerer(match: string, fn: PromptAnswerer): void {
  if (match.startsWith("kind:")) {
    KIND_ANSWERS.set(match.slice("kind:".length), fn);
    return;
  }
  REASON_ANSWERS.set(match, fn);
}

/** Reason match first, then kind match. */
export function answerFromRegistry(prompt: Prompt, room: Room): PromptAnswer | undefined {
  const reason = prompt.data?.reason;
  if (typeof reason === "string") {
    const byReason = REASON_ANSWERS.get(reason);
    if (byReason) {
      const answer = byReason(prompt, room);
      if (answer !== undefined) return answer;
    }
  }
  return KIND_ANSWERS.get(prompt.kind)?.(prompt, room);
}
