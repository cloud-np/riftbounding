/**
 * Triggered abilities through the steps of playing an ability — rules 399–407, the single path
 * every Pending triggered item takes before it becomes Finalized:
 *
 * - 402.1: the trigger is a Pending item on the chain (placed by R2-effects' trigger queue);
 * - 403.1 / 383.3.a: "you may" as the first part of its effect is decided now — "no" removes it
 *   and it is considered not to have triggered (403.1.a, 383.3.a.2);
 * - 403.2 / 403.4.b: its choices (modes, targets, X: R2-effects' `requiredChoices`) are made now;
 *   a forced choice is bound automatically (411.2), otherwise a `play.choice` prompt opens;
 * - 403.4: with not enough legal options it is removed, never countered (403.4.a);
 * - 404.1.b.1 / 383.3.b: a cost within instructions at the beginning of its effect (or right after
 *   the leading "you may") is its base cost; 404.2/404.3 modifications apply (356);
 * - 405.1 / 405.2: its controller pays the cost or declines (`play.trigger` yes/no); a declined or
 *   unpayable trigger is removed (405.2.a, 383.3.b.1). A paid leading cost is marked
 *   `choices.$costPaid` so the `cost_then` instruction does not pay again on resolution;
 * - 407: it becomes a Finalized Chain Item (`finalizeChainItem`; the 337.1 finalize hook then
 *   records the 359.3.e target snapshot).
 *
 * `advance` calls `prepareTriggeredItem` for each Pending triggered item (407.3); the play
 * prompt handlers resume it after an answer.
 */
import type { Ability, ChainItem, Cost, Effect, Room } from "@rift/protocol";
import type { RulesHost } from "../host";
import type { RulesFailure, RulesStepContext } from "../types";
import { fail, pushEvent } from "../types";
import type { IntentResult } from "../intents/context";
import { lookupAbility } from "../cards/registry";
import { finalizeChainItem, removeChainItem } from "../timing/fepr";
import { noteLimitUse } from "../triggers/detect";
import { PLAY_PROMPT_REASONS } from "../prompts/play/reasons";
import { planCore, type CorePlan } from "./core";
import { cardDomains, costSummary, resolveCost } from "./cost-model";
import { applyPayment, checkpoint, paidCostRecord, rollback } from "./payment";
import { openChoicePrompt, openCostPrompt } from "./prompting";

export type TriggerPrepareResult = "finalized" | "pending" | "removed";

export interface TriggerPrepareOptions {
  /** The triggered ability (defaults to the item's inline effect or its script ability). */
  ability?: Ability;
  /** 404.1.b.1: its cost within instructions, taken as the base cost (default: the leading one). */
  cost?: Cost;
  /** 403.1 / 405.2: the controller declines the optional ability / its cost. */
  decline?: boolean;
}

/** The ability a triggered chain item performs: an inline keyword/delayed effect, or the script's. */
export function triggeredAbilityOf(item: ChainItem): Ability | null {
  if (item.effect) {
    return { kind: "triggered", trigger: { kind: "custom", id: "inline" }, effect: item.effect };
  }
  return lookupAbility(item.cardName, item.abilityRef)?.ability ?? null;
}

/** 383.3.b: the cost within instructions at the beginning of a triggered ability's effect. */
export function triggerLeadingCost(ability: Ability | null | undefined): Extract<Effect, { op: "cost_then" }> | null {
  if (!ability || ability.kind !== "triggered") return null;
  const effect = ability.effect;
  if (effect.op === "cost_then") return effect;
  if (effect.op === "seq" && effect.effects[0]?.op === "cost_then") return effect.effects[0];
  return null;
}

function baseCostOf(item: ChainItem, ability: Ability | null, options: TriggerPrepareOptions): Cost | undefined {
  return options.cost ?? item.process?.triggerCost ?? triggerLeadingCost(ability)?.cost;
}

function planTrigger(room: Room, host: RulesHost, item: ChainItem, ability: Ability | null, cost: Cost | undefined): CorePlan | RulesFailure {
  const sourceId = item.sourceObjectId ?? item.id;
  const info = item.sourceObjectId ? host.cardInfo(room, item.sourceObjectId) : null;
  const domains = cardDomains(info);
  return planCore(room, host, {
    playerId: item.controller,
    kind: "activated",
    sourceId,
    ...(item.abilityRef ? { abilityRef: item.abilityRef } : {}),
    ...(ability ? { ability } : {}),
    info,
    keywords: [],
    domains,
    base: resolveCost(cost ?? {}, domains, { choices: item.choices }),
    choices: item.choices,
    optionalCosts: [],
    ...(item.process?.request.plan ? { plan: item.process.request.plan } : {}),
    itemId: item.id,
  });
}

function removeTrigger(room: Room, step: RulesStepContext, item: ChainItem, type: "trigger_removed" | "trigger_declined", rule: string, reason: string): void {
  const rules = room.rules;
  removeChainItem(room, item.id);
  if (rules) {
    if (rules.prompt?.sourceItemId === item.id) rules.prompt = null;
    // 337.4 / 340.4: the controller of the newest remaining item gains Priority (advance).
    rules.priority = null;
  }
  pushEvent(step.events, {
    type,
    playerId: item.controller,
    ...(item.cardName ? { cardName: item.cardName } : {}),
    data: { itemId: item.id, rule, reason },
  });
}

function ensureProcess(room: Room, item: ChainItem, stage: NonNullable<ChainItem["process"]>["stage"], cost: Cost | undefined) {
  const rules = room.rules!;
  item.process ??= {
    kind: "triggered",
    stage,
    saved: { priority: rules.priority, focus: rules.focus, passes: [...rules.passes] },
    request: {},
  };
  item.process.stage = stage;
  if (cost) item.process.triggerCost = cost;
  return item.process;
}

/** 403.1 / 405.2: a yes/no decision of the trigger's controller. */
function openTriggerDecision(room: Room, step: RulesStepContext, item: ChainItem, stage: "may" | "cost"): void {
  const rules = room.rules;
  if (!rules) return;
  rules.prompt = {
    id: step.host.nextId("prompt"),
    kind: "yes-no",
    playerId: item.controller,
    promptKey: stage === "may" ? "rules.prompt.mayTrigger" : "rules.prompt.payTriggerCost",
    rule: stage === "may" ? "403.1" : "405.2",
    sourceItemId: item.id,
    options: stage === "may"
      ? [{ id: "yes", label: "Yes" }, { id: "no", label: "No" }]
      : [{ id: "yes", label: "Pay" }, { id: "no", label: "Decline" }],
    min: 1,
    max: 1,
    data: { reason: PLAY_PROMPT_REASONS.trigger, stage },
  };
  if (item.process) item.process.awaiting = stage;
  pushEvent(step.events, { type: "prompt", playerId: item.controller, data: { kind: "yes-no", itemId: item.id, stage } });
}

/** 405–407 once choices and cost objects are known. */
export function completeTriggeredItem(room: Room, step: RulesStepContext, item: ChainItem, core: CorePlan, leadingCost = false): IntentResult {
  if (!core.payment) return fail("insufficient_resources", "405.1");
  const paid = applyPayment(room, step, item.controller, core.cost, core.payment);
  if (!paid.ok) return paid;
  item.choices = { ...core.choices, ...(leadingCost ? { $costPaid: true } : {}) };
  item.paid = paidCostRecord(core.cost, core.payment);
  item.totalCost = costSummary(core.cost);
  delete item.process;
  finalizeChainItem(room, item, step);
  return { ok: true };
}

/**
 * 402–407 for one Pending triggered item on the chain: finalizes it, leaves it Pending behind a
 * prompt, or removes it (never "countered", 403.4.a / 405.2.a).
 */
export function prepareTriggeredItem(
  room: Room,
  step: RulesStepContext,
  item: ChainItem,
  options: TriggerPrepareOptions = {},
): TriggerPrepareResult {
  const rules = room.rules;
  if (!rules || item.status !== "pending") return "finalized";
  const ability = options.ability ?? triggeredAbilityOf(item);
  const cost = baseCostOf(item, ability, options);
  const leading = !options.cost && !item.process?.triggerCost && !!triggerLeadingCost(ability);
  // 403.1 / 383.3.a: "you may" first — decided before anything else.
  if (item.optional && !item.mayDecided) {
    if (options.decline) {
      removeTrigger(room, step, item, "trigger_declined", "383.3.a.2", "declined");
      return "removed";
    }
    ensureProcess(room, item, "may", options.cost);
    openTriggerDecision(room, step, item, "may");
    return "pending";
  }
  if (options.decline) {
    // 405.2 (a cost) / 403.1.a: removed from the chain; it never becomes a Finalized item.
    removeTrigger(room, step, item, "trigger_declined", cost ? "405.2" : "403.1.a", "declined");
    return "removed";
  }
  const plan = planTrigger(room, step.host, item, ability, cost);
  if (!plan.ok) {
    // 403.4: not enough options; 383.3.b.1 / 405.2: a cost that cannot be paid.
    const rule = plan.code === "no_legal_targets" || !cost ? "403.4" : "383.3.b.1";
    removeTrigger(room, step, item, "trigger_removed", rule, plan.code);
    return "removed";
  }
  item.choices = { ...item.choices, ...plan.choices };
  if (plan.pendingChoice) {
    ensureProcess(room, item, "choices", options.cost);
    openChoicePrompt(room, step, item, { ...plan.pendingChoice, rule: "403.2" });
    return "pending";
  }
  // 405.2: a player may decline to pay a triggered ability's cost.
  if (cost && hasCost(plan) && !item.process?.costAccepted) {
    ensureProcess(room, item, "cost", options.cost);
    openTriggerDecision(room, step, item, "cost");
    return "pending";
  }
  if (plan.pendingCost) {
    ensureProcess(room, item, "payment", options.cost);
    openCostPrompt(room, step, item, plan.pendingCost);
    return "pending";
  }
  const point = checkpoint(room, step);
  const done = completeTriggeredItem(room, step, item, plan, leading && hasCost(plan));
  if (!done.ok) {
    // 405.2 / 383.3.b.1: undo the partial payment, then remove the trigger.
    rollback(room, step, point);
    const restored = room.rules?.chain.find((entry) => entry.id === item.id);
    if (restored) removeTrigger(room, step, restored, "trigger_removed", "383.3.b.1", done.code);
    return "removed";
  }
  return "finalized";
}

function hasCost(plan: CorePlan): boolean {
  const cost = plan.cost;
  return (
    cost.energy > 0 ||
    cost.power.some((entry) => entry.count > 0) ||
    cost.objects.length > 0 ||
    cost.discard > 0 ||
    cost.payPoints > 0 ||
    cost.spendXp > 0 ||
    cost.recycleSelf === true ||
    cost.unsupported.length > 0
  );
}

/**
 * Answer to a `play.trigger` decision (403.1 may / 405.2 pay or decline), then continue 403–407.
 */
export function answerTriggerDecision(room: Room, step: RulesStepContext, item: ChainItem, stage: unknown, yes: boolean): IntentResult {
  if (stage === "may") {
    if (!yes) {
      // 383.3.a.2 / 386.2.b: declined → removed, considered not to have triggered.
      removeTrigger(room, step, item, "trigger_declined", "383.3.a.2", "declined");
      return { ok: true };
    }
    item.mayDecided = true;
    // 383.3.e.2: an optional limited trigger counts toward its limit only once accepted.
    if (item.sourceObjectId && item.abilityRef) noteLimitUse(room, item.sourceObjectId, item.abilityRef);
  } else if (stage === "cost") {
    if (!yes) {
      // 405.2 / 405.2.a: a declined trigger cost removes it (not countered).
      removeTrigger(room, step, item, "trigger_declined", "405.2", "declined");
      return { ok: true };
    }
    if (item.process) item.process.costAccepted = true;
  } else {
    return fail("invalid_choice", "411.2");
  }
  prepareTriggeredItem(room, step, item);
  return { ok: true };
}
