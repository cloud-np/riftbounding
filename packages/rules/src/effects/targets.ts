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
import { maximalGroupSubsets } from "./group";
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

/** "Any number of" (355.13): no upper count beyond the legal choices (kept JSON-safe). */
export const ANY_NUMBER_MAX = 999;

/**
 * 355.13 / selector counts: `count` = exactly N (default 1), `maxCount` = up to N, `anyNumber`
 * = zero or more.
 */
export function choiceBounds(ctx: EvalContext, selector: Selector): { min: number; max: number } {
  if (selector.anyNumber) {
    const cap = selector.maxCount !== undefined ? Math.max(0, evaluateAmount(ctx, selector.maxCount) ?? 0) : ANY_NUMBER_MAX;
    return { min: 0, max: cap };
  }
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
    // 424 / 427 / 442: record the object's status before an instruction moves it, like the
    // kill event's last-known information (383.2.c.3.b).
    const object = ctx.room.rules?.objects[id];
    setLki(ctx.env, id, {
      controller: controllerOf(ctx.room, ctx.host, id),
      owner: ownerOf(ctx.room, ctx.host, id),
      zone: located.zone,
      might: mightOf(ctx, id),
      name: located.card.name,
      type: typeOf(ctx.room, ctx.host, id),
      ...(object
        ? { stunned: object.stunned === true, buffs: object.buffs ?? 0, empowered: object.empowered ?? 0 }
        : {}),
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
    // 359.3.e.4: it left the board and came back — not the same object any more.
    if (wasBoard && env.itemId && !(room.rules?.objects[id]?.targetedBy ?? []).includes(env.itemId)) return false;
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
        data: { answer: "objects", key, ...(selector.group ? { group: selector.group } : {}) },
      }),
    };
  }

  // 355.11.b: the controller is choosing a legal subset of a group that no longer qualifies.
  const pendingGroup = env.vars[`$group:${key}`] as { legal: string[]; subsets: string[][] } | undefined;
  if (pendingGroup) {
    const answer = context.machine?.frame.answer;
    if (context.machine && answer !== undefined) {
      context.machine.frame.answer = undefined;
      delete env.vars[`$group:${key}`];
      return { ok: true, ids: keepGroupSubset(context, key, pendingGroup.legal, idsOf(answer)) };
    }
    return askGroupSubset(context, key, pendingGroup.legal, pendingGroup.subsets);
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
  if (selector.group && legal.length > 0) {
    // 355.11.b / 355.11.b.1: a group that no longer qualifies is reduced to a maximal legal
    // subset of the original (still legal) targets, chosen by the controller.
    const subsets = maximalGroupSubsets(ctx, selector.group, legal);
    if (subsets.length === 1) return { ok: true, ids: keepGroupSubset(context, key, legal, subsets[0]!) };
    if (!context.machine) return { ok: true, ids: keepGroupSubset(context, key, legal, subsets[0]!) };
    delete env.vars[`$legal:${key}`];
    env.vars[`$group:${key}`] = { legal, subsets };
    return askGroupSubset(context, key, legal, subsets);
  }
  return { ok: true, ids: legal };
}

/** Bind the kept subset; the other original targets are no longer affected (355.11.b). */
function keepGroupSubset(context: EffectExecutionContext, key: string, legal: readonly string[], kept: readonly string[]): string[] {
  const env = evalContextOf(context).env;
  const keep = legal.filter((id) => kept.includes(id));
  const dropped = legal.filter((id) => !keep.includes(id));
  env.vars[`$legal:${key}`] = keep;
  if (dropped.length > 0) {
    env.vars[`$illegal:${key}`] = [...idsOf(env.vars[`$illegal:${key}`]), ...dropped];
    pushEvent(context.step.events, {
      type: "group_subset",
      playerId: env.controller,
      targetIds: keep,
      data: { key, dropped, rule: "355.11.b", ...(env.itemId ? { itemId: env.itemId } : {}) },
    });
  }
  return keep;
}

function askGroupSubset(
  context: EffectExecutionContext,
  key: string,
  legal: readonly string[],
  subsets: readonly string[][],
): TargetResult {
  const ctx = evalContextOf(context);
  const sizes = subsets.map((subset) => subset.length);
  return {
    ok: false,
    result: context.machine!.ask({
      kind: "choose-target",
      playerId: ctx.env.controller,
      options: legal.map((id) => optionFor(ctx, id)),
      min: Math.min(...sizes),
      max: Math.max(...sizes),
      rule: "355.11.b",
      promptKey: "rules.prompt.chooseGroupSubset",
      data: { answer: "objects", subsets: subsets.map((subset) => [...subset]) },
    }),
  };
}

/** Record the outcome of a leaf instruction (linked "if you do", 359.3.e.14.b). */
export function recordOutcome(context: EffectExecutionContext, affected: readonly string[], did: boolean): void {
  const env = context.machine?.env;
  if (!env) return;
  env.vars.$affected = [...affected];
  env.vars.$did = did;
}
