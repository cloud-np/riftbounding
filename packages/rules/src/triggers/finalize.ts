/**
 * Finalizing triggered abilities — rules 402–407 (403.1, 403.2, 403.4), 383.3.a, 383.3.e.2,
 * 388.4, plus the 359.3.e target snapshot for every chain item.
 *
 * Runs from the 337.1 `afterFinalize` hook:
 * - 403.1 / 383.3.a: a trigger whose effect starts with "you may" asks its controller now; "no"
 *   removes it from the chain and it is considered not to have triggered (383.3.a.2);
 * - 403.2: its choices (modes, targets, …; `requiredChoices`) are made now — a single legal
 *   option is auto-selected, otherwise the controller answers an `effects.trigger_choice` prompt;
 * - 403.4: with not enough legal options it is removed (not countered, 403.4.a);
 * - every item: the zones of its chosen targets are recorded (`targetSnapshot`) so resolution
 *   can tell a target that moved to or from a non-board zone (359.3.e.2 / 359.3.e.4).
 *
 * - 383.3.b / 404.1.b.1 / 405.2: a cost within instructions at the start of the effect (a leading
 *   `cost_then`) is the trigger's base cost: its controller pays it now or declines, and an unpaid
 *   trigger is removed (it never becomes a Finalized Chain Item, 383.3.b.1).
 */
import type { Ability, ChainItem, ChoiceValue, Effect, Room } from "@rift/protocol";
import type { RulesStepContext } from "../types";
import { pushEvent } from "../types";
import { lookupAbility } from "../cards/registry";
import { removeChainItem } from "../timing/fepr/chain";
import { requiredChoices } from "../effects/choices";
import type { EffectExecutionContext } from "../effects/execute";
import { costPayable, payInstructionCost } from "../effects/ops/cost-then";
import { idsOf } from "../effects/env";
import { findChainItem, locate } from "../effects/objects";
import { EFFECTS_PROMPT_REASONS } from "../prompts/effects/reasons";
import { noteLimitUse } from "./detect";

export function abilityForItem(item: ChainItem): Ability | null {
  if (item.effect) {
    return { kind: "triggered", trigger: { kind: "custom", id: "inline" }, effect: item.effect };
  }
  const ref = item.kind === "card" ? "spell" : item.abilityRef;
  return lookupAbility(item.cardName, ref)?.ability ?? null;
}

/** 359.3.e: note where each chosen object is when the item finalizes. */
export function snapshotTargets(room: Room, item: ChainItem, step: RulesStepContext): void {
  const snapshot: NonNullable<ChainItem["targetSnapshot"]> = { ...(item.targetSnapshot ?? {}) };
  let any = false;
  for (const [key, value] of Object.entries(item.choices ?? {})) {
    if (key === "location" || key.startsWith("$")) continue;
    for (const id of idsOf(value)) {
      if (snapshot[id]) continue;
      const located = locate(room, step.host, id);
      if (located) {
        snapshot[id] = { zone: located.zone, controller: located.playerId };
        any = true;
      } else if (findChainItem(room, id)) {
        snapshot[id] = { zone: "chain" };
        any = true;
      }
    }
  }
  if (any) item.targetSnapshot = snapshot;
}

function removeTrigger(room: Room, item: ChainItem, step: RulesStepContext, type: string, rule: string): void {
  removeChainItem(room, item.id);
  if (room.rules) room.rules.priority = null;
  pushEvent(step.events, {
    type,
    playerId: item.controller,
    cardName: item.cardName,
    data: { itemId: item.id, rule },
  });
}

function bind(item: ChainItem, key: string, ids: string[], max: number, kind: string): void {
  let value: ChoiceValue;
  if (kind === "choose-number") value = Number(ids[0] ?? 0);
  else value = max === 1 && ids.length <= 1 ? (ids[0] ?? null) : ids;
  item.choices[key] = value;
}

/** Continue 403 for a triggered item; opens a prompt when its controller must decide. */
export function continueTriggerFinalization(room: Room, item: ChainItem, step: RulesStepContext): void {
  const rules = room.rules;
  if (!rules) return;
  const ability = abilityForItem(item);
  if (!ability) return;
  if (item.optional && !item.mayDecided) {
    rules.prompt = {
      id: step.host.nextId("prompt"),
      kind: "yes-no",
      playerId: item.controller,
      promptKey: "rules.prompt.mayTrigger",
      rule: "403.1",
      sourceItemId: item.id,
      options: [
        { id: "yes", label: "Yes" },
        { id: "no", label: "No" },
      ],
      min: 1,
      max: 1,
      data: { reason: EFFECTS_PROMPT_REASONS.triggerChoice, itemId: item.id, stage: "may" },
    };
    pushEvent(step.events, { type: "prompt", playerId: item.controller, data: { kind: "yes-no", reason: EFFECTS_PROMPT_REASONS.triggerChoice } });
    return;
  }
  for (let guard = 0; guard < 20; guard += 1) {
    const specs = requiredChoices(room, step.host, ability, {
      controller: item.controller,
      ...(item.sourceObjectId ? { sourceObjectId: item.sourceObjectId } : {}),
      itemId: item.id,
      choices: item.choices,
    });
    const spec = specs[0];
    if (!spec) break;
    const options = spec.options;
    if (spec.min > 0 && options.length < spec.min && spec.key !== "x") {
      // 403.4: not enough legal options → it ceases to be a Pending Item (not countered).
      removeTrigger(room, item, step, "trigger_removed", "403.4");
      return;
    }
    const max = Math.min(spec.max, options.length);
    const min = Math.min(spec.min, max);
    if (max === 0) {
      bind(item, spec.key, [], spec.max, spec.kind);
      continue;
    }
    if (min === max && max === options.length && spec.kind !== "choose-number") {
      bind(item, spec.key, options.map((option) => option.id), spec.max, spec.kind);
      continue;
    }
    rules.prompt = {
      id: step.host.nextId("prompt"),
      kind: spec.kind,
      playerId: item.controller,
      promptKey: spec.label ?? "rules.prompt.chooseTarget",
      rule: "403.2",
      sourceItemId: item.id,
      options,
      min,
      max,
      data: { reason: EFFECTS_PROMPT_REASONS.triggerChoice, itemId: item.id, stage: "choice", key: spec.key, choiceKind: spec.kind, choiceMax: spec.max },
    };
    pushEvent(step.events, { type: "prompt", playerId: item.controller, data: { kind: spec.kind, reason: EFFECTS_PROMPT_REASONS.triggerChoice } });
    return;
  }
  const cost = leadingCost(ability);
  if (cost && item.choices.$costPaid !== true) {
    const context = costContext(room, item, step);
    if (!costPayable(context, item.controller, cost.cost)) {
      // 383.3.b.1: the cost must be paid to finalize the trigger.
      removeTrigger(room, item, step, "trigger_removed", "383.3.b.1");
      return;
    }
    rules.prompt = {
      id: step.host.nextId("prompt"),
      kind: "yes-no",
      playerId: item.controller,
      promptKey: "rules.prompt.payTriggerCost",
      rule: "405.2",
      sourceItemId: item.id,
      options: [
        { id: "yes", label: "Pay" },
        { id: "no", label: "Decline" },
      ],
      min: 1,
      max: 1,
      data: { reason: EFFECTS_PROMPT_REASONS.triggerChoice, itemId: item.id, stage: "cost" },
    };
    pushEvent(step.events, { type: "prompt", playerId: item.controller, data: { kind: "yes-no", reason: EFFECTS_PROMPT_REASONS.triggerChoice } });
    return;
  }
  snapshotTargets(room, item, step);
}

/** 383.3.b: the cost within instructions at the start of a trigger's effect. */
export function leadingCost(ability: Ability): Extract<Effect, { op: "cost_then" }> | null {
  if (ability.kind !== "triggered") return null;
  const effect = ability.effect;
  if (effect.op === "cost_then") return effect;
  if (effect.op === "seq" && effect.effects[0]?.op === "cost_then") return effect.effects[0];
  return null;
}

function costContext(room: Room, item: ChainItem, step: RulesStepContext): EffectExecutionContext {
  return {
    room,
    step,
    controller: item.controller,
    itemId: item.id,
    choices: item.choices,
    ...(item.sourceObjectId ? { sourceObjectId: item.sourceObjectId } : {}),
    ...(item.triggerEvent ? { event: item.triggerEvent } : {}),
  };
}

/** 337.1 afterFinalize hook body. */
export function onItemFinalized(room: Room, item: ChainItem, step: RulesStepContext): void {
  if (item.kind === "triggered") {
    // 337.4 / 340.4: once the pending triggers are finalized, the controller of the newest item
    // gains Priority. A trigger placed by a cleanup after Priority was already handed out (e.g.
    // a Deathknell after a spell resolved) must not leave the stale holder in place; the advance
    // loop grants the newest item's controller.
    if (room.rules) room.rules.priority = null;
    continueTriggerFinalization(room, item, step);
    return;
  }
  snapshotTargets(room, item, step);
  notePaidAdditionalCost(room, item);
}

/**
 * 355.1.a / 356.4.f.1: remember on the permanent whether its optional additional cost was paid
 * (R2-play contract: `choices.additionalCost === true` or a non-empty `paid.additional`), so its
 * own "if you paid the additional cost" play effect can read it after the chain item is gone.
 */
function notePaidAdditionalCost(room: Room, item: ChainItem): void {
  const rules = room.rules;
  const card = item.cardSnapshot;
  if (!rules || item.kind !== "card" || !card) return;
  const flags = ["additionalCost", "optionalCost", "paidAdditional"];
  const paid =
    flags.some((key) => item.choices?.[key] === true) ||
    (!!item.paid?.additional && Object.keys(item.paid.additional).length > 0);
  if (paid) (rules.objects[card.id] ??= {}).paidAdditionalCost = true;
}

/** Answer handler for `effects.trigger_choice`. */
export function answerTriggerChoice(
  room: Room,
  step: RulesStepContext,
  data: Record<string, unknown>,
  selected: string[],
  booleanAnswer: boolean | undefined,
): void {
  const itemId = typeof data.itemId === "string" ? data.itemId : "";
  const item = findChainItem(room, itemId);
  if (!item) return;
  if (data.stage === "cost") {
    const ability = abilityForItem(item);
    const cost = ability ? leadingCost(ability) : null;
    const yes = booleanAnswer ?? selected.includes("yes");
    if (!yes || !cost || !payInstructionCost(costContext(room, item, step), item.controller, cost.cost)) {
      // 405.2 / 405.2.a: a declined trigger cost removes it (not countered).
      removeTrigger(room, item, step, "trigger_declined", "405.2");
      return;
    }
    item.choices.$costPaid = true;
  } else if (data.stage === "may") {
    const yes = booleanAnswer ?? selected.includes("yes");
    if (!yes) {
      // 383.3.a.2 / 386.2.b: declined → removed, considered not to have triggered.
      removeTrigger(room, item, step, "trigger_declined", "383.3.a.2");
      return;
    }
    item.mayDecided = true;
    if (item.sourceObjectId && item.abilityRef) noteLimitUse(room, item.sourceObjectId, item.abilityRef);
  } else if (typeof data.key === "string") {
    const kind = typeof data.choiceKind === "string" ? data.choiceKind : "choose-target";
    const max = typeof data.choiceMax === "number" ? data.choiceMax : selected.length;
    bind(item, data.key, selected, max, kind);
  }
  continueTriggerFinalization(room, item, step);
}
