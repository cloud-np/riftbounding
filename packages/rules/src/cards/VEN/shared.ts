/**
 * Shared builders and card-specific conditions for the Vendetta (VEN) and Proving Grounds (OGS)
 * scripts (wave R3). Pure data helpers plus import-time registrations of `ven:*` conditions.
 *
 * - `empower(cost)` — 827.1.c.1: "[Empower] [Cost]" is short for "[Cost]: Empower this. Use only
 *   if not Empowered." (the 377.2.b precondition is enforced by `validateChoices`).
 * - `whileEmpowered(modifier)` — 828.1.b/c: an "[Empowered] …" passive is a Dependent Ability,
 *   active only while the source has the Empowered status (`conditional` modifier, 727.1.b).
 * - `...notIntrinsic(keyword)` (re-exported from `cards/lib`) — 727.1.b / 135.2.d.3: the catalog lists keywords that only appear
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
import { evalContextOf, optionFor, recordOutcome } from "../../effects/targets";
import { canPayCost, payCost } from "../../play/payment";
import { appendChainItem } from "../../timing/fepr/chain";
import { pushEvent } from "../../types";
import { channelRunes, drawCards } from "../../actions/primitives";
import { hasUnitPresentAt, unitsPresentAt } from "../../state/presence";
import { forgetObject } from "../../effects/ops/util";
import { effectiveMight } from "../../layers";
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
import { SELF_EMPOWERED } from "../lib/conditions";
import { costLessForEach } from "../lib/costs";
import { whilePassive as conditional } from "../lib/passives";
export { WHEN_I_ATTACK, WHEN_I_BECOME_EMPOWERED, WHEN_I_CONQUER, WHEN_I_DEFEND, WHEN_I_HOLD } from "../lib/triggers";

export { SELF_EMPOWERED } from "../lib/conditions";

/** The source is on the board (see `ven:self-on-board`). */
export const ON_BOARD: Condition = custom("ven:self-on-board");

/** Status note for [Flow] spells (829 is not implemented by the play layer). */
export const FLOW_GAP =
  "[Flow] (829: play from the trash for the Flow cost, then banish it) is not implemented by R2-play; the spell's effect is automated.";

/** Status note for gear that "enters exhausted" (149.1 default is ready; no entry replacement for gear). */
export const ENTERS_EXHAUSTED_GAP =
  '"This enters exhausted" is not automated: gear enter ready (149.1) and the entry layer only has an enter-ready replacement (369.3).';

/** 827.1.c.1 "[Empower] [Cost]" / 828.1.c "[Empowered] …" — shared builders from `cards/lib`. */
export { empower, whileEmpowered } from "../lib/costs";
/** 364.3.a: a conditional passive — `whilePassive` from `cards/lib`. */
export { whilePassive as conditional } from "../lib/passives";

/** 727.1.b: the printed (catalog) keyword is not intrinsic; an ability grants it. */
export { notIntrinsic } from "../lib/keywords";

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
  return costLessForEach(selector, 1, steps, { target, extra });
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

/* ---------------------------------------------------- wave R4 shared conditions */

/** 143.1: the candidate (`it`) is a unit or a gear. */
registerCustomCondition("ven:is-unit-or-gear", (ctx) => {
  const id = ctx.env.it;
  if (!id) return false;
  const type = (ctx.host.cardInfo(ctx.room, id)?.type ?? "").toLowerCase();
  return type.includes("unit") || type.includes("gear");
});

/** `it` is at the battlefield where a showdown (combat or non-combat) is in progress. */
registerCustomCondition("ven:at-showdown", (ctx) => {
  const id = ctx.env.it;
  const rules = ctx.room.rules;
  const zone = rules?.showdown?.battlefield ?? rules?.combat?.battlefield;
  if (!id || !zone) return false;
  return locationOf(ctx.room, ctx.host, id) === zone;
});

/** Every id bound anywhere in a chain item's choices (targets, modes, chosen cards/players). */
function choiceIds(choices: Record<string, unknown> | undefined): string[] {
  if (!choices) return [];
  const out: string[] = [];
  const visit = (value: unknown): void => {
    if (typeof value === "string") out.push(value);
    else if (Array.isArray(value)) for (const entry of value) visit(entry);
    else if (value && typeof value === "object") for (const entry of Object.values(value)) visit(entry);
  };
  for (const value of Object.values(choices)) visit(value);
  return out;
}

/** Decree of Focus: in combat with an enemy Fury unit, or chosen by an enemy Fury spell. */
registerCustomCondition("ven:decree-focus-eligible", (ctx) => {
  const id = ctx.env.it;
  const rules = ctx.room.rules;
  if (!id || !rules) return false;
  const inCombat =
    !!rules.combat &&
    locationOf(ctx.room, ctx.host, id) === rules.combat.battlefield &&
    !!rules.objects[id]?.designation &&
    unitsPresentAt(ctx.room, ctx.host, rules.combat.battlefield).some((card) => {
      if (controllerOf(ctx.room, ctx.host, card.id) === controllerOf(ctx.room, ctx.host, id)) return false;
      if (!rules.objects[card.id]?.designation) return false;
      return (ctx.host.cardInfo(ctx.room, card.id)?.domains ?? []).some(
        (entry) => String(entry).toLowerCase() === "fury",
      );
    });
  if (inCombat) return true;
  return (rules.chain ?? []).some((item) => {
    if (item.kind !== "card" || item.controller === ctx.env.controller) return false;
    if (!choiceIds(item.choices).includes(id)) return false;
    const info = ctx.host.cardInfo(ctx.room, item.cardSnapshot?.id ?? item.id);
    const domains = info?.domains ?? item.cardSnapshot?.domains ?? [];
    return (domains as string[]).some((entry) => String(entry).toLowerCase() === "fury");
  });
});

/** 420.4.a: the played-card event came from a zone other than its controller's hand. */
registerCustomCondition("ven:played-from-not-hand", (ctx) => {
  const event = ctx.env.event;
  const from = event?.data?.from;
  if (typeof from === "string") return from !== "hand";
  // `card_played` carries the chain item; its `fromZone` is the play origin (350.1).
  const itemId = event?.data?.itemId;
  if (typeof itemId !== "string") return false;
  const item = ctx.room.rules?.chain.find((entry) => entry.id === itemId);
  return !!item?.fromZone && item.fromZone !== "hand";
});

/** "during their first and second turn": the event player's turn ordinal within the game. */
registerCustomCondition("ven:first-or-second-turn", (ctx) => {
  const rules = ctx.room.rules;
  if (!rules) return false;
  const players = ctx.host.activePlayerIds(ctx.room).length || 1;
  const ordinal = Math.ceil(rules.turn.number / players);
  return ordinal <= 2;
});

/* ---------------------------------------------------- wave R4 shared effects */

/** 473.1.b style "they draw 1 instead" for a replaced Scoring action: the event's player draws. */
registerCustomEffect("ven:draw-instead-of-score", (_params, context) => {
  const playerId = context.machine?.env.event?.playerId;
  if (!playerId) return RESOLVED;
  drawCards(context.room, playerId, 1, context.step);
  return RESOLVED;
});

/** 315.3.b.1: the event player channels exactly one rune (Sandstone Chimera's replacement). */
registerCustomEffect("ven:channel-one", (_params, context) => {
  const playerId = context.machine?.env.event?.playerId;
  if (!playerId) return RESOLVED;
  channelRunes(context.room, playerId, 1, context.step);
  return RESOLVED;
});

/** "Banish your hand and trash": every card in the controller's hand and trash is banished. */
registerCustomEffect("ven:banish-hand-and-trash", (_params, context) => {
  const host = context.step.host;
  const player = context.controller;
  const cards = [...host.zoneCards(context.room, player, "hand"), ...host.zoneCards(context.room, player, "trash")];
  const done: string[] = [];
  for (const card of cards) {
    const located = locate(context.room, host, card.id);
    if (!located) continue;
    if (!host.moveCardToOwnerZone(context.room, card.id, "banished")) continue;
    forgetObject(context.room, host, card.id);
    done.push(card.id);
    pushEvent(context.step.events, {
      type: "banish",
      cardId: card.id,
      playerId: located.playerId,
      cardName: card.name,
      data: { from: located.zone },
    });
  }
  recordOutcome(context, done, done.length > 0);
  return RESOLVED;
});

/**
 * "When you burn a unit this way, give a friendly unit +[Might] equal to the burned card's
 * Might": reads the burn event this resolution just emitted (441), then asks for the friendly
 * unit at resolution (355.18) and applies the noted Might.
 */
registerCustomEffect("ven:give-burned-might", (_params, context) => {
  const machine = context.machine;
  if (!machine) return RESOLVED;
  const events = context.step.events;
  const burn = [...events].reverse().find((event) => event.type === "burn" && event.playerId === context.controller);
  const burnedId = (burn?.data?.cardIds as string[] | undefined)?.[0];
  if (!burnedId) return RESOLVED;
  const host = context.step.host;
  const located = host.findCard(context.room, burnedId);
  const info = host.cardInfo(context.room, burnedId);
  if (!located || !info || !(info.type ?? "").toLowerCase().includes("unit")) return RESOLVED;
  const might = typeof info.might === "number" ? info.might : 0;
  machine.env.vars.burnedMight = might as never;
  machine.push(
    {
      effect: {
        op: "choose",
        key: "unit",
        selector: { cardType: "unit", controller: "self" },
        min: 1,
        max: 1,
        label: "Choose a friendly unit",
      },
    },
    { effect: { op: "custom", id: "ven:give-might-equal-burned" } },
  );
  return RESOLVED;
});

registerCustomEffect("ven:give-might-equal-burned", (_params, context) => {
  const machine = context.machine;
  if (!machine) return RESOLVED;
  const amount = typeof machine.env.vars.burnedMight === "number" ? machine.env.vars.burnedMight : 0;
  const ids = refIds(evalContextOf(context), "unit");
  machine.push(
    ...ids.map((id) => ({
      effect: { op: "temporary_might" as const, amount, target: { targetRef: `obj:${id}` } },
    })),
  );
  return RESOLVED;
});

/**
 * Temporal Breach: "Banish a unit, then its owner plays it to the same location, ignoring its
 * cost." The owner is the new chain item's controller (420.3), and the recorded location is
 * forced through `totalCost` (359.2.c/d).
 */
registerCustomEffect("ven:banish-then-replay", (params, context) => {
  const host = context.step.host;
  const rules = context.room.rules;
  const ctx = evalContextOf(context);
  const ref = typeof params.ref === "string" ? params.ref : "target:0";
  const ids = refIds(ctx, ref);
  for (const id of ids) {
    if (!rules) break;
    const located = locate(context.room, host, id);
    if (!located) continue;
    const zone = located.zone;
    if (!host.moveCardToOwnerZone(context.room, id, "banished")) continue;
    forgetObject(context.room, host, id);
    pushEvent(context.step.events, {
      type: "banish",
      cardId: id,
      playerId: located.playerId,
      cardName: located.card.name,
      data: { from: zone },
    });
    const owner = located.card.ownerPlayerId ?? located.playerId;
    const info = host.cardInfo(context.room, id);
    const snapshot = host.takeCard(context.room, owner, "banished", id);
    if (!snapshot) continue;
    const type = (info?.type ?? snapshot.type ?? "").toLowerCase();
    const location = type.includes("unit") && zone !== "base" ? zone : "base";
    const item = {
      id: host.nextId("chain"),
      kind: "card" as const,
      status: "pending" as const,
      controller: owner,
      cardName: info?.name ?? snapshot.name,
      ...(snapshot.cardCode ? { cardCode: snapshot.cardCode } : {}),
      choices: { location },
      origin: "play" as const,
      fromZone: "banished",
      cardSnapshot: snapshot,
      totalCost: { energy: 0, power: 0 },
      addedAt: host.now(),
    };
    appendChainItem(context.room, item, context.step);
    rules.history.cardsPlayedThisTurn[owner] = (rules.history.cardsPlayedThisTurn[owner] ?? 0) + 1;
    pushEvent(context.step.events, {
      type: "card_played",
      cardId: id,
      playerId: owner,
      cardName: item.cardName,
      data: { itemId: item.id, limited: true, cost: "ignored", from: "banished" },
    });
  }
  return RESOLVED;
});

/** The controller of a unit/gear or rune controlled by `playerId` is ready-able. */
function readyCandidates(room: EvaluatorRoom, host: EvaluatorHost, playerId: string): string[] {
  const zones = ["base", ...host.battlefieldZones(room)];
  const out: string[] = [];
  for (const zone of zones) {
    for (const card of host.zoneCards(room, playerId, zone)) {
      const type = (host.cardInfo(room, card.id)?.type ?? "").toLowerCase();
      if (type.includes("unit") || type.includes("gear")) out.push(card.id);
    }
  }
  for (const card of host.zoneCards(room, playerId, "runeArea")) out.push(card.id);
  return out;
}

type EvaluatorRoom = Parameters<typeof channelRunes>[0];
type EvaluatorHost = Parameters<typeof hasUnitPresentAt>[1];

/** "Ready up to N units, gear and/or runes" (355.13: zero or more, up to N). */
registerCustomEffect("ven:ready-up-to", (params, context) => {
  const machine = context.machine;
  if (!machine) return RESOLVED;
  const host = context.step.host;
  const ctx = evalContextOf(context);
  const max = typeof params.count === "number" ? Math.max(0, params.count) : 4;
  const pool = readyCandidates(context.room, host, ctx.env.controller).filter((id) =>
    host.isExhausted(context.room, id),
  );
  if (pool.length === 0) return RESOLVED;
  if (machine.frame.answer === undefined) {
    return machine.ask({
      kind: "choose-card",
      playerId: ctx.env.controller,
      options: pool.map((id) => optionFor(ctx, id)),
      min: 0,
      max: Math.min(max, pool.length),
      rule: "355.13",
      promptKey: "rules.prompt.choose",
      data: { answer: "objects" },
    });
  }
  const answer = machine.frame.answer;
  machine.frame.answer = undefined;
  const ids = (Array.isArray(answer) ? answer : [answer]).filter(
    (id): id is string => typeof id === "string" && pool.includes(id),
  );
  machine.push(...ids.map((id) => ({ effect: { op: "ready" as const, target: { targetRef: `obj:${id}` } } })));
  return RESOLVED;
});

/**
 * Wild Claw: "You may banish a unit or gear from among them and play it, reducing its Energy
 * cost by [5]. Recycle the rest." (`chosen` holds the looked-at card picked at resolution.)
 */
registerCustomEffect("ven:wild-claw-play", (_params, context) => {
  const machine = context.machine;
  const host = context.step.host;
  const rules = context.room.rules;
  if (!machine || !rules) return RESOLVED;
  const ctx = evalContextOf(context);
  const controller = ctx.env.controller;
  const chosen = refIds(ctx, "chosen");
  const played: string[] = [];
  for (const id of chosen) {
    const located = locate(context.room, host, id);
    if (!located) continue;
    const owner = located.card.ownerPlayerId ?? located.playerId;
    const info = host.cardInfo(context.room, id);
    const domains = (info?.domains ?? []) as string[];
    const power = info?.powerCost ?? 0;
    const energy = Math.max(0, (info?.energyCost ?? 0) - 5);
    const cost = {
      ...(energy > 0 ? { energy } : {}),
      ...(power > 0 ? { power: { [domains.length === 1 ? domains[0]! : "any"]: power } } : {}),
    };
    if (!canPayCost(context.room, host, controller, cost)) continue;
    if (!host.moveCardToOwnerZone(context.room, id, "banished")) continue;
    forgetObject(context.room, host, id);
    pushEvent(context.step.events, {
      type: "banish",
      cardId: id,
      playerId: located.playerId,
      cardName: located.card.name,
      data: { from: located.zone },
    });
    if (!payCost(context.room, context.step, controller, cost).ok) continue;
    const snapshot = host.takeCard(context.room, owner, "banished", id);
    if (!snapshot) continue;
    const item = {
      id: host.nextId("chain"),
      kind: "card" as const,
      status: "pending" as const,
      controller,
      cardName: info?.name ?? snapshot.name,
      ...(snapshot.cardCode ? { cardCode: snapshot.cardCode } : {}),
      choices: { location: "base" },
      origin: "play" as const,
      fromZone: "banished",
      cardSnapshot: snapshot,
      totalCost: { energy, power },
      addedAt: host.now(),
    };
    appendChainItem(context.room, item, context.step);
    rules.history.cardsPlayedThisTurn[controller] = (rules.history.cardsPlayedThisTurn[controller] ?? 0) + 1;
    played.push(id);
    pushEvent(context.step.events, {
      type: "card_played",
      cardId: id,
      playerId: controller,
      cardName: item.cardName,
      data: { itemId: item.id, limited: true, cost: "reduced", from: "banished" },
    });
  }
  const rest = refIds(ctx, "looked").filter((id) => !chosen.includes(id));
  for (const id of rest) {
    const located = locate(context.room, host, id);
    if (!located || located.zone !== "deck") continue;
    if (!host.moveCardToOwnerZone(context.room, id, "deck", "bottom")) continue;
    pushEvent(context.step.events, {
      type: "recycle",
      cardId: id,
      playerId: located.card.ownerPlayerId ?? located.playerId,
      zone: "deck",
      data: { from: "deck" },
    });
  }
  // "Then you may do this: Empower it." The played card finalizes after this resolution, so the
  // optional empowerment waits for its play event (391.2 / 420.3).
  if (played.length > 0) {
    machine.push({
      effect: {
        op: "delayed",
        trigger: {
          kind: "event",
          event: { type: ["unit_played", "gear_played"], subject: { targetRef: "chosen" } },
        },
        effect: { op: "empower", target: { targetRef: "chosen" } },
        duration: "this-turn",
        optional: true,
      },
    });
  }
  return RESOLVED;
});

/**
 * Rebuttal — "You may pay [Rune]. If you do, gain control of it and you may make new choices for
 * it. Otherwise, counter it." The spell stays pending below Rebuttal; changing the item's
 * controller and clearing its choices lets its own resolution choose anew (355.18).
 */
registerCustomEffect("ven:rebuttal", (params, context) => {
  const machine = context.machine;
  const ctx = evalContextOf(context);
  if (!machine) return RESOLVED;
  const ref = typeof params.ref === "string" ? params.ref : "target:0";
  const id = refIds(ctx, ref)[0];
  const item = id ? ctx.room.rules?.chain.find((entry) => entry.id === id) : undefined;
  if (!id || !item) return RESOLVED;
  const pay = { power: { any: 1 } };
  const payable = canPayCost(context.room, context.step.host, ctx.env.controller, pay);
  const answer = machine.frame.answer;
  if (payable && answer === undefined) {
    return machine.ask({
      kind: "yes-no",
      playerId: ctx.env.controller,
      options: [
        { id: "yes", label: "Pay [Rune]" },
        { id: "no", label: "Counter it" },
      ],
      min: 1,
      max: 1,
      rule: "445.2",
      promptKey: "rules.prompt.payCost",
      data: { answer: "boolean" },
    });
  }
  machine.frame.answer = undefined;
  const yes = answer === true || answer === "yes" || (Array.isArray(answer) && answer.includes("yes"));
  if (payable && yes && payCost(context.room, context.step, ctx.env.controller, pay).ok) {
    item.controller = ctx.env.controller;
    item.choices = {};
    pushEvent(context.step.events, {
      type: "establish_control",
      playerId: ctx.env.controller,
      data: { itemId: item.id, rule: "435" },
    });
    return RESOLVED;
  }
  machine.push({ effect: { op: "counter", target: { targetRef: `obj:${item.id}` } } });
  return RESOLVED;
});

/** Choose a player: they gain control of this and recall it (Glowstone). */
registerCustomEffect("ven:control-and-recall", (params, context) => {
  const host = context.step.host;
  const ctx = evalContextOf(context);
  const sourceRef = typeof params.source === "string" ? params.source : "self";
  const source = refIds(ctx, sourceRef)[0];
  const player = refIds(ctx, typeof params.playerRef === "string" ? params.playerRef : "player")[0];
  if (!source || !player) return RESOLVED;
  if (!host.setController(context.room, source, player)) return RESOLVED;
  pushEvent(context.step.events, {
    type: "establish_control",
    cardId: source,
    playerId: player,
    data: { rule: "190" },
  });
  const located = locate(context.room, host, source);
  if (located && located.zone !== "base") {
    host.moveCard(context.room, located.playerId, located.zone, "base", source);
    pushEvent(context.step.events, { type: "recall", cardId: source, playerId: player });
  }
  return RESOLVED;
});

/** Dame the Despoiler: increase my Might to the chosen unit's Might, then give me +1. */
registerCustomEffect("ven:increase-might-to-chosen", (_params, context) => {
  const machine = context.machine;
  if (!machine) return RESOLVED;
  const ctx = evalContextOf(context);
  const source = ctx.env.sourceObjectId;
  const chosen = refIds(ctx, "unit")[0];
  if (!source || !chosen) return RESOLVED;
  const mine = effectiveMight(context.room, source, context.step.host);
  const theirs = effectiveMight(context.room, chosen, context.step.host);
  const amount = Math.max(0, theirs - mine);
  machine.push({
    effect: {
      op: "seq",
      effects: [
        { op: "temporary_might", amount, target: { targetRef: `obj:${source}` } },
        { op: "temporary_might", amount: 1, target: { targetRef: `obj:${source}` } },
      ],
    },
  });
  return RESOLVED;
});
