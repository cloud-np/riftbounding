/**
 * Shared builders and card-specific conditions for the Vendetta (VEN) and Proving Grounds (OGS)
 * scripts (wave R3). Pure data helpers plus import-time registrations of `ven:*` conditions.
 *
 * - `empower(cost)` — 827.1.c.1: "[Empower] [Cost]" is short for "[Cost]: Empower this. Use only
 *   if not Empowered." (the 377.2.b precondition is enforced by `validateChoices`).
 * - `whileEmpowered(modifier)` — 828.1.b/c: an "[Empowered] …" passive is a Dependent Ability,
 *   active only while the source has the Empowered status (`conditional` modifier, 727.1.b).
 * - `notIntrinsic(keyword)` — 727.1.b / 135.2.d.3: the catalog lists keywords that only appear
 *   in reminder text or in a dependent/conditional ability; the marker removes the printed
 *   instance so only the ability that grants it applies.
 */
import type {
  Ability,
  Condition,
  Cost,
  Effect,
  GameEvent,
  Modifier,
  Selector,
  Trigger,
} from "@rift/protocol";
import type { EvalContext } from "../../effects/env";
import { idsOf } from "../../effects/env";
import { playersInTurnOrder, refIds, registerCustomCondition } from "../../effects/evaluate";
import { RESOLVED } from "../../effects/execute";
import { registerCustomEffect } from "../../effects/ops/control";
import { evalContextOf, recordOutcome } from "../../effects/targets";
import { pushEvent } from "../../types";
import { hasUnitPresentAt, unitsPresentAt } from "../../state/presence";
import {
  battlefieldController,
  boardZoneList,
  controllerOf,
  findChainItem,
  isBattlefieldZone,
  isBoardZone,
  locate,
  locationOf,
} from "../../effects/objects";
import { SELF, custom, not } from "../dsl";

/** "When I become [Empowered]" (442.2.a / 828.1.d). */
export const WHEN_I_BECOME_EMPOWERED: Trigger = {
  kind: "event",
  event: { type: "empower", subject: SELF },
};

/** "When I attack" (383.4.e, R2-combat's unit `attack` event). */
export const WHEN_I_ATTACK: Trigger = { kind: "event", event: { type: "attack", subject: SELF } };

/** "When I defend" (383.4.f). */
export const WHEN_I_DEFEND: Trigger = { kind: "event", event: { type: "defend", subject: SELF } };

/** "When I conquer" (383.4.c.2.a: I was present at the conquered battlefield). */
export const WHEN_I_CONQUER: Trigger = { kind: "event", event: { type: "conquer", subject: SELF } };

/** "When I hold" (383.4.d.2.a). */
export const WHEN_I_HOLD: Trigger = { kind: "event", event: { type: "hold", subject: SELF } };

export const SELF_EMPOWERED: Condition = custom("self-empowered");

/** The source is on the board (see `ven:self-on-board`). */
export const ON_BOARD: Condition = custom("ven:self-on-board");

/** Status note for [Flow] spells (829 is not implemented by the play layer). */
export const FLOW_GAP =
  "[Flow] (829: play from the trash for the Flow cost, then banish it) is not implemented by R2-play; the spell's effect is automated.";

/** Status note for gear that "enters exhausted" (149.1 default is ready; no entry replacement for gear). */
export const ENTERS_EXHAUSTED_GAP =
  '"This enters exhausted" is not automated: gear enter ready (149.1) and the entry layer only has an enter-ready replacement (369.3).';

/** Status note shared by the cards whose Deflect comes from a passive (see ven-ogs.md gaps). */
export const DEFLECT_GAP =
  "Deflect from the Empowered passive is granted (effectiveKeywords), but R2-play's Deflect cost reads printed and object-granted keywords only, so it is not charged (809.1.c).";

/** 827.1.c.1: "[Cost]: Empower this. Use only if not Empowered." */
export function empower(cost: Cost): Ability {
  return {
    kind: "activated",
    cost,
    effect: {
      op: "requires",
      condition: not(SELF_EMPOWERED),
      rule: "827.1.c.1",
      effect: { op: "empower", target: SELF },
    },
  };
}

/** 828.1.c: a Dependent passive that applies only while the source is Empowered. */
export function whileEmpowered(modifier: Modifier): Ability {
  return conditional(SELF_EMPOWERED, modifier);
}

/** 364.3.a: a conditional passive. */
export function conditional(condition: Condition, modifier: Modifier): Ability {
  return {
    kind: "passive",
    modifier: { kind: "custom", id: "conditional", params: { condition, modifier } },
  };
}

/** 727.1.b: the printed (catalog) keyword is not intrinsic; an ability grants it. */
export function notIntrinsic(keyword: string): Ability {
  return { kind: "keyword", keyword, value: 0 };
}

/** "you control N or more / fewer runes" (runes are in the Rune Area, 107). */
export function runesControlled(op: "lte" | "gte", value: number): Condition {
  return {
    kind: "count",
    selector: { cardType: "rune", controller: "self" },
    comparison: { op, value },
  };
}

/**
 * Per-step cost reductions ("costs [1] less for each rune you control"): the cost layer only
 * sums fixed amounts (356.4), so one conditional -1 entry is registered per threshold.
 * `extra` conditions (e.g. "while on the board") are and-ed in.
 */
export function perCountCostReduction(
  selector: Selector,
  steps: number,
  target: Selector,
  extra: Condition[] = [],
): Ability[] {
  return Array.from({ length: steps }, (_, index) =>
    conditional(
      {
        kind: "and",
        conditions: [
          ...extra,
          { kind: "count", selector, comparison: { op: "gte", value: index + 1 } },
        ],
      },
      { kind: "cost", amount: -1, target },
    ),
  );
}

/* ---------------------------------------------------------------- custom conditions */

/**
 * The source is on the board (107): used to keep "this ability costs … less" from also applying
 * to the card's own play cost while it is in hand (366.2.a reads cost passives in hand).
 */
registerCustomCondition("ven:self-on-board", (ctx) => {
  const source = ctx.env.sourceObjectId;
  if (!source) return false;
  return isBoardZone(ctx.room, ctx.host, locate(ctx.room, ctx.host, source)?.zone);
});

/** 740.2.c: "I'm in combat" — at the battlefield where combat is ongoing, with a designation. */
registerCustomCondition("ven:self-in-combat", (ctx, params) => {
  const ref = typeof params.ref === "string" ? params.ref : null;
  const id = ref === "it" ? ctx.env.it : ctx.env.sourceObjectId;
  const combat = ctx.room.rules?.combat;
  if (!id || !combat) return false;
  if (locationOf(ctx.room, ctx.host, id) !== combat.battlefield) return false;
  return !!ctx.room.rules?.objects[id]?.designation;
});

/** "If you control fewer runes than an opponent" (315.2 Beginning Phase checks). */
registerCustomCondition("ven:fewer-runes-than-an-opponent", (ctx) => {
  const me = ctx.env.controller;
  const count = (playerId: string) => ctx.host.zoneCards(ctx.room, playerId, "runeArea").length;
  const mine = count(me);
  return ctx.host.activePlayerIds(ctx.room).some((id) => id !== me && count(id) > mine);
});

/**
 * "while I'm at a battlefield with exactly one other unit you control" / "if there is exactly one
 * other unit you control here": counts the source's (or, with `host: true`, the equipped unit's)
 * controller's other units at its location.
 */
registerCustomCondition("ven:exactly-one-other-friendly-here", (ctx, params) => {
  let id = ctx.env.sourceObjectId;
  if (!id) return false;
  if (params.host === true) {
    const located = ctx.host.findCard(ctx.room, id);
    id = located?.card.attachedToCardId ?? undefined;
    if (!id) return false;
  }
  const zone = locationOf(ctx.room, ctx.host, id);
  const controller = controllerOf(ctx.room, ctx.host, id);
  if (!zone || !controller) return false;
  if (params.battlefield === true && zone === "base") return false;
  const others = ctx.host
    .zoneCards(ctx.room, controller, zone)
    .filter((card) => card.id !== id && !card.hidden && isUnitCard(ctx, card.id));
  return others.length === 1;
});

function isUnitCard(ctx: EvalContext, id: string): boolean {
  return (ctx.host.cardInfo(ctx.room, id)?.type ?? "").toLowerCase().includes("unit");
}

/**
 * The event of the ability being chosen for / resolved: the bound trigger event, else the
 * triggering event of the chain item being finalized (403.2 choices are made before
 * resolution, when only the item carries the event).
 */
export function eventOf(ctx: EvalContext): GameEvent | undefined {
  if (ctx.env.event) return ctx.env.event;
  const item = ctx.env.itemId ? findChainItem(ctx.room, ctx.env.itemId) : null;
  return item?.triggerEvent;
}

/**
 * The candidate (`it`) is at a battlefield the trigger's moving object moved to or from (421:
 * a move event carries its destination in `zone` and its origin in `data.from`).
 */
registerCustomCondition("ven:at-move-endpoint-battlefield", (ctx) => {
  const id = ctx.env.it;
  const event = eventOf(ctx);
  if (!id || !event) return false;
  const zone = locationOf(ctx.room, ctx.host, id);
  if (!zone || !isBattlefieldZone(ctx.room, ctx.host, zone)) return false;
  const from = typeof event.data?.from === "string" ? event.data.from : null;
  return zone === event.zone || zone === from;
});

/** "if you control something that's [Empowered]": any board object you control (442.2). */
registerCustomCondition("ven:control-empowered", (ctx) => {
  const objects = ctx.room.rules?.objects ?? {};
  const zones = boardZoneList(ctx.room, ctx.host);
  return Object.entries(objects).some(([id, object]) => {
    if ((object.empowered ?? 0) <= 0) return false;
    const located = locate(ctx.room, ctx.host, id);
    return !!located && zones.includes(located.zone) && located.playerId === ctx.env.controller;
  });
});

/**
 * 442.1.c.1: "I can be [Empowered] up to N times" — empower the source, stacking up to `max`
 * statuses (the core `empower` op is binary, 442.1.b). Emits the 442.2.a event.
 */
registerCustomEffect("ven:empower-stacking", (params, context) => {
  const source = context.machine?.env.sourceObjectId ?? context.sourceObjectId;
  const max = typeof params.max === "number" ? params.max : 1;
  const rules = context.room.rules;
  const done: string[] = [];
  if (
    rules &&
    source &&
    isBoardZone(
      context.room,
      context.step.host,
      locate(context.room, context.step.host, source)?.zone,
    )
  ) {
    const object = (rules.objects[source] ??= {});
    if ((object.empowered ?? 0) < max) {
      object.empowered = (object.empowered ?? 0) + 1;
      done.push(source);
      pushEvent(context.step.events, {
        type: "empower",
        cardId: source,
        playerId: context.controller,
      });
    }
  }
  recordOutcome(context, done, done.length > 0);
  return RESOLVED;
});

/**
 * 359.3.f.3.a: run `effect` once per object bound to `ref` (a legal chosen target, 359.3.e),
 * with every `targetRef: "$bound"` in it frozen to that object (`obj:<id>`). Used where a
 * created effect must keep referring to the chosen object outside this resolution (e.g. the
 * matcher of a delayed replacement, which is evaluated without the creator's choices).
 */
export const BOUND = "$bound";

registerCustomEffect("ven:with-bound", (params, context) => {
  const machine = context.machine;
  const ref = typeof params.ref === "string" ? params.ref : "";
  const effect = params.effect as Effect | undefined;
  if (!machine || !ref || !effect) return RESOLVED;
  const ids = refIds(evalContextOf(context), ref);
  const frames = ids.map((id) => ({ effect: freezeBound(effect, id) }));
  machine.push(...frames);
  return RESOLVED;
});

function freezeBound(value: Effect, id: string): Effect {
  return JSON.parse(JSON.stringify(value), (key, entry) =>
    key === "targetRef" && entry === BOUND ? `obj:${id}` : entry,
  ) as Effect;
}

/**
 * 356.4.f.1 / 355.1.a: the spell being resolved was played with its printed optional additional
 * cost (R2-play records each chosen optional cost as `choices["cost:<id>"] = true`; text costs
 * are `optional:<n>`). Reads the spell's own choices, not `paidAdditionalCost` (see ven-ogs.md).
 */
registerCustomCondition("ven:paid-optional-cost", (ctx, params) => {
  const id = typeof params.id === "string" ? params.id : null;
  return Object.entries(ctx.env.choices).some(
    ([key, value]) =>
      value === true && (id ? key === `cost:${id}` : key.startsWith("cost:optional:")),
  );
});

/** The candidate (`it`) is not at the location bound to `ref` (a chosen battlefield). */
registerCustomCondition("ven:not-at-ref-zone", (ctx, params) => {
  const id = ctx.env.it;
  const ref = typeof params.ref === "string" ? params.ref : "";
  if (!id || !ref) return false;
  const bound = refIds(ctx, ref)[0];
  const zone = bound?.startsWith("battlefield:") ? bound.slice("battlefield:".length) : bound;
  return !!zone && locationOf(ctx.room, ctx.host, id) !== zone;
});

/**
 * "if an opponent has played another spell this turn": an opponent's played-card history
 * (`history.effects.played`, recorded on `card_played`, 350.1) holds a spell other than the
 * card of the chain item bound to `ref`.
 */
registerCustomCondition("ven:opponent-played-another-spell", (ctx, params) => {
  const ref = typeof params.ref === "string" ? params.ref : "";
  const itemId = ref ? refIds(ctx, ref)[0] : undefined;
  const item = itemId ? findChainItem(ctx.room, itemId) : undefined;
  const excluded = item?.cardSnapshot?.id ?? itemId;
  const played = ctx.room.rules?.history.effects?.played ?? {};
  return Object.entries(played).some(
    ([playerId, ids]) =>
      playerId !== ctx.env.controller &&
      ids.some(
        (id) =>
          id !== excluded &&
          (ctx.host.cardInfo(ctx.room, id)?.type ?? "").toLowerCase().includes("spell"),
      ),
  );
});

/** The candidate (`it`, a battlefield object or zone) has at least one unit you control (107.3). */
registerCustomCondition("ven:you-have-units-at-it", (ctx) => {
  const id = ctx.env.it;
  if (!id) return false;
  const zone = id.startsWith("battlefield:") ? id.slice("battlefield:".length) : id;
  return hasUnitPresentAt(ctx.room, ctx.host, ctx.env.controller, zone);
});

/**
 * "Each player chooses a unit they control. Kill the rest." — every player, in Turn Order
 * (303.2.a), picks one unit they control (a resolution-time pick, 355.18), then every other unit
 * is killed (429).
 */
registerCustomEffect("ven:each-player-keeps-one-unit", (_params, context) => {
  const machine = context.machine;
  if (!machine) return RESOLVED;
  const ctx = evalContextOf(context);
  const frames: Array<{ effect: Effect }> = playersInTurnOrder(ctx.room, ctx.host).map(
    (playerId) => ({
      effect: {
        op: "choose",
        key: `keep:${playerId}`,
        selector: { cardType: "unit", controller: { kind: "player", id: playerId } },
        chooser: { kind: "player", id: playerId },
        min: 1,
        max: 1,
        label: "Choose a unit you control to keep",
      },
    }),
  );
  frames.push({
    effect: { op: "kill", target: { cardType: "unit", where: custom("ven:not-kept") } },
  });
  machine.push(...frames);
  return RESOLVED;
});

/** The candidate (`it`) was not picked under any `keep:<player>` key. */
registerCustomCondition("ven:not-kept", (ctx) => {
  const id = ctx.env.it;
  if (!id) return false;
  return !Object.entries(ctx.env.vars).some(
    ([key, value]) => key.startsWith("keep:") && idsOf(value).includes(id),
  );
});

/**
 * "Its base Might becomes N this turn" for the current `for_each` element (`it`): a this-turn
 * Might change of N − base Might (base = the object's `baseMight` or printed Might, 143.2).
 */
registerCustomEffect("ven:base-might-becomes", (params, context) => {
  const machine = context.machine;
  const id = machine?.env.it;
  const value = typeof params.value === "number" ? params.value : 0;
  if (!machine || !id) return RESOLVED;
  const host = context.step.host;
  const base =
    context.room.rules?.objects[id]?.baseMight ?? host.cardInfo(context.room, id)?.might ?? 0;
  machine.push({
    effect: { op: "temporary_might", amount: value - base, target: { targetRef: `obj:${id}` } },
  });
  return RESOLVED;
});

/**
 * "If your score is (not) within N points of the Victory Score": the Victory Score minus the
 * player's score is at most N. `player: "opponent"` = any
 * opponent ("an opponent's score is within …").
 */
registerCustomCondition("ven:score-within", (ctx, params) => {
  const points = typeof params.points === "number" ? params.points : 3;
  // The host's Victory Score already includes battlefield adjustments (Aspirant's Climb).
  const victory = ctx.host.victoryScore(ctx.room);
  const players =
    params.player === "opponent"
      ? ctx.host.activePlayerIds(ctx.room).filter((id) => id !== ctx.env.controller)
      : [ctx.env.controller];
  return players.some((id) => victory - ctx.host.score(ctx.room, id) <= points);
});

/**
 * "if you control a battlefield with exactly N units there": a battlefield you control (stored
 * control, 190.2, else the presence proxy 190.4.a) with exactly `count` face-up units in total.
 */
registerCustomCondition("ven:control-battlefield-with-units", (ctx, params) => {
  const count = typeof params.count === "number" ? params.count : 1;
  const players = ctx.host.activePlayerIds(ctx.room);
  return (ctx.host.battlefieldZones(ctx.room) as string[]).some((zone) => {
    const stored = ctx.room.rules?.objects[zone]?.controller;
    const controller =
      stored !== undefined ? stored : battlefieldController(ctx.room, ctx.host, zone);
    if (controller !== ctx.env.controller) return false;
    const units = players.reduce(
      (sum, id) => sum + unitsPresentAt(ctx.room, ctx.host, zone, id).length,
      0,
    );
    return units === count;
  });
});

/**
 * The damage event (a `deal_damage` proposal) comes from an enemy spell or ability: it is not
 * combat damage (467.2.d) and the chain item resolving now is controlled by an opponent of the
 * source's controller (418.6, 740.1.b).
 */
registerCustomCondition("ven:damage-from-enemy-spell-or-ability", (ctx) => {
  const event = ctx.env.event;
  if (!event || event.data?.combat === true) return false;
  const chain = ctx.room.rules?.chain ?? [];
  const resolving = chain[chain.length - 1];
  return !!resolving && resolving.controller !== ctx.env.controller;
});

/**
 * "the attacker and defender each [add] …": the players named by the triggering `combat_begin`
 * event (466.2) each add the resources (430).
 */
registerCustomEffect("ven:combatants-add", (params, context) => {
  const machine = context.machine;
  const event = machine?.env.event;
  if (!machine || !event) return RESOLVED;
  const energy = typeof params.energy === "number" ? params.energy : 0;
  const players = [event.data?.attacker, event.data?.defender].filter(
    (id, index, list): id is string => typeof id === "string" && list.indexOf(id) === index,
  );
  machine.push(
    ...players.map((id) => ({
      effect: {
        op: "add" as const,
        resources: { energy },
        player: { kind: "player" as const, id },
      },
    })),
  );
  return RESOLVED;
});

/** The candidate (`it`) is attached to the source (716–719). */
registerCustomCondition("ven:attached-to-self", (ctx) => {
  const id = ctx.env.it;
  const source = ctx.env.sourceObjectId;
  if (!id || !source) return false;
  return ctx.host.findCard(ctx.room, id)?.card.attachedToCardId === source;
});

/**
 * "if you've played a non-token unit, a non-token gear, and a spell this turn": the controller's
 * played cards this turn (`history.effects.played`, card plays only — tokens are created, not
 * played as cards, 440.2.c) include each type.
 */
registerCustomCondition("ven:played-unit-gear-spell", (ctx) => {
  const ids = ctx.room.rules?.history.effects?.played?.[ctx.env.controller] ?? [];
  const types = ids.map((id) => (ctx.host.cardInfo(ctx.room, id)?.type ?? "").toLowerCase());
  return ["unit", "gear", "spell"].every((wanted) => types.some((type) => type.includes(wanted)));
});

/** 442.1.c.1: a stacking Empowered status of at least `n` on the source. */
registerCustomCondition("ven:self-empowered-at-least", (ctx, params) => {
  const source = ctx.env.sourceObjectId;
  const n = typeof params.n === "number" ? params.n : 1;
  return !!source && (ctx.room.rules?.objects[source]?.empowered ?? 0) >= n;
});

/** The candidate (`it`) has the given Domain (131: Fury, Calm, Mind, Body, Chaos, Order). */
registerCustomCondition("ven:has-domain", (ctx, params) => {
  const id = ctx.env.it;
  const domain = typeof params.domain === "string" ? params.domain.toLowerCase() : "";
  if (!id || !domain) return false;
  const domains = ctx.host.cardInfo(ctx.room, id)?.domains ?? [];
  return domains.some((entry) => String(entry).toLowerCase() === domain);
});
