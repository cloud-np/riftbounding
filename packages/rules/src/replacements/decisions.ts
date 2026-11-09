/**
 * Replacement decisions — rules 371.2 (optional "may" replacements), 372 / 372.1 / 372.2
 * (ordering several replacements that apply to one event), 373 (simultaneous events), 374.
 *
 * The action interceptor runs synchronously inside a game-action primitive, so a decision cannot
 * be prompted there. Instead the qualifying event is **held**: the primitive does not perform it
 * (370.1.c: replacements apply before the event occurs) and a decision is recorded:
 *
 * - inside an effect resolution (the interpreter is running) the decision is queued on the step
 *   and the interpreter asks it right after the current instruction (`effects/machine.ts`), so the
 *   held event settles before the next instruction runs;
 * - otherwise (cleanup deaths, combat damage) an `effects.replacement` prompt is opened (or the
 *   decision is appended to the open one, 373) and the rest of the procedure waits behind it (321).
 *
 * Settling a held event: with several applicable replacements the controller of the object being
 * acted on (372; a player acted on decides for themself, 372.1; an uncontrolled battlefield →
 * the Turn Player, 372.2) chooses the one applied first; an optional replacement's controller
 * chooses whether to apply it (371.2.a). A declined optional replacement has not been applied
 * (371.2.b: its "once each turn" use is not spent). When every applicable replacement was
 * declined, the original action is performed (`performHeld`) without asking again.
 *
 * Events that can be held: `kill`, `deal_damage`, `recall` (the primitives whose arguments the
 * proposal fully describes). Other actions, and actions caused while a replacement is being
 * applied (370.2 nesting), use the deterministic fallback: mandatory replacements in timestamp
 * order (482), optional ones not applied.
 */
import type { Ability, Cost, Effect, PromptOption, Room } from "@rift/protocol";
import type { RulesHost } from "../host";
import type { RulesStepContext } from "../types";
import type { ActionProposal } from "../timing/hooks";
import { controllerOf, nameOf } from "../effects/objects";

const HELD = Symbol("effects.heldReplacements");
const OVERRIDE = Symbol("effects.replacementOverride");
const MACHINE = Symbol("effects.machineDepth");

type StepState = RulesStepContext & {
  [HELD]?: HeldReplacement[];
  [OVERRIDE]?: ReplacementOverride[];
  [MACHINE]?: number;
};

/** A held event waiting for a 371.2 / 372 decision (plain JSON). */
export interface HeldReplacement {
  proposal: ActionProposal;
  /** Applicable replacement ids (timestamp order) when the decision was asked. */
  candidates: string[];
  /** 371.2.b: optional replacements declined for this event. */
  declined: string[];
  /** "order" (372: which applies first) or "optional" (371.2.a: apply `chosen`?). */
  stage: "order" | "optional";
  chosen?: string;
}

/** Instructions for re-running a settled action through the interceptor. */
export interface ReplacementOverride {
  signature: string;
  declined: string[];
  /** Apply this replacement (already chosen) without asking. */
  apply?: string;
  /** Prevention shields were already applied to the held amount (438). */
  skipPrevention?: boolean;
}

export const HOLDABLE_ACTIONS: readonly string[] = ["kill", "deal_damage", "recall"];

/** Order-prompt option: apply none of the (optional, own) replacements (371.2.a). */
export const DECLINE_ALL = "$none";

export function proposalSignature(proposal: ActionProposal): string {
  return `${proposal.type}|${proposal.cardId ?? ""}|${proposal.playerId ?? ""}|${proposal.zone ?? ""}`;
}

/* ---------------------------------------------------------------- step-scoped state */

export function enterMachine(step: RulesStepContext): void {
  const state = step as StepState;
  state[MACHINE] = (state[MACHINE] ?? 0) + 1;
}

export function leaveMachine(step: RulesStepContext): void {
  const state = step as StepState;
  state[MACHINE] = Math.max(0, (state[MACHINE] ?? 1) - 1);
}

export function inMachine(step: RulesStepContext): boolean {
  return ((step as StepState)[MACHINE] ?? 0) > 0;
}

export function queueHeld(step: RulesStepContext, held: HeldReplacement): void {
  const state = step as StepState;
  const list = (state[HELD] ??= []);
  if (!list.some((entry) => proposalSignature(entry.proposal) === proposalSignature(held.proposal))) list.push(held);
}

export function isHeldOnStep(step: RulesStepContext, proposal: ActionProposal): boolean {
  const signature = proposalSignature(proposal);
  return ((step as StepState)[HELD] ?? []).some((entry) => proposalSignature(entry.proposal) === signature);
}

/** Drain the decisions held during the current instruction. */
export function takeHeld(step: RulesStepContext): HeldReplacement[] {
  const state = step as StepState;
  const list = state[HELD] ?? [];
  state[HELD] = [];
  return list;
}

export function overrideFor(step: RulesStepContext, proposal: ActionProposal): ReplacementOverride | null {
  const signature = proposalSignature(proposal);
  const list = (step as StepState)[OVERRIDE] ?? [];
  return list.find((entry) => entry.signature === signature) ?? null;
}

/** Run `fn` (one primitive call) with an override for the matching proposal. */
export function withOverride<T>(step: RulesStepContext, override: ReplacementOverride, fn: () => T): T {
  const state = step as StepState;
  const list = (state[OVERRIDE] ??= []);
  list.push(override);
  try {
    return fn();
  } finally {
    const index = list.indexOf(override);
    if (index >= 0) list.splice(index, 1);
  }
}

/* ---------------------------------------------------------------- replacement shape */

type ReplaceSpec = Extract<Ability, { kind: "replacement" }>["replace"];

/** 371.2: "you may …" — `{ op: "may" }` or an optional cost (`cost_then` with `optional`). */
export function isOptionalReplace(replace: ReplaceSpec): boolean {
  if (!replace || typeof replace !== "object" || !("op" in replace)) return false;
  return replace.op === "may" || (replace.op === "cost_then" && replace.optional === true);
}

/** The cost a "may pay … to … instead" replacement needs (gates whether it can be applied). */
export function optionalReplaceCost(replace: ReplaceSpec): Cost | null {
  if (!replace || typeof replace !== "object" || !("op" in replace)) return null;
  return replace.op === "cost_then" && replace.optional === true ? replace.cost : null;
}

/** The instructions run once the player chose to apply the replacement. */
export function effectToRun(replace: ReplaceSpec): Effect {
  const effect = replace as Effect;
  if (effect.op === "may") return effect.effect;
  if (effect.op === "cost_then" && effect.optional) return { ...effect, optional: false };
  return effect;
}

/* ---------------------------------------------------------------- prompts */

/** 372 / 372.1 / 372.2: who orders the replacements applying to this event. */
export function orderChooser(room: Room, host: RulesHost, proposal: ActionProposal): string {
  if (proposal.cardId) {
    const controller = controllerOf(room, host, proposal.cardId);
    if (controller) return controller;
  }
  if (proposal.playerId) return proposal.playerId;
  return room.rules?.turn.player ?? "";
}

export interface DecisionSource {
  id: string;
  controller: string;
  sourceObjectId?: string;
  optional: boolean;
}

export interface DecisionAsk {
  kind: "choose-mode" | "yes-no";
  playerId: string;
  options: PromptOption[];
  min: number;
  max: number;
  rule: string;
  promptKey: string;
}

export function decisionAsk(room: Room, host: RulesHost, held: HeldReplacement, sources: readonly DecisionSource[]): DecisionAsk {
  if (held.stage === "optional") {
    const source = sources.find((entry) => entry.id === held.chosen);
    return {
      kind: "yes-no",
      playerId: source?.controller ?? orderChooser(room, host, held.proposal),
      options: [
        { id: "yes", label: "Apply" },
        { id: "no", label: "Decline" },
      ],
      min: 1,
      max: 1,
      rule: "371.2.a",
      promptKey: "rules.prompt.applyReplacement",
    };
  }
  const chooser = orderChooser(room, host, held.proposal);
  const candidates = held.candidates.map((id) => sources.find((entry) => entry.id === id));
  // 371.2.a: when the chooser controls only optional candidates they may also apply none.
  const mayDeclineAll = candidates.every((source) => !!source && source.optional && source.controller === chooser);
  return {
    kind: "choose-mode",
    playerId: chooser,
    options: [
      ...held.candidates.map((id) => {
      const source = sources.find((entry) => entry.id === id);
      const label = source?.sourceObjectId ? nameOf(room, host, source.sourceObjectId) : null;
        return {
          id,
          label: label ?? id,
          ...(source?.sourceObjectId && !source.sourceObjectId.startsWith("battlefield:") ? { objectId: source.sourceObjectId } : {}),
        };
      }),
      ...(mayDeclineAll ? [{ id: DECLINE_ALL, label: "Apply none" }] : []),
    ],
    min: 1,
    max: 1,
    rule: "372",
    promptKey: "rules.prompt.orderReplacements",
  };
}
