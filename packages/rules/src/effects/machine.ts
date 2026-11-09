/**
 * Resumable effect interpreter — §6.2, 355.18, 359.3.d, 411.2.
 *
 * Effects execute "from top to bottom" (359.3.d) on an explicit work stack of JSON frames, so
 * the interpreter can stop when a player must decide something during resolution (355.18:
 * choices not made on play are made on resolution) and continue later from exactly the same
 * point. When an op needs an answer it calls `handle.ask(...)`: the current frame is pushed back
 * and the whole continuation (`{ stack, env }`, plain JSON) is stored on a `rules.prompt` with
 * reason `effects.resume`. The prompt handler (`prompts/effects/resume.ts`) writes the answer
 * into the top frame and calls `runMachine` again.
 *
 * Deviation (documented in docs/rules/effects.md): the FEPR resolver (`timing/fepr/resolve.ts`,
 * not owned by R2-effects) treats a waiting resolution as resolved, so the spell reaches its
 * owner's trash before the remaining instructions run after the answer.
 */
import type { Effect, GameEvent, PromptKind, PromptOption, Room } from "@rift/protocol";
import type { RulesStepContext } from "../types";
import { pushEvent } from "../types";
import type { EffectEnv } from "./env";
import { getEffectOp } from "./registry";
import { EFFECTS_PROMPT_REASONS } from "../prompts/effects/reasons";

export interface Frame {
  effect: Effect;
  /** `for_each` element bound as "it" for this frame. */
  it?: string | null;
  /** Answer written by the resume prompt handler. */
  answer?: unknown;
  /** Op-private progress (e.g. which phase of a two-step op is next). */
  data?: Record<string, unknown>;
}

export interface Continuation {
  stack: Frame[];
  env: EffectEnv;
}

export interface AskSpec {
  kind: PromptKind;
  playerId: string;
  options: PromptOption[];
  min: number;
  max: number;
  rule: string;
  promptKey?: string;
  /** Stored on `prompt.data.ask` for the resume handler (e.g. which answer field to read). */
  data?: Record<string, unknown>;
}

export type MachineResult =
  | { status: "done" }
  | { status: "await" }
  | { status: "manual"; reason: string };

export interface MachineHandle {
  env: EffectEnv;
  frame: Frame;
  /** Push frames so that `frames[0]` executes next. */
  push(...frames: Frame[]): void;
  /** Open a resolution prompt and stop; the op re-runs with `frame.answer` set. */
  ask(spec: AskSpec): { status: "await" };
}

const MAX_MACHINE_STEPS = 2000;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Run until the stack is empty, an op waits for a player, or an op is not implemented. */
export function runMachine(room: Room, step: RulesStepContext, continuation: Continuation): MachineResult {
  const stack = continuation.stack;
  const env = continuation.env;
  for (let guard = 0; guard < MAX_MACHINE_STEPS; guard += 1) {
    const frame = stack.pop();
    if (!frame) return { status: "done" };
    const handler = getEffectOp(frame.effect.op);
    if (!handler) return { status: "manual", reason: `effect_not_implemented:${frame.effect.op}` };
    let asked = false;
    const currentIt = frame.it !== undefined ? frame.it : env.it;
    const handle: MachineHandle = {
      env,
      frame,
      push(...frames: Frame[]) {
        for (let index = frames.length - 1; index >= 0; index -= 1) {
          const child = frames[index]!;
          // Children inherit the enclosing `for_each` element ("it").
          if (child.it === undefined && currentIt != null) child.it = currentIt;
          stack.push(child);
        }
      },
      ask(spec: AskSpec) {
        asked = true;
        stack.push(frame);
        openResumePrompt(room, step, { stack, env }, spec);
        return { status: "await" };
      },
    };
    const previousIt = env.it;
    if (frame.it !== undefined) env.it = frame.it;
    const result = handler(frame.effect, {
      room,
      step,
      itemId: env.itemId,
      controller: env.controller,
      choices: env.choices,
      machine: handle,
    });
    env.it = previousIt;
    if (result.status === "manual") return { status: "manual", reason: result.reason ?? "manual" };
    if (result.status === "await" || asked) return { status: "await" };
  }
  pushEvent(step.events, { type: "loop_guard", data: { rule: "effects", steps: MAX_MACHINE_STEPS } });
  return { status: "done" };
}

function openResumePrompt(
  room: Room,
  step: RulesStepContext,
  continuation: Continuation,
  spec: AskSpec,
): void {
  const rules = room.rules;
  if (!rules) return;
  const id = step.host.nextId("prompt");
  rules.prompt = {
    id,
    kind: spec.kind,
    playerId: spec.playerId,
    ...(spec.promptKey ? { promptKey: spec.promptKey } : {}),
    rule: spec.rule,
    ...(continuation.env.itemId ? { sourceItemId: continuation.env.itemId } : {}),
    options: spec.options,
    min: spec.min,
    max: spec.max,
    data: {
      reason: EFFECTS_PROMPT_REASONS.resume,
      continuation: clone(continuation) as unknown as Record<string, unknown>,
      ...(spec.data ? { ask: clone(spec.data) } : {}),
    },
  };
  const event: GameEvent = {
    type: "prompt",
    playerId: spec.playerId,
    data: { kind: spec.kind, reason: EFFECTS_PROMPT_REASONS.resume },
  };
  pushEvent(step.events, event);
}

/** Start a fresh machine for `effect` in `env`. */
export function startMachine(
  room: Room,
  step: RulesStepContext,
  effect: Effect,
  env: EffectEnv,
): MachineResult {
  return runMachine(room, step, { stack: [{ effect }], env });
}
