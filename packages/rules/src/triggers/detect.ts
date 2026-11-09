/**
 * Trigger detection — rules 382–386 (triggered abilities), 383.2.c (evaluated after the event;
 * leave-the-board triggers of the object itself, 383.2.c.3), 383.3.e / 386 (once each turn),
 * 383.4.e/f (attack/defend triggers on R2-combat's designation events), 390–393 (delayed triggers), 727.1.c.1
 * (dependent keywords must be active), 816/817/823/831 (keyword triggers).
 *
 * Detection turns new `GameEvent`s into `PendingTrigger`s in `rules.triggers`; `index.ts`
 * (`flushPendingTriggers`) moves them onto the chain in 303.2.a / 383.3.d order.
 */
import type { Ability, CardInstance, GameEvent, PendingTrigger, Room, Trigger } from "@rift/protocol";
import type { RulesHost } from "../host";
import type { RulesStepContext } from "../types";
import { pushEvent } from "../types";
import { getCardScript } from "../cards/registry";
import { effectiveKeywordValues, effectiveMight, keywordsAtDepth } from "../layers";
import { consumeOnceCostEffects } from "../layers/costs";
import { enterReadyApplies } from "../layers/entry";
import { makeEnv } from "../effects/env";
import { evaluateCondition } from "../effects/evaluate";
import { battlefieldNameAt, battlefieldObjectId } from "../effects/objects";
import { takeNewEvents } from "./cursor";
import { KEYWORD_TRIGGERS } from "./keywords";
import { phaseTriggerMatches, triggerMatchesEvent, type TriggerScope } from "./match";
import { hasUnitPresentAt, unitsPresentAt } from "../state/presence";

export interface TriggerEntry {
  ref: string;
  trigger: Trigger;
  optional?: boolean;
  condition?: Extract<Ability, { kind: "triggered" }>["condition"];
  limit?: Extract<Ability, { kind: "triggered" }>["limit"];
  /** Delayed triggers ignore the "your turn" phase convention (393). */
  anyTurn?: boolean;
  /** Delayed triggers: the creating ability's bindings (359.3.f.3.a). */
  choices?: Record<string, unknown>;
  /**
   * 718.2 / 718.3 / 719.1: an attached card's Effect Text is appended to its Top-Most card.
   * The triggered ability is executed from this card's script while the host stays the source
   * object (`sourceObjectId`), so "self/here/host" refer to the Top-Most card.
   */
  scriptName?: string;
}

export interface TriggerSource {
  sourceId: string;
  controller: string;
  name: string;
  entries: TriggerEntry[];
  /** Battlefield sources act for the event's player ("When you hold here"). */
  battlefield?: boolean;
}

const LEAVE_EVENTS = new Set(["kill", "banish", "return_to_hand", "recycle"]);

function scriptEntries(name: string): TriggerEntry[] {
  const script = getCardScript(name);
  if (!script || script.status === "manual") return [];
  const out: TriggerEntry[] = [];
  script.abilities.forEach((ability, index) => {
    if (ability.kind !== "triggered") return;
    out.push({
      ref: `triggered:${index}`,
      trigger: ability.trigger,
      ...(ability.optional ? { optional: true } : {}),
      ...(ability.condition ? { condition: ability.condition } : {}),
      ...(ability.limit ? { limit: ability.limit } : {}),
    });
  });
  return out;
}

function boardCards(room: Room, host: RulesHost): Array<{ card: CardInstance; controller: string }> {
  const out: Array<{ card: CardInstance; controller: string }> = [];
  const zones = ["base", ...host.battlefieldZones(room), "legend", "runeArea"];
  for (const playerId of host.activePlayerIds(room)) {
    for (const zone of zones) {
      for (const card of host.zoneCards(room, playerId, zone)) out.push({ card, controller: playerId });
    }
  }
  return out;
}

/** 384.2: triggered abilities of permanents are evaluated while on the Board. */
export function triggerSources(room: Room, host: RulesHost): TriggerSource[] {
  const out: TriggerSource[] = [];
  const cards = boardCards(room, host);
  for (const { card, controller } of cards) {
    // 718.2 / 719.1: an attached card's printed Rules Text is Inactive; its Effect Text is
    // appended to the Top-Most card (718.3) and executed from the attached card's script while
    // the host remains the source object (`sourceId`).
    if (card.attachedToCardId) continue;
    const entries = scriptEntries(card.name);
    for (const attached of cards) {
      if (attached.card.attachedToCardId !== card.id) continue;
      for (const entry of scriptEntries(attached.card.name)) {
        entries.push({ ...entry, scriptName: attached.card.name });
      }
    }
    const keywords = keywordsAtDepth(room, card.id, host, 0).map((keyword) => keyword.toLowerCase());
    if (keywords.length > 0) {
      const values = effectiveKeywordValues(room, card.id, host);
      for (const def of KEYWORD_TRIGGERS) {
        if (!keywords.includes(def.keyword)) continue;
        const value = Math.max(1, values[def.keyword] ?? 1);
        // 816.2.a / 819.2 / 830.2: several instances trigger once (with the summed value);
        // 817.2 / 821.1.c.7: multiple instances trigger separately.
        const instances = def.once ? 1 : value;
        for (let index = 0; index < instances; index += 1) {
          entries.push({
            ref: `keyword:${def.keyword}:${value}`,
            trigger: def.trigger,
            ...(def.optional ? { optional: true } : {}),
          });
        }
      }
    }
    if (entries.length > 0) out.push({ sourceId: card.id, controller, name: card.name, entries });
  }
  for (const zone of host.battlefieldZones(room)) {
    const name = battlefieldNameAt(room, host, zone);
    if (!name) continue;
    const entries = scriptEntries(name);
    if (entries.length === 0) continue;
    const present = host.activePlayerIds(room).filter((id) => hasUnitPresentAt(room, host, id, zone));
    out.push({
      sourceId: battlefieldObjectId(zone),
      controller: present.length === 1 ? present[0]! : (room.rules?.turn.player ?? ""),
      name,
      entries,
      battlefield: true,
    });
  }
  for (const effect of room.rules?.effects ?? []) {
    const modifier = effect.modifier;
    if (modifier.kind !== "custom" || modifier.id !== "delayed-trigger") continue;
    const params = modifier.params ?? {};
    out.push({
      sourceId: effect.sourceObjectId ?? effect.id,
      controller: effect.controller,
      name: (params.sourceName as string | undefined) ?? "Delayed ability",
      entries: [
        {
          ref: `delayed:${effect.id}`,
          trigger: params.trigger as Trigger,
          ...(params.optional ? { optional: true } : {}),
          anyTurn: true,
          ...(params.choices ? { choices: params.choices as Record<string, unknown> } : {}),
        },
      ],
    });
  }
  return out;
}

function limitKey(sourceId: string, scriptName: string | undefined, ref: string): string {
  // An attached card's Effect Text can reuse the host's `triggered:<n>` refs; the script name
  // keeps two attached scripts (and the host's own text) on separate once-per-turn limits.
  return scriptName ? `${sourceId}|${scriptName}|${ref}` : `${sourceId}|${ref}`;
}

/** 383.3.e.1 / 386.1: has a limited ability already been performed its allowed times? */
export function limitReached(room: Room, sourceId: string, entry: TriggerEntry): boolean {
  const limit = entry.limit;
  if (!limit) return false;
  const allowed = limit.kind === "once-per-turn" ? 1 : limit.kind === "per-turn" ? (limit.count ?? 1) : null;
  if (allowed === null) return false;
  const used = room.rules?.history.effects?.limits?.[limitKey(sourceId, entry.scriptName, entry.ref)] ?? 0;
  return used >= allowed;
}

export function noteLimitUse(room: Room, sourceId: string, ref: string, scriptName?: string): void {
  const rules = room.rules;
  if (!rules) return;
  const history = (rules.history.effects ??= {});
  const limits = (history.limits ??= {});
  const key = limitKey(sourceId, scriptName, ref);
  limits[key] = (limits[key] ?? 0) + 1;
}

function conditionHolds(room: Room, host: RulesHost, entry: TriggerEntry, scope: TriggerScope, event?: GameEvent): boolean {
  if (!entry.condition) return true;
  return evaluateCondition(
    {
      room,
      host,
      env: makeEnv({
        controller: scope.controller,
        ...(scope.sourceObjectId ? { sourceObjectId: scope.sourceObjectId } : {}),
        ...(event ? { event } : {}),
        ...(scope.choices ? { choices: { ...scope.choices } } : {}),
      }),
    },
    entry.condition,
  );
}

function queueTrigger(
  room: Room,
  step: RulesStepContext,
  source: TriggerSource,
  entry: TriggerEntry,
  controller: string,
  event?: GameEvent,
): void {
  const rules = room.rules;
  if (!rules) return;
  // 718.3 / 719.1: an attached card's appended ability executes from its own script, but the
  // Top-Most card stays the source object and the controller is the host's controller.
  const sourceName = entry.scriptName ?? source.name;
  const pending: PendingTrigger = {
    id: step.host.nextId("trigger"),
    controller,
    sourceObjectId: source.sourceId,
    sourceName,
    abilityRef: entry.ref,
    ...(event ? { event } : {}),
    ...(entry.optional ? { optional: true } : {}),
    conditionMet: true,
  };
  rules.triggers.push(pending);
  if (!entry.optional) noteLimitUse(room, source.sourceId, entry.ref, entry.scriptName);
  pushEvent(step.events, {
    type: "trigger",
    playerId: controller,
    cardName: sourceName,
    ...(source.sourceId ? { sourceObjectId: source.sourceId } : {}),
    data: { ref: entry.ref, triggerId: pending.id, ...(event ? { on: event.type } : {}) },
  });
}

/**
 * 709 / 370.1.a (EX[137]): a unit "becomes Mighty" when its Might changes from below 5 to 5 or
 * more while on the board. The last observed Might per unit is kept in the per-turn marks; a
 * unit seen for the first time (e.g. entering with 7 Might) does not "become" Mighty.
 */
function mightyEvents(room: Room, step: RulesStepContext): GameEvent[] {
  const rules = room.rules;
  if (!rules) return [];
  const history = (rules.history.effects ??= {});
  const marks = (history.marks ??= {});
  const previous = (marks.$might as Record<string, number> | undefined) ?? {};
  const next: Record<string, number> = {};
  const out: GameEvent[] = [];
  for (const playerId of step.host.activePlayerIds(room)) {
    for (const zone of ["base", ...step.host.battlefieldZones(room)]) {
      for (const card of unitsPresentAt(room, step.host, zone, playerId)) {
        const might = effectiveMight(room, card.id, step.host);
        next[card.id] = might;
        const before = previous[card.id];
        if (before !== undefined && before < 5 && might >= 5) {
          const event: GameEvent = { type: "become_mighty", cardId: card.id, playerId, zone, amount: might };
          pushEvent(step.events, event);
          out.push(event);
        }
      }
    }
  }
  marks.$might = next;
  return out;
}

/**
 * 392 / EX[179] (Ravenborn Tome): "The next spell you play this turn deals 1 Bonus Damage" binds
 * to the next spell that player plays (`params.boundCardId`).
 */
function bindNextSpellBonus(room: Room, step: RulesStepContext, event: GameEvent): void {
  const rules = room.rules;
  if (!rules || !event.cardId) return;
  const item = rules.chain.find((entry) => entry.cardSnapshot?.id === event.cardId);
  const type = (item?.cardSnapshot ? step.host.cardInfo(room, item.cardSnapshot.id)?.type ?? item.cardSnapshot.type : "") ?? "";
  if (!type.toLowerCase().includes("spell")) return;
  for (const effect of rules.effects) {
    const modifier = effect.modifier;
    if (modifier.kind !== "custom" || modifier.id !== "bonus-damage") continue;
    if (!modifier.params?.nextSpell || modifier.params.boundCardId || effect.controller !== event.playerId) continue;
    modifier.params = { ...modifier.params, boundCardId: event.cardId };
  }
}

/** Per-event bookkeeping that is not a trigger (420.5 once-cost effects, 369.3 enter ready). */
function eventSideEffects(room: Room, step: RulesStepContext, event: GameEvent): void {
  if (event.type === "card_played" && event.playerId) {
    consumeOnceCostEffects(room, event.playerId);
    bindNextSpellBonus(room, step, event);
    const rules = room.rules;
    if (rules && event.cardId) {
      const history = (rules.history.effects ??= {});
      const played = (history.played ??= {});
      played[event.playerId] = [...(played[event.playerId] ?? []), event.cardId];
    }
  }
  if (event.type === "unit_played" && event.cardId && event.playerId && event.zone && !event.data?.token) {
    // 369.3 / EX[134]: "… enter ready" replaces entering exhausted (no ready event, 805.6.a).
    if (step.host.isExhausted(room, event.cardId) && enterReadyApplies(room, step.host, event.cardId, event.playerId, event.zone)) {
      step.host.setExhausted(room, event.cardId, false);
    }
  }
}

/** Detect event triggers for every event emitted since the last detection in this step. */
export function collectTriggers(room: Room, step: RulesStepContext): number {
  const rules = room.rules;
  if (!rules || room.gameOutcome) return 0;
  const events = takeNewEvents(step);
  // 383.4.e/f: Attack/Defend triggers key off R2-combat's `attack`/`defend` events (466.2.c.3,
  // 323.2.a; emitted once per unit/player per combat). Only "becomes Mighty" is synthesized here.
  const synthesized = mightyEvents(room, step);
  takeNewEvents(step); // the synthesized events are processed below, not again later
  const all = [...events, ...synthesized].filter((event) => event.type !== "trigger");
  if (all.length === 0) return 0;
  const before = rules.triggers.length;
  for (const event of all) {
    eventSideEffects(room, step, event);
    const sources = triggerSources(room, step.host);
    // 383.2.c.3: the leaving object's own leave-the-board abilities ("When I die", Deathknell).
    const subject = event.cardId ?? event.objectId;
    if (LEAVE_EVENTS.has(event.type) && subject && event.cardName && !sources.some((source) => source.sourceId === subject)) {
      const entries = scriptEntries(event.cardName).filter((entry) => {
        const matcher = entry.trigger.kind === "event" ? entry.trigger.event : null;
        return !!matcher && matcher.subject?.targetRef === "self";
      });
      if (entries.length > 0) {
        sources.push({ sourceId: subject, controller: event.playerId ?? rules.turn.player, name: event.cardName, entries });
      }
    }
    for (const source of sources) {
      for (const entry of source.entries) {
        const controller = source.battlefield ? (event.playerId ?? source.controller) : source.controller;
        const scope: TriggerScope = {
          controller,
          sourceObjectId: source.sourceId,
          ...(entry.choices ? { choices: entry.choices } : {}),
        };
        if (!triggerMatchesEvent(room, step.host, entry.trigger, event, scope)) continue;
        if (limitReached(room, source.sourceId, entry)) continue;
        if (!conditionHolds(room, step.host, entry, scope, event)) continue;
        queueTrigger(room, step, source, entry, controller, event);
      }
    }
  }
  return rules.triggers.length - before;
}

export type PhaseMoment = "beginning" | "main" | "ending";

/**
 * Turn-structure triggers (315.2.a.1 start of Beginning Phase, 316.4 start of Main Phase, 317.1
 * end of turn). Fired once per turn per moment, when no task or chain work is outstanding, so
 * they finalize and resolve before the next step's tasks (e.g. Temporary before scoring, 816.1.b).
 */
export function collectPhaseTriggers(room: Room, step: RulesStepContext): number {
  const rules = room.rules;
  if (!rules || room.gameOutcome) return 0;
  if (rules.tasks.length > 0 || rules.chain.length > 0 || rules.prompt || rules.manual || rules.triggers.length > 0) {
    return 0;
  }
  let moment: PhaseMoment | null = null;
  if (rules.turn.phase === "beginning" && rules.turn.step === "beginning") moment = "beginning";
  else if (rules.turn.phase === "main" && !rules.showdown && !rules.combat) moment = "main";
  else if (rules.turn.phase === "ending" && rules.turn.step === "ending") moment = "ending";
  if (!moment) return 0;
  const history = (rules.history.effects ??= {});
  const marks = (history.marks ??= {});
  const key = `$phase:${moment}`;
  if (marks[key] === true) return 0;
  marks[key] = true;
  const before = rules.triggers.length;
  for (const source of triggerSources(room, step.host)) {
    for (const entry of source.entries) {
      const scope: TriggerScope = { controller: source.controller, sourceObjectId: source.sourceId };
      const matches = entry.anyTurn
        ? phaseTriggerMatches(room, entry.trigger, moment, { ...scope, controller: rules.turn.player })
        : phaseTriggerMatches(room, entry.trigger, moment, scope);
      if (!matches) continue;
      if (limitReached(room, source.sourceId, entry)) continue;
      if (!conditionHolds(room, step.host, entry, scope)) continue;
      queueTrigger(room, step, source, entry, source.controller);
    }
  }
  return rules.triggers.length - before;
}
