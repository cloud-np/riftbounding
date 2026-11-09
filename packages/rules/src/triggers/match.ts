/**
 * Trigger matching — rules 383.1–383.4, 412.4 ("you" = the responsible player), 384–386.
 *
 * `EventMatcher` semantics (all present filters must hold):
 * - `type`: the `GameEvent.type` (or one of a list); "die" is an alias of "kill";
 * - `subject` (selector): the event's subject (`cardId ?? objectId`) matches, evaluated for the
 *   ability's controller with last-known information from the event (kill/leave events carry
 *   zone/controller/Might, 383.2.c.3.b). For subject-less events (conquer, hold) the ref "self"
 *   means "the source was present at `event.zone` under the acting player" (383.4.c.2.a,
 *   383.4.d.2.a);
 * - `player` / `controller` (PlayerSelector): `event.playerId` relative to the ability's
 *   controller ("When you …", 412.4);
 * - `cardType`: the subject's type; `zone`: `event.zone`; `from`: `event.data.from` (zone refs such
 *   as "here" resolve against the source);
 * - `sourceObjectId: "self"`: the event's `sourceObjectId` is the ability's source;
 * - `data`: equality on `event.data[key]` (`{ player: true }` selects the player-level `attack`/
 *   `defend` events of 466.2.c.3, i.e. "When you attack/defend");
 * - `condition`: evaluated for the source with the event bound (383.2.a.1: an "if" right after the
 *   condition is part of the trigger condition).
 */
import type { EventMatcher, GameEvent, Room, Trigger } from "@rift/protocol";
import type { RulesHost } from "../host";
import type { EvalContext, LastKnown } from "../effects/env";
import { makeEnv } from "../effects/env";
import { evaluateCondition, matchesSelector, resolvePlayers, resolveZoneNames } from "../effects/evaluate";
import { controllerOf, locate, typeMatches, typeOf } from "../effects/objects";

export interface TriggerScope {
  controller: string;
  sourceObjectId?: string;
  /** Bindings of a delayed trigger's creator (359.3.f.3.a: referenced when it was created). */
  choices?: Record<string, unknown>;
}

/**
 * 420.4.a: "when you play a card" triggers when playing completes by the card's resolution
 * (`played`); a countered card never resolves, so it never triggers (426.1.b). 383.4.c.2.c /
 * 383.4.d.2.c: conquer/hold effects trigger even when the point is replaced (`score_draw_instead`
 * carries `data.kind`).
 */
const TYPE_ALIASES: Record<string, string[]> = {
  die: ["kill"],
  played: ["spell_resolved", "unit_played", "gear_played"],
};

function typeList(matcher: EventMatcher): string[] {
  const raw = Array.isArray(matcher.type) ? matcher.type : [matcher.type];
  return raw.flatMap((type) => TYPE_ALIASES[type] ?? [type]);
}

/** Last-known information an event carries about its subject (383.2.c.3.b). */
export function eventLki(event: GameEvent): LastKnown {
  const data = (event.data ?? {}) as Record<string, unknown>;
  return {
    controller: event.playerId ?? null,
    owner: typeof data.owner === "string" ? data.owner : null,
    zone: event.zone ?? (typeof data.from === "string" ? data.from : null),
    might: typeof data.might === "number" ? data.might : null,
    name: event.cardName ?? null,
    ...(typeof data.stunned === "boolean" ? { stunned: data.stunned } : {}),
    ...(typeof data.buffs === "number" ? { buffs: data.buffs } : {}),
    ...(typeof data.empowered === "number" ? { empowered: data.empowered } : {}),
  };
}

function evalContext(room: Room, host: RulesHost, scope: TriggerScope, event: GameEvent): EvalContext {
  return {
    room,
    host,
    env: makeEnv({
      controller: scope.controller,
      ...(scope.sourceObjectId ? { sourceObjectId: scope.sourceObjectId } : {}),
      event,
      ...(scope.choices ? { choices: { ...scope.choices } } : {}),
    }),
  };
}

/** Subject-less events (conquer/hold): "I conquer" = present at the zone under the actor. */
function presentAtEvent(room: Room, host: RulesHost, event: GameEvent, objectId: string | undefined): boolean {
  if (!objectId || !event.zone) return false;
  const located = locate(room, host, objectId);
  if (!located || located.zone !== event.zone) return false;
  return !event.playerId || controllerOf(room, host, objectId) === event.playerId;
}

export function eventMatches(
  room: Room,
  host: RulesHost,
  matcher: EventMatcher,
  event: GameEvent,
  scope: TriggerScope,
): boolean {
  const type = event.type === "score_draw_instead" && typeof event.data?.kind === "string" ? event.data.kind : event.type;
  if (!typeList(matcher).includes(type)) return false;
  const ctx = evalContext(room, host, scope, event);
  const subject = event.cardId ?? event.objectId;
  if (matcher.subject) {
    if (!subject) {
      // 383.4.e/f: a player-level designation event ("When you attack/defend", `data.player`)
      // has a player, not an object, as its subject; "When I attack" matches the unit's event.
      if (event.data?.player === true) return false;
      if (matcher.subject.targetRef === "self") {
        if (!presentAtEvent(room, host, event, scope.sourceObjectId)) return false;
      } else {
        return false;
      }
    } else if (matcher.subject.targetRef === "self" && !matcher.subject.cardType && !matcher.subject.controller) {
      if (subject !== scope.sourceObjectId) return false;
    } else {
      const selector = matcher.subject.targetRef === "self" ? { ...matcher.subject, targetRef: undefined } : matcher.subject;
      if (matcher.subject.targetRef === "self" && subject !== scope.sourceObjectId) return false;
      if (!matchesSelector(ctx, selector, subject, { lki: eventLki(event), ignoreZone: selector.zone === undefined })) {
        return false;
      }
    }
  }
  const playerFilter = matcher.player ?? matcher.controller;
  if (playerFilter !== undefined) {
    if (!event.playerId || !resolvePlayers(ctx, playerFilter).includes(event.playerId)) return false;
  }
  if (matcher.cardType) {
    if (!subject) return false;
    const type = typeOf(room, host, subject);
    if (!typeMatches(type, matcher.cardType)) return false;
  }
  if (matcher.zone !== undefined) {
    const zones = resolveZoneNames(ctx, matcher.zone);
    if (!event.zone || !zones.includes(event.zone)) return false;
  }
  if (matcher.from !== undefined) {
    const zones = resolveZoneNames(ctx, matcher.from);
    const from = event.data?.from;
    if (typeof from !== "string" || !zones.includes(from)) return false;
  }
  if (matcher.sourceObjectId === "self" && event.sourceObjectId !== scope.sourceObjectId) return false;
  if (matcher.data) {
    for (const [key, value] of Object.entries(matcher.data)) {
      if ((event.data ?? {})[key] !== value) return false;
    }
  }
  if (matcher.condition && !evaluateCondition(ctx, matcher.condition)) return false;
  return true;
}

/** Event-kind triggers; turn-structure kinds are matched by `phaseTriggerMatches`. */
export function triggerMatchesEvent(
  room: Room,
  host: RulesHost,
  trigger: Trigger,
  event: GameEvent,
  scope: TriggerScope,
): boolean {
  switch (trigger.kind) {
    case "event":
      return eventMatches(room, host, trigger.event, event, scope);
    case "showdown-begin":
      return event.type === "showdown_begin";
    case "showdown-end":
      return event.type === "showdown_end";
    case "combat-begin":
      return event.type === "combat_begin";
    case "combat-end":
      return event.type === "combat_end";
    default:
      return false;
  }
}

/**
 * Turn-structure triggers ("At the start of your Beginning Phase", "At the end of your turn").
 * Convention: phase triggers refer to the ability controller's own turn unless the ability's
 * condition says otherwise.
 */
export function phaseTriggerMatches(
  room: Room,
  trigger: Trigger,
  moment: "beginning" | "main" | "ending",
  scope: TriggerScope,
): boolean {
  const rules = room.rules;
  if (!rules || rules.turn.player !== scope.controller) return false;
  if (trigger.kind === "phase") return trigger.phase === moment;
  if (trigger.kind === "turn-start") return moment === "beginning";
  if (trigger.kind === "turn-end") return moment === "ending";
  return false;
}
