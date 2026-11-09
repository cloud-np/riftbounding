/**
 * Process of play — rules 349–359 (cards), 420, 806/813 (timing), 811 (facedown), 822 (Ambush),
 * 805 (Accelerate).
 *
 * `planCardPlay` is the single verdict shared by `rules_play`, `explainIllegal` and
 * `legalIntents`: permission/source zone (354, 420.1.a), timing (358.4, checked before the
 * card moves), Location (355.2), restrictions, choices (355), total cost (356) and payment
 * (357). It is pure.
 *
 * `executeCardPlay` then performs the steps in rule order on the draft: the card moves to the
 * chain as a Pending item (354, closing the state, 354.1); when a real choice remains (a target,
 * mode, X, or which object pays a non-standard cost) a prompt opens and the item stays Pending
 * (411.2); otherwise costs are paid (357), the item is Finalized (359) and permanents resolve
 * immediately (337.2/359.2). A play that fails after a prompt is undone (358.5): the card goes
 * back to the zone/index it came from and Priority/Focus are restored.
 */
import type { ChainItem, ChoiceRecord, Room, RulesState } from "@rift/protocol";
import type { CardInfo, LocatedCard, RulesHost } from "../host";
import type { RulesFailure, RulesStepContext } from "../types";
import { fail, pushEvent } from "../types";
import type { IntentResult } from "../intents/context";
import { lookupAbility } from "../cards/registry";
import { restrictionFor } from "../layers/restrictions";
import { keywordsWithPrinted } from "../layers";
import { baseActionVerdict, keywordTimingVerdict } from "../legality/timing";
import { appendChainItem, finalizeChainItem, passPriority, removeChainItem, runCleanupOrQueue } from "../timing/fepr";
import { grantPriority } from "../state";
import { snapshotInfo, typeOf } from "./card-info";
import { planCore, type CoreInput, type CorePlan } from "./core";
import { cardDomains, costSummary, printedCardCost } from "./cost-model";
import { cardKeywords, printedCardKeywords } from "./keywords";
import { chooseLocation, type LocationOption } from "./locations";
import { applyPayment, checkpoint, paidCostRecord, rollback } from "./payment";
import { playPermission, type PlayPermission } from "./permissions";
import { bindRepeatChoices, repeatDeflectCosts, targetedChoiceKeys } from "./repeat";
import { deflectCostsForTargets, type AdditionalCostSpec } from "./additional-costs";
import { recordFinalizedCard } from "./keyword-helpers";
import { openCostPrompt, openChoicePrompt, openOptionalCostPrompt } from "./prompting";
import type { PlayRequest } from "./request";
import { fullControl } from "../auto/prefs";

export interface CardPlayPlan extends CorePlan {
  located: LocatedCard;
  info: CardInfo;
  permission: PlayPermission;
  /** 355.2: the chosen Location ("base" for spells, matching R1). */
  location: string;
  locationOption: LocationOption | null;
  keywords: string[];
}

export type CardPlayPlanResult = CardPlayPlan | RulesFailure;

function withPermissionKeywords(keywords: readonly string[], permission: PlayPermission): string[] {
  const out = [...keywords];
  for (const keyword of permission.keywords ?? []) {
    if (!out.some((entry) => entry.toLowerCase() === keyword.toLowerCase())) out.push(keyword);
  }
  return out;
}

function spellAbility(info: CardInfo) {
  return typeOf(info).spell ? lookupAbility(info.name, "spell")?.ability : undefined;
}

/**
 * 820.2: plan the play-time choices and then one extra choice set per paid Repeat instance.
 * The repeated choices are bound under `repeat:<run>:<key>`; a Deflect target chosen in a
 * repeated execution is priced as an extra additional cost (809.1.c). Returns the plan to prompt
 * on when a repeated choice is still open.
 */
function planCoreWithRepeat(
  room: Room,
  host: RulesHost,
  info: CardInfo,
  ability: ReturnType<typeof spellAbility>,
  input: CoreInput,
): CorePlan | RulesFailure {
  const extraAdditional: AdditionalCostSpec[] = [...(input.extraAdditional ?? [])];
  let core = planCore(room, host, input);
  if (!core.ok) return core;
  // 809.1.c: Deflect is owed for every target choice, including targets the intent supplied up
  // front (the choice walker omits bound specs, so they are missing from `core.targetKeys`).
  if (ability && !core.pendingChoice) {
    const boundTargets = targetedChoiceKeys(
      room,
      host,
      ability,
      {
        controller: input.playerId,
        sourceObjectId: input.sourceId,
        ...(input.itemId ? { itemId: input.itemId } : {}),
        ...(input.facedownAt ? { facedownAt: input.facedownAt } : {}),
      },
      input.choices,
    );
    const targetKeys = core.targetKeys;
    const missing = boundTargets.filter((key) => !targetKeys.includes(key));
    const deflect = deflectCostsForTargets(room, host, input.playerId, input.choices, missing);
    if (deflect.length > 0) {
      extraAdditional.push(...deflect);
      const replan = planCore(room, host, { ...input, extraAdditional: [...extraAdditional] });
      if (!replan.ok) return replan;
      core = replan;
    }
  }
  if (!core.ok || core.pendingChoice || core.pendingOptional.length > 0) return core;
  const repeat = bindRepeatChoices(room, host, info, ability, {
    choices: core.choices,
    optionalCosts: input.optionalCosts,
  });
  if (!repeat.ok) return repeat;
  const repeatKeys = Object.keys(repeat.choices).filter((key) => key.startsWith("repeat:"));
  if (!repeat.pending && repeatKeys.length === 0) return core;
  const merged: CorePlan = {
    ...core,
    choices: repeat.choices,
    targetKeys: [...core.targetKeys, ...repeat.targetKeys],
  };
  if (repeat.pending) return { ...merged, pendingChoice: repeat.pending };
  if (repeat.targetKeys.length === 0) return merged;
  extraAdditional.push(...repeatDeflectCosts(room, host, input.playerId, repeat.choices, repeat.targetKeys));
  return planCore(room, host, {
    ...input,
    choices: repeat.choices,
    extraAdditional: [...extraAdditional],
  });
}

/**
 * 420.3: a Limited play instructed by an effect (R2-effects' `play` op). The effect names the
 * card (any zone), may replace or ignore its costs (420.3.b.1) and may require a location
 * (355.17); the Discretionary-play timing permissions (358.4) do not apply.
 */
export interface LimitedPlay {
  permission?: PlayPermission;
  /** 355.2.b: Locations the instructing effect makes valid ("you may play it here"). */
  extraLocations?: string[];
  /** 355.17: Locations the instructing effect requires ("to a battlefield you control"). */
  requiredLocations?: string[];
}

/** 349–358: the full play verdict for a card that is still in its zone. Pure. */
export function planCardPlay(
  room: Room,
  playerId: string,
  cardId: string,
  request: Pick<PlayRequest, "choices" | "optionalCosts" | "optionalCostsDeclared" | "plan" | "location">,
  host: RulesHost,
  limited?: LimitedPlay,
): CardPlayPlanResult {
  const located = host.findCard(room, cardId);
  // 354 / 420.1.a: hand or Chosen Champion zone, facedown (811.1.b) or an effect's permission.
  const permission = located
    ? limited
      ? (limited.permission ?? { id: "effect", rule: "420.3" })
      : playPermission(room, host, playerId, located)
    : null;
  if (!located || !permission) return fail("not_in_hand", "420.1.a");
  if (!limited) {
    const base = baseActionVerdict(room, playerId);
    if (!base.ok) return base;
  }
  const info = host.cardInfo(room, cardId);
  if (!info) return fail("unknown_card", "contract:§1");
  const keywords = withPermissionKeywords(cardKeywords(room, host, cardId, info), permission);
  // 355.2: the Location decides Ambush's Reaction permission (822.1.b), so resolve it first.
  const place = chooseLocation(
    room,
    host,
    {
      playerId,
      cardId,
      info,
      keywords,
      ...(permission.facedownAt ? { facedownAt: permission.facedownAt } : {}),
      ...(limited?.extraLocations ? { extraLocations: limited.extraLocations } : {}),
      ...(limited?.requiredLocations ? { requiredLocations: limited.requiredLocations } : {}),
    },
    request.location,
  );
  const timingKeywords = place.ok && place.option?.viaAmbush ? [...keywords, "Reaction"] : keywords;
  // 358.4 (checked up front, 358.5): 806/813 timing permissions (not for Limited plays, 420.3).
  if (!limited) {
    const timing = keywordTimingVerdict(room, playerId, timingKeywords);
    if (!timing.ok) return timing;
  }
  if (!place.ok) return place;
  // 475–479 restriction layer: "can't play …".
  const restriction = restrictionFor(room, host, { kind: "play", playerId, cardId });
  if (restriction) return fail("restricted", restriction.rule ?? "355.17.b", restriction.note);
  const ability = spellAbility(info);
  const core = planCoreWithRepeat(room, host, info, ability, {
    playerId,
    kind: "card",
    sourceId: cardId,
    ...(ability ? { ability } : {}),
    info,
    keywords,
    domains: cardDomains(info),
    base: printedCardCost(info),
    permission,
    choices: request.choices,
    optionalCosts: request.optionalCosts,
    optionalCostsDeclared: request.optionalCostsDeclared !== false,
    ...(request.plan ? { plan: request.plan } : {}),
    excludeIds: [cardId],
    ...(permission.facedownAt ? { facedownAt: permission.facedownAt } : {}),
  });
  if (!core.ok) return core;
  return {
    ...core,
    located,
    info,
    permission,
    location: place.location,
    locationOption: place.option,
    keywords: timingKeywords,
  };
}

/** Re-plan a Pending card item after a prompt answer (the card is on the chain now). */
export function planPendingCard(room: Room, host: RulesHost, item: ChainItem): CorePlan | RulesFailure {
  const snapshot = item.cardSnapshot;
  const process = item.process;
  if (!snapshot || !process) return fail("card_not_found", "354");
  const info = snapshotInfo(snapshot);
  const permission: PlayPermission = process.permission
    ? { ...process.permission }
    : { id: "hand", rule: "420.1.a" };
  const keywords = withPermissionKeywords(keywordsWithPrinted(room, snapshot.id, printedCardKeywords(info), host), permission);
  const ability = spellAbility(info);
  return planCoreWithRepeat(room, host, info, ability, {
    playerId: item.controller,
    kind: "card",
    sourceId: snapshot.id,
    ...(ability ? { ability } : {}),
    info,
    keywords,
    domains: cardDomains(info),
    base: printedCardCost(info),
    permission,
    choices: item.choices,
    optionalCosts: item.optionalCosts ?? [],
    // 355.1.a: only requests that explicitly omitted `optionalCosts` keep prompting; old
    // serialized pending items default to the pre-prompt behaviour.
    optionalCostsDeclared: process.request.optionalCostsDeclared !== false,
    ...(process.request.plan ? { plan: process.request.plan } : {}),
    itemId: item.id,
    ...(permission.facedownAt ? { facedownAt: permission.facedownAt } : {}),
  });
}

function savedPriority(rules: RulesState) {
  return { priority: rules.priority, focus: rules.focus, passes: [...rules.passes] };
}


/** 805.2.b / 805.6: a paid Accelerate replaces entering exhausted with entering ready. */
function applyEnterReady(room: Room, item: ChainItem, step: RulesStepContext): void {
  const snapshot = item.cardSnapshot;
  if (!snapshot || !(item.optionalCosts ?? []).includes("accelerate")) return;
  const located = step.host.findCard(room, snapshot.id);
  if (!located || !located.card.exhausted) return;
  step.host.setExhausted(room, snapshot.id, false);
  // Not a "ready" event: the unit never entered exhausted (805.6.a).
  pushEvent(step.events, { type: "enters_ready", cardId: snapshot.id, playerId: item.controller, data: { rule: "805.6" } });
}

/**
 * 357–359: pay and finalize a Pending card item whose choices and cost objects are all known.
 * Not atomic by itself (the caller owns the undo point).
 */
export function completeCardItem(
  room: Room,
  step: RulesStepContext,
  item: ChainItem,
  core: CorePlan,
  hold: boolean,
): IntentResult {
  const rules = room.rules;
  if (!rules || !core.payment) return fail("insufficient_resources", "357");
  const paid = applyPayment(room, step, item.controller, core.cost, core.payment);
  if (!paid.ok) return paid;
  const location = item.choices.location;
  item.choices = { ...core.choices, ...(location !== undefined ? { location } : {}) };
  item.paid = paidCostRecord(core.cost, core.payment, item.optionalCosts ?? []);
  item.totalCost = costSummary(core.cost);
  delete item.process;
  const snapshot = item.cardSnapshot;
  if (snapshot && item.playedFromFacedown) {
    delete rules.objects[snapshot.id]?.hiddenTurn;
    delete rules.objects[snapshot.id]?.hiddenBy;
  }
  // 350.1 / 359: the card has finished the process — it is Played and Finalized.
  if (snapshot) recordFinalizedCard(room, item.controller, snapshot.id);
  rules.history.cardsPlayedThisTurn[item.controller] = (rules.history.cardsPlayedThisTurn[item.controller] ?? 0) + 1;
  pushEvent(step.events, {
    type: "card_played",
    ...(snapshot ? { cardId: snapshot.id } : {}),
    playerId: item.controller,
    ...(item.cardName ? { cardName: item.cardName } : {}),
    data: { itemId: item.id, hold, ...(item.playedFromFacedown ? { playedFromFacedown: true } : {}) },
  });
  finalizeChainItem(room, item, step);
  applyEnterReady(room, item, step);
  runCleanupOrQueue(room, step);
  if (rules.chain.some((entry) => entry.id === item.id)) {
    // 337.4: after finalizing, the controller of the newest item gains Priority.
    grantPriority(rules, item.controller);
    // Owner decision 3: auto-pass unless held — never on behalf of a player without Priority (F1).
    // Full control (auto-pass `hold`, docs/rules/auto-pass.md) holds every play.
    if (!hold && !fullControl(rules, item.controller) && rules.priority === item.controller) {
      passPriority(room, item.controller, step);
    }
  }
  return { ok: true };
}

/** 354–359 on the draft for a verdict-checked plan. */
export function executeCardPlay(
  room: Room,
  step: RulesStepContext,
  actorId: string,
  plan: CardPlayPlan,
  request: PlayRequest,
): IntentResult {
  const rules = room.rules;
  if (!rules) return fail("rules_require_strict", "contract:§1");
  const saved = savedPriority(rules);
  // 354: move the card from its zone to the chain.
  const snapshot = step.host.takeCard(room, plan.located.playerId, plan.located.zone, plan.located.card.id);
  if (!snapshot) return fail("card_not_found", "354");
  // 422.4: a facedown card changing zones is revealed to all players. Its hidden-turn record is
  // kept until the play completes so a 358.5 undo can put it back facedown, still playable.
  if (plan.permission.facedownAt) delete snapshot.hidden;
  const { unit, gear } = typeOf(plan.info);
  const item: ChainItem = {
    id: step.host.nextId("chain"),
    kind: "card",
    status: "pending",
    controller: actorId,
    cardName: plan.info.name,
    ...(snapshot.cardCode ? { cardCode: snapshot.cardCode } : {}),
    choices: { ...plan.choices },
    origin: "play",
    fromZone: plan.located.zone,
    cardSnapshot: snapshot,
    addedAt: step.ctx.now,
    ...(request.optionalCosts.length ? { optionalCosts: [...request.optionalCosts] } : {}),
    ...(plan.permission.facedownAt ? { playedFromFacedown: plan.permission.facedownAt } : {}),
    // R3 — 829.1.b.1: a spell played for its Flow cost is banished instead of leaving the chain
    // (a 358.5 undo returns it to the trash; that is not leaving the chain as a finalized item).
    ...(plan.permission.id === "flow" ? { leaveChainTo: "banished" as const } : {}),
  };
  // 355.2: only permanents carry a location.
  if (unit || gear) item.choices.location = plan.location;
  appendChainItem(room, item, step);

  const pending = plan.pendingChoice ?? null;
  const optional = plan.pendingOptional[0] ?? null;
  if (pending || optional || plan.pendingCost) {
    item.process = {
      kind: "card",
      stage: pending ? "choices" : optional ? "optional" : "payment",
      permission: { ...plan.permission },
      fromZone: plan.located.zone,
      fromIndex: plan.located.index,
      fromPlayerId: plan.located.playerId,
      saved,
      request: {
        ...(request.plan ? { plan: request.plan } : {}),
        ...(request.optionalCosts.length ? { optionalCosts: [...request.optionalCosts] } : {}),
        optionalCostsDeclared: request.optionalCostsDeclared !== false,
        hold: request.hold,
      },
    };
    if (pending) openChoicePrompt(room, step, item, pending);
    else if (optional) openOptionalCostPrompt(room, step, item, optional);
    else openCostPrompt(room, step, item, plan.pendingCost!);
    return { ok: true };
  }
  return completeCardItem(room, step, item, plan, request.hold);
}

/** 358.5: undo a Pending play — card back to its zone, Priority/Focus restored. */
export function cancelPendingItem(room: Room, step: RulesStepContext, item: ChainItem, failure: RulesFailure): void {
  const rules = room.rules;
  const process = item.process;
  if (!rules || !process) return;
  removeChainItem(room, item.id);
  if (item.kind === "card" && item.cardSnapshot && process.fromZone && process.fromPlayerId) {
    const card = { ...item.cardSnapshot };
    if (process.permission?.facedownAt) card.hidden = true;
    step.host.putCard(room, process.fromPlayerId, process.fromZone, card, process.fromIndex);
  }
  rules.priority = process.saved.priority;
  rules.focus = process.saved.focus;
  rules.passes = [...process.saved.passes];
  pushEvent(step.events, {
    type: "play_cancelled",
    playerId: item.controller,
    ...(item.cardName ? { cardName: item.cardName } : {}),
    data: { itemId: item.id, code: failure.code, rule: failure.rule, ...(failure.detail ? { detail: failure.detail } : {}) },
  });
}

/**
 * Continue a Pending item after its play prompt was answered (`choices` already updated).
 * Either opens the next prompt, or pays and finalizes atomically; a failure undoes the play
 * (358.5) and the answering intent still succeeds.
 */
export function continuePendingItem(
  room: Room,
  step: RulesStepContext,
  item: ChainItem,
  replan: (room: Room, host: RulesHost, item: ChainItem) => CorePlan | RulesFailure,
  complete: (room: Room, step: RulesStepContext, item: ChainItem, core: CorePlan, hold: boolean) => IntentResult,
): IntentResult {
  const process = item.process;
  if (!process) return fail("no_pending_prompt", "411.2");
  const plan = replan(room, step.host, item);
  if (!plan.ok) {
    cancelPendingItem(room, step, item, plan);
    return { ok: true };
  }
  item.choices = { ...item.choices, ...plan.choices };
  if (plan.pendingChoice) {
    process.stage = "choices";
    openChoicePrompt(room, step, item, plan.pendingChoice);
    return { ok: true };
  }
  if (plan.pendingOptional.length > 0) {
    // 355.1.a: one yes/no per affordable optional additional cost, before payment.
    process.stage = "optional";
    openOptionalCostPrompt(room, step, item, plan.pendingOptional[0]!);
    return { ok: true };
  }
  if (plan.pendingCost) {
    process.stage = "payment";
    openCostPrompt(room, step, item, plan.pendingCost);
    return { ok: true };
  }
  const point = checkpoint(room, step);
  const done = complete(room, step, item, plan, process.request.hold === true);
  if (!done.ok) {
    rollback(room, step, point);
    const restored = room.rules?.chain.find((entry) => entry.id === item.id);
    if (restored) cancelPendingItem(room, step, restored, done);
  }
  return { ok: true };
}

export function choicesWithLocation(choices: ChoiceRecord, location: unknown): ChoiceRecord {
  return location === undefined ? choices : { ...choices, location: location as string };
}
