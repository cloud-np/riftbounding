/**
 * RAD set module: the set's custom conditions/effects (`rad:` ids) and the builders its
 * cards share. Imported first by the set barrel.
 */
import type {
  Amount,
  CardInstance,
  Condition,
  Effect,
  PlayerSelector,
  Room,
  Selector,
  ZoneSelector,
} from "@rift/protocol";
import type { EvalContext, RulesHost } from "../sdk";
import {
  addContinuousEffect,
  battlefieldController,
  battlefieldZoneOf,
  compare,
  costsOf,
  ctxOf,
  custom,
  effectiveKeywordValues,
  evaluateAmount,
  HERE,
  hostOf,
  isBattlefieldZone,
  lkiOf,
  locate,
  locationOf,
  mightOf,
  pushEvent,
  recordOutcome,
  refIds,
  registerCustomCondition,
  registerCustomEffect,
  registerPlayPermission,
  RESOLVED,
  resolvePlayers,
  resolveSelector,
  token,
  typeOf,
  unitsPresentAt,
  WHEN_I_HOLD,
} from "../sdk";

export function playBombs(count: number, ref = "bomb"): Effect {
  return {
    op: "create",
    token: token("Bomb", { ...(count > 1 ? { count } : {}), play: true }),
    zone: zoneRef(ref),
  };
}

export function zoneOfRef(ctx: EvalContext, ref: string | undefined): string | null {
  if (!ref) return null;
  const value = ref in ctx.env.vars ? ctx.env.vars[ref] : ctx.env.choices[ref];
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string") return null;
  return battlefieldZoneOf(raw) ?? raw;
}

/** The zone a battlefield-or-object candidate stands for (`it` = `battlefield:<zone>`). */
export function itZone(ctx: EvalContext): string | null {
  const it = ctx.env.it;
  if (!it) return null;
  return battlefieldZoneOf(it) ?? locationOf(ctx.room, ctx.host, it);
}

export function marks(room: Room): Record<string, unknown> {
  const rules = room.rules;
  if (!rules) return {};
  const history = (rules.history.effects ??= {});
  return (history.marks ??= {}) as Record<string, unknown>;
}

export function markKey(ctx: EvalContext, key: unknown): string {
  return `${String(key ?? "")}`.replace("{self}", ctx.env.sourceObjectId ?? "");
}

/** 170.11.c: open = unoccupied (no face-up Unit, 107.3) and uncontrolled (190.2). */
export function battlefieldOpen(room: Room, host: RulesHost, zone: string): boolean {
  if (!isBattlefieldZone(room, host, zone)) return false;
  return (
    unitsPresentAt(room, host, zone).length === 0 &&
    battlefieldController(room, zone, host) === null
  );
}

/** 170.11.a + 740.1: occupied by a unit of an opponent of `player`. */
export function enemyOccupied(room: Room, host: RulesHost, zone: string, player: string): boolean {
  if (!isBattlefieldZone(room, host, zone)) return false;
  return unitsPresentAt(room, host, zone).some(
    (card) => (host.findCard(room, card.id)?.playerId ?? null) !== player,
  );
}

/** The trigger event's `amount` compared with `value` (e.g. "reduce the Might … by 1 or more"). */
registerCustomCondition("rad:event-amount", (ctx, params) => {
  const amount = ctx.env.event?.amount;
  if (typeof amount !== "number") return false;
  const value = typeof params.value === "number" ? params.value : 0;
  return compare(amount, (params.op as Parameters<typeof compare>[1]) ?? "gte", value);
});

/** The trigger event's subject was not a token (185; the kill event notes `data.token`). */
registerCustomCondition("rad:event-not-token", (ctx) => ctx.env.event?.data?.token !== true);

/** `it` is a unit or a gear (permanents, 141). */
registerCustomCondition("rad:unit-or-gear", (ctx) => {
  const it = ctx.env.it;
  if (!it) return false;
  const type = typeOf(ctx.room, ctx.host, it);
  return type.includes("unit") || type.includes("gear");
});

/** `it` is face up (107.3: a facedown card is not a unit/gear at the location). */
registerCustomCondition("rad:face-up", (ctx) => {
  const it = ctx.env.it;
  return !!it && locate(ctx.room, ctx.host, it)?.card.hidden !== true;
});

/** The zone bound to `ref` (or `it`) is a battlefield (355.4 destination "to a battlefield"). */
registerCustomCondition("rad:zone-is-battlefield", (ctx, params) => {
  const zone = typeof params.ref === "string" ? zoneOfRef(ctx, params.ref) : itZone(ctx);
  return !!zone && isBattlefieldZone(ctx.room, ctx.host, zone);
});

/** 170.11.c: the battlefield bound to `ref` (or `it`) is open. */
registerCustomCondition("rad:zone-open", (ctx, params) => {
  const zone = typeof params.ref === "string" ? zoneOfRef(ctx, params.ref) : itZone(ctx);
  return !!zone && battlefieldOpen(ctx.room, ctx.host, zone);
});

/** 170.11.c: no battlefield is open. */
registerCustomCondition(
  "rad:no-open-battlefield",
  (ctx) =>
    !(ctx.host.battlefieldZones(ctx.room) as string[]).some((zone) =>
      battlefieldOpen(ctx.room, ctx.host, zone),
    ),
);

/** 170.11.a / 740.1: the battlefield bound to `ref` (or `it`) is occupied by an enemy unit. */
registerCustomCondition("rad:zone-enemy-occupied", (ctx, params) => {
  const zone = typeof params.ref === "string" ? zoneOfRef(ctx, params.ref) : itZone(ctx);
  return !!zone && enemyOccupied(ctx.room, ctx.host, zone, ctx.env.controller);
});

/** 323.2: `it` currently holds the Attacker designation. */
registerCustomCondition("rad:is-attacker", (ctx) => {
  const it = ctx.env.it;
  return !!it && ctx.room.rules?.objects[it]?.designation === "attacker";
});

/** `it` moved this turn (421; `movedThisTurn` is set by the move action and cleared each turn). */
registerCustomCondition("rad:moved-this-turn", (ctx) => {
  const it = ctx.env.it;
  return !!it && ctx.room.rules?.objects[it]?.movedThisTurn === true;
});

/** 107.3: the controller has a facedown card at the source's location ("a facedown card here"). */
registerCustomCondition("rad:facedown-here", (ctx) => {
  const source = ctx.env.sourceObjectId;
  const zone = source ? locationOf(ctx.room, ctx.host, source) : null;
  if (!zone || !isBattlefieldZone(ctx.room, ctx.host, zone)) return false;
  return ctx.host
    .zoneCards(ctx.room, ctx.env.controller, zone)
    .some((card) => card.hidden === true);
});

/** 811.1.b / 811.6: the resolving spell was played from face down (its chain item records it). */
registerCustomCondition("rad:played-from-facedown", (ctx) => {
  const itemId = ctx.env.itemId;
  const item = itemId ? ctx.room.rules?.chain.find((entry) => entry.id === itemId) : undefined;
  return !!item?.playedFromFacedown;
});

/** 190.2.b: the controller controls the battlefield the source is at ("if you control this battlefield"). */
registerCustomCondition("rad:control-here", (ctx) => {
  const source = ctx.env.sourceObjectId;
  const zone = source ? locationOf(ctx.room, ctx.host, source) : null;
  if (!zone || !isBattlefieldZone(ctx.room, ctx.host, zone)) return false;
  return battlefieldController(ctx.room, zone, ctx.host) === ctx.env.controller;
});

/** The event's unit has more Might than each other unit on the board (143.2). */
registerCustomCondition("rad:event-unit-mightiest", (ctx) => {
  const subject = ctx.env.event?.cardId;
  if (!subject) return false;
  const mine = mightOf(ctx, subject);
  if (mine === null) return false;
  for (const zone of ["base", ...(ctx.host.battlefieldZones(ctx.room) as string[])]) {
    for (const card of unitsPresentAt(ctx.room, ctx.host, zone)) {
      if (card.id === subject) continue;
      if ((mightOf(ctx, card.id) ?? 0) >= mine) return false;
    }
  }
  return true;
});

/** The event's player had at least `n` other cards in hand when drawing (`amount` cards drawn). */
registerCustomCondition("rad:other-cards-in-hand-gte", (ctx, params) => {
  const event = ctx.env.event;
  if (!event?.playerId) return false;
  const n = typeof params.n === "number" ? params.n : 0;
  const drawn = typeof event.amount === "number" ? event.amount : 0;
  return ctx.host.zoneCards(ctx.room, event.playerId, "hand").length - drawn >= n;
});

/** Per-player "first time each turn": no marker `key` for the event's player yet. */
registerCustomCondition("rad:event-player-unmarked", (ctx, params) => {
  const player = ctx.env.event?.playerId;
  if (!player) return false;
  return marks(ctx.room)[`${markKey(ctx, params.key)}:${player}`] === undefined;
});

/** 369.3 / 356.4.f.1: this permanent was played paying an optional additional cost. */
registerCustomCondition("rad:paid-additional-self", (ctx) => {
  const source = ctx.env.sourceObjectId;
  return !!source && ctx.room.rules?.objects[source]?.paidAdditionalCost === true;
});

/**
 * Akali, Brash (RAD-015): "the first/second time I move each turn" — the source's move count
 * this turn is kept in the per-turn marks (383.1.b: a per-turn ordinal, not a trigger limit).
 */
export function moveCount(room: Room, source: string): number {
  const value = marks(room)[`rad:moves:${source}`];
  return typeof value === "number" ? value : 0;
}

registerCustomCondition("rad:move-count-lt", (ctx, params) => {
  const source = ctx.env.sourceObjectId;
  if (!source) return false;
  const limit = typeof params.n === "number" ? params.n : 2;
  return moveCount(ctx.room, source) < limit;
});

/** Marks the event's player for `key` this turn (per-player "first time each turn"). */
registerCustomEffect("rad:mark-event-player", (params, context) => {
  const ctx = ctxOf(context);
  const player = ctx.env.event?.playerId;
  if (player) marks(context.room)[`${markKey(ctx, params.key)}:${player}`] = true;
  return RESOLVED;
});

/** A computed amount that the DSL's `Amount` cannot express. */
export type RadAmount =
  | { amount: Amount }
  | { keywordValue: string; of: Selector }
  | { energyCostOf: Selector }
  | { lkiMightOf: string };

export function evaluateRadAmount(ctx: EvalContext, spec: RadAmount): number | null {
  if ("amount" in spec) return evaluateAmount(ctx, spec.amount);
  if ("keywordValue" in spec) {
    // 807.2 / 814.2 / 831.2: the summed value of the keyword's instances.
    const ids = resolveSelector(ctx, spec.of);
    if (ids.length === 0) return null;
    return ids.reduce(
      (sum, id) =>
        sum +
        (effectiveKeywordValues(ctx.room, id, ctx.host)[spec.keywordValue.toLowerCase()] ?? 0),
      0,
    );
  }
  if ("energyCostOf" in spec) {
    const ids = resolveSelector(ctx, spec.energyCostOf);
    if (ids.length === 0) return null;
    let total = 0;
    for (const id of ids) {
      const costs = costsOf(ctx.room, ctx.host, id);
      if (!costs) return null;
      total += costs.energy;
    }
    return total;
  }
  // 359.3.e.13: the Might the object had when it was last on the board.
  const [id] = refIds(ctx, spec.lkiMightOf);
  if (!id) return null;
  const known = lkiOf(ctx.env, id)?.might;
  if (typeof known === "number") return Math.max(0, known);
  return mightOf(ctx, id);
}

export function substitute(node: unknown, value: number): unknown {
  if (node === "$X") return value;
  if (typeof node === "string") return node.split("{X}").join(String(value));
  if (Array.isArray(node)) return node.map((entry) => substitute(entry, value));
  if (node && typeof node === "object") {
    const record = node as Record<string, unknown>;
    if (record.kind === "x" && Object.keys(record).length === 1) return value;
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(record)) out[key] = substitute(entry, value);
    return out;
  }
  return node;
}

/**
 * "… equal to <computed value>": evaluates `amount` on execution (359.3.f.2) and runs `effect`
 * with the value substituted for `{ kind: "x" }`, `"$X"` and `"{X}"`. Unavailable information
 * ignores the instruction (359.3.e.12). The inner effect is not scanned for play-time choices,
 * so its targets must be references bound elsewhere (e.g. an enclosing `for_each` → "it").
 */
registerCustomEffect("rad:let-x", (params, context) => {
  const machine = context.machine;
  if (!machine) return RESOLVED;
  const value = evaluateRadAmount(ctxOf(context), params.amount as RadAmount);
  if (value === null) {
    recordOutcome(context, [], false);
    return RESOLVED;
  }
  machine.push({ effect: substitute(params.effect, Math.trunc(value)) as Effect });
  return RESOLVED;
});

/** 425: reveal the top card of each player's Main Deck (`player`); binds them to `key`. */
registerCustomEffect("rad:reveal-top-each", (params, context) => {
  const host = hostOf(context);
  const ctx = ctxOf(context);
  const revealed: string[] = [];
  for (const playerId of resolvePlayers(ctx, params.player as PlayerSelector | undefined)) {
    const top = host.lookAtTop(context.room, playerId, "deck", 1)[0];
    if (!top) continue;
    host.reveal(context.room, top.id);
    revealed.push(top.id);
    pushEvent(context.step.events, {
      type: "reveal",
      cardId: top.id,
      playerId: ctx.env.controller,
      data: { owner: playerId },
    });
  }
  if (context.machine) context.machine.env.vars[String(params.key ?? "revealed")] = revealed;
  recordOutcome(context, revealed, revealed.length > 0);
  return RESOLVED;
});

/**
 * Mechanical Bandit (RAD-111): each player reveals the top card of their Main Deck (425); if
 * yours has the lowest Energy cost (ties included), draw it; recycle the rest (417).
 */
registerCustomEffect("rad:mechanical-bandit", (_params, context) => {
  const host = hostOf(context);
  const ctx = ctxOf(context);
  const tops: Array<{ playerId: string; card: CardInstance; energy: number }> = [];
  for (const playerId of resolvePlayers(ctx, "each")) {
    const card = host.lookAtTop(context.room, playerId, "deck", 1)[0];
    if (!card) continue;
    host.reveal(context.room, card.id);
    pushEvent(context.step.events, { type: "reveal", cardId: card.id, playerId });
    tops.push({ playerId, card, energy: costsOf(context.room, host, card.id)?.energy ?? 0 });
  }
  const lowest = Math.min(...tops.map((entry) => entry.energy));
  for (const entry of tops) {
    if (entry.playerId === ctx.env.controller && entry.energy === lowest) {
      if (host.moveCardTo(context.room, entry.playerId, "deck", "hand", entry.card.id)) {
        pushEvent(context.step.events, {
          type: "draw",
          playerId: entry.playerId,
          amount: 1,
          data: { cardIds: [entry.card.id] },
        });
      }
      continue;
    }
    if (host.moveCardToOwnerZone(context.room, entry.card.id, "deck", "bottom")) {
      pushEvent(context.step.events, {
        type: "recycle",
        cardId: entry.card.id,
        playerId: entry.playerId,
        zone: "deck",
        data: { from: "deck" },
      });
    }
  }
  return RESOLVED;
});

export const CARD_TYPES = ["unit", "gear", "spell"] as const;

/**
 * Scrutinizing Scope (RAD-064): the chosen opponent guesses a card type (a decision of theirs,
 * 355.18); reveal the top card of your Main Deck; recycle it if it has that type, else draw it.
 */
registerCustomEffect("rad:scope-guess", (params, context) => {
  const machine = context.machine;
  if (!machine) return RESOLVED;
  const host = hostOf(context);
  const ctx = ctxOf(context);
  const guesser = resolvePlayers(
    ctx,
    (params.player as PlayerSelector | undefined) ?? "opponent",
  )[0];
  if (!guesser) return RESOLVED;
  const answer = machine.frame.answer;
  if (answer === undefined) {
    return machine.ask({
      kind: "choose-mode",
      playerId: guesser,
      options: CARD_TYPES.map((type) => ({ id: type, label: type })),
      min: 1,
      max: 1,
      rule: "355.18",
      promptKey: "rules.prompt.guessCardType",
      data: { answer: "options" },
    });
  }
  machine.frame.answer = undefined;
  const guess = (Array.isArray(answer) ? answer[0] : answer) as string;
  const top = host.lookAtTop(context.room, ctx.env.controller, "deck", 1)[0];
  if (!top) return RESOLVED;
  host.reveal(context.room, top.id);
  pushEvent(context.step.events, {
    type: "reveal",
    cardId: top.id,
    playerId: ctx.env.controller,
    data: { guess },
  });
  if (typeOf(context.room, host, top.id).includes(String(guess))) {
    if (host.moveCardToOwnerZone(context.room, top.id, "deck", "bottom")) {
      pushEvent(context.step.events, {
        type: "recycle",
        cardId: top.id,
        playerId: ctx.env.controller,
        zone: "deck",
        data: { from: "deck" },
      });
    }
  } else if (host.moveCardTo(context.room, ctx.env.controller, "deck", "hand", top.id)) {
    pushEvent(context.step.events, {
      type: "draw",
      playerId: ctx.env.controller,
      amount: 1,
      data: { cardIds: [top.id] },
    });
  }
  return RESOLVED;
});

export const LINK = "rad:link";

/**
 * Linked abilities (one ability refers to what another did, e.g. "the banished card"): remember
 * the referenced cards for this source object under `key`. Stored as a permanent continuous
 * effect (it carries no modifier the layers read); tokens are not cards (185) and are skipped.
 */
registerCustomEffect("rad:link-cards", (params, context) => {
  const host = hostOf(context);
  const ctx = ctxOf(context);
  const source = ctx.env.sourceObjectId;
  if (!source) return RESOLVED;
  const ids = refIds(ctx, String(params.ref ?? "it")).filter((id) => {
    const located = locate(context.room, host, id);
    return !!located && located.card.source !== "token";
  });
  if (ids.length === 0) return RESOLVED;
  addContinuousEffect(context.room, host, {
    controller: ctx.env.controller,
    duration: "permanent",
    modifier: {
      kind: "custom",
      id: LINK,
      params: { key: String(params.key ?? ""), source, cardIds: ids },
    },
    sourceObjectId: source,
  });
  return RESOLVED;
});

/** Binds the cards linked to this source under `key` to the variable `as`. */
registerCustomEffect("rad:bind-linked", (params, context) => {
  const ctx = ctxOf(context);
  const source = ctx.env.sourceObjectId;
  const ids: string[] = [];
  for (const effect of context.room.rules?.effects ?? []) {
    const modifier = effect.modifier;
    if (modifier.kind !== "custom" || modifier.id !== LINK) continue;
    if (modifier.params?.source !== source || modifier.params?.key !== params.key) continue;
    for (const id of (modifier.params?.cardIds as string[] | undefined) ?? []) ids.push(id);
  }
  if (context.machine) context.machine.env.vars[String(params.as ?? "linked")] = ids;
  return RESOLVED;
});

export const MAY_PLAY = "rad:may-play";

/** The turn number of `player`'s next Ending Phase (317) seen from now. */
export function nextEndingTurn(room: Room, host: RulesHost, player: string): number {
  const rules = room.rules!;
  const now = rules.turn.number;
  if (rules.turn.player === player && rules.turn.phase !== "ending") return now;
  const order = host.turnOrder(room);
  const current = order.indexOf(rules.turn.player);
  const mine = order.indexOf(player);
  if (current < 0 || mine < 0) return now;
  return now + ((mine - current + order.length) % order.length || order.length);
}

/**
 * "Until your next Ending Phase, you may play that card. (You still pay its costs.)" — a play
 * permission from Banishment (354 / 420.1.a) for the referenced cards, read by the provider below.
 */
registerCustomEffect("rad:may-play-until-ending", (params, context) => {
  const host = hostOf(context);
  const ctx = ctxOf(context);
  const ids = refIds(ctx, String(params.ref ?? "it"));
  if (ids.length === 0) return RESOLVED;
  addContinuousEffect(context.room, host, {
    controller: ctx.env.controller,
    duration: "permanent",
    modifier: {
      kind: "custom",
      id: MAY_PLAY,
      params: { cardIds: ids, untilTurn: nextEndingTurn(context.room, host, ctx.env.controller) },
    },
    ...(ctx.env.sourceObjectId ? { sourceObjectId: ctx.env.sourceObjectId } : {}),
  });
  return RESOLVED;
});

registerPlayPermission((room, _host, query) => {
  const rules = room.rules;
  if (!rules || query.zone !== "banished") return null;
  for (const effect of rules.effects) {
    const modifier = effect.modifier;
    if (
      modifier.kind !== "custom" ||
      modifier.id !== MAY_PLAY ||
      effect.controller !== query.playerId
    )
      continue;
    const params = modifier.params ?? {};
    const ids = Array.isArray(params.cardIds) ? params.cardIds : [];
    if (!ids.includes(query.card.id)) continue;
    const until = typeof params.untilTurn === "number" ? params.untilTurn : -1;
    const now = rules.turn.number;
    if (now > until || (now === until && rules.turn.phase === "ending")) continue;
    return { id: MAY_PLAY, rule: "420.1.a" };
  }
  return null;
});

/**
 * Akali, Brash (RAD-015): the first move each turn Adds [1][Rune]; the second banishes the top
 * card of the Main Deck and grants "until your next Ending Phase, you may play that card"
 * (420.1.a). Ordinal tracked in the per-turn marks; later moves do nothing.
 */
registerCustomEffect("rad:akali-move", (_params, context) => {
  const machine = context.machine;
  const ctx = ctxOf(context);
  const source = ctx.env.sourceObjectId;
  if (!machine || !source) return RESOLVED;
  const key = `rad:moves:${source}`;
  const count = moveCount(context.room, source);
  marks(context.room)[key] = count + 1;
  if (count === 0) {
    machine.push({ effect: { op: "add", resources: { energy: 1, power: { any: 1 } } } });
  } else if (count === 1) {
    machine.push({
      effect: {
        op: "look",
        amount: 1,
        then: {
          op: "seq",
          effects: [
            { op: "banish", target: { targetRef: "looked" } },
            { op: "custom", id: "rad:may-play-until-ending", params: { ref: "looked" } },
          ],
        },
      },
    });
  }
  return RESOLVED;
});

/**
 * Seraphic Wyvern (RAD-092): "If you would channel runes, channel that many runes plus 1
 * exhausted rune instead." Replaces the proposed `channel` (431): the original count first
 * (ready unless the effect said otherwise), then one exhausted rune.
 */
registerCustomEffect("rad:channel-plus-one", (_params, context) => {
  const machine = context.machine;
  const ctx = ctxOf(context);
  if (!machine) return RESOLVED;
  const base = typeof ctx.env.event?.amount === "number" ? ctx.env.event.amount : 0;
  machine.push({
    effect: {
      op: "seq",
      effects: [
        ...(base > 0 ? [{ op: "channel" as const, amount: base }] : []),
        { op: "channel" as const, amount: 1, exhausted: true },
      ],
    },
  });
  return RESOLVED;
});

/** Fanfare (RAD-047): fewer than three unit plays have been counted for this source this turn. */
export function fanfareCount(room: Room, source: string): number {
  const value = marks(room)[`rad:fanfare:${source}`];
  return typeof value === "number" ? value : 0;
}

registerCustomCondition("rad:fanfare-pending", (ctx) => {
  const source = ctx.env.sourceObjectId;
  return !!source && fanfareCount(ctx.room, source) < 3;
});

/** Fanfare: count the unit play and draw 1 (the delayed trigger stops after three). */
registerCustomEffect("rad:fanfare-draw", (_params, context) => {
  const machine = context.machine;
  const ctx = ctxOf(context);
  const source = ctx.env.sourceObjectId;
  if (!machine || !source) return RESOLVED;
  const count = fanfareCount(context.room, source);
  if (count >= 3) return RESOLVED;
  marks(context.room)[`rad:fanfare:${source}`] = count + 1;
  machine.push({ effect: { op: "draw", amount: 1 } });
  return RESOLVED;
});

/**
 * "Kill that unit at end of turn": created by a delayed "next unit you play" trigger (390–393);
 * the unit is frozen to `obj:<id>` so the turn-end trigger can still find it.
 */
registerCustomEffect("rad:delayed-kill-event", (_params, context) => {
  const ctx = ctxOf(context);
  const id = ctx.env.event?.cardId;
  if (!id) return RESOLVED;
  addContinuousEffect(context.room, hostOf(context), {
    controller: ctx.env.controller,
    duration: "this-turn",
    modifier: {
      kind: "custom",
      id: "delayed-trigger",
      params: {
        trigger: { kind: "turn-end" },
        effect: { op: "kill", target: { targetRef: `obj:${id}` } },
        once: true,
        choices: {},
      },
    },
    ...(ctx.env.sourceObjectId ? { sourceObjectId: ctx.env.sourceObjectId } : {}),
  });
  pushEvent(context.step.events, {
    type: "delayed_created",
    playerId: ctx.env.controller,
    data: { rule: "391.2" },
  });
  return RESOLVED;
});

/**
 * "Choose two —" (Encore, RAD-152; 355.3): a resolution-time multi-mode choice. The engine's
 * `requiredChoices` only asks one mode on play, so this card-specific op asks for exactly `min`
 * modes on resolution and runs each chosen mode (a partial: mode/target timing, see the lane doc).
 */
registerCustomEffect("rad:choose-modes", (params, context) => {
  const machine = context.machine;
  if (!machine) return RESOLVED;
  const ctx = ctxOf(context);
  const modes =
    (params.modes as Array<{ id: string; label?: string; effect: Effect }> | undefined) ?? [];
  const min = typeof params.min === "number" ? params.min : 1;
  const max = typeof params.max === "number" ? params.max : min;
  const answer = machine.frame.answer;
  if (answer === undefined) {
    return machine.ask({
      kind: "choose-mode",
      playerId: ctx.env.controller,
      options: modes.map((mode) => ({ id: mode.id, ...(mode.label ? { label: mode.label } : {}) })),
      min,
      max,
      rule: String(params.rule ?? "355.3"),
      promptKey: String(params.promptKey ?? "rules.prompt.chooseModes"),
      data: { answer: "options" },
    });
  }
  machine.frame.answer = undefined;
  const picked = Array.isArray(answer)
    ? answer.filter((entry): entry is string => typeof entry === "string")
    : typeof answer === "string"
      ? [answer]
      : [];
  machine.push(
    ...modes.filter((mode) => picked.includes(mode.id)).map((mode) => ({ effect: mode.effect })),
  );
  return RESOLVED;
});

/** A zone bound to a choice/variable key (a chosen battlefield's id resolves to its zone). */
export function zoneRef(ref: string): ZoneSelector {
  return { kind: "chosen", ref };
}

/** "Choose a battlefield" — a battlefield target (355.7; battlefields are objects, 053.3). */
export function aBattlefield(ref: string, extra: Partial<Selector> = {}): Selector {
  return { chosen: true, cardType: "battlefield", targetRef: ref, ...extra };
}

/** `it` is a face-up unit or gear (107.3: a facedown card is neither). */
export const UNIT_OR_GEAR: Condition = {
  kind: "and",
  conditions: [custom("rad:unit-or-gear"), custom("rad:face-up")],
};

/** "… equal to <value>": run `effect` with the value substituted for `{kind:"x"}` / "$X" / "{X}". */
export function letX(amount: RadAmount, effect: Effect): Effect {
  return { op: "custom", id: "rad:let-x", params: { amount, effect } };
}

/**
 * "Choose an opponent" (355.7: a player target, chosen when the ability is played) for abilities
 * whose later instructions read `{ kind: "chosen", ref: "opponent" }` from a field the choice scan
 * does not cover (`choose.chooser`, a selector's controller). The zero-amount draw only binds the
 * choice; drawing 0 does nothing (414.4).
 */
export const CHOOSE_OPPONENT: Effect = {
  op: "draw",
  amount: 0,
  player: { kind: "chosen", ref: "opponent" },
};

/** "Draw it" — the referenced card goes from the Main Deck to hand as a draw. */
export function drawCard(ref: string): Effect {
  return { op: "custom", id: "core:draw-ref", params: { ref } };
}

/** Per-player "the first time each turn" guard pair for a battlefield trigger. */
export function oncePerPlayerPerTurn(
  key: string,
  effect: Effect,
): { condition: Condition; effect: Effect } {
  const unmarked = custom("rad:event-player-unmarked", { key });
  return {
    condition: unmarked,
    effect: {
      op: "if",
      condition: unmarked,
      then: {
        op: "seq",
        effects: [{ op: "custom", id: "rad:mark-event-player", params: { key } }, effect],
      },
    },
  };
}

export const HOST = { targetRef: "host" } as const;

export const FRIENDLY_UNITS_HERE: Selector = { cardType: "unit", controller: "self", zone: HERE };

export const DEFLECT_GAP =
  "The optional additional cost (356.2.b.1) cannot be paid: the protocol Cost has no 'return a gear to hand' part, so only the base play and the printed keyword are automated.";

export const PLAY_OP_NOTE =
  "units played by the play op go to their controller's base (no location choice, 355.2 / 420.3.b)";

export const EVELYNN_HOLD = {
  kind: "triggered" as const,
  trigger: WHEN_I_HOLD,
  condition: custom("rad:facedown-here"),
  effect: {
    op: "if" as const,
    condition: custom("rad:facedown-here"),
    then: { op: "score_points" as const, amount: 1 },
  },
};

/**
 * Jarvan IV, Martial Paragon (RAD-091) — "Your gear with [Deploy] have [Action]. When I conquer, if
 * there is a friendly gear with [Deploy] here, channel 1 rune exhausted."
 */
export const DEPLOY_GEAR_HERE: Condition = {
  kind: "exists",
  selector: { cardType: "gear", controller: "self", keyword: "Deploy", zone: HERE },
};

/** A face-up friendly gear is at the source's location (107.3: facedown cards are not gear). */
registerCustomCondition("rad:friendly-gear-here", (ctx) => {
  const source = ctx.env.sourceObjectId;
  return !!source && friendlyGearAt(ctx.room, ctx.host, source);
});

export function friendlyGearAt(room: Room, host: RulesHost, unitId: string): boolean {
  const located = host.findCard(room, unitId);
  if (!located) return false;
  return host
    .zoneCards(room, located.playerId, located.zone)
    .some(
      (card) =>
        card.hidden !== true &&
        (host.cardInfo(room, card.id)?.type ?? "").toLowerCase().includes("gear"),
    );
}
