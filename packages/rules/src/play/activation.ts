/**
 * Activating abilities — rules 376–381, 377.2.b, 378, 380, 399–407, 430.2, 430.2.a, 818.
 *
 * `planActivation` is the single verdict for `rules_activate`, `explainIllegal` and
 * `legalIntents`: source on the Board and controlled by the activator (378/380), the ability
 * exists and is activated (403.3), timing (381 + 806/813), activation conditions (377.2.b), the
 * ability's Limit, restrictions, then the shared 355–357 core (choices, total cost, payment).
 *
 * `executeActivation` follows 402–407: a Pending item goes on the chain (402.1, closing the
 * state), a real choice opens a prompt, otherwise costs are paid (405) and the item is
 * Finalized (407). Add abilities finalize and resolve immediately and never pass Priority or
 * Focus (430.2/430.2.a); built-in and plain printed Add effects are executed here.
 */
import type { ChainItem, Room, RulesState } from "@rift/protocol";
import type { CardInfo, LocatedCard, RulesHost } from "../host";
import type { RulesFailure, RulesStepContext } from "../types";
import { fail, pushEvent } from "../types";
import type { IntentResult } from "../intents/context";
import { restrictionFor } from "../layers/restrictions";
import { abilityTimingVerdict, boardZones } from "../legality/timing";
import { addResources } from "../actions/resources";
import { runFinalizeHooks } from "../timing/hooks";
import { appendChainItem, finalizeChainItem, passPriority, removeChainItem, runCleanupOrQueue } from "../timing/fepr";
import { grantPriority } from "../state";
import { equipTargetSpec, findActivatedAbility, type ActivatedAbilityInfo } from "./abilities";
import { isBattlefield } from "./control";
import { planCore, type CorePlan } from "./core";
import { cardDomains, costSummary, resolveCost } from "./cost-model";
import { applyPayment, paidCostRecord } from "./payment";
import { openChoicePrompt, openCostPrompt } from "./prompting";
import type { PlayRequest } from "./request";

export interface ActivationPlan extends CorePlan {
  located: LocatedCard;
  info: CardInfo | null;
  entry: ActivatedAbilityInfo;
  ref: string;
  keywords: string[];
}

export type ActivationPlanResult = ActivationPlan | RulesFailure;

/** Default ref when the intent omits one (R1 scheme). */
export const DEFAULT_ABILITY_REF = "activated:0";

function limitKey(objectId: string, ref: string): string {
  return `${objectId}::${ref}`;
}

function limitReached(room: Room, objectId: string, entry: ActivatedAbilityInfo): boolean {
  const limit = entry.ability.limit;
  if (!limit || (limit.kind !== "once-per-turn" && limit.kind !== "per-turn")) return false;
  const max = limit.kind === "once-per-turn" ? 1 : Math.max(1, limit.count ?? 1);
  const used = room.rules?.history.activationsThisTurn?.[limitKey(objectId, entry.ref)] ?? 0;
  return used >= max;
}

function baseFor(entry: ActivatedAbilityInfo, request: Pick<PlayRequest, "baseCost">): { ok: true; index: number } | RulesFailure {
  // 204.1.b: with several Base Cost alternatives the controller chooses one.
  if (entry.costs.length <= 1) {
    if (request.baseCost !== undefined && request.baseCost !== 0) return fail("invalid_choice", "204.1.b", "no such base cost");
    return { ok: true, index: 0 };
  }
  if (request.baseCost === undefined) return { ok: true, index: -1 };
  if (!Number.isInteger(request.baseCost) || request.baseCost < 0 || request.baseCost >= entry.costs.length) {
    return fail("invalid_choice", "204.1.b", "no such base cost");
  }
  return { ok: true, index: request.baseCost };
}

function coreFor(
  room: Room,
  host: RulesHost,
  playerId: string,
  located: LocatedCard,
  info: CardInfo | null,
  entry: ActivatedAbilityInfo,
  request: Pick<PlayRequest, "choices" | "optionalCosts" | "plan" | "baseCost">,
  itemId?: string,
) {
  const choice = baseFor(entry, request);
  if (!choice.ok) return choice;
  const domains = cardDomains(info);
  const tryIndex = (index: number) =>
    planCore(room, host, {
      playerId,
      kind: "activated",
      sourceId: located.card.id,
      abilityRef: entry.ref,
      ...(entry.builtin || entry.manual ? {} : { ability: entry.ability }),
      ...(entry.builtin === "equip" ? { specProvider: () => [equipTargetSpec(room, host, playerId, located.card.id)] } : {}),
      info,
      keywords: entry.keywords,
      domains,
      base: resolveCost(entry.costs[index] ?? {}, domains, { choices: request.choices }),
      choices: request.choices,
      optionalCosts: request.optionalCosts,
      ...(request.plan ? { plan: request.plan } : {}),
      ...(itemId ? { itemId } : {}),
    });
  if (choice.index >= 0) return { core: tryIndex(choice.index), index: choice.index };
  // No explicit choice among alternatives: the first payable one (deterministic, 204.1.b).
  let first: ReturnType<typeof tryIndex> | null = null;
  for (let index = 0; index < entry.costs.length; index += 1) {
    const core = tryIndex(index);
    if (core.ok) return { core, index };
    first ??= core;
  }
  return { core: first!, index: 0 };
}

/** 376–381 / 399–406: the full activation verdict. Pure. */
export function planActivation(
  room: Room,
  playerId: string,
  objectId: string,
  abilityRef: string | undefined,
  request: Pick<PlayRequest, "choices" | "optionalCosts" | "plan" | "baseCost">,
  host: RulesHost,
): ActivationPlanResult {
  const located = host.findCard(room, objectId);
  // 378: the controller of the source decides whether to activate.
  if (!located || located.playerId !== playerId) return fail("card_not_found", "399");
  // 380: activated abilities are activated from the Board (Runes and Legends included, 107).
  if (!boardZones(room, host).includes(located.zone) || located.card.hidden) {
    return fail("illegal_action", "380", "source is not on the board");
  }
  const ref = typeof abilityRef === "string" && abilityRef.length > 0 ? abilityRef : DEFAULT_ABILITY_REF;
  const entry = findActivatedAbility(room, host, located, ref);
  if (!entry) return fail("illegal_action", "403.3", "ability is not an activated ability");
  // 381 + 806/813: the ability's own permissive keywords drive timing.
  const timing = abilityTimingVerdict(room, playerId, entry.keywords);
  if (!timing.ok) return timing;
  // 377.2.b: a condition on using the ability must be true.
  if (entry.conditions.includes("at-battlefield") && !isBattlefield(room, host, located.zone)) {
    return fail("illegal_action", "377.2.b", "use this ability only while at a battlefield");
  }
  if (limitReached(room, objectId, entry)) return fail("illegal_action", "376", "ability limit reached this turn");
  const restriction = restrictionFor(room, host, { kind: "activate", playerId, objectId, sourceObjectId: objectId });
  if (restriction) return fail("restricted", restriction.rule ?? "377.2.b", restriction.note);
  const info = host.cardInfo(room, objectId);
  const planned = coreFor(room, host, playerId, located, info, entry, request);
  if ("ok" in planned) return planned;
  if (!planned.core.ok) return planned.core;
  return { ...planned.core, located, info, entry, ref, keywords: entry.keywords };
}

/** Re-plan a Pending activation after a prompt answer. */
export function planPendingActivation(room: Room, host: RulesHost, item: ChainItem): CorePlan | RulesFailure {
  const process = item.process;
  const objectId = item.sourceObjectId;
  if (!process || !objectId || !item.abilityRef) return fail("card_not_found", "399");
  const located = host.findCard(room, objectId);
  if (!located) return fail("card_not_found", "399", "the source left the board");
  const entry = findActivatedAbility(room, host, located, item.abilityRef);
  if (!entry) return fail("illegal_action", "403.3");
  const planned = coreFor(
    room,
    host,
    item.controller,
    located,
    host.cardInfo(room, objectId),
    entry,
    {
      choices: item.choices,
      optionalCosts: item.optionalCosts ?? [],
      ...(process.request.plan ? { plan: process.request.plan } : {}),
      ...(process.request.baseCost !== undefined ? { baseCost: process.request.baseCost } : {}),
    },
    item.id,
  );
  if ("ok" in planned) return planned;
  return planned.core;
}

function recordActivation(rules: RulesState, objectId: string, ref: string): void {
  const map = (rules.history.activationsThisTurn ??= {});
  const key = limitKey(objectId, ref);
  map[key] = (map[key] ?? 0) + 1;
  rules.history.playHistoryTurn = rules.turn.number;
}

/** 430.2: resolve an Add ability the engine executes itself (built-in rune / plain "[Add]"). */
function resolveOwnAdd(room: Room, step: RulesStepContext, item: ChainItem, entry: ActivatedAbilityInfo): void {
  item.status = "finalized";
  pushEvent(step.events, { type: "finalize", cardName: item.cardName, data: { itemId: item.id } });
  runFinalizeHooks(room, item, step);
  addResources(room, item.controller, entry.resources ?? {}, step);
  pushEvent(step.events, {
    type: "add_resolved",
    playerId: item.controller,
    ...(item.cardName ? { cardName: item.cardName } : {}),
    data: { itemId: item.id, ref: entry.ref },
  });
  removeChainItem(room, item.id);
}

/** 405–407: pay and finalize a Pending activation whose choices/cost objects are known. */
export function completeActivationItem(
  room: Room,
  step: RulesStepContext,
  item: ChainItem,
  core: CorePlan,
  hold: boolean,
  savedBefore?: { priority: string | null; focus: string | null; passes: string[] },
): IntentResult {
  const rules = room.rules;
  if (!rules || !core.payment) return fail("insufficient_resources", "405.1");
  const objectId = item.sourceObjectId ?? "";
  const located = step.host.findCard(room, objectId);
  const entry = located && item.abilityRef ? findActivatedAbility(room, step.host, located, item.abilityRef) : null;
  if (!entry) return fail("illegal_action", "403.3");
  // 430.2.a: the state before the item was added (its addition cleared the pass count).
  const saved = item.process?.saved ?? savedBefore ?? { priority: rules.priority, focus: rules.focus, passes: [...rules.passes] };
  const paid = applyPayment(room, step, item.controller, core.cost, core.payment);
  if (!paid.ok) return paid;
  item.choices = { ...core.choices };
  item.paid = paidCostRecord(core.cost, core.payment, item.optionalCosts ?? []);
  item.totalCost = costSummary(core.cost);
  delete item.process;
  recordActivation(rules, objectId, entry.ref);
  pushEvent(step.events, {
    type: "ability_activated",
    playerId: item.controller,
    sourceObjectId: objectId,
    ...(item.cardName ? { cardName: item.cardName } : {}),
    data: { itemId: item.id, ref: entry.ref, manual: entry.manual },
  });
  if (entry.addsResources) {
    // 430.2/430.2.a: finalize and resolve now; Priority, Focus and the pass count are untouched.
    if (entry.resources) resolveOwnAdd(room, step, item, entry);
    else finalizeChainItem(room, item, step);
    rules.priority = saved.priority;
    rules.focus = saved.focus;
    rules.passes = saved.passes;
    runCleanupOrQueue(room, step);
    return { ok: true };
  }
  finalizeChainItem(room, item, step);
  runCleanupOrQueue(room, step);
  if (rules.chain.some((entry2) => entry2.id === item.id)) {
    grantPriority(rules, item.controller);
    if (!hold && rules.priority === item.controller) passPriority(room, item.controller, step);
  }
  return { ok: true };
}

/** 402–407 on the draft for a verdict-checked activation plan. */
export function executeActivation(
  room: Room,
  step: RulesStepContext,
  actorId: string,
  plan: ActivationPlan,
  request: PlayRequest,
): IntentResult {
  const rules = room.rules;
  if (!rules) return fail("rules_require_strict", "contract:§1");
  const saved = { priority: rules.priority, focus: rules.focus, passes: [...rules.passes] };
  const item: ChainItem = {
    id: step.host.nextId("chain"),
    kind: "activated",
    status: "pending",
    controller: actorId,
    sourceObjectId: plan.located.card.id,
    cardName: plan.located.card.name,
    abilityRef: plan.ref,
    choices: { ...plan.choices },
    // 430.2: Add abilities finalize and resolve immediately.
    origin: plan.entry.addsResources ? "add" : "play",
    addedAt: step.ctx.now,
    ...(request.optionalCosts.length ? { optionalCosts: [...request.optionalCosts] } : {}),
  };
  appendChainItem(room, item, step);
  if (plan.pendingChoice || plan.pendingCost) {
    item.process = {
      kind: "activated",
      stage: plan.pendingChoice ? "choices" : "payment",
      saved,
      request: {
        ...(request.plan ? { plan: request.plan } : {}),
        ...(request.optionalCosts.length ? { optionalCosts: [...request.optionalCosts] } : {}),
        ...(request.baseCost !== undefined ? { baseCost: request.baseCost } : {}),
        hold: request.hold,
      },
    };
    if (plan.pendingChoice) openChoicePrompt(room, step, item, plan.pendingChoice);
    else openCostPrompt(room, step, item, plan.pendingCost!);
    return { ok: true };
  }
  return completeActivationItem(room, step, item, plan, request.hold, saved);
}
