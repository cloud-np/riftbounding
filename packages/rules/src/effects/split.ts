/**
 * Split damage answers — rules 355.14.e, 355.14.f, 355.14.g, 355.14.h, 355.14.h.1.
 *
 * Shared by the `deal_split` op (which asks), the `effects.resume` handler (which rejects an
 * illegal answer and keeps the prompt pending, 411.2) and `chooseVerdict` (so `explainIllegal`
 * agrees with the write path). Pure.
 */
import type { PromptAnswer, Verdict } from "@rift/protocol";
import { fail } from "../types";

export interface SplitAsk {
  answer: "split";
  total: number;
  targets: string[];
  /** 355.14.g: valid damage is at least 1 per target. */
  minEach: number;
}

export interface DropAsk {
  answer: "objects";
  /** 355.14.h.1: exactly this many targets remain (one per point of damage). */
  exact: number;
}

export interface SplitShare {
  targetId: string;
  amount: number;
}

export function isSplitAsk(ask: unknown): ask is SplitAsk {
  const record = ask as Partial<SplitAsk> | null;
  return !!record && record.answer === "split" && typeof record.total === "number" && Array.isArray(record.targets);
}

/** Normalize `answer.assignments` (combined per target). */
export function splitShares(answer: PromptAnswer): SplitShare[] {
  const out = new Map<string, number>();
  for (const entry of answer.assignments ?? []) {
    if (!entry || typeof entry.targetId !== "string" || typeof entry.amount !== "number") continue;
    out.set(entry.targetId, (out.get(entry.targetId) ?? 0) + entry.amount);
  }
  return [...out.entries()].map(([targetId, amount]) => ({ targetId, amount }));
}

/**
 * 355.14.e–g: every target receives a positive integer amount (≥ `minEach`), nothing else
 * receives damage, and the shares add up to the total.
 */
export function splitAnswerVerdict(ask: SplitAsk, answer: PromptAnswer): Verdict {
  if (!Array.isArray(answer.assignments)) return fail("invalid_choice", "355.14.e", "answer.assignments is required");
  const shares = splitShares(answer);
  const targets = new Set(ask.targets);
  let sum = 0;
  for (const share of shares) {
    if (!targets.has(share.targetId)) return fail("invalid_choice", "355.14.d", `${share.targetId} is not a target`);
    if (!Number.isInteger(share.amount) || share.amount < ask.minEach) {
      return fail("invalid_choice", "355.14.g", `${share.targetId}: ${share.amount}`);
    }
    sum += share.amount;
  }
  for (const id of ask.targets) {
    if (!shares.some((share) => share.targetId === id)) return fail("invalid_choice", "355.14.f", `${id} receives no damage`);
  }
  if (sum !== ask.total) return fail("invalid_choice", "355.14.e", `assigned ${sum} of ${ask.total}`);
  return { ok: true };
}
