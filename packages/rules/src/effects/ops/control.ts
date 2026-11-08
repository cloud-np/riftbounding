/**
 * Control ops — §6.2: `may` (383.3.a.3 / 445.2), `if` (359.3.e.14), `for_each`, `repeat`,
 * `choose_mode` (355.3), `requires` (377.2.b) and the `custom` escape hatch.
 *
 * Kept in one module because each is a few lines of stack manipulation; every game-action op
 * has its own file.
 */
import type { Effect } from "@rift/protocol";
import type { EffectExecutionContext, EffectExecutionResult } from "../execute";
import { executeEffect, RESOLVED } from "../execute";
import { evaluateCondition } from "../evaluate";
import { registerEffectOp } from "../registry";
import { targets } from "../targets";
import { amountOf, ctxOf } from "./util";

const MANUAL = (op: string): EffectExecutionResult => ({ status: "manual", reason: `effect_not_implemented:${op}` });

function answerIsYes(answer: unknown): boolean {
  if (answer === true || answer === "yes") return true;
  if (Array.isArray(answer)) return answer.includes("yes");
  return false;
}

/** 383.3.a.3 / 355.18: a "you may" decided on resolution. */
registerEffectOp("may", (effect, context) => {
  if (effect.op !== "may") return MANUAL("may");
  const machine = context.machine;
  if (!machine) return executeEffect(effect, context);
  const answer = machine.frame.answer;
  if (answer === undefined) {
    return machine.ask({
      kind: "yes-no",
      playerId: machine.env.controller,
      options: [
        { id: "yes", label: "Yes" },
        { id: "no", label: "No" },
      ],
      min: 1,
      max: 1,
      rule: "383.3.a.3",
      promptKey: effect.label ?? "rules.prompt.may",
      data: { answer: "boolean" },
    });
  }
  machine.frame.answer = undefined;
  if (answerIsYes(answer)) machine.push({ effect: effect.effect });
  machine.env.vars.$did = answerIsYes(answer);
  return RESOLVED;
});

/** Conditional instruction; the condition is checked on execution (359.3.f.2). */
registerEffectOp("if", (effect, context) => {
  if (effect.op !== "if") return MANUAL("if");
  const machine = context.machine;
  if (!machine) return executeEffect(effect, context);
  const ok = evaluateCondition(ctxOf(context), effect.condition);
  if (ok) machine.push({ effect: effect.then });
  else if (effect.else) machine.push({ effect: effect.else });
  return RESOLVED;
});

/** Apply `effect` once per matching object, binding it as "it". */
registerEffectOp("for_each", (effect, context) => {
  if (effect.op !== "for_each") return MANUAL("for_each");
  const machine = context.machine;
  if (!machine) return executeEffect(effect, context);
  const found = targets(context, effect.selector);
  if (!found.ok) return found.result;
  let ids = found.ids;
  if (effect.max !== undefined) {
    const max = amountOf(context, effect.max);
    if (max !== null) ids = ids.slice(0, Math.max(0, max));
  }
  machine.push(...ids.map((id) => ({ effect: effect.effect, it: id })));
  return RESOLVED;
});

/** "Do X N times" (388.1.a uses `reflexive` with `times` instead). */
registerEffectOp("repeat", (effect, context) => {
  if (effect.op !== "repeat") return MANUAL("repeat");
  const machine = context.machine;
  if (!machine) return executeEffect(effect, context);
  const times = Math.max(0, Math.min(100, amountOf(context, effect.times) ?? 0));
  const frames = Array.from({ length: times }, () => ({ effect: effect.effect }));
  machine.push(...frames);
  return RESOLVED;
});

/** A mode is available unless it is guarded by a false `requires` condition. */
export function modeAvailable(context: EffectExecutionContext, mode: Effect): boolean {
  if (mode.op !== "requires") return true;
  return evaluateCondition(ctxOf(context), mode.condition);
}

/** 355.3: modes are chosen on play (`choices.mode`); a missing choice is asked on resolution. */
registerEffectOp("choose_mode", (effect, context) => {
  if (effect.op !== "choose_mode") return MANUAL("choose_mode");
  const machine = context.machine;
  if (!machine) return executeEffect(effect, context);
  const bound = machine.env.choices.mode ?? machine.env.vars.mode;
  let chosen: string[] = [];
  if (typeof bound === "string") chosen = [bound];
  else if (Array.isArray(bound)) chosen = bound.filter((entry): entry is string => typeof entry === "string");
  if (chosen.length === 0 && machine.frame.answer !== undefined) {
    const answer = machine.frame.answer;
    chosen = Array.isArray(answer) ? answer.filter((entry): entry is string => typeof entry === "string") : typeof answer === "string" ? [answer] : [];
    machine.frame.answer = undefined;
  }
  const available = effect.modes.filter((mode) => modeAvailable(context, mode.effect));
  if (chosen.length === 0) {
    if (available.length === 0) return RESOLVED;
    if (available.length === 1) {
      chosen = [available[0]!.id];
    } else {
      return machine.ask({
        kind: "choose-mode",
        playerId: machine.env.controller,
        options: available.map((mode) => ({ id: mode.id, ...(mode.label ? { label: mode.label } : {}) })),
        min: 1,
        max: 1,
        rule: "355.3",
        promptKey: effect.promptKey ?? "rules.prompt.chooseMode",
        data: { answer: "options" },
      });
    }
  }
  machine.env.vars.mode = chosen;
  const frames = effect.modes
    .filter((mode) => chosen.includes(mode.id))
    .map((mode) => ({ effect: mode.effect }));
  machine.push(...frames);
  return RESOLVED;
});

/** 377.2.b: the precondition is checked when playing/activating; on resolution it is a wrapper. */
registerEffectOp("requires", (effect, context) => {
  if (effect.op !== "requires") return MANUAL("requires");
  const machine = context.machine;
  if (!machine) return executeEffect(effect, context);
  machine.push({ effect: effect.effect });
  return RESOLVED;
});

/* ---------------------------------------------------------------- custom (§6.2 escape hatch) */

export type CustomEffectHandler = (
  params: Record<string, unknown>,
  context: EffectExecutionContext,
) => EffectExecutionResult;

const CUSTOM_EFFECTS = new Map<string, CustomEffectHandler>();

/** Register genuinely unique card text (import-time table; always tested). */
export function registerCustomEffect(id: string, handler: CustomEffectHandler): void {
  CUSTOM_EFFECTS.set(id, handler);
}

export function customEffectIds(): string[] {
  return [...CUSTOM_EFFECTS.keys()].sort((a, b) => a.localeCompare(b));
}

registerEffectOp("custom", (effect, context) => {
  if (effect.op !== "custom") return MANUAL("custom");
  if (effect.id === "manual") return { status: "manual", reason: "manual_ability" };
  const handler = CUSTOM_EFFECTS.get(effect.id);
  if (!handler) return { status: "manual", reason: `custom_not_implemented:${effect.id}` };
  return handler(effect.params ?? {}, context);
});
