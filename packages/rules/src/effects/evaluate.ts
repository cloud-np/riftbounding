/**
 * DSL evaluation — `PlayerSelector`, `ZoneSelector`, `Selector`, `Amount`, `Condition` (§6.2).
 *
 * Rule anchors: 355.9 (valid choices: board objects by default, 355.9.a.1/.2), 740.1
 * (friendly/enemy), 706–711 (Mighty, printed Might off the board), 359.3.e.12 (null
 * information → instructions ignored), 359.3.f (referents such as "here"/"my" are read on
 * execution).
 *
 * Reserved selector refs (`Selector.targetRef` without `chosen`):
 *   "self"          the ability's source object
 *   "it"            the current `for_each` element, else the last affected objects
 *   "host"          the top-most card the source is attached to (719)
 *   "event"         the subject of the trigger event (`cardId ?? objectId`)
 *   "event-source"  the event's `sourceObjectId`
 *   "obj:<id>"      a literal object id (continuous effects bound to one object)
 *   anything else   a choice key (355) or a resolution variable (`choose`)
 * Reserved zone refs (`{ kind: "chosen", ref }`): "here" (the source's location; battlefields
 * refer to themselves, 053.3), "event-zone", "event-from", "self-zone".
 *
 * Pure: reads only.
 */
import type {
  Amount,
  ComparisonOp,
  Condition,
  PlayerSelector,
  Room,
  Selector,
  ShowOffInfo,
  ZoneSelector,
} from "@rift/protocol";
import type { RulesHost } from "../host";
import { keywordsAtDepth, rawMight, setLayerAmountEvaluator, setLayerTargetMatcher } from "../layers";
import { setLayerConditionEvaluator } from "../layers/passives";
import { turnState } from "../state/turn";
import type { EvalContext, EffectEnv, LastKnown } from "./env";
import { idsOf, lkiOf, makeEnv } from "./env";
import {
  attachedTo,
  battlefieldObjectId,
  battlefieldZoneOf,
  boardZoneList,
  controllerOf,
  costsOf,
  findChainItem,
  isBattlefieldZone,
  isBoardZone,
  isToken,
  locate,
  locationOf,
  locationZones,
  nameOf,
  ownerOf,
  tagsOf,
  typeMatches,
  typeOf,
} from "./objects";
import { hasUnitPresentAt, unitsPresentAt } from "../state/presence";
import { keyedRegistry } from "../registry-table";

/* ---------------------------------------------------------------- players */

/** Active players in Turn Order starting with the Turn Player (303.2.a). */
export function playersInTurnOrder(room: Room, host: RulesHost): string[] {
  const active = host.activePlayerIds(room);
  const order = host.turnOrder(room).filter((id) => active.includes(id));
  for (const id of active) if (!order.includes(id)) order.push(id);
  const start = room.rules?.turn.player;
  const index = start ? order.indexOf(start) : -1;
  return index <= 0 ? order : [...order.slice(index), ...order.slice(0, index)];
}

export function opponentsOf(room: Room, host: RulesHost, playerId: string): string[] {
  return playersInTurnOrder(room, host).filter((id) => id !== playerId);
}

export function resolvePlayers(ctx: EvalContext, selector: PlayerSelector | undefined): string[] {
  const { room, host, env } = ctx;
  if (selector === undefined || selector === "self") return [env.controller];
  if (selector === "opponent") return opponentsOf(room, host, env.controller);
  if (selector === "all" || selector === "each") return playersInTurnOrder(room, host);
  if (selector === "turn-player") return room.rules ? [room.rules.turn.player] : [];
  if (selector === "priority-holder") return room.rules?.priority ? [room.rules.priority] : [];
  if (selector === "focus-holder") return room.rules?.focus ? [room.rules.focus] : [];
  if (selector.kind === "player") return [selector.id];
  if (selector.kind === "chosen") {
    const value = readRef(env, selector.ref ?? "player");
    return idsOf(value).filter((id) => host.playerIds(room).includes(id));
  }
  if (selector.kind === "controller") {
    const ids = resolveSelector(ctx, selector.of);
    const out: string[] = [];
    for (const id of ids) {
      const controller = controllerOf(room, host, id) ?? lkiOf(env, id)?.controller ?? null;
      if (controller && !out.includes(controller)) out.push(controller);
    }
    // 359.3.e.13: look back at objects that left the board during this resolution.
    if (out.length === 0) {
      for (const id of referencedIds(ctx, selector.of)) {
        const controller = lkiOf(env, id)?.controller ?? null;
        if (controller && !out.includes(controller)) out.push(controller);
      }
    }
    return out;
  }
  if (selector.kind === "owner") {
    const out: string[] = [];
    for (const id of [...resolveSelector(ctx, selector.of), ...referencedIds(ctx, selector.of)]) {
      const owner = ownerOf(room, host, id) ?? lkiOf(env, id)?.owner ?? null;
      if (owner && !out.includes(owner)) out.push(owner);
    }
    return out;
  }
  return [];
}

/** Does `player` satisfy a controller/owner filter relative to the ability controller? */
function playerFilterMatches(
  ctx: EvalContext,
  filter: Selector["controller"] | Selector["owner"],
  player: string | null | undefined,
): boolean {
  if (filter === undefined || filter === "any" || filter === "all") return true;
  if (!player) return false;
  if (filter === "self") return player === ctx.env.controller;
  if (filter === "opponent") return player !== ctx.env.controller;
  return resolvePlayers(ctx, filter as PlayerSelector).includes(player);
}

/* ---------------------------------------------------------------- refs */

export function readRef(env: EffectEnv, key: string): unknown {
  if (key in env.vars) return env.vars[key];
  return env.choices[key];
}

const RESERVED_REFS = new Set(["self", "it", "host", "event", "event-source"]);

export function isReservedRef(ref: string): boolean {
  return RESERVED_REFS.has(ref) || ref.startsWith("obj:");
}

/** Raw ids a reference points at (no legality filter). */
export function referencedIds(ctx: EvalContext, selector: Selector): string[] {
  const ref = selector.targetRef;
  if (!ref) return [];
  return refIds(ctx, ref);
}

export function refIds(ctx: EvalContext, ref: string): string[] {
  const { room, host, env } = ctx;
  if (ref === "self") return env.sourceObjectId ? [env.sourceObjectId] : [];
  if (ref === "it") {
    if (env.it) return [env.it];
    return idsOf(env.vars.$affected);
  }
  if (ref === "host") {
    const host2 = env.sourceObjectId ? attachedTo(room, host, env.sourceObjectId) : null;
    return host2 ? [host2] : [];
  }
  if (ref === "event") {
    const subject = env.event?.cardId ?? env.event?.objectId;
    return subject ? [subject] : [];
  }
  if (ref === "event-source") return env.event?.sourceObjectId ? [env.event.sourceObjectId] : [];
  if (ref.startsWith("obj:")) return [ref.slice(4)];
  const illegal = new Set(idsOf(env.vars[`$illegal:${ref}`]));
  return idsOf(readRef(env, ref)).filter((id) => !illegal.has(id));
}

/* ---------------------------------------------------------------- zones */

export interface ZoneScan {
  playerId?: string;
  zone: string;
}

/** Zone names (no player) a zone selector designates. */
export function resolveZoneNames(ctx: EvalContext, zone: ZoneSelector | undefined): string[] {
  const { room, host, env } = ctx;
  if (zone === undefined) return [];
  if (typeof zone === "string") {
    if (zone === "battlefield") return host.battlefieldZones(room) as string[];
    return [zone];
  }
  if (zone.kind === "battlefield") return [zone.id];
  const ref = zone.ref ?? "zone";
  if (ref === "here") {
    const source = env.sourceObjectId;
    if (!source) return [];
    const location = locationOf(room, host, source) ?? lkiOf(env, source)?.zone ?? null;
    return location ? [location] : [];
  }
  if (ref === "self-zone") {
    const source = env.sourceObjectId;
    const located = source ? locate(room, host, source) : null;
    return located ? [located.zone] : [];
  }
  if (ref === "event-zone") return env.event?.zone ? [env.event.zone] : [];
  if (ref === "event-from") {
    const from = env.event?.data?.from;
    return typeof from === "string" ? [from] : [];
  }
  const bound = readRef(env, ref);
  if (typeof bound === "string") {
    const asZone = battlefieldZoneOf(bound) ?? bound;
    return [asZone];
  }
  return idsOf(bound).map((value) => battlefieldZoneOf(value) ?? value);
}

/** Default zones for a selector without `zone` (355.9.a.1/.2/.4). */
function defaultZones(room: Room, host: RulesHost, selector: Selector): string[] {
  const type = selector.cardType?.toLowerCase() ?? "";
  if (type.includes("spell") || type.includes("ability")) return ["chain"];
  if (type.includes("rune")) return ["runeArea"];
  if (type.includes("legend")) return ["legend"];
  if (type.includes("battlefield")) return ["battlefield-objects"];
  return locationZones(room, host);
}

/* ---------------------------------------------------------------- selectors */

export interface MatchOptions {
  /** Last-known information used when the object has left its zone (event subjects). */
  lki?: LastKnown;
  /** Skip the zone filter (re-checking a reference). */
  ignoreZone?: boolean;
}

function zoneOfObject(ctx: EvalContext, id: string): string | null {
  const { room, host } = ctx;
  const bf = battlefieldZoneOf(id);
  if (bf) return "battlefield-objects";
  if (findChainItem(room, id)) return "chain";
  return locate(room, host, id)?.zone ?? null;
}

/**
 * Might as spells and abilities reference it: effective on the board, printed elsewhere
 * (710/711), last-known after leaving. 143.2.c: a negative Might is treated as 0 when referenced
 * (the characteristic itself keeps its actual value, 143.2.c.1).
 */
export function mightOf(ctx: EvalContext, id: string, lki?: LastKnown): number | null {
  const { room, host } = ctx;
  const located = locate(room, host, id);
  if (located && isBoardZone(room, host, located.zone)) return Math.max(0, rawMight(room, id, host, ctx.depth ?? 0));
  if (located) return host.cardInfo(room, id)?.might ?? null;
  const known = lki?.might ?? lkiOf(ctx.env, id)?.might ?? null;
  return known === null ? null : Math.max(0, known);
}

export function compare(left: number, op: ComparisonOp, right: number): boolean {
  switch (op) {
    case "lt":
      return left < right;
    case "lte":
      return left <= right;
    case "eq":
      return left === right;
    case "gte":
      return left >= right;
    case "gt":
      return left > right;
    case "neq":
      return left !== right;
  }
}

export function matchesSelector(
  ctx: EvalContext,
  selector: Selector,
  id: string,
  options: MatchOptions = {},
): boolean {
  const { room, host, env } = ctx;
  const lki = options.lki;
  const isRef = !!selector.targetRef && !selector.chosen;
  // A reference ("self", "it", a bound choice …) matches only the referenced objects.
  if (isRef && !refIds(ctx, selector.targetRef!).includes(id)) return false;
  if (!options.ignoreZone && !(isRef && selector.zone === undefined)) {
    // 383.2.c.3.b: a leave-the-board event subject is read with its last-known zone (the card
    // has already moved to the trash when its "when I die" trigger is matched).
    const zone = lki?.zone ?? zoneOfObject(ctx, id) ?? null;
    const zones = selector.zone !== undefined ? resolveZoneNames(ctx, selector.zone) : defaultZones(room, host, selector);
    if (!zone) return false;
    if (zones.length > 0 && !zones.includes(zone)) return false;
  }
  if (selector.excludeSource && id === env.sourceObjectId) return false;
  if (selector.excludeSelf && (id === env.sourceObjectId || id === env.itemId)) return false;
  if (selector.controller !== undefined) {
    const controller = controllerOf(room, host, id) ?? lki?.controller ?? null;
    if (!playerFilterMatches(ctx, selector.controller, controller)) return false;
  }
  if (selector.owner !== undefined) {
    const owner = ownerOf(room, host, id) ?? lki?.owner ?? null;
    if (!playerFilterMatches(ctx, selector.owner, owner)) return false;
  }
  if (selector.cardType) {
    const type = typeOf(room, host, id) || (lki?.type ?? "");
    if (!typeMatches(type, selector.cardType)) return false;
  }
  if (selector.name) {
    const name = nameOf(room, host, id) ?? lki?.name ?? null;
    if (name !== selector.name) return false;
  }
  const located = locate(room, host, id);
  if (selector.tag) {
    const tags = tagsOf(located?.card).map((tag) => tag.toLowerCase());
    if (!tags.includes(selector.tag.toLowerCase())) return false;
  }
  if (selector.keyword) {
    const keywords = located
      ? keywordsAtDepth(room, id, host, ctx.depth ?? 0).map((keyword) => keyword.toLowerCase())
      : [];
    if (!keywords.includes(selector.keyword.toLowerCase())) return false;
  }
  if (selector.minMight !== undefined || selector.might !== undefined || selector.mighty !== undefined) {
    const might = mightOf(ctx, id, lki);
    if (might === null) return false;
    if (selector.minMight !== undefined) {
      const min = evaluateAmount(ctx, selector.minMight);
      if (min === null || might < min) return false;
    }
    if (selector.might) {
      const value = evaluateAmount(ctx, selector.might.value);
      if (value === null || !compare(might, selector.might.op, value)) return false;
    }
    if (selector.mighty !== undefined && (might >= 5) !== selector.mighty) return false;
  }
  if (selector.energyCost || selector.powerCost) {
    const costs = costsOf(room, host, id);
    if (!costs) return false;
    if (selector.energyCost) {
      const value = evaluateAmount(ctx, selector.energyCost.value);
      if (value === null || !compare(costs.energy, selector.energyCost.op, value)) return false;
    }
    if (selector.powerCost) {
      const value = evaluateAmount(ctx, selector.powerCost.value);
      if (value === null || !compare(costs.power, selector.powerCost.op, value)) return false;
    }
  }
  const object = room.rules?.objects[id];
  if (selector.exhausted !== undefined) {
    if (!located || !isBoardZone(room, host, located.zone)) return false;
    if (!!located.card.exhausted !== selector.exhausted) return false;
  }
  // 424 / 427 / 442 / 383.2.c.3.b: use the live object while it is on the board, otherwise the
  // last-known status carried by the event (or noted before the instruction moved it).
  const known = lki ?? lkiOf(env, id);
  if (selector.stunned !== undefined) {
    const stunned = object ? object.stunned === true : (known?.stunned ?? false);
    if (stunned !== selector.stunned) return false;
  }
  if (selector.buffed !== undefined) {
    const buffs = object ? (object.buffs ?? 0) : (known?.buffs ?? 0);
    if (buffs > 0 !== selector.buffed) return false;
  }
  if (selector.empowered !== undefined) {
    const empowered = object ? (object.empowered ?? 0) : (known?.empowered ?? 0);
    if (empowered > 0 !== selector.empowered) return false;
  }
  if (selector.token !== undefined && isToken(located?.card) !== selector.token) return false;
  if (selector.excludeRefs) {
    for (const ref of selector.excludeRefs) if (refIds(ctx, ref).includes(id)) return false;
  }
  if (selector.sameLocationAs) {
    const others = refIds(ctx, selector.sameLocationAs);
    const otherLocation = others[0]
      ? (locationOf(room, host, others[0]) ?? lkiOf(env, others[0])?.zone ?? null)
      : null;
    if (!otherLocation || locationOf(room, host, id) !== otherLocation) return false;
  }
  if (selector.where) {
    if (!evaluateCondition({ ...ctx, env: { ...env, it: id } }, selector.where)) return false;
  }
  return true;
}

/** Every object id a selector's zones contain (before filters). */
export function candidateIds(ctx: EvalContext, selector: Selector): string[] {
  const { room, host } = ctx;
  const zones = selector.zone !== undefined ? resolveZoneNames(ctx, selector.zone) : defaultZones(room, host, selector);
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    out.push(id);
  };
  for (const zone of zones) {
    if (zone === "chain") {
      // 355.9.a.2: "spell"/"ability" are finalized objects on the Chain; an item still in the
      // process of being played or finalized (Pending, 354/403) is not one yet.
      for (const item of [...(room.rules?.chain ?? [])].reverse()) if (item.status !== "pending") push(item.id);
      continue;
    }
    if (zone === "battlefield-objects") {
      for (const bf of host.battlefieldZones(room)) push(battlefieldObjectId(bf));
      continue;
    }
    for (const playerId of playersInTurnOrder(room, host)) {
      for (const card of host.zoneCards(room, playerId, zone)) push(card.id);
    }
  }
  return out;
}

/** All objects matching a criteria selector (355.5.a / 355.10.d). */
export function matchingIds(ctx: EvalContext, selector: Selector): string[] {
  return candidateIds(ctx, selector).filter((id) => matchesSelector(ctx, selector, id));
}

/**
 * Resolve a selector to object ids for an instruction.
 *
 * - `targetRef` without `chosen` → the referenced ids (illegal targets removed, 359.3.e.14.a);
 * - `chosen` → the bound choice (legality is checked by the interpreter, `effects/targets.ts`);
 * - otherwise → every matching object (criteria, 355.5.a).
 */
export function resolveSelector(ctx: EvalContext, selector: Selector): string[] {
  if (selector.targetRef && !selector.chosen) {
    const ids = refIds(ctx, selector.targetRef);
    // A reference with extra filters ("it, if it's a Recruit") keeps only matching objects.
    const filtered = Object.keys(selector).some((key) => key !== "targetRef" && key !== "label");
    return filtered ? ids.filter((id) => matchesSelector(ctx, selector, id)) : ids;
  }
  if (selector.chosen && selector.targetRef) return refIds(ctx, selector.targetRef);
  return matchingIds(ctx, selector);
}

/* ---------------------------------------------------------------- amounts */

/** `null` = the information is unavailable (359.3.e.12): dependent instructions are ignored. */
export function evaluateAmount(ctx: EvalContext, amount: Amount | undefined): number | null {
  const { room, host, env } = ctx;
  if (amount === undefined) return null;
  if (typeof amount === "number") return amount;
  switch (amount.kind) {
    case "fixed":
      return amount.value;
    case "count": {
      const count = resolveSelector(ctx, amount.selector).length;
      return count * (amount.per ?? 1);
    }
    case "might": {
      const ids = resolveSelector(ctx, amount.selector);
      const fallback = ids.length === 0 ? referencedIds(ctx, amount.selector) : ids;
      if (fallback.length === 0) return null;
      let total = 0;
      for (const id of fallback) {
        const might = mightOf(ctx, id);
        if (might === null) return null;
        total += might;
      }
      return total;
    }
    case "damage": {
      const ids = resolveSelector(ctx, amount.selector);
      if (ids.length === 0) return null;
      return ids.reduce((sum, id) => sum + (room.rules?.objects[id]?.damage ?? 0), 0);
    }
    case "points": {
      const players = resolvePlayers(ctx, amount.player);
      return players.reduce((sum, id) => sum + host.score(room, id), 0);
    }
    case "cards-in-hand": {
      const players = resolvePlayers(ctx, amount.player);
      return players.reduce((sum, id) => sum + host.zoneCards(room, id, "hand").length, 0);
    }
    case "cards-in-zone": {
      const players = resolvePlayers(ctx, amount.player);
      return players.reduce((sum, id) => sum + host.zoneCards(room, id, amount.zone).length, 0);
    }
    case "spent":
      // TODO(R2-effects): resources spent this turn are not tracked by the pools yet.
      return 0;
    case "x": {
      const x = env.choices.x ?? env.vars.x;
      return typeof x === "number" ? x : null;
    }
    case "sum": {
      let total = 0;
      for (const part of amount.amounts) {
        const value = evaluateAmount(ctx, part);
        if (value === null) return null;
        total += value;
      }
      return total;
    }
    case "min": {
      const values = amount.amounts.map((part) => evaluateAmount(ctx, part));
      if (values.some((value) => value === null)) return null;
      let result = Math.min(...(values as number[]));
      if (amount.cap !== undefined) {
        const cap = evaluateAmount(ctx, amount.cap);
        if (cap !== null) result = Math.min(result, cap);
      }
      return result;
    }
    case "max": {
      const values = amount.amounts.map((part) => evaluateAmount(ctx, part));
      if (values.some((value) => value === null)) return null;
      return Math.max(...(values as number[]));
    }
    case "shown-off": {
      // 832.1.d.1: the information noted when the object was shown off.
      const info = shownOffInfo(ctx);
      if (!info) return null;
      const property = amount.property ?? "might";
      if (property === "count") return info.ids.length;
      const value = property === "might" ? info.might : property === "energy-cost" ? info.energy : info.power;
      return typeof value === "number" ? value : null;
    }
  }
  return null;
}

/** 832.1.c.1: what the resolving spell / this permanent showed off as it was played. */
export function shownOffInfo(ctx: EvalContext): ShowOffInfo | null {
  const fromChoices = ctx.env.choices.$showOff as ShowOffInfo | undefined;
  if (fromChoices && Array.isArray(fromChoices.ids)) return fromChoices;
  const source = ctx.env.sourceObjectId;
  const fromObject = source ? ctx.room.rules?.objects[source]?.showOff : undefined;
  return fromObject && Array.isArray(fromObject.ids) ? fromObject : null;
}

/* ---------------------------------------------------------------- conditions */

export type CustomCondition = (ctx: EvalContext, params: Record<string, unknown>) => boolean;

/** G1: one implementation per custom condition id; duplicates throw (tests: `src/testing.ts`). */
export const CUSTOM_CONDITIONS = keyedRegistry<CustomCondition>("custom condition");

/** Register a `{ kind: "custom", id }` condition (import-time table; no game state). */
export function registerCustomCondition(id: string, fn: CustomCondition): void {
  CUSTOM_CONDITIONS.register(id, fn);
}

export function customConditionIds(): string[] {
  return CUSTOM_CONDITIONS.keys();
}

export function evaluateCondition(ctx: EvalContext, condition: Condition | undefined): boolean {
  const { room, host, env } = ctx;
  if (!condition) return true;
  switch (condition.kind) {
    case "true":
      return true;
    case "false":
      return false;
    case "and":
      return condition.conditions.every((entry) => evaluateCondition(ctx, entry));
    case "or":
      return condition.conditions.some((entry) => evaluateCondition(ctx, entry));
    case "not":
      return !evaluateCondition(ctx, condition.condition);
    case "exists":
      return resolveSelector(ctx, condition.selector).length > 0;
    case "count": {
      const count = resolveSelector(ctx, condition.selector).length;
      const value = evaluateAmount(ctx, condition.comparison.value);
      return value !== null && compare(count, condition.comparison.op, value);
    }
    case "compare": {
      const left = evaluateAmount(ctx, condition.left);
      const right = evaluateAmount(ctx, condition.right);
      return left !== null && right !== null && compare(left, condition.op, right);
    }
    case "has-keyword": {
      const ids = resolveSelector(ctx, condition.selector);
      return ids.some((id) =>
        keywordsAtDepth(room, id, host, ctx.depth ?? 0).some(
          (keyword) => keyword.toLowerCase() === condition.keyword.toLowerCase(),
        ),
      );
    }
    case "is-turn-player": {
      const players = resolvePlayers(ctx, condition.player);
      return !!room.rules && players.includes(room.rules.turn.player);
    }
    case "is-phase":
      return room.rules?.turn.phase === condition.phase;
    case "is-state":
      return turnState(room) === condition.state;
    case "player-score": {
      const players = resolvePlayers(ctx, condition.player);
      const value = evaluateAmount(ctx, condition.comparison.value);
      if (value === null) return false;
      return players.some((id) => compare(host.score(room, id), condition.comparison.op, value));
    }
    case "scored-this-turn": {
      const players = resolvePlayers(ctx, condition.player);
      return players.some((id) => {
        const zones = room.rules?.scoredThisTurn[id] ?? [];
        return condition.zone ? zones.includes(condition.zone) : zones.length > 0;
      });
    }
    case "controls": {
      const players = resolvePlayers(ctx, condition.player);
      const zones = condition.zone ? [condition.zone] : (host.battlefieldZones(room) as string[]);
      return players.some((player) =>
        zones.some((zone) => {
          const present = host.activePlayerIds(room).filter((id) => hasUnitPresentAt(room, host, id, zone));
          return present.length === 1 && present[0] === player;
        }),
      );
    }
    case "custom": {
      const fn = CUSTOM_CONDITIONS.get(condition.id);
      return fn ? fn(ctx, condition.params ?? {}) : false;
    }
  }
  void env;
  return false;
}

/* ---------------------------------------------------------------- built-in custom conditions */

registerCustomCondition("did", (ctx) => ctx.env.vars.$did === true);

/** 356.4.f.1: an optional additional cost was "paid" if the player decided to pay it. */
registerCustomCondition("paid-additional", (ctx) => {
  const keys = ["additionalCost", "optionalCost", "paidAdditional", "paid"];
  if (keys.some((key) => ctx.env.choices[key] === true)) return true;
  // A play effect reads the flag noted on its source permanent (triggers/finalize.ts).
  const source = ctx.env.sourceObjectId;
  return !!source && ctx.room.rules?.objects[source]?.paidAdditionalCost === true;
});

registerCustomCondition("self-at-battlefield", (ctx) => {
  const source = ctx.env.sourceObjectId;
  if (!source) return false;
  return isBattlefieldZone(ctx.room, ctx.host, locationOf(ctx.room, ctx.host, source) ?? undefined);
});

registerCustomCondition("self-empowered", (ctx) => {
  const source = ctx.env.sourceObjectId;
  return !!source && (ctx.room.rules?.objects[source]?.empowered ?? 0) > 0;
});

registerCustomCondition("self-mighty", (ctx) => {
  const source = ctx.env.sourceObjectId;
  return !!source && (mightOf(ctx, source) ?? 0) >= 5;
});

registerCustomCondition("self-buffed", (ctx) => {
  const source = ctx.env.sourceObjectId;
  return !!source && (ctx.room.rules?.objects[source]?.buffs ?? 0) > 0;
});

/** 824.1.b.1: "While you have [N] or more XP". */
registerCustomCondition("xp-at-least", (ctx, params) => {
  const n = typeof params.n === "number" ? params.n : 0;
  return xpOf(ctx.room, ctx.env.controller) >= n;
});

/** "it is the only unit you control there" (En Garde). */
registerCustomCondition("alone", (ctx, params) => {
  const ref = typeof params.ref === "string" ? params.ref : "it";
  const [id] = refIds(ctx, ref);
  if (!id) return false;
  const location = locationOf(ctx.room, ctx.host, id);
  const controller = controllerOf(ctx.room, ctx.host, id);
  if (!location || !controller) return false;
  return unitsPresentAt(ctx.room, ctx.host, location, controller).every((card) => card.id === id);
});

/** `it` is one of the listed ids (continuous effects frozen to several chosen objects). */
registerCustomCondition("in-ids", (ctx, params) => {
  const ids = Array.isArray(params.ids) ? params.ids : [];
  return !!ctx.env.it && ids.includes(ctx.env.it);
});

/** `it` is one of the objects bound to `ref` (e.g. the looked-at cards). */
registerCustomCondition("in-ref", (ctx, params) => {
  const ref = typeof params.ref === "string" ? params.ref : "looked";
  return !!ctx.env.it && refIds(ctx, ref).includes(ctx.env.it);
});

/**
 * "your first card each turn": the trigger event's card is the first card its controller played
 * this turn (420.4.a: the trigger fires when that card resolves).
 */
registerCustomCondition("first-played-this-turn", (ctx) => {
  const event = ctx.env.event;
  const player = event?.playerId ?? ctx.env.controller;
  const played = ctx.room.rules?.history.effects?.played?.[player] ?? [];
  return !!event?.cardId && played[0] === event.cardId;
});

/**
 * 832.1.c.1: "if you showed off" — the item / permanent showed off (at least `count` objects,
 * default 1, for "[Show Off] five …" sets).
 */
registerCustomCondition("showed-off", (ctx, params) => {
  const info = shownOffInfo(ctx);
  const count = typeof params.count === "number" ? params.count : 1;
  return !!info && info.ids.length >= count;
});

/** A per-turn marker set with the `mark` op equals / contains `value`. */
registerCustomCondition("marked", (ctx, params) => {
  const key = String(params.key ?? "").replace("{self}", ctx.env.sourceObjectId ?? "");
  const marks = ctx.room.rules?.history.effects?.marks ?? {};
  const value = marks[key];
  if (params.value === undefined) return value !== undefined;
  if (Array.isArray(value)) return (value as unknown[]).includes(params.value);
  return value === params.value;
});

/** Number of cards the controller has played this turn (history counter). */
registerCustomCondition("cards-played", (ctx, params) => {
  const count = ctx.room.rules?.history.cardsPlayedThisTurn[ctx.env.controller] ?? 0;
  const op = (params.op as ComparisonOp | undefined) ?? "gte";
  const value = typeof params.value === "number" ? params.value : 1;
  return compare(count, op, value);
});

/** The trigger event's subject is (or was) at a battlefield / the base. */
registerCustomCondition("event-zone-is", (ctx, params) => {
  const zone = ctx.env.event?.zone;
  if (params.battlefield === true) return isBattlefieldZone(ctx.room, ctx.host, zone);
  return zone === params.zone;
});

/* ---------------------------------------------------------------- XP (728–733) */

/** 729: XP is tracked per player (`board.legendXp`). */
export function xpOf(room: Room, playerId: string): number {
  const board = room.players.find((player) => player.id === playerId)?.board;
  return Math.max(0, Math.trunc(board?.legendXp ?? 0));
}

/** Draft-only mutator. */
export function setXp(room: Room, playerId: string, value: number): void {
  const board = room.players.find((player) => player.id === playerId)?.board;
  if (board) board.legendXp = Math.max(0, Math.trunc(value));
}

/** Is `id` currently a board object (107)? */
export function onBoard(room: Room, host: RulesHost, id: string): boolean {
  const located = locate(room, host, id);
  return !!located && boardZoneList(room, host).includes(located.zone);
}

/* ---------------------------------------------------------------- layer bridge (475–482) */

// The layers module matches modifier targets / evaluates conditional passives through the same
// selector and condition semantics (wired once at import; no game state).
setLayerTargetMatcher((room, host, target, objectId, scope) =>
  matchesSelector(
    {
      room,
      host,
      env: makeEnv({
        controller: scope.controller,
        ...(scope.sourceObjectId ? { sourceObjectId: scope.sourceObjectId } : {}),
      }),
      depth: scope.depth,
    },
    target,
    objectId,
    scope.ignoreZone ? { ignoreZone: true } : {},
  ),
);

setLayerConditionEvaluator((room, host, condition, scope) =>
  evaluateCondition(
    {
      room,
      host,
      env: makeEnv({
        controller: scope.controller,
        ...(scope.sourceObjectId ? { sourceObjectId: scope.sourceObjectId } : {}),
      }),
      depth: scope.depth,
    },
    condition,
  ),
);

setLayerAmountEvaluator((room, host, amount, scope) =>
  evaluateAmount(
    {
      room,
      host,
      env: makeEnv({
        controller: scope.controller,
        ...(scope.sourceObjectId ? { sourceObjectId: scope.sourceObjectId } : {}),
      }),
      depth: scope.depth,
    },
    amount,
  ),
);
