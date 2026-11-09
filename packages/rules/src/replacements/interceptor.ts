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
 * TODO(R2-effects): 372/373 — when several replacements apply, the affected object's controller
 * chooses the order; they currently apply in timestamp order (482).
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
  let current = proposal;
  // 438: prevention.
  if (current.type === "deal_damage" && current.cardId && (current.amount ?? 0) > 0) {
    const before = current.amount ?? 0;
    const after = applyPreventShields(room, current.cardId, before, true);
    if (after !== before) {
      pushEvent(step.events, { type: "prevented", cardId: current.cardId, amount: before - after, data: { rule: "438.2" } });
      current = { ...current, amount: after };
    }
  }
  const active = applying(step);
  for (const source of replacementSources(room, step.host)) {
    if (active.has(source.id) || !limitOk(room, source)) continue;
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
    // 370.1.b: the event is replaced by the replacing instructions.
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
      source.replace as Parameters<typeof startMachine>[2],
      makeEnv({
        controller: source.controller,
        ...(source.sourceObjectId ? { sourceObjectId: source.sourceObjectId } : {}),
        kind: "replacement",
        event: proposalEvent(current),
        choices: { ...(source.choices ?? {}) },
      }),
    );
    active.delete(source.id);
    return null;
  }
  return current;
}

registerActionInterceptor(replacementInterceptor);
