/**
 * Spiritforged (SFD) — lane-prefixed custom conditions/effects that need resolution prompts or
 * computed amounts the core DSL cannot express (`sfd:*`). Conditions are pure; effects mutate
 * only the draft room through the regular game-action ops (pushed as interpreter frames) or
 * host primitives, and emit an event for every change.
 */
import type {
  Amount,
  ChainItem,
  Effect,
  PromptOption,
  Selector,
  TokenSpec,
  ZoneSelector,
} from "@rift/protocol";
import { evaluateAmount, mightOf, refIds, registerCustomCondition } from "../../effects/evaluate";
import { registerCustomEffect } from "../../effects/ops";
import { RESOLVED, type EffectExecutionContext } from "../../effects/execute";
import type { EvalContext } from "../../effects/env";
import { evalContextOf, optionFor, recordOutcome, targets } from "../../effects/targets";
import { resolveZoneNames } from "../../effects/evaluate";
import { appendChainItem } from "../../timing/fepr/chain";
import { cardDomains } from "../../play/cost-model";
import { locationZones } from "../../effects/objects";
import {
  battlefieldController,
  controllerOf,
  findChainItem,
  locate,
  locationOf,
  ownerOf,
  tagsOf,
} from "../../effects/objects";
import { effectiveKeywordValues, keywordsAtDepth } from "../../layers";
import { canPayCost, payCost } from "../../play/payment";
import { unitsPresentAt } from "../../state/presence";
import { pushEvent } from "../../types";
import { token } from "../dsl";

function ctxOf(context: EffectExecutionContext): EvalContext {
  return evalContextOf(context);
}

/* ---------------------------------------------------------------- conditions */

/** 466: the combat in progress has exactly one attacking and one defending unit ("one on one"). */
registerCustomCondition("sfd:one-on-one", (ctx) => {
  const combat = ctx.room.rules?.combat;
  if (!combat) return false;
  let attackers = 0;
  let defenders = 0;
  for (const card of unitsPresentAt(ctx.room, ctx.host, combat.battlefield)) {
    const designation = ctx.room.rules?.objects[card.id]?.designation;
    if (designation === "attacker") attackers += 1;
    if (designation === "defender") defenders += 1;
  }
  return attackers === 1 && defenders === 1;
});

/**
 * A subject-less conquer/hold event (383.4.c.2.a) concerns the unit bound to `ref`: it is at the
 * event's battlefield under the acting player ("When I conquer" for a granted / delayed ability).
 */
registerCustomCondition("sfd:ref-present-at-event", (ctx, params) => {
  const ref = typeof params.ref === "string" ? params.ref : "target:0";
  const [id] = refIds(ctx, ref);
  const event = ctx.env.event;
  if (!id || !event?.zone) return false;
  const located = locate(ctx.room, ctx.host, id);
  return (
    !!located &&
    located.zone === event.zone &&
    (!event.playerId || located.playerId === event.playerId)
  );
});

/** `it` is attached to another card (716–718). `attached: false` = detached. */
registerCustomCondition("sfd:it-attached", (ctx, params) => {
  const id = ctx.env.it;
  if (!id) return false;
  const attached = !!locate(ctx.room, ctx.host, id)?.card.attachedToCardId;
  return attached === (params.attached !== false);
});

/** `it` is attached to the object bound to `ref`. */
registerCustomCondition("sfd:it-attached-to", (ctx, params) => {
  const id = ctx.env.it;
  const ref = typeof params.ref === "string" ? params.ref : "target:0";
  const [hostId] = refIds(ctx, ref);
  return !!id && !!hostId && locate(ctx.room, ctx.host, id)?.card.attachedToCardId === hostId;
});

/** The object bound to `ref` has an Equipment attached (it is "equipped"). */
registerCustomCondition("sfd:it-equipped", (ctx) => {
  const id = ctx.env.it;
  if (!id) return false;
  for (const playerId of ctx.host.activePlayerIds(ctx.room)) {
    for (const zone of ["base", ...(ctx.host.battlefieldZones(ctx.room) as string[])]) {
      for (const card of ctx.host.zoneCards(ctx.room, playerId, zone)) {
        if (
          card.attachedToCardId === id &&
          tagsOf(card).some((tag) => tag.toLowerCase() === "equipment")
        )
          return true;
      }
    }
  }
  return false;
});

/** `it` has the same controller as the object bound to `ref` (740.1). */
registerCustomCondition("sfd:same-controller-as", (ctx, params) => {
  const id = ctx.env.it;
  const ref = typeof params.ref === "string" ? params.ref : "target:0";
  const [other] = refIds(ctx, ref);
  if (!id || !other) return false;
  const a = controllerOf(ctx.room, ctx.host, id);
  return !!a && a === controllerOf(ctx.room, ctx.host, other);
});

/** `it` (a spell or ability on the chain) chose a unit or gear the ability's controller controls. */
registerCustomCondition("sfd:chooses-friendly", (ctx) => {
  const item = ctx.env.it ? findChainItem(ctx.room, ctx.env.it) : undefined;
  if (!item) return false;
  const chosen: string[] = [];
  for (const [key, value] of Object.entries(item.choices ?? {})) {
    if (!key.startsWith("target:")) continue;
    if (typeof value === "string") chosen.push(value);
    else if (Array.isArray(value))
      chosen.push(...value.filter((entry): entry is string => typeof entry === "string"));
  }
  return chosen.some((id) => {
    const located = locate(ctx.room, ctx.host, id);
    if (!located || located.zone === "hand" || located.zone === "deck" || located.zone === "trash")
      return false;
    const type = (ctx.host.cardInfo(ctx.room, id)?.type ?? "").toLowerCase();
    return (
      (type.includes("unit") || type.includes("gear")) && located.playerId === ctx.env.controller
    );
  });
});

/** The activated ability's source (`event.sourceObjectId`) is a gear. */
registerCustomCondition("sfd:event-source-gear", (ctx) => {
  const source = ctx.env.event?.sourceObjectId;
  return (
    !!source && (ctx.host.cardInfo(ctx.room, source)?.type ?? "").toLowerCase().includes("gear")
  );
});

/** The unit `it` has at least `n` Equipment attached that the ability's controller controls. */
registerCustomCondition("sfd:it-equipment-at-least", (ctx, params) => {
  const id = ctx.env.it;
  const n = typeof params.n === "number" ? params.n : 1;
  if (!id) return false;
  let count = 0;
  for (const zone of ["base", ...(ctx.host.battlefieldZones(ctx.room) as string[])]) {
    for (const card of ctx.host.zoneCards(ctx.room, ctx.env.controller, zone)) {
      if (
        card.attachedToCardId === id &&
        tagsOf(card).some((tag) => tag.toLowerCase() === "equipment")
      )
        count += 1;
    }
  }
  return count >= n;
});

/* ---------------------------------------------------------------- effects */

/**
 * "Play a … token for each …": evaluate `amount` (an Amount) once, play that many tokens in one
 * `create` instruction (440), and bind the created ids to the variable `bind` (default
 * `created`) for later "them" references (inherited by reflexive items, 389).
 */
registerCustomEffect("sfd:create-count", (params, context) => {
  const machine = context.machine;
  if (!machine) return RESOLVED;
  const count = Math.max(
    0,
    Math.trunc(evaluateAmount(ctxOf(context), params.amount as Amount) ?? 0),
  );
  if (count === 0) return RESOLVED;
  const spec = params.token as TokenSpec;
  machine.push(
    {
      effect: {
        op: "create",
        token: { ...spec, count },
        ...(params.zone ? { zone: params.zone as ZoneSelector } : {}),
      },
    },
    {
      effect: {
        op: "custom",
        id: "sfd:bind",
        params: { from: "$affected", to: params.bind ?? "created" },
      },
    },
  );
  return RESOLVED;
});

/** Copy a resolution value (`from`, e.g. `$affected`) into a named variable `to` (inherited by reflexive items). */
registerCustomEffect("sfd:bind", (params, context) => {
  const env = context.machine?.env;
  if (!env) return RESOLVED;
  const from = typeof params.from === "string" ? params.from : "$affected";
  const to = typeof params.to === "string" ? params.to : "bound";
  env.vars[to] = JSON.parse(JSON.stringify(env.vars[from] ?? env.choices[from] ?? []));
  return RESOLVED;
});

/**
 * "Put a card from your hand on the top or bottom of your Main Deck" (Altar of Memories): the
 * controller picks a card from hand, then top or bottom (355.18 resolution choices).
 */
registerCustomEffect("sfd:hand-to-deck-top-or-bottom", (_params, context) => {
  const machine = context.machine;
  if (!machine) return RESOLVED;
  const host = context.step.host;
  const env = machine.env;
  const data = (machine.frame.data ??= {});
  const handCards = host.zoneCards(context.room, env.controller, "hand").map((card) => card.id);
  if (handCards.length === 0) return RESOLVED;
  if (typeof data.card !== "string") {
    if (handCards.length === 1) data.card = handCards[0];
    else if (machine.frame.answer !== undefined) {
      const picked = (
        Array.isArray(machine.frame.answer) ? machine.frame.answer : [machine.frame.answer]
      ).find((id): id is string => typeof id === "string" && handCards.includes(id));
      machine.frame.answer = undefined;
      if (picked) data.card = picked;
    }
    if (typeof data.card !== "string") {
      return machine.ask({
        kind: "choose-card",
        playerId: env.controller,
        options: handCards.map((id) => optionFor(ctxOf(context), id)),
        min: 1,
        max: 1,
        rule: "355.18",
        promptKey: "Put a card from your hand on your Main Deck",
        data: { answer: "objects" },
      });
    }
  }
  if (machine.frame.answer === undefined) {
    return machine.ask({
      kind: "choose-mode",
      playerId: env.controller,
      options: [
        { id: "top", label: "Top of your Main Deck" },
        { id: "bottom", label: "Bottom of your Main Deck" },
      ],
      min: 1,
      max: 1,
      rule: "355.18",
      promptKey: "Top or bottom?",
      data: { answer: "options" },
    });
  }
  const answer = machine.frame.answer;
  machine.frame.answer = undefined;
  const position = (Array.isArray(answer) ? answer[0] : answer) === "bottom" ? "bottom" : "top";
  const cardId = data.card as string;
  // The draw end of the Main Deck is its top (host convention).
  if (host.moveCardToOwnerZone(context.room, cardId, "deck", position)) {
    pushEvent(context.step.events, {
      type: "put_on_deck",
      cardId,
      playerId: env.controller,
      data: { position },
    });
    recordOutcome(context, [cardId], true);
  }
  return RESOLVED;
});

/**
 * Deal damage equal to the source's keyword value (e.g. "damage equal to my [Assault]", 807.2)
 * to `it` (the enclosing `for_each` target).
 */
registerCustomEffect("sfd:deal-keyword-value", (params, context) => {
  const machine = context.machine;
  const env = machine?.env;
  if (!machine || !env?.sourceObjectId || !env.it) return RESOLVED;
  const keyword = String(params.keyword ?? "assault").toLowerCase();
  const value =
    effectiveKeywordValues(context.room, env.sourceObjectId, context.step.host)[keyword] ?? 0;
  if (value <= 0) return RESOLVED;
  machine.push({ effect: { op: "deal", amount: value, target: { targetRef: "it" } }, it: env.it });
  return RESOLVED;
});

/**
 * "Give another friendly unit my keywords and +[Might] equal to my Might this turn" (Kato the
 * Arm): every keyword the source has (with its value, 801.3.a) and its Might (143.2.c: a
 * negative Might is referenced as 0) go to `it` this turn.
 */
registerCustomEffect("sfd:give-my-keywords-and-might", (_params, context) => {
  const machine = context.machine;
  const env = machine?.env;
  if (!machine || !env?.sourceObjectId || !env.it) return RESOLVED;
  const host = context.step.host;
  const source = env.sourceObjectId;
  const values = effectiveKeywordValues(context.room, source, host);
  const frames: Effect[] = keywordsAtDepth(context.room, source, host, 0).map((keyword) => {
    const value = values[keyword.toLowerCase()];
    const valued = value !== undefined && value > 1 ? `${keyword} ${value}` : keyword;
    return {
      op: "grant_keyword",
      keyword: valued,
      target: { targetRef: "it" },
      duration: "this-turn",
    };
  });
  const might = mightOf(ctxOf(context), source) ?? 0;
  if (might > 0) frames.push({ op: "temporary_might", amount: might, target: { targetRef: "it" } });
  machine.push(...frames.map((effect) => ({ effect, it: env.it })));
  return RESOLVED;
});

/**
 * Riposte: "Counter that spell and give that unit +[Might] equal to that spell's Energy cost this
 * turn." The cost is read from the spell before it is countered (its printed Energy cost).
 */
registerCustomEffect("sfd:counter-and-give-cost", (params, context) => {
  const machine = context.machine;
  if (!machine) return RESOLVED;
  const ctx = ctxOf(context);
  const spellRef = typeof params.spell === "string" ? params.spell : "target:1";
  const unitRef = typeof params.unit === "string" ? params.unit : "target:0";
  const [itemId] = refIds(ctx, spellRef);
  const item = itemId ? findChainItem(context.room, itemId) : undefined;
  const cardId = item?.cardSnapshot?.id;
  const cost = cardId ? (context.step.host.cardInfo(context.room, cardId)?.energyCost ?? 0) : 0;
  const frames: Effect[] = [{ op: "counter", target: { targetRef: spellRef } }];
  if (item && cost > 0)
    frames.push({ op: "temporary_might", amount: cost, target: { targetRef: unitRef } });
  machine.push(...frames.map((effect) => ({ effect })));
  return RESOLVED;
});

/**
 * Hard Bargain: "Counter a spell unless its controller pays [N]." The spell's controller decides
 * (if they can pay); paying goes through R2-play's `payCost` (445).
 */
registerCustomEffect("sfd:counter-unless-pay", (params, context) => {
  const machine = context.machine;
  if (!machine) return RESOLVED;
  const host = context.step.host;
  const ctx = ctxOf(context);
  const ref = typeof params.ref === "string" ? params.ref : "target:0";
  const energy = typeof params.energy === "number" ? params.energy : 2;
  const [itemId] = refIds(ctx, ref);
  const item = itemId ? findChainItem(context.room, itemId) : undefined;
  if (!item) return RESOLVED;
  const payer = item.controller;
  const cost = { energy };
  if (canPayCost(context.room, host, payer, cost)) {
    if (machine.frame.answer === undefined) {
      return machine.ask({
        kind: "yes-no",
        playerId: payer,
        options: [
          { id: "yes", label: `Pay [${energy}]` },
          { id: "no", label: "Don't pay" },
        ],
        min: 1,
        max: 1,
        rule: "445.2",
        promptKey: `Pay [${energy}] or the spell is countered`,
        data: { answer: "boolean" },
      });
    }
    const pay = machine.frame.answer === true;
    machine.frame.answer = undefined;
    if (pay && payCost(context.room, context.step, payer, cost).ok) {
      recordOutcome(context, [], false);
      return RESOLVED;
    }
  }
  machine.push({ effect: { op: "counter", target: { targetRef: ref } } });
  return RESOLVED;
});

/** Locations a player may play a unit to: their base and battlefields they control (355.2). */
function unitLocations(context: EffectExecutionContext, playerId: string): string[] {
  const host = context.step.host;
  const zones = ["base"];
  for (const zone of host.battlefieldZones(context.room) as string[]) {
    if (battlefieldController(context.room, host, zone) === playerId) zones.push(zone);
  }
  return zones;
}

/**
 * Vanguard Armory: "Play three 1 [Might] Recruit unit tokens. (You may play them to different
 * locations.)" Each token's location is chosen as it is played (440.2.b, 355.2).
 */
registerCustomEffect("sfd:recruits-anywhere", (params, context) => {
  const machine = context.machine;
  if (!machine) return RESOLVED;
  const env = machine.env;
  const remaining = typeof params.count === "number" ? params.count : 3;
  if (remaining <= 0) return RESOLVED;
  const zones = unitLocations(context, env.controller);
  let zone: string | undefined = zones.length === 1 ? zones[0] : undefined;
  if (!zone) {
    if (machine.frame.answer === undefined) {
      return machine.ask({
        kind: "choose-battlefield",
        playerId: env.controller,
        options: zones.map((id): PromptOption => ({ id, zone: id })),
        min: 1,
        max: 1,
        rule: "440.2.b",
        promptKey: "Play a Recruit token where?",
        data: { answer: "zone" },
      });
    }
    const answer = machine.frame.answer;
    machine.frame.answer = undefined;
    zone = typeof answer === "string" && zones.includes(answer) ? answer : "base";
  }
  machine.push(
    {
      effect: {
        op: "create",
        token: token(typeof params.token === "string" ? params.token : "Recruit", {
          might: 1,
          play: true,
        }),
        zone: zone as never,
      },
    },
    {
      effect: {
        op: "custom",
        id: "sfd:recruits-anywhere",
        params: { ...params, count: remaining - 1 },
      },
    },
  );
  return RESOLVED;
});

/**
 * Temptation: "Move an enemy unit to a location where there's a unit with the same controller."
 * The destination is chosen on resolution among locations (base or battlefields, other than its
 * own, 355.4.a) holding another unit of its controller.
 */
registerCustomEffect("sfd:move-to-ally-location", (params, context) => {
  const machine = context.machine;
  if (!machine) return RESOLVED;
  const host = context.step.host;
  const ctx = ctxOf(context);
  const ref = typeof params.ref === "string" ? params.ref : "target:0";
  const [id] = refIds(ctx, ref);
  if (!id) return RESOLVED;
  const controller = controllerOf(context.room, host, id);
  const from = locationOf(context.room, host, id);
  if (!controller || !from) return RESOLVED;
  const zones = ["base", ...(host.battlefieldZones(context.room) as string[])].filter(
    (zone) =>
      zone !== from &&
      unitsPresentAt(context.room, host, zone, controller).some((card) => card.id !== id),
  );
  if (zones.length === 0) return RESOLVED;
  let zone = zones.length === 1 ? zones[0]! : undefined;
  if (!zone) {
    if (machine.frame.answer === undefined) {
      return machine.ask({
        kind: "choose-battlefield",
        playerId: machine.env.controller,
        options: zones.map((entry): PromptOption => ({ id: entry, zone: entry })),
        min: 1,
        max: 1,
        rule: "355.4",
        promptKey: "Move it where?",
        data: { answer: "zone" },
      });
    }
    const answer = machine.frame.answer;
    machine.frame.answer = undefined;
    zone = typeof answer === "string" && zones.includes(answer) ? answer : zones[0]!;
  }
  machine.push({ effect: { op: "move", target: { targetRef: ref }, to: zone as never } });
  return RESOLVED;
});

/**
 * Bard, Mercurial: "move any number of your units to an open battlefield" — one open battlefield
 * (170.11.c: unoccupied and uncontrolled) is chosen on resolution, then the units bound to `ref`
 * move there.
 */
registerCustomEffect("sfd:move-to-open-battlefield", (params, context) => {
  const machine = context.machine;
  if (!machine) return RESOLVED;
  const host = context.step.host;
  const ctx = ctxOf(context);
  const ref = typeof params.ref === "string" ? params.ref : "movers";
  if (refIds(ctx, ref).length === 0) return RESOLVED;
  const zones = (host.battlefieldZones(context.room) as string[]).filter(
    (zone) =>
      unitsPresentAt(context.room, host, zone).length === 0 &&
      !battlefieldController(context.room, host, zone),
  );
  if (zones.length === 0) return RESOLVED;
  let zone = zones.length === 1 ? zones[0]! : undefined;
  if (!zone) {
    if (machine.frame.answer === undefined) {
      return machine.ask({
        kind: "choose-battlefield",
        playerId: machine.env.controller,
        options: zones.map((entry): PromptOption => ({ id: entry, zone: entry })),
        min: 1,
        max: 1,
        rule: "170.11.c",
        promptKey: "Move them to which open battlefield?",
        data: { answer: "zone" },
      });
    }
    const answer = machine.frame.answer;
    machine.frame.answer = undefined;
    zone = typeof answer === "string" && zones.includes(answer) ? answer : zones[0]!;
  }
  machine.push({ effect: { op: "move", target: { targetRef: ref }, to: zone as never } });
  return RESOLVED;
});

/* ---------------------------------------------------------------- batch 5 */

/**
 * A Limited Play (420.3) that keeps the Power cost: "play it, ignoring its Energy cost (you must
 * still pay its Power cost)" (356.1.b.1) or "reducing its cost by [N]" (356.4). Mirrors the core
 * `play` op, but pays the card's Power cost and applies `energy`: `"ignore"` or a discount.
 * Nothing is played when the cost cannot be paid (358.5).
 */
registerCustomEffect("sfd:play-card", (params, context) => {
  const host = context.step.host;
  const ctx = ctxOf(context);
  const rules = context.room.rules;
  const found = targets(context, params.target as Selector);
  if (!found.ok) return found.result;
  let zones: string[];
  if (params.location === "controlled-battlefield") {
    // "to a battlefield you control" (355.2.a): the player picks among them when several.
    const controlled = (host.battlefieldZones(context.room) as string[]).filter(
      (zone) => battlefieldController(context.room, host, zone) === ctx.env.controller,
    );
    if (found.ids.length === 0 || controlled.length === 0) return RESOLVED;
    let picked: string | undefined = controlled.length === 1 ? controlled[0] : undefined;
    const machine = context.machine;
    if (!picked && machine) {
      if (machine.frame.answer === undefined) {
        return machine.ask({
          kind: "choose-battlefield",
          playerId: ctx.env.controller,
          options: controlled.map((id): PromptOption => ({ id, zone: id })),
          min: 1,
          max: 1,
          rule: "355.2.a",
          promptKey: "Play it to which battlefield?",
          data: { answer: "zone" },
        });
      }
      const answer = machine.frame.answer;
      machine.frame.answer = undefined;
      picked = typeof answer === "string" && controlled.includes(answer) ? answer : controlled[0];
    }
    zones = picked ? [picked] : ["base"];
  } else {
    zones = params.location ? resolveZoneNames(ctx, params.location as ZoneSelector) : ["base"];
  }
  const location = zones.find((zone) => locationZones(context.room, host).includes(zone)) ?? "base";
  const discount = typeof params.energy === "number" ? params.energy : 0;
  const played: string[] = [];
  for (const id of found.ids) {
    const located = locate(context.room, host, id);
    if (!rules || !located) continue;
    const info = host.cardInfo(context.room, id);
    const domains = cardDomains(info);
    const power = info?.powerCost ?? 0;
    const energy = params.energy === "ignore" ? 0 : Math.max(0, (info?.energyCost ?? 0) - discount);
    const cost = {
      ...(energy > 0 ? { energy } : {}),
      ...(power > 0 ? { power: { [domains.length === 1 ? domains[0]! : "any"]: power } } : {}),
    };
    if (!payCost(context.room, context.step, ctx.env.controller, cost as never).ok) continue;
    const snapshot = host.takeCard(context.room, located.playerId, located.zone, id);
    if (!snapshot) continue;
    const type = (info?.type ?? snapshot.type ?? "").toLowerCase();
    const item: ChainItem = {
      id: host.nextId("chain"),
      kind: "card",
      status: "pending",
      controller: ctx.env.controller,
      cardName: info?.name ?? snapshot.name,
      ...(snapshot.cardCode ? { cardCode: snapshot.cardCode } : {}),
      choices:
        type.includes("unit") || type.includes("gear")
          ? { location: type.includes("unit") ? location : "base" }
          : {},
      origin: "play",
      fromZone: located.zone,
      cardSnapshot: snapshot,
      addedAt: host.now(),
    };
    appendChainItem(context.room, item, context.step);
    rules.history.cardsPlayedThisTurn[ctx.env.controller] =
      (rules.history.cardsPlayedThisTurn[ctx.env.controller] ?? 0) + 1;
    played.push(id);
    pushEvent(context.step.events, {
      type: "card_played",
      cardId: id,
      playerId: ctx.env.controller,
      cardName: item.cardName,
      data: { itemId: item.id, limited: true, cost: "sfd", from: located.zone },
    });
  }
  recordOutcome(context, played, played.length > 0);
  return RESOLVED;
});

/**
 * "Take control of it" for the ability's controller (no duration: it lasts while the object stays
 * on the board). The unit's owner is remembered in `$owner:<id>` so it can be given back.
 */
registerCustomEffect("sfd:take-control", (params, context) => {
  const found = targets(context, params.target as Selector);
  if (!found.ok) return found.result;
  const host = context.step.host;
  const controller = context.machine?.env.controller ?? context.controller;
  const done: string[] = [];
  for (const id of found.ids) {
    const previous = controllerOf(context.room, host, id);
    if (!previous || previous === controller) continue;
    if (!host.setController(context.room, id, controller)) continue;
    done.push(id);
    pushEvent(context.step.events, {
      type: "gain_control",
      cardId: id,
      playerId: controller,
      data: { from: previous },
    });
  }
  recordOutcome(context, done, done.length > 0);
  return RESOLVED;
});

/** "Lose control of that unit": the card's owner controls it again. */
registerCustomEffect("sfd:release-control", (params, context) => {
  const found = targets(context, params.target as Selector);
  if (!found.ok) return found.result;
  const host = context.step.host;
  const done: string[] = [];
  for (const id of found.ids) {
    const located = locate(context.room, host, id);
    const owner = ownerOf(context.room, host, id);
    const current = controllerOf(context.room, host, id);
    if (!located || !owner || !current || owner === current) continue;
    if (!host.setController(context.room, id, owner)) continue;
    done.push(id);
    pushEvent(context.step.events, {
      type: "lose_control",
      cardId: id,
      playerId: current,
      data: { to: owner },
    });
  }
  recordOutcome(context, done, done.length > 0);
  return RESOLVED;
});

/**
 * Card Sharp: "you and each opponent may play a Gold gear token exhausted. For each opponent who
 * did, you play a Gold gear token exhausted." The controller decides first, then each opponent in
 * turn order is asked (383.3.a.3 / 445.2); tokens are created through the regular `create` op.
 */
registerCustomEffect("sfd:card-sharp", (params, context) => {
  const machine = context.machine;
  if (!machine) return RESOLVED;
  const env = machine.env;
  const host = context.step.host;
  const gold: Effect = { op: "create", token: token("Gold", { exhausted: true, play: true }) };
  const order = [
    env.controller,
    ...host.playerIds(context.room).filter((id) => id !== env.controller),
  ];
  const stateKey = "$card-sharp";
  const state = (env.vars[stateKey] as { next: number; did: string[] } | undefined) ?? {
    next: 0,
    did: [],
  };
  if (machine.frame.answer !== undefined) {
    const answer = machine.frame.answer;
    machine.frame.answer = undefined;
    const yes =
      answer === true || answer === "yes" || (Array.isArray(answer) && answer.includes("yes"));
    if (yes) state.did.push(order[state.next]!);
    state.next += 1;
  }
  env.vars[stateKey] = state as never;
  if (state.next < order.length) {
    const playerId = order[state.next]!;
    return machine.ask({
      kind: "yes-no",
      playerId,
      options: [
        { id: "yes", label: "Play a Gold gear token exhausted" },
        { id: "no", label: "No" },
      ],
      min: 1,
      max: 1,
      rule: "445.2",
      promptKey: "Play a Gold gear token exhausted?",
      data: { answer: "boolean" },
    });
  }
  const effects: Effect[] = [];
  for (const playerId of state.did) {
    if (playerId === env.controller) {
      effects.push(gold);
    } else {
      effects.push({ ...gold, player: { kind: "player", id: playerId } } as Effect, gold);
    }
  }
  if (effects.length > 0) machine.push({ effect: { op: "seq", effects } });
  return RESOLVED;
});

/**
 * "Reveal the top N cards of your Main Deck. You may banish one, then play it [, reducing its cost
 * by [R]]. Recycle (or draw) the rest." (425 reveal, 428 banish, 420.3 play, 417 recycle, 414
 * draw). The banished card is played with `sfd:play-card`; `location` is where a unit is played.
 */
registerCustomEffect("sfd:reveal-banish-play", (params, context) => {
  const machine = context.machine;
  if (!machine) return RESOLVED;
  const env = machine.env;
  const host = context.step.host;
  const ctx = ctxOf(context);
  const key = "$rbp";
  let ids = env.vars[key] as unknown as string[] | undefined;
  if (!ids) {
    const count = typeof params.reveal === "number" ? params.reveal : 2;
    ids = host.lookAtTop(context.room, env.controller, "deck", count).map((card) => card.id);
    if (ids.length === 0) return RESOLVED;
    env.vars[key] = ids as never;
    pushEvent(context.step.events, {
      type: "reveal",
      playerId: env.controller,
      data: { cardIds: ids },
    });
    return machine.ask({
      kind: "choose-card",
      playerId: env.controller,
      options: ids.map((id) => optionFor(ctx, id)),
      min: 0,
      max: 1,
      rule: "428",
      promptKey: "You may banish one, then play it",
      data: { answer: "objects" },
    });
  }
  const answer = machine.frame.answer;
  machine.frame.answer = undefined;
  delete env.vars[key];
  const chosen = (Array.isArray(answer) ? answer : [answer]).find(
    (id): id is string => typeof id === "string" && ids!.includes(id),
  );
  const rest = ids.filter((id) => id !== chosen);
  env.vars["rbp-rest"] = rest as never;
  const effects: Effect[] = [];
  if (chosen) {
    effects.push(
      { op: "banish", target: { targetRef: `obj:${chosen}` } },
      {
        op: "custom",
        id: "sfd:play-card",
        params: {
          target: { targetRef: `obj:${chosen}` },
          energy: typeof params.reduce === "number" ? params.reduce : 0,
          ...(params.location ? { location: params.location } : {}),
        },
      },
    );
  }
  if (rest.length > 0) {
    effects.push(
      params.rest === "draw"
        ? { op: "custom", id: "sfd:draw-ref", params: { ref: "rbp-rest" } }
        : { op: "recycle", target: { targetRef: "rbp-rest" } },
    );
  }
  if (effects.length > 0) machine.push({ effect: { op: "seq", effects } });
  return RESOLVED;
});

/**
 * Hostile Takeover: "Lose control of that unit and recall it at end of turn." A delayed trigger
 * (391.2) frozen to the unit bound to `ref`; the owner controls it again, then it is recalled
 * (Send it to base, 456-460; not a move).
 */
registerCustomEffect("sfd:release-at-end-of-turn", (params, context) => {
  const machine = context.machine;
  if (!machine) return RESOLVED;
  const ref = typeof params.ref === "string" ? params.ref : "it";
  const ids = refIds(ctxOf(context), ref);
  if (ids.length === 0) return RESOLVED;
  const target = { targetRef: `obj:${ids[0]}` };
  machine.push({
    effect: {
      op: "delayed",
      trigger: { kind: "turn-end" },
      once: true,
      effect: {
        op: "seq",
        effects: [
          { op: "custom", id: "sfd:release-control", params: { target } },
          { op: "recall", target },
        ],
      },
    },
  });
  return RESOLVED;
});

/** The source unit is part of the combat in progress ("while I'm in combat", 466). */
registerCustomCondition("sfd:self-in-combat", (ctx) => {
  const combat = ctx.room.rules?.combat;
  const source = ctx.env.sourceObjectId;
  if (!combat || !source) return false;
  return unitsPresentAt(ctx.room, ctx.host, combat.battlefield).some((card) => card.id === source);
});

/**
 * "Banish this" on a spell: the resolving spell leaves the chain for its owner's Banishment
 * instead of the trash (428.2; 359.3.e.15 — it finishes resolving).
 */
registerCustomEffect("sfd:banish-this-spell", (_params, context) => {
  const machine = context.machine;
  const itemId = machine?.env.itemId;
  if (!machine || !itemId) return RESOLVED;
  machine.push({ effect: { op: "banish", target: { targetRef: `obj:${itemId}` } } });
  return RESOLVED;
});
