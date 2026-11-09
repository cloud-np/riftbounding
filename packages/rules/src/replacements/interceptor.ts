/**
 * Replacement effects — rules 367–375, Prevent 438, Skip 444, through the R1 action interceptor
 * (`registerActionInterceptor`; every `actions/*` primitive calls `interceptAction` first).
 *
 * Applied to a proposed game action, in this order:
 * 1. Prevention shields on the damaged unit (438.2/438.3: consume the Prevent Value; "All" never
 *    decreases; 438.4: fully prevented damage is not dealt at all) and `{ prevent: X }`
 *    replacement abilities (438.1.a.1 includes Bonus Damage, which is already in the amount);
 * 2. Skip effects (444) for the Draw Phase draw / Channel Phase channel;
 * 3. Replacement abilities (`Ability.kind === "replacement"`) of board objects and delayed
 *    replacements (`custom` "replacement" effects): when `matches` holds for the action, the
 *    action is replaced by executing `replace` and the original does not happen (370.1.b /
 *    370.1.c; triggers on the replaced event do not fire, 383.2.c.3.a / EX[164]).
 *
 * 370.2: each replacement applies at most once to an event and to the actions that replace it —
 * replacements currently being applied (tracked on the per-intent step object) are skipped for
 * the nested actions. 371 / 386: "once each turn" limits use `history.effects.replacements`.
 * R3: 371.2 optional replacements and 372/373 ordering hold the event for a decision
 * (`replacements/decisions.ts`); the event is settled by `answerHeld`/`resettleHeld`.
 */
import type { Ability, EventMatcher, GameEvent, Room } from "@rift/protocol";
import type { RulesHost } from "../host";
import type { RulesStepContext } from "../types";
import { pushEvent } from "../types";
import { getCardScript } from "../cards/registry";
import { registerActionInterceptor, type ActionProposal } from "../timing/hooks";
import { durationActive } from "../layers/durations";
import { makeEnv } from "../effects/env";
import { startMachine } from "../effects/machine";
import { eventMatches } from "../triggers/match";
import { battlefieldNameAt } from "../effects/objects";
import { dealDamage } from "../actions/damage";
import { kill, recall } from "../actions/move";
import { costPayable } from "../effects/ops/cost-then";
import { EFFECTS_PROMPT_REASONS } from "../prompts/effects/reasons";
import {
  DECLINE_ALL,
  HOLDABLE_ACTIONS,
  decisionAsk,
  effectToRun,
  inMachine,
  isHeldOnStep,
  isOptionalReplace,
  optionalReplaceCost,
  orderChooser,
  overrideFor,
  proposalSignature,
  queueHeld,
  withOverride,
  type DecisionSource,
  type HeldReplacement,
  type ReplacementOverride,
} from "./decisions";

const APPLYING = Symbol("effects.replacementsApplying");

type WithApplying = RulesStepContext & { [APPLYING]?: Set<string> };

function applying(step: RulesStepContext): Set<string> {
  const holder = step as WithApplying;
  return (holder[APPLYING] ??= new Set());
}

export interface ReplacementSource {
  id: string;
  sourceObjectId?: string;
  controller: string;
  matches: EventMatcher;
  replace: Extract<Ability, { kind: "replacement" }>["replace"];
  limit?: Extract<Ability, { kind: "replacement" }>["limit"];
  /** Delayed replacement (continuous effect id) used up on application. */
  effectId?: string;
  choices?: Record<string, unknown>;
}

/** Every replacement that could apply right now, in timestamp order (482). */
export function replacementSources(room: Room, host: RulesHost): ReplacementSource[] {
  const out: ReplacementSource[] = [];
  const zones = ["base", ...host.battlefieldZones(room), "legend", "runeArea"];
  for (const playerId of host.activePlayerIds(room)) {
    for (const zone of zones) {
      for (const card of host.zoneCards(room, playerId, zone)) {
        if (card.attachedToCardId) continue; // 718.2
        const script = getCardScript(card.name);
        if (!script || script.status === "manual") continue;
        script.abilities.forEach((ability, index) => {
          if (ability.kind !== "replacement") return;
          out.push({
            id: `${card.id}|replacement:${index}`,
            sourceObjectId: card.id,
            controller: playerId,
            matches: ability.matches,
            replace: ability.replace,
            ...(ability.limit ? { limit: ability.limit } : {}),
          });
        });
      }
    }
  }
  for (const zone of host.battlefieldZones(room)) {
    const name = battlefieldNameAt(room, host, zone);
    const script = name ? getCardScript(name) : undefined;
    if (!script || script.status === "manual") continue;
    script.abilities.forEach((ability, index) => {
      if (ability.kind !== "replacement") return;
      out.push({
        id: `battlefield:${zone}|replacement:${index}`,
        sourceObjectId: `battlefield:${zone}`,
        controller: room.rules?.turn.player ?? "",
        matches: ability.matches,
        replace: ability.replace,
        ...(ability.limit ? { limit: ability.limit } : {}),
      });
    });
  }
  for (const effect of room.rules?.effects ?? []) {
    const modifier = effect.modifier;
    if (modifier.kind !== "custom" || modifier.id !== "replacement") continue;
    const stamp = {
      duration: effect.duration,
      turn: effect.expiresAtTurn ?? room.rules?.turn.number ?? 0,
      controller: effect.controller,
      ...(effect.expiresAtTurn !== undefined ? { expiresAtTurn: effect.expiresAtTurn } : {}),
    };
    if (!durationActive(room, stamp)) continue;
    const params = modifier.params ?? {};
    out.push({
      id: effect.id,
      ...(effect.sourceObjectId ? { sourceObjectId: effect.sourceObjectId } : {}),
      controller: effect.controller,
      matches: params.matches as EventMatcher,
      replace: params.replace as ReplacementSource["replace"],
      ...(params.once !== false ? { effectId: effect.id } : {}),
      ...(params.choices ? { choices: params.choices as Record<string, unknown> } : {}),
    });
  }
  return out;
}

/** The event a proposal would generate (for `EventMatcher` evaluation). */
export function proposalEvent(proposal: ActionProposal): GameEvent {
  return {
    type: proposal.type === "deal_damage" ? "damage" : proposal.type,
    ...(proposal.cardId ? { cardId: proposal.cardId } : {}),
    ...(proposal.playerId ? { playerId: proposal.playerId } : {}),
    ...(proposal.zone ? { zone: proposal.zone } : {}),
    ...(proposal.amount !== undefined ? { amount: proposal.amount } : {}),
    ...(proposal.objectId ? { sourceObjectId: proposal.objectId } : {}),
    ...(proposal.data ? { data: proposal.data } : {}),
  };
}

function limitOk(room: Room, source: ReplacementSource): boolean {
  if (!source.limit) return true;
  const allowed = source.limit.kind === "once-per-turn" ? 1 : source.limit.kind === "per-turn" ? (source.limit.count ?? 1) : null;
  if (allowed === null) return true;
  return (room.rules?.history.effects?.replacements?.[source.id] ?? 0) < allowed;
}

function noteUse(room: Room, source: ReplacementSource): void {
  const rules = room.rules;
  if (!rules) return;
  const history = (rules.history.effects ??= {});
  const uses = (history.replacements ??= {});
  uses[source.id] = (uses[source.id] ?? 0) + 1;
  if (source.effectId) rules.effects = rules.effects.filter((effect) => effect.id !== source.effectId);
}

/** 438.2/438.3: apply prevention shields to a damage amount; returns the damage left. */
export function applyPreventShields(room: Room, cardId: string, amount: number, consume: boolean): number {
  const object = room.rules?.objects[cardId];
  if (!object?.prevent || amount <= 0) return amount;
  let left = amount;
  const remaining: typeof object.prevent = [];
  for (const shield of object.prevent) {
    if (!durationActive(room, shield)) continue;
    if (left <= 0) {
      remaining.push(shield);
      continue;
    }
    if (shield.value === "all") {
      left = 0;
      remaining.push(shield);
      continue;
    }
    const prevented = Math.min(shield.value, left);
    left -= prevented;
    const value = shield.value - prevented;
    if (value > 0) remaining.push({ ...shield, value });
  }
  if (consume) {
    if (remaining.length > 0) object.prevent = remaining;
    else delete object.prevent;
  }
  return left;
}

/** Total Prevent Value tracked on a unit ("all" = unlimited, 438.5.b). */
export function preventValue(room: Room, cardId: string): number | "all" {
  let total = 0;
  for (const shield of room.rules?.objects[cardId]?.prevent ?? []) {
    if (!durationActive(room, shield)) continue;
    if (shield.value === "all") return "all";
    total += shield.value;
  }
  return total;
}

function matchesProposal(room: Room, host: RulesHost, source: ReplacementSource, proposal: ActionProposal): boolean {
  const event = proposalEvent(proposal);
  const matcher: EventMatcher = {
    ...source.matches,
    type: (Array.isArray(source.matches.type) ? source.matches.type : [source.matches.type]).map((type) =>
      type === "deal_damage" ? "damage" : type,
    ),
  };
  return eventMatches(room, host, matcher, event, {
    controller: source.controller,
    ...(source.sourceObjectId ? { sourceObjectId: source.sourceObjectId } : {}),
  });
}

function skipApplies(room: Room, proposal: ActionProposal): string | null {
  const rules = room.rules;
  if (!rules) return null;
  const what =
    proposal.type === "draw" && proposal.data?.resumeViaTask && rules.turn.phase === "draw"
      ? "draw"
      : proposal.type === "channel" && rules.turn.phase === "channel"
        ? "channel"
        : null;
  if (!what) return null;
  const effect = rules.effects.find(
    (entry) =>
      entry.modifier.kind === "custom" &&
      entry.modifier.id === "skip" &&
      entry.modifier.params?.what === what &&
      entry.modifier.params?.player === proposal.playerId,
  );
  return effect?.id ?? null;
}

export function replacementInterceptor(room: Room, step: RulesStepContext, proposal: ActionProposal): ActionProposal | null {
  const rules = room.rules;
  if (!rules) return proposal;
  // 444: skip the Draw Phase draw / Channel Phase channel.
  const skip = skipApplies(room, proposal);
  if (skip) {
    rules.effects = rules.effects.filter((effect) => effect.id !== skip);
    pushEvent(step.events, { type: "skip", playerId: proposal.playerId, data: { action: proposal.type, rule: "444.2" } });
    return null;
  }
  const override = overrideFor(step, proposal);
  // A held event stays held until its decision is made (371.2 / 372).
  if (!override && isHeld(room, step, proposal)) return null;
  let current = proposal;
  // 438: prevention.
  if (!override?.skipPrevention && current.type === "deal_damage" && current.cardId && (current.amount ?? 0) > 0) {
    const before = current.amount ?? 0;
    const after = applyPreventShields(room, current.cardId, before, true);
    if (after !== before) {
      pushEvent(step.events, { type: "prevented", cardId: current.cardId, amount: before - after, data: { rule: "438.2" } });
      current = { ...current, amount: after };
    }
  }
  const active = applying(step);
  const declined = new Set(override?.declined ?? []);
  const instead: ReplacementSource[] = [];
  for (const source of replacementSources(room, step.host)) {
    if (active.has(source.id) || declined.has(source.id) || !limitOk(room, source)) continue;
    if (!matchesProposal(room, step.host, source, current)) continue;
    const replace = source.replace as { prevent?: unknown };
    if (replace && typeof replace === "object" && "prevent" in replace && !("op" in replace)) {
      if (current.type !== "deal_damage") continue;
      const value = typeof replace.prevent === "number" ? replace.prevent : 0;
      const before = current.amount ?? 0;
      const after = Math.max(0, before - value);
      if (after === before) continue;
      noteUse(room, source);
      pushEvent(step.events, { type: "prevented", cardId: current.cardId, amount: before - after, sourceObjectId: source.sourceObjectId });
      current = { ...current, amount: after };
      continue;
    }
    if (!usable(room, step, source)) continue;
    instead.push(source);
  }
  if (instead.length === 0) return current;
  if (override?.apply) {
    const chosen = instead.find((source) => source.id === override.apply);
    if (chosen) {
      applyReplacement(room, step, chosen, current);
      return null;
    }
  }
  const optional = instead.some((source) => isOptionalReplace(source.replace));
  if (instead.length === 1 && !optional) {
    applyReplacement(room, step, instead[0]!, current);
    return null;
  }
  // 371.2 / 372: a player decides — hold the event when the procedure can wait for them.
  if (canHold(room, step, current)) {
    hold(room, step, {
      proposal: current,
      candidates: instead.map((source) => source.id),
      declined: [...declined],
      stage: instead.length === 1 ? "optional" : "order",
      ...(instead.length === 1 ? { chosen: instead[0]!.id } : {}),
    });
    return null;
  }
  // Fallback: mandatory replacements in timestamp order (482); optional ones are not applied.
  const mandatory = instead.find((source) => !isOptionalReplace(source.replace));
  if (mandatory) {
    applyReplacement(room, step, mandatory, current);
    return null;
  }
  return current;
}

/** 370.1.b: replace the event with the replacement's instructions (374: its controller's). */
function applyReplacement(room: Room, step: RulesStepContext, source: ReplacementSource, current: ActionProposal): void {
  const active = applying(step);
  noteUse(room, source);
  active.add(source.id);
  pushEvent(step.events, {
    type: "replaced",
    ...(current.cardId ? { cardId: current.cardId } : {}),
    ...(source.sourceObjectId ? { sourceObjectId: source.sourceObjectId } : {}),
    playerId: source.controller,
    data: { action: current.type, replacement: source.id },
  });
  startMachine(
    room,
    step,
    effectToRun(source.replace),
    makeEnv({
      controller: source.controller,
      ...(source.sourceObjectId ? { sourceObjectId: source.sourceObjectId } : {}),
      kind: "replacement",
      event: proposalEvent(current),
      choices: { ...(source.choices ?? {}) },
    }),
  );
  active.delete(source.id);
}

/** "You may pay [X] to … instead": only a payable optional cost can be applied (371.2, 445). */
function usable(room: Room, step: RulesStepContext, source: ReplacementSource): boolean {
  const cost = optionalReplaceCost(source.replace);
  if (!cost) return true;
  return costPayable(
    { room, step, controller: source.controller, ...(source.sourceObjectId ? { sourceObjectId: source.sourceObjectId } : {}) },
    source.controller,
    cost,
  );
}

/* ---------------------------------------------------------------- held events (371.2 / 372) */

function isReplacementPrompt(room: Room): boolean {
  return room.rules?.prompt?.data?.reason === EFFECTS_PROMPT_REASONS.replacement;
}

function promptQueue(room: Room): HeldReplacement[] {
  if (!isReplacementPrompt(room)) return [];
  const queue = room.rules?.prompt?.data?.queue;
  return Array.isArray(queue) ? (queue as HeldReplacement[]) : [];
}

function isHeld(room: Room, step: RulesStepContext, proposal: ActionProposal): boolean {
  if (isHeldOnStep(step, proposal)) return true;
  const signature = proposalSignature(proposal);
  return promptQueue(room).some((held) => proposalSignature(held.proposal) === signature);
}

function canHold(room: Room, step: RulesStepContext, proposal: ActionProposal): boolean {
  if (!HOLDABLE_ACTIONS.includes(proposal.type)) return false;
  // 370.2: actions caused while a replacement is being applied are settled immediately.
  if (applying(step).size > 0) return false;
  if (inMachine(step)) return true;
  return !room.rules?.prompt || isReplacementPrompt(room);
}

function hold(room: Room, step: RulesStepContext, held: HeldReplacement): void {
  pushEvent(step.events, {
    type: "replacement_held",
    ...(held.proposal.cardId ? { cardId: held.proposal.cardId } : {}),
    data: { action: held.proposal.type, candidates: [...held.candidates], rule: held.stage === "order" ? "372" : "371.2.a" },
  });
  if (inMachine(step)) {
    queueHeld(step, held);
    return;
  }
  openReplacementPrompt(room, step, [...promptQueue(room), held]);
}

/** Decision sources for the current applicability of a held event. */
export function decisionSources(room: Room, step: RulesStepContext, held: HeldReplacement): DecisionSource[] {
  return applicableFor(room, step, held).map((source) => ({
    id: source.id,
    controller: source.controller,
    ...(source.sourceObjectId ? { sourceObjectId: source.sourceObjectId } : {}),
    optional: isOptionalReplace(source.replace),
  }));
}

function applicableFor(room: Room, step: RulesStepContext, held: HeldReplacement): ReplacementSource[] {
  const declined = new Set(held.declined);
  const active = applying(step);
  return replacementSources(room, step.host).filter((source) => {
    if (active.has(source.id) || declined.has(source.id) || !limitOk(room, source)) return false;
    const replace = source.replace as { prevent?: unknown };
    if (replace && typeof replace === "object" && "prevent" in replace && !("op" in replace)) return false;
    return matchesProposal(room, step.host, source, held.proposal) && usable(room, step, source);
  });
}

/** Re-run the held action through its primitive with `override` (no new decision for it). */
function performHeld(room: Room, step: RulesStepContext, held: HeldReplacement, extra: Partial<ReplacementOverride> = {}): void {
  const proposal = held.proposal;
  const override: ReplacementOverride = {
    signature: proposalSignature(proposal),
    declined: [...held.declined],
    skipPrevention: true,
    ...extra,
  };
  withOverride(step, override, () => {
    const cardId = proposal.cardId;
    if (!cardId) return;
    if (proposal.type === "kill") {
      const source = (proposal.data?.source ?? undefined) as { objectId?: string; playerId?: string } | undefined;
      kill(room, cardId, step, source);
    } else if (proposal.type === "deal_damage") {
      dealDamage(room, cardId, proposal.amount ?? 0, step, {
        ...(proposal.objectId ? { objectId: proposal.objectId } : {}),
        ...(proposal.playerId ? { playerId: proposal.playerId } : {}),
        ...(proposal.data?.combat ? { combat: true } : {}),
      });
    } else if (proposal.type === "recall") {
      recall(room, cardId, step);
    }
  });
}

/**
 * Settle a held event as far as possible without a player: no applicable replacement left →
 * the original action happens; one mandatory → it applies. Returns the decision still needed,
 * or null when settled.
 */
export function resettleHeld(room: Room, step: RulesStepContext, held: HeldReplacement): HeldReplacement | null {
  const applicable = applicableFor(room, step, held);
  if (applicable.length === 0) {
    performHeld(room, step, held);
    return null;
  }
  if (applicable.length === 1 && !isOptionalReplace(applicable[0]!.replace)) {
    performHeld(room, step, held, { apply: applicable[0]!.id });
    return null;
  }
  const candidates = applicable.map((source) => source.id);
  if (applicable.length === 1) return { ...held, candidates, stage: "optional", chosen: candidates[0]! };
  return { proposal: held.proposal, declined: held.declined, candidates, stage: "order" };
}

/** Apply a player's answer to a held decision; returns the next decision or null when settled. */
export function answerHeld(room: Room, step: RulesStepContext, held: HeldReplacement, answer: unknown): HeldReplacement | null {
  const choice = Array.isArray(answer) ? answer[0] : answer;
  const sources = decisionSources(room, step, held);
  if (held.stage === "optional") {
    const yes = choice === true || choice === "yes";
    const chosen = sources.find((source) => source.id === held.chosen);
    if (yes && chosen) {
      performHeld(room, step, held, { apply: chosen.id });
      return null;
    }
    // 371.2.b: a declined optional replacement has not been applied.
    return resettleHeld(room, step, { ...held, declined: [...held.declined, ...(held.chosen ? [held.chosen] : [])] });
  }
  if (choice === DECLINE_ALL) {
    return resettleHeld(room, step, { ...held, declined: [...held.declined, ...held.candidates] });
  }
  const chosen = sources.find((source) => source.id === choice);
  if (!chosen) return resettleHeld(room, step, held);
  const chooser = orderChooser(room, step.host, held.proposal);
  // 371.2.a: an optional replacement is applied only if its controller chooses to.
  if (chosen.optional && chosen.controller !== chooser) {
    return { ...held, stage: "optional", chosen: chosen.id };
  }
  performHeld(room, step, held, { apply: chosen.id });
  return null;
}

/** Open (or replace) the `effects.replacement` prompt for the first queued decision (373). */
export function openReplacementPrompt(room: Room, step: RulesStepContext, queue: HeldReplacement[]): void {
  const rules = room.rules;
  const first = queue[0];
  if (!rules || !first) return;
  const ask = decisionAsk(room, step.host, first, decisionSources(room, step, first));
  const reuse = isReplacementPrompt(room) ? rules.prompt : null;
  rules.prompt = {
    id: reuse?.id ?? step.host.nextId("prompt"),
    kind: ask.kind,
    playerId: ask.playerId,
    promptKey: ask.promptKey,
    rule: ask.rule,
    options: ask.options,
    min: ask.min,
    max: ask.max,
    data: { reason: EFFECTS_PROMPT_REASONS.replacement, queue: JSON.parse(JSON.stringify(queue)) as unknown[] },
  };
  if (!reuse) {
    pushEvent(step.events, { type: "prompt", playerId: ask.playerId, data: { kind: ask.kind, reason: EFFECTS_PROMPT_REASONS.replacement } });
  }
}

registerActionInterceptor(replacementInterceptor);
