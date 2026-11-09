/**
 * Targets during resolution — rules 355.7, 355.13, 355.18, 359.3.e (mistargeting), 758.1.
 *
 * A selector with `chosen: true` is a choice stored under `targetRef` (normalized at
 * registration: `target:<n>`). On resolution each bound target is re-checked (359.3.e.2): it
 * must still meet the targeting requirements, must not have moved to or from a non-board zone
 * since the item finalized (359.3.e.4), and must not have become untargetable for this source
 * (758.1). Illegal targets are unaffected (359.3.e.5); instructions linked to them through the
 * same ref are ignored too (359.3.e.14.a).
 *
 * A choice that was never bound (355.18: choices made on resolution, or a flow that skipped the
 * 355 binding) is asked now through an `effects.resume` prompt.
 */
import type { PromptOption, Selector } from "@rift/protocol";
import { pushEvent } from "../types";
import { restrictionFor } from "../layers/restrictions";
import type { EffectExecutionContext, EffectExecutionResult } from "./execute";
import type { EvalContext } from "./env";
import { idsOf, setLki } from "./env";
import { evaluateAmount, matchesSelector, matchingIds, mightOf, resolveSelector } from "./evaluate";
import {
  controllerOf,
  findChainItem,
  isBoardZone,
  locate,
  nameOf,
  ownerOf,
  typeOf,
} from "./objects";

export type TargetResult = { ok: true; ids: string[] } | { ok: false; result: EffectExecutionResult };

export function evalContextOf(context: EffectExecutionContext): EvalContext {
  const env = context.machine?.env ?? {
    controller: context.controller,
    choices: { ...(context.choices ?? {}) },
    vars: {},
    ...(context.sourceObjectId ? { sourceObjectId: context.sourceObjectId } : {}),
    ...(context.itemId ? { itemId: context.itemId } : {}),
    ...(context.event ? { event: context.event } : {}),
  };
  return { room: context.room, host: context.step.host, env };
}

/** 355.13 / selector counts: `count` = exactly N (default 1), `maxCount` = up to N. */
export function choiceBounds(ctx: EvalContext, selector: Selector): { min: number; max: number } {
  if (selector.maxCount !== undefined) {
    const max = Math.max(0, evaluateAmount(ctx, selector.maxCount) ?? 0);
    return { min: 0, max };
  }
  const count = selector.count !== undefined ? Math.max(0, evaluateAmount(ctx, selector.count) ?? 1) : 1;
  return { min: count, max: count };
}

/** 758 / 355.9.b: can this source choose `id`? (`pick` choices are not targets, 355.7.) */
export function targetable(ctx: EvalContext, selector: Selector, id: string): boolean {
  if (selector.pick) return true;
  if (id === ctx.env.itemId) return false; // 355.9.c: not the spell or ability itself
  const restriction = restrictionFor(ctx.room, ctx.host, {
    kind: "be-targeted",
    objectId: id,
    playerId: ctx.env.controller,
    ...(ctx.env.sourceObjectId ? { sourceObjectId: ctx.env.sourceObjectId } : {}),
  });
  return restriction === null;
}

/** Legal options for a choice right now (355.9). */
export function choiceOptions(ctx: EvalContext, selector: Selector): string[] {
  return matchingIds(ctx, selector).filter((id) => targetable(ctx, selector, id));
}

export function optionFor(ctx: EvalContext, id: string): PromptOption {
  const name = nameOf(ctx.room, ctx.host, id) ?? id;
  const item = findChainItem(ctx.room, id);
  return {
    id,
    label: name,
    objectId: id,
    ...(item ? {} : { cardId: id }),
  };
}

/** 359.3.e.13: note last-known information before an instruction changes an object. */
export function noteLki(ctx: EvalContext, ids: readonly string[]): void {
  for (const id of ids) {
    const located = locate(ctx.room, ctx.host, id);
    if (!located) continue;
    setLki(ctx.env, id, {
      controller: controllerOf(ctx.room, ctx.host, id),
      owner: ownerOf(ctx.room, ctx.host, id),
      zone: located.zone,
      might: mightOf(ctx, id),
      name: located.card.name,
      type: typeOf(ctx.room, ctx.host, id),
    });
  }
}

/** 359.3.e.2 / 359.3.e.4 / 758.1 legality of one bound target on resolution. */
export function targetStillLegal(ctx: EvalContext, selector: Selector, id: string): boolean {
  const { room, host, env } = ctx;
  const snapshot = env.snapshot?.[id];
  const located = locate(room, host, id);
  const item = findChainItem(room, id);
  if (!located && !item && !id.startsWith("battlefield:")) return false;
  if (snapshot && located) {
    const wasBoard = isBoardZone(room, host, snapshot.zone);
    const isBoard = isBoardZone(room, host, located.zone);
    if (wasBoard !== isBoard) return false;
    if (!wasBoard && snapshot.zone !== located.zone) return false;
  }
  if (!matchesSelector(ctx, selector, id)) return false;
  return targetable(ctx, selector, id);
}

/**
 * The objects an instruction acts on. Returns `{ ok:false, result }` when the interpreter has
 * to stop for a resolution-time choice.
 */
export function targets(
  context: EffectExecutionContext,
  selector: Selector,
  options: { promptKey?: string; chooser?: string } = {},
): TargetResult {
  const ctx = evalContextOf(context);
  const env = ctx.env;
  if (!selector.chosen) return { ok: true, ids: resolveSelector(ctx, selector) };
  const key = selector.targetRef ?? "target:0";
  const cached = env.vars[`$legal:${key}`];
  if (cached !== undefined) return { ok: true, ids: idsOf(cached) };

  const bound = key in env.vars ? env.vars[key] : env.choices[key];
  if (bound === undefined || bound === null) {
    const machine = context.machine;
    const answer = machine?.frame.answer;
    if (machine && answer !== undefined) {
      const ids = idsOf(answer);
      env.vars[key] = ids;
      env.vars[`$legal:${key}`] = ids;
      machine.frame.answer = undefined;
      return { ok: true, ids };
    }
    const legal = choiceOptions(ctx, selector);
    const bounds = choiceBounds(ctx, selector);
    const max = Math.min(bounds.max, legal.length);
    const min = Math.min(bounds.min, max);
    if (legal.length === 0 || max === 0) {
      env.vars[key] = [];
      env.vars[`$legal:${key}`] = [];
      return { ok: true, ids: [] };
    }
    if (min === legal.length && max === legal.length) {
      env.vars[key] = legal;
      env.vars[`$legal:${key}`] = legal;
      return { ok: true, ids: legal };
    }
    if (!machine) return { ok: true, ids: [] };
    return {
      ok: false,
      result: machine.ask({
        kind: selector.pick ? "choose-card" : "choose-target",
        playerId: options.chooser ?? env.controller,
        options: legal.map((id) => optionFor(ctx, id)),
        min,
        max,
        rule: selector.pick ? "355.18" : "355.7",
        promptKey: options.promptKey ?? selector.label ?? "rules.prompt.chooseTarget",
        data: { answer: "objects", key },
      }),
    };
  }

  const ids = idsOf(bound);
  const legal: string[] = [];
  const illegal: string[] = [];
  for (const id of ids) {
    if (targetStillLegal(ctx, selector, id)) legal.push(id);
    else illegal.push(id);
  }
  env.vars[`$legal:${key}`] = legal;
  if (illegal.length > 0) {
    env.vars[`$illegal:${key}`] = illegal;
    pushEvent(context.step.events, {
      type: "mistarget",
      playerId: env.controller,
      targetIds: illegal,
      data: { key, rule: "359.3.e.5", ...(env.itemId ? { itemId: env.itemId } : {}) },
    });
  }
  return { ok: true, ids: legal };
}

/** Record the outcome of a leaf instruction (linked "if you do", 359.3.e.14.b). */
export function recordOutcome(context: EffectExecutionContext, affected: readonly string[], did: boolean): void {
  const env = context.machine?.env;
  if (!env) return;
  env.vars.$affected = [...affected];
  env.vars.$did = did;
}
