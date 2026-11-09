/**
 * OGN set module: the set's custom conditions/effects (`ogn:` ids) and the builders its
 * cards share. Imported first by the set barrel.
 */
import type { Condition, Cost, Effect, Selector } from "@rift/protocol";
import {
  addContinuousEffect,
  aUnit,
  controllerOf,
  controlsBattlefield,
  costsOf,
  custom,
  evalContextOf,
  HERE,
  isBattlefieldZone,
  lkiOf,
  locate,
  locationOf,
  locationZones,
  matchingIds,
  mightOf,
  opponentsOf,
  optionFor,
  payCost,
  playersInTurnOrder,
  playerWins,
  pushEvent,
  recordOutcome,
  refIds,
  registerCustomCondition,
  registerCustomEffect,
  RESOLVED,
  targets,
  typeOf,
} from "../sdk";

/**
 * Players choose objects one after another and the picks are bound to `key` (355.18 picks, not
 * targets). `players`: "each" (Turn Order from the Turn Player, 303.2.a) or "others-from-next"
 * (every other player, starting with the player after the controller). `own`: each player picks
 * among objects they control. `distinct`: an object already picked cannot be picked again.
 */
registerCustomEffect("ogn:players-choose", (params, context) => {
  const machine = context.machine;
  if (!machine) return RESOLVED;
  const ctx = evalContextOf(context);
  const { room, host, env } = ctx;
  const key = String(params.key ?? "picked");
  const selector = (params.selector ?? {}) as Selector;
  const count = typeof params.count === "number" ? params.count : 1;
  const all = playersInTurnOrder(room, host);
  let order = all;
  if (params.players === "others-from-next") {
    const at = all.indexOf(env.controller);
    order = [...all.slice(at + 1), ...all.slice(0, Math.max(0, at))].filter(
      (id) => id !== env.controller,
    );
  }
  const picked = Array.isArray(env.vars[key]) ? [...(env.vars[key] as string[])] : [];
  const start =
    typeof machine.frame.data?.index === "number" ? (machine.frame.data.index as number) : 0;
  for (let index = start; index < order.length; index += 1) {
    const player = order[index]!;
    const pool = matchingIds(ctx, selector).filter(
      (id) =>
        (params.own !== true || controllerOf(room, host, id) === player) &&
        (params.distinct !== true || !picked.includes(id)),
    );
    const n = Math.min(count, pool.length);
    if (n === 0) continue;
    let chosen: string[];
    if (pool.length <= count) {
      chosen = pool;
    } else if (machine.frame.answer !== undefined && machine.frame.data?.index === index) {
      const answer = machine.frame.answer;
      chosen = (Array.isArray(answer) ? answer : [answer]).filter(
        (id): id is string => typeof id === "string" && pool.includes(id),
      );
      machine.frame.answer = undefined;
      if (chosen.length !== n) chosen = pool.slice(0, n);
    } else {
      machine.frame.data = { index };
      env.vars[key] = picked;
      return machine.ask({
        kind: "choose-card",
        playerId: player,
        options: pool.map((id) => optionFor(ctx, id)),
        min: n,
        max: n,
        rule: "355.18",
        promptKey: (params.label as string | undefined) ?? "rules.prompt.choose",
        data: { answer: "objects" },
      });
    }
    picked.push(...chosen);
    env.vars[key] = picked;
  }
  machine.frame.data = undefined;
  env.vars[key] = picked;
  recordOutcome(context, picked, picked.length > 0);
  return RESOLVED;
});

/** "Each player kills one of their <type>" (choose in Turn Order, then kill together). */
export function eachPlayerKillsOne(cardType: string): Effect {
  return {
    op: "seq",
    effects: [
      {
        op: "custom",
        id: "ogn:players-choose",
        params: { key: "doomed", selector: { cardType }, own: true, count: 1 },
      },
      { op: "kill", target: { targetRef: "doomed" } },
    ],
  };
}

/** The trigger event happened at a battlefield the ability's controller controls (190.2). */
registerCustomCondition("ogn:event-battlefield-yours", (ctx) => {
  const zone = ctx.env.event?.zone;
  if (!zone || !(ctx.host.battlefieldZones(ctx.room) as string[]).includes(zone)) return false;
  return controlsBattlefield(ctx.room, ctx.env.controller, zone, ctx.host);
});

/** The preceding channel instruction channelled fewer than `n` runes (431.3). */
registerCustomCondition("ogn:channelled-fewer-than", (ctx, params) => {
  const n = typeof params.n === "number" ? params.n : 1;
  const channelled = typeof ctx.env.vars.$channelled === "number" ? ctx.env.vars.$channelled : 0;
  return channelled < n;
});

/** Give the object bound to `target` +X Might this turn, X = Might(`from`) - Might(`target`), at least 0. */
registerCustomEffect("ogn:raise-might-to", (params, context) => {
  const machine = context.machine;
  if (!machine) return RESOLVED;
  const ctx = evalContextOf(context);
  const [target] = refIds(ctx, String(params.target));
  const [from] = refIds(ctx, String(params.from));
  if (!target || !from) return RESOLVED;
  const mine = mightOf(ctx, target);
  const theirs = mightOf(ctx, from);
  if (mine === null || theirs === null || theirs <= mine) return RESOLVED;
  machine.push({
    effect: {
      op: "temporary_might",
      amount: theirs - mine,
      target: { targetRef: `obj:${target}` },
    },
  });
  return RESOLVED;
});

/** The trigger event's card is the `n`-th card (1-based) its player played this turn. */
registerCustomCondition("ogn:nth-card-played", (ctx, params) => {
  const n = typeof params.n === "number" ? params.n : 1;
  const event = ctx.env.event;
  const player = event?.playerId ?? ctx.env.controller;
  const played = ctx.room.rules?.history.effects?.played?.[player] ?? [];
  return !!event?.cardId && played[n - 1] === event.cardId;
});

/** `it` is a unit at a battlefield or a gear. */
registerCustomCondition("ogn:unit-at-battlefield-or-gear", (ctx) => {
  const id = ctx.env.it;
  if (!id) return false;
  const type = typeOf(ctx.room, ctx.host, id);
  if (type.includes("gear")) return true;
  return (
    type.includes("unit") &&
    isBattlefieldZone(ctx.room, ctx.host, locationOf(ctx.room, ctx.host, id) ?? undefined)
  );
});

/** Bind the objects the previous instruction affected to `key` (e.g. the discarded card). */
registerCustomEffect("ogn:remember-affected", (params, context) => {
  const machine = context.machine;
  if (machine)
    machine.env.vars[String(params.key ?? "remembered")] = [
      ...((machine.env.vars.$affected as string[] | undefined) ?? []),
    ];
  return RESOLVED;
});

/** Deal the summed printed Energy cost of the cards bound to `ref` to "it" (418). */
registerCustomEffect("ogn:deal-energy-cost-of", (params, context) => {
  const machine = context.machine;
  if (!machine) return RESOLVED;
  const ctx = evalContextOf(context);
  const ids = refIds(ctx, String(params.ref ?? "remembered"));
  if (ids.length === 0 || !machine.env.it) return RESOLVED;
  const amount = ids.reduce((sum, id) => sum + (costsOf(ctx.room, ctx.host, id)?.energy ?? 0), 0);
  machine.push({ effect: { op: "deal", amount, target: { targetRef: "it" } }, it: machine.env.it });
  return RESOLVED;
});

/** Move the controller's Chosen Champion from their trash to their empty Champion Zone. */
registerCustomEffect("ogn:return-chosen-champion", (_params, context) => {
  const host = context.step.host;
  const player = context.machine?.env.controller ?? context.controller;
  if (host.zoneCards(context.room, player, "champion").length > 0) {
    recordOutcome(context, [], false);
    return RESOLVED;
  }
  const champion = host
    .zoneCards(context.room, player, "trash")
    .find((card) => card.source === "champion" && (card.ownerPlayerId ?? player) === player);
  if (!champion || !host.moveCardTo(context.room, player, "trash", "champion", champion.id)) {
    recordOutcome(context, [], false);
    return RESOLVED;
  }
  pushEvent(context.step.events, {
    type: "zone_move",
    cardId: champion.id,
    playerId: player,
    cardName: champion.name,
    zone: "champion",
    data: { from: "trash" },
  });
  recordOutcome(context, [champion.id], true);
  return RESOLVED;
});

/**
 * An opponent's score is within `n` points of the Victory Score (472). Like every other Victory
 * Score comparison in the engine it reads the host's Victory Score; `victoryScoreAdjustment` is
 * not added because it collects the very layers that evaluate this condition (478.1.c loop).
 */
registerCustomCondition("ogn:opponent-near-victory", (ctx, params) => {
  const n = typeof params.n === "number" ? params.n : 3;
  const victory = ctx.host.victoryScore(ctx.room);
  return opponentsOf(ctx.room, ctx.host, ctx.env.controller).some(
    (id) => victory - ctx.host.score(ctx.room, id) <= n,
  );
});

export const OPPONENT_WITHIN_3: Condition = {
  kind: "custom",
  id: "ogn:opponent-near-victory",
  params: { n: 3 },
};

registerCustomEffect("ogn:reveal-hand-discard-chosen", (_params, context) => {
  const machine = context.machine;
  if (!machine) return RESOLVED;
  const ctx = evalContextOf(context);
  const { room, host, env } = ctx;
  const data = machine.frame.data ?? {};
  let opponent = typeof data.opponent === "string" ? data.opponent : undefined;
  if (!opponent) {
    const opponents = opponentsOf(room, host, env.controller);
    if (opponents.length === 0) return RESOLVED;
    if (opponents.length === 1) opponent = opponents[0]!;
    else if (machine.frame.answer !== undefined) {
      const answer = machine.frame.answer;
      const id = Array.isArray(answer) ? answer[0] : answer;
      machine.frame.answer = undefined;
      opponent = typeof id === "string" && opponents.includes(id) ? id : opponents[0]!;
    } else {
      return machine.ask({
        kind: "choose-opponent",
        playerId: env.controller,
        options: opponents.map((id) => ({ id, playerId: id, label: host.playerName(room, id) })),
        min: 1,
        max: 1,
        rule: "355.7",
        promptKey: "rules.prompt.chooseOpponent",
        data: { answer: "objects" },
      });
    }
    // 425: they reveal their hand.
    for (const card of host.zoneCards(room, opponent, "hand")) {
      if (host.reveal(room, card.id))
        pushEvent(context.step.events, { type: "reveal", cardId: card.id, playerId: opponent });
    }
    machine.frame.data = { opponent };
  }
  const hand = host.zoneCards(room, opponent, "hand").map((card) => card.id);
  let chosen: string | undefined;
  if (hand.length === 0) {
    machine.frame.data = undefined;
    return RESOLVED;
  }
  if (hand.length === 1) chosen = hand[0];
  else if (machine.frame.answer !== undefined) {
    const answer = machine.frame.answer;
    const id = Array.isArray(answer) ? answer[0] : answer;
    machine.frame.answer = undefined;
    chosen = typeof id === "string" && hand.includes(id) ? id : hand[0];
  } else {
    return machine.ask({
      kind: "choose-card",
      playerId: env.controller,
      options: hand.map((id) => optionFor(ctx, id)),
      min: 1,
      max: 1,
      rule: "355.18",
      promptKey: "rules.prompt.chooseDiscard",
      data: { answer: "objects" },
    });
  }
  machine.frame.data = undefined;
  if (chosen && host.moveCardToOwnerZone(room, chosen, "trash")) {
    pushEvent(context.step.events, { type: "discard", cardId: chosen, playerId: opponent });
    recordOutcome(context, [chosen], true);
  }
  return RESOLVED;
});

/** 107.3 / 811: the controller has a facedown (hidden) card at a battlefield. */
registerCustomCondition("ogn:controls-facedown-at-battlefield", (ctx) =>
  ctx.host
    .battlefieldZones(ctx.room)
    .some((zone) =>
      ctx.host.zoneCards(ctx.room, ctx.env.controller, zone).some((card) => card.hidden === true),
    ),
);

registerCustomCondition("ogn:permanent-or-facedown", (ctx) => {
  const id = ctx.env.it;
  if (!id) return false;
  const located = locate(ctx.room, ctx.host, id);
  if (!located) return false;
  if (located.card.hidden) return true;
  const type = typeOf(ctx.room, ctx.host, id);
  return type.includes("unit") || type.includes("gear");
});

registerCustomEffect("ogn:party-favors", (_params, context) => {
  const machine = context.machine;
  if (!machine) return RESOLVED;
  const me = machine.env.controller;
  const others = opponentsOf(context.room, context.step.host, me);
  const vars = machine.env.vars;
  const answer = machine.frame.answer;
  if (answer !== undefined) {
    const pending = others.find((player) => vars[`favors:${player}`] === undefined);
    const choice = Array.isArray(answer) ? answer[0] : answer;
    if (pending) vars[`favors:${pending}`] = choice === "runes" ? "runes" : "cards";
    machine.frame.answer = undefined;
  }
  const next = others.find((player) => vars[`favors:${player}`] === undefined);
  if (next) {
    return machine.ask({
      kind: "choose-mode",
      playerId: next,
      options: [
        { id: "cards", label: "Cards" },
        { id: "runes", label: "Runes" },
      ],
      min: 1,
      max: 1,
      rule: "355.18",
      promptKey: "rules.prompt.cardsOrRunes",
      data: { answer: "options" },
    });
  }
  const frames: Array<{ effect: Effect }> = [];
  for (const player of others) {
    const pair = [me, player];
    for (const who of pair) {
      frames.push({
        effect:
          vars[`favors:${player}`] === "runes"
            ? { op: "channel", amount: 1, exhausted: true, player: { kind: "player", id: who } }
            : { op: "draw", amount: 1, player: { kind: "player", id: who } },
      });
    }
  }
  machine.push(...frames);
  return RESOLVED;
});

export function isYes(answer: unknown): boolean {
  if (answer === true || answer === "yes") return true;
  return Array.isArray(answer) && answer.includes("yes");
}

registerCustomEffect("ogn:unless-you-draw", (params, context) => {
  const machine = context.machine;
  if (!machine) return RESOLVED;
  const target = machine.env.it;
  if (!target) return RESOLVED;
  const amount = typeof params.amount === "number" ? params.amount : 0;
  const draw = typeof params.draw === "number" ? params.draw : 0;
  const answer = machine.frame.answer;
  if (answer === undefined) {
    const decider = controllerOf(context.room, context.step.host, target);
    if (!decider) return RESOLVED;
    return machine.ask({
      kind: "yes-no",
      playerId: decider,
      options: [
        { id: "yes", label: `Let them draw ${draw}` },
        { id: "no", label: `Take ${amount} damage` },
      ],
      min: 1,
      max: 1,
      rule: "355.18",
      promptKey: "rules.prompt.unlessDraw",
      data: { answer: "boolean" },
    });
  }
  machine.frame.answer = undefined;
  if (isYes(answer)) machine.push({ effect: { op: "draw", amount: draw } });
  else machine.push({ effect: { op: "deal", amount, target: { targetRef: "it" } } });
  return RESOLVED;
});

/** The kill event was caused by the ability's controller ("When you kill", 429.5). */
registerCustomCondition("ogn:killed-by-you", (ctx) => {
  const responsible = (ctx.env.event?.data ?? {}).responsible;
  return typeof responsible === "string" && responsible === ctx.env.controller;
});

registerCustomEffect("ogn:put-in-hand", (params, context) => {
  const found = targets(context, params.target as Selector);
  if (!found.ok) return found.result;
  const host = context.step.host;
  const done: string[] = [];
  for (const id of found.ids) {
    const located = locate(context.room, host, id);
    if (!located || located.zone === "hand") continue;
    if (!host.moveCardToOwnerZone(context.room, id, "hand")) continue;
    done.push(id);
    pushEvent(context.step.events, {
      type: "put_in_hand",
      cardId: id,
      playerId: located.card.ownerPlayerId ?? located.playerId,
      data: { from: located.zone },
    });
  }
  recordOutcome(context, done, done.length > 0);
  return RESOLVED;
});

/** The held event is the tie recall of the controller's attacker in the current combat's cleanup. */
registerCustomCondition("ogn:attacker-tie-recall", (ctx) => {
  const rules = ctx.room.rules;
  const combat = rules?.combat;
  const event = ctx.env.event;
  if (!rules || !combat || !event?.cardId) return false;
  if (combat.attacker !== ctx.env.controller) return false;
  if (controllerOf(ctx.room, ctx.host, event.cardId) !== ctx.env.controller) return false;
  if (locationOf(ctx.room, ctx.host, event.cardId) !== combat.battlefield) return false;
  return rules.history.combatProgress?.stage === "cleanup";
});

/** Candidate units for "all units at that battlefield" (the current combat's battlefield). */
registerCustomCondition("ogn:unit-at-combat-battlefield", (ctx) => {
  const combat = ctx.room.rules?.combat;
  const id = ctx.env.it;
  if (!combat || !id) return false;
  return locationOf(ctx.room, ctx.host, id) === combat.battlefield;
});

registerCustomEffect("ogn:reveal-top", (params, context) => {
  const machine = context.machine;
  if (!machine) return RESOLVED;
  const count = typeof params.count === "number" ? params.count : 1;
  const key = typeof params.key === "string" ? params.key : "revealed";
  const controller = machine.env.controller;
  const host = context.step.host;
  const cards = host.lookAtTop(context.room, controller, "deck", count).map((card) => card.id);
  for (const id of cards) {
    host.reveal(context.room, id);
    pushEvent(context.step.events, { type: "reveal", cardId: id, playerId: controller });
  }
  machine.env.vars[key] = cards;
  return RESOLVED;
});

registerCustomEffect("ogn:bind-zones", (params, context) => {
  const machine = context.machine;
  if (!machine) return RESOLVED;
  const key = typeof params.key === "string" ? params.key : "zones";
  const wanted = Array.isArray(params.zones)
    ? params.zones.filter((zone): zone is string => typeof zone === "string")
    : [];
  const zones = wanted.flatMap((zone) =>
    zone === "board" ? locationZones(context.room, context.step.host) : [zone],
  );
  machine.env.vars[key] = zones;
  return RESOLVED;
});

registerCustomEffect("ogn:win-game", (_params, context) => {
  playerWins(context.room, context.machine?.env.controller ?? context.controller, context.step);
  return RESOLVED;
});

registerCustomEffect("ogn:pay-printed-cost", (params, context) => {
  const found = targets(context, params.target as Selector);
  if (!found.ok) return found.result;
  const id = found.ids[0];
  if (!id) {
    recordOutcome(context, [], false);
    return RESOLVED;
  }
  const info = context.step.host.cardInfo(context.room, id);
  const reduction = typeof params.energyReduction === "number" ? params.energyReduction : 0;
  const energy =
    params.ignoreEnergy === true ? 0 : Math.max(0, (info?.energyCost ?? 0) - reduction);
  const power = info?.powerCost ?? 0;
  const cost: Cost = {
    ...(energy > 0 ? { energy } : {}),
    ...(power > 0 ? { additional: { "power:self": power } } : {}),
  };
  const controller = context.machine?.env.controller ?? context.controller;
  const verdict =
    Object.keys(cost).length === 0
      ? { ok: true }
      : payCost(context.room, context.step, controller, cost, { sourceObjectId: id });
  recordOutcome(context, verdict.ok ? [id] : [], verdict.ok);
  return RESOLVED;
});

/** "Play the picked unit (bound to `key`), ignoring its Energy cost / reducing it." */
export function playPickedUnit(
  key: string,
  payment: { ignoreEnergy?: boolean; energyReduction?: number },
): Effect {
  return {
    op: "seq",
    effects: [
      {
        op: "custom" as const,
        id: "ogn:pay-printed-cost",
        params: { target: { targetRef: key }, ...payment },
      },
      {
        op: "if" as const,
        condition: { kind: "did" },
        then: { op: "play" as const, target: { targetRef: key }, cost: "ignored" as const },
      },
    ],
  };
}

export const BY_DOMAIN: Record<string, Effect> = {
  Fury: {
    op: "seq",
    effects: [
      {
        op: "deal",
        amount: 2,
        target: aUnit({ controller: "opponent", zone: HERE, targetRef: "tf:primary" }),
      },
      {
        op: "deal",
        amount: 1,
        target: {
          cardType: "unit",
          controller: "opponent",
          zone: HERE,
          excludeRefs: ["tf:primary"],
        },
      },
    ],
  },
  Mind: { op: "draw", amount: 1 },
  Order: { op: "stun", target: aUnit({ controller: "opponent", targetRef: "tf:stunned" }) },
};

registerCustomEffect("ogn:twisted-fate", (_params, context) => {
  const machine = context.machine;
  if (!machine) return RESOLVED;
  const host = context.step.host;
  const controller = machine.env.controller;
  const [rune] = host.lookAtTop(context.room, controller, "runeDeck", 1);
  if (!rune) return RESOLVED;
  host.reveal(context.room, rune.id);
  pushEvent(context.step.events, { type: "reveal", cardId: rune.id, playerId: controller });
  const domain = host.cardInfo(context.room, rune.id)?.domains?.[0] ?? "";
  if (host.moveCardToOwnerZone(context.room, rune.id, "runeDeck", "bottom")) {
    pushEvent(context.step.events, {
      type: "recycle",
      cardId: rune.id,
      playerId: controller,
      zone: "runeDeck",
      data: { from: "runeDeck" },
    });
  }
  const effect = BY_DOMAIN[domain];
  if (effect) machine.push({ effect });
  return RESOLVED;
});

registerCustomCondition("ogn:noncombat-damage", (ctx) => ctx.env.event?.data?.combat !== true);

registerCustomEffect("ogn:prevent-noncombat-damage-this-turn", (_params, context) => {
  const env = context.machine?.env;
  const controller = env?.controller ?? context.controller;
  const id = addContinuousEffect(context.room, context.step.host, {
    controller,
    duration: "this-turn",
    modifier: {
      kind: "custom",
      id: "replacement",
      params: {
        matches: { type: "damage", condition: custom("ogn:noncombat-damage") },
        replace: { prevent: Number.MAX_SAFE_INTEGER },
        once: false,
      },
    },
    ...(env?.sourceObjectId ? { sourceObjectId: env.sourceObjectId } : {}),
  });
  pushEvent(context.step.events, {
    type: "replacement_created",
    playerId: controller,
    data: { effectId: id },
  });
  recordOutcome(context, [], true);
  return RESOLVED;
});

registerCustomEffect("ogn:each-player-may-return", (_params, context) => {
  const machine = context.machine;
  if (!machine) return RESOLVED;
  const order = playersInTurnOrder(context.room, context.step.host);
  const me = machine.env.controller;
  const start = order.indexOf(me);
  const sequence = start < 0 ? order : [...order.slice(start + 1), ...order.slice(0, start + 1)];
  const frames: Array<{ effect: Effect }> = [];
  for (const player of sequence) {
    const key = `whirlwind:${player}`;
    frames.push({
      effect: {
        op: "choose",
        key,
        selector: { cardType: "unit" },
        min: 0,
        max: 1,
        chooser: { kind: "player", id: player },
        label: "rules.prompt.mayReturnUnit",
      },
    });
    frames.push({ effect: { op: "return_to_hand", target: { targetRef: key } } });
  }
  machine.push(...frames);
  return RESOLVED;
});

registerCustomEffect("ogn:move-to-location-of", (params, context) => {
  const machine = context.machine;
  if (!machine) return RESOLVED;
  const ref = typeof params.of === "string" ? params.of : "target:0";
  const ctx = { room: context.room, host: context.step.host, env: machine.env };
  const [other] = refIds(ctx, ref);
  const zone = other
    ? (locationOf(context.room, context.step.host, other) ?? lkiOf(machine.env, other)?.zone)
    : null;
  if (!zone) return RESOLVED;
  machine.push({ effect: { op: "move", target: { targetRef: "it" }, to: zone as "battlefieldA" } });
  return RESOLVED;
});
