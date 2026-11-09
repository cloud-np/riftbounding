/**
 * Triggered abilities through the steps of playing an ability — rules 399–407 (402.1 the trigger
 * is a Pending item, 403.1 “you may” decided now, 403.2 choices, 403.4 removed when no legal
 * choice exists, 404.1.b.1 a cost within instructions is the base cost, 405.2 its controller may
 * decline to pay, 406 legality, 407 Finalized).
 *
 * For R2-effects (who owns the trigger queue, 382+): call `prepareTriggeredItem` for each Pending
 * trigger item before FEPR finalizes it. It either finalizes the item (`finalizeChainItem`), opens
 * a play prompt and leaves it Pending (the `play.choice`/`play.cost` handlers resume it), or
 * removes it from the chain — never "countered" (403.4.a/405.2.a).
 */
import type { Ability, ChainItem, Cost, Room } from "@rift/protocol";
import type { RulesHost } from "../host";
import type { RulesFailure, RulesStepContext } from "../types";
import { fail, pushEvent } from "../types";
import type { IntentResult } from "../intents/context";
import { lookupAbility } from "../cards/registry";
import { finalizeChainItem, removeChainItem } from "../timing/fepr";
import { planCore, type CorePlan } from "./core";
import { cardDomains, costSummary, resolveCost } from "./cost-model";
import { applyPayment, checkpoint, paidCostRecord, rollback } from "./payment";
import { openChoicePrompt, openCostPrompt } from "./prompting";

export type TriggerPrepareResult = "finalized" | "pending" | "removed";

export interface TriggerPrepareOptions {
  /** The triggered ability (defaults to the script ability named by `item.abilityRef`). */
  ability?: Ability;
  /** 404.1.b.1: its cost within instructions, taken as the base cost. */
  cost?: Cost;
  /** 403.1 / 405.2: the controller declines the optional ability / its cost. */
  decline?: boolean;
}

function abilityOf(item: ChainItem, ability?: Ability): Ability | undefined {
  return ability ?? lookupAbility(item.cardName, item.abilityRef)?.ability;
}

function planTrigger(room: Room, host: RulesHost, item: ChainItem, ability: Ability | undefined, cost: Cost | undefined): CorePlan | RulesFailure {
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
    itemId: item.id,
  });
}

function removeTrigger(room: Room, step: RulesStepContext, item: ChainItem, rule: string, reason: string): void {
  removeChainItem(room, item.id);
  pushEvent(step.events, {
    type: "trigger_removed",
    playerId: item.controller,
    ...(item.cardName ? { cardName: item.cardName } : {}),
    data: { itemId: item.id, rule, reason },
  });
}

/** 405–407 once choices and cost objects are known. */
export function completeTriggeredItem(room: Room, step: RulesStepContext, item: ChainItem, core: CorePlan): IntentResult {
  if (!core.payment) return fail("insufficient_resources", "405.1");
  const paid = applyPayment(room, step, item.controller, core.cost, core.payment);
  if (!paid.ok) return paid;
  item.choices = { ...core.choices };
  item.paid = paidCostRecord(core.cost, core.payment);
  item.totalCost = costSummary(core.cost);
  delete item.process;
  finalizeChainItem(room, item, step);
  return { ok: true };
}

/** Replan a Pending trigger after a play prompt answer. */
export function planPendingTrigger(room: Room, host: RulesHost, item: ChainItem): CorePlan | RulesFailure {
  return planTrigger(room, host, item, abilityOf(item), item.process?.triggerCost);
}

/** 402–407 for one Pending triggered item on the chain. */
export function prepareTriggeredItem(
  room: Room,
  step: RulesStepContext,
  item: ChainItem,
  options: TriggerPrepareOptions = {},
): TriggerPrepareResult {
  const rules = room.rules;
  if (!rules || item.status !== "pending") return "finalized";
  if (options.decline) {
    // 403.1.a / 405.2: removed from the chain; it never becomes a Finalized item.
    removeTrigger(room, step, item, options.cost ? "405.2" : "403.1.a", "declined");
    return "removed";
  }
  const ability = abilityOf(item, options.ability);
  const plan = planTrigger(room, step.host, item, ability, options.cost);
  if (!plan.ok) {
    // 403.4: not enough options → removed (not countered, 403.4.a); 405.2: cost cannot be paid.
    removeTrigger(room, step, item, plan.code === "insufficient_resources" ? "405.2" : "403.4", plan.code);
    return "removed";
  }
  if (plan.pendingChoice || plan.pendingCost) {
    item.choices = { ...plan.choices };
    item.process = {
      kind: "triggered",
      stage: plan.pendingChoice ? "choices" : "payment",
      saved: { priority: rules.priority, focus: rules.focus, passes: [...rules.passes] },
      request: {},
      ...(options.cost ? { triggerCost: options.cost } : {}),
    };
    if (plan.pendingChoice) openChoicePrompt(room, step, item, plan.pendingChoice);
    else openCostPrompt(room, step, item, plan.pendingCost!);
    return "pending";
  }
  const point = checkpoint(room, step);
  const done = completeTriggeredItem(room, step, item, plan);
  if (!done.ok) {
    // 405.2 / 358.5: undo the partial payment, then remove the trigger.
    rollback(room, step, point);
    const restored = room.rules?.chain.find((entry) => entry.id === item.id);
    if (restored) removeTrigger(room, step, restored, "405.2", done.code);
    return "removed";
  }
  return "finalized";
}
