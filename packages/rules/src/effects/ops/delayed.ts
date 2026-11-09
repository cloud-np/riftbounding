/**
 * `delayed` / `continuous` / `replace` — Delayed Abilities 390–393, continuous effects (391.4,
 * 475) and delayed replacements (391.3, 439 core op `replace`).
 *
 * - `delayed`: a Delayed Trigger (391.2) stored in `rules.effects` as
 *   `{ kind: "custom", id: "delayed-trigger", params: { trigger, effect, once, optional, choices,
 *   sourceName } }`; `triggers/detect.ts` matches it like a printed trigger (393: regardless of
 *   whether its source is still on the board). 359.3.e.16: not generated when its window
 *   already ended.
 * - `continuous`: a Delayed Passive (391.4); targets bound to choices are frozen to the chosen
 *   objects (`obj:<id>`).
 * - `replace`: a delayed replacement `{ kind: "custom", id: "replacement", params }` consumed by
 *   `replacements/interceptor.ts`.
 */
import type { Modifier, Selector } from "@rift/protocol";
import { pushEvent } from "../../types";
import { addContinuousEffect } from "../../layers/mods";
import { RESOLVED } from "../execute";
import type { EffectEnv } from "../env";
import { isReservedRef, refIds } from "../evaluate";
import { registerEffectOp } from "../registry";
import { recordOutcome } from "../targets";
import { inheritedChoices } from "./reflexive";
import { ctxOf, hostOf } from "./util";

/** Freeze a modifier's target: a choice-key ref becomes the chosen object(s). */
export function bindTarget(target: Selector, ctx: ReturnType<typeof ctxOf>): Selector {
  const ref = target.targetRef;
  if (!ref || ref === "host" || (isReservedRef(ref) && ref !== "it" && ref !== "event")) return target;
  const ids = refIds(ctx, ref);
  if (ids.length === 1) return { targetRef: `obj:${ids[0]}` };
  return {
    ...target,
    targetRef: undefined,
    chosen: undefined,
    where: { kind: "in-ids", ids },
  } as Selector;
}

function bindModifier(modifier: Modifier, ctx: ReturnType<typeof ctxOf>): Modifier {
  if ("target" in modifier && modifier.target) {
    return { ...modifier, target: bindTarget(modifier.target, ctx) } as Modifier;
  }
  if (modifier.kind === "while" || modifier.kind === "rules-text") {
    return { ...modifier, modifier: bindModifier(modifier.modifier, ctx) };
  }
  if (modifier.kind === "custom" && modifier.params?.target) {
    return {
      ...modifier,
      params: { ...modifier.params, target: bindTarget(modifier.params.target as Selector, ctx) },
    };
  }
  return modifier;
}

function delayedWindowOver(room: Parameters<typeof addContinuousEffect>[0], env: EffectEnv, trigger: unknown, duration: string): boolean {
  void env;
  const rules = room.rules;
  if (!rules || duration !== "this-turn") return false;
  const t = trigger as { kind?: string; phase?: string; step?: string };
  // 359.3.e.16 / EX[117]/EX[118]: "at the end of this turn" generated during the Ending Phase.
  if (t.kind === "phase" && t.phase === "ending" && rules.turn.phase === "ending") return true;
  if (t.kind === "turn-end" && rules.turn.phase === "ending") return true;
  return false;
}

registerEffectOp("delayed", (effect, context) => {
  if (effect.op !== "delayed") return { status: "manual", reason: "effect_not_implemented:delayed" };
  const ctx = ctxOf(context);
  const duration = effect.duration ?? "this-turn";
  if (delayedWindowOver(context.room, ctx.env, effect.trigger, duration)) {
    recordOutcome(context, [], false);
    return RESOLVED;
  }
  const id = addContinuousEffect(context.room, hostOf(context), {
    controller: ctx.env.controller,
    duration,
    modifier: {
      kind: "custom",
      id: "delayed-trigger",
      params: {
        trigger: effect.trigger,
        effect: effect.effect,
        once: effect.once ?? true,
        ...(effect.optional ? { optional: true } : {}),
        choices: inheritedChoices(ctx.env),
        ...(ctx.env.sourceName ? { sourceName: ctx.env.sourceName } : {}),
      },
    },
    ...(ctx.env.sourceObjectId ? { sourceObjectId: ctx.env.sourceObjectId } : {}),
  });
  pushEvent(context.step.events, { type: "delayed_created", playerId: ctx.env.controller, data: { effectId: id } });
  recordOutcome(context, [], true);
  return RESOLVED;
});

registerEffectOp("continuous", (effect, context) => {
  if (effect.op !== "continuous") return { status: "manual", reason: "effect_not_implemented:continuous" };
  const ctx = ctxOf(context);
  const id = addContinuousEffect(context.room, hostOf(context), {
    controller: ctx.env.controller,
    duration: effect.duration,
    modifier: bindModifier(effect.modifier, ctx),
    ...(effect.condition ? { condition: effect.condition } : {}),
    ...(ctx.env.sourceObjectId ? { sourceObjectId: ctx.env.sourceObjectId } : {}),
  });
  pushEvent(context.step.events, { type: "continuous_created", playerId: ctx.env.controller, data: { effectId: id } });
  recordOutcome(context, [], true);
  return RESOLVED;
});

registerEffectOp("replace", (effect, context) => {
  if (effect.op !== "replace") return { status: "manual", reason: "effect_not_implemented:replace" };
  const ctx = ctxOf(context);
  const id = addContinuousEffect(context.room, hostOf(context), {
    controller: ctx.env.controller,
    duration: "this-turn",
    modifier: {
      kind: "custom",
      id: "replacement",
      params: { matches: effect.matches, replace: effect.replace, once: true, choices: inheritedChoices(ctx.env) },
    },
    ...(ctx.env.sourceObjectId ? { sourceObjectId: ctx.env.sourceObjectId } : {}),
  });
  pushEvent(context.step.events, { type: "replacement_created", playerId: ctx.env.controller, data: { effectId: id } });
  recordOutcome(context, [], true);
  return RESOLVED;
});
