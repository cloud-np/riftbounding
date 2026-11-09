/**
 * Spiritforged (SFD) shared script helpers — lane-prefixed custom conditions/effects (`sfd:*`)
 * and small builders. Every registration is an import-time table entry (no game state); every
 * condition is pure (reads only).
 */
import type {
  Amount,
  Condition,
  Effect,
  GameEvent,
  Modifier,
  Selector,
  ZoneSelector,
} from "@rift/protocol";
import { registerCustomCondition } from "../../effects/evaluate";
import { registerCustomEffect } from "../../effects/ops";
import { RESOLVED } from "../../effects/execute";
import { lkiOf } from "../../effects/env";
import { refIds } from "../../effects/evaluate";
import { recordOutcome } from "../../effects/targets";
import {
  battlefieldController,
  battlefieldZoneOf,
  controllerOf,
  costsOf,
  isToken,
  locate,
  locationOf,
  tagsOf,
  typeOf,
} from "../../effects/objects";
import { unitsPresentAt } from "../../state/presence";
import { teamOf } from "../../scoring/teams";
import { pushEvent } from "../../types";
import { custom, token } from "../dsl";

/* ---------------------------------------------------------------- builders */

export const HOST: Selector = { targetRef: "host" };
export const HERE_ZONE: ZoneSelector = { kind: "chosen", ref: "here" };

/** "Play a Gold gear token exhausted." (187, 440.2.c) */
export function gold(count = 1): Effect {
  return {
    op: "create",
    token: token("Gold", { exhausted: true, play: true, ...(count > 1 ? { count } : {}) }),
  };
}

/** "Play a 2 [Might] Sand Soldier unit token" (187). */
export function sandSoldier(zone?: ZoneSelector, count = 1): Effect {
  return {
    op: "create",
    token: token("Sand Soldier", { might: 2, play: true, ...(count > 1 ? { count } : {}) }),
    ...(zone ? { zone } : {}),
  };
}

/** "Play a 3 [Might] Mech unit token to your base" (187). */
export function mech(count = 1): Effect {
  return {
    op: "create",
    token: token("Mech", { might: 3, play: true, tags: ["Mech"], ...(count > 1 ? { count } : {}) }),
    zone: "base",
  };
}

/** "Play a 1 [Might] Recruit unit token" (187.1). */
export function recruit(zone: ZoneSelector, count = 1): Effect {
  return {
    op: "create",
    token: token("Recruit", { might: 1, play: true, ...(count > 1 ? { count } : {}) }),
    zone,
  };
}

/** A Might Bonus of an attached card (479.4.d / 718.4): applies to the top-most card. */
export function mightBonus(amount: number): { kind: "passive"; modifier: Modifier } {
  return { kind: "passive", modifier: { kind: "might", amount, target: HOST } };
}

/** Effect text keyword of an attached card (718.3): appended to the top-most card. */
export function hostKeyword(keyword: string): { kind: "passive"; modifier: Modifier } {
  return { kind: "passive", modifier: { kind: "keyword", keyword, target: HOST } };
}

/**
 * The catalog keyword list includes keywords that the card only grants (or only has in effect
 * text / reminder text). `value: 0` marks them as not intrinsic (727.1.b, layers `withoutSuppressed`).
 */
export function notIntrinsic(keyword: string): { kind: "keyword"; keyword: string; value: number } {
  return { kind: "keyword", keyword, value: 0 };
}

/** A conditional passive (364.3.a): the inner modifier applies only while `condition` holds. */
export function whilePassive(
  condition: Condition,
  modifier: Modifier,
): { kind: "passive"; modifier: Modifier } {
  return {
    kind: "passive",
    modifier: { kind: "custom", id: "conditional", params: { condition, modifier } },
  };
}

/** A unit chosen as a Target with extra filters. */
export function target(extra: Partial<Selector> = {}): Selector {
  return { chosen: true, cardType: "unit", ...extra };
}

/** A "count" amount. */
export function countOf(selector: Selector, per?: number): Amount {
  return { kind: "count", selector, ...(per !== undefined ? { per } : {}) };
}

/** "I enter ready" (369.3), optionally only while `condition` holds as it enters. */
export function enterReady(condition?: Condition): { kind: "passive"; modifier: Modifier } {
  const modifier: Modifier = {
    kind: "custom",
    id: "enter-ready",
    params: { target: { targetRef: "self" } },
  };
  return condition ? whilePassive(condition, modifier) : { kind: "passive", modifier };
}

/** "When I move to a battlefield" (421, 447). */
export const WHEN_I_MOVE_TO_BATTLEFIELD = {
  kind: "event" as const,
  event: {
    type: "move",
    subject: { targetRef: "self" },
    condition: custom("event-zone-is", { battlefield: true }),
  },
};

/** "When I move from a battlefield". */
export const WHEN_I_MOVE_FROM_BATTLEFIELD = {
  kind: "event" as const,
  event: {
    type: "move",
    subject: { targetRef: "self" },
    condition: custom("sfd:event-from-battlefield"),
  },
};

/** "When I conquer" (383.4.c.2.a) / "When I hold" (383.4.d.2.a). */
export const WHEN_I_CONQUER = {
  kind: "event" as const,
  event: { type: "conquer", subject: { targetRef: "self" } },
};
export const WHEN_I_HOLD = {
  kind: "event" as const,
  event: { type: "hold", subject: { targetRef: "self" } },
};

/** "When I attack" / "When I defend" (383.4.e / 383.4.f). */
export const WHEN_I_ATTACK = {
  kind: "event" as const,
  event: { type: "attack", subject: { targetRef: "self" } },
};
export const WHEN_I_DEFEND = {
  kind: "event" as const,
  event: { type: "defend", subject: { targetRef: "self" } },
};
export const WHEN_I_ATTACK_OR_DEFEND = {
  kind: "event" as const,
  event: { type: ["attack", "defend"], subject: { targetRef: "self" } },
};

/** "When I win a combat" (468.3): the combat result names me as a winning unit. */
export const WHEN_I_WIN_A_COMBAT = {
  kind: "event" as const,
  event: { type: "combat_result", condition: custom("sfd:self-won-combat") },
};

/** "When you win a combat" (468.3). */
export const WHEN_YOU_WIN_A_COMBAT = {
  kind: "event" as const,
  event: { type: "combat_result", condition: custom("sfd:you-won-combat") },
};

/** "When you conquer" (any battlefield, 383.4.c.2). */
export const WHEN_YOU_CONQUER = {
  kind: "event" as const,
  event: { type: "conquer", player: "self" as const },
};

/* ---------------------------------------------------------------- custom conditions */

function eventData(event: GameEvent | undefined): Record<string, unknown> {
  return (event?.data ?? {}) as Record<string, unknown>;
}

/** The move event's origin was a battlefield ("When I move from a battlefield"). */
registerCustomCondition("sfd:event-from-battlefield", (ctx) => {
  const from = eventData(ctx.env.event).from;
  return (
    typeof from === "string" && (ctx.host.battlefieldZones(ctx.room) as string[]).includes(from)
  );
});

/** 468.3: the combat result lists the source as a winning unit. */
registerCustomCondition("sfd:self-won-combat", (ctx) => {
  const units = eventData(ctx.env.event).units as Record<string, string> | undefined;
  const source = ctx.env.sourceObjectId;
  return !!source && units?.[source] === "win";
});

/** 468.3: the combat result names the ability's controller as the winner. */
registerCustomCondition(
  "sfd:you-won-combat",
  (ctx) => eventData(ctx.env.event).winner === ctx.env.controller,
);

/** The unit bound to `ref` (default `target:0`) holds the Attacker designation (466.2.c.3). */
registerCustomCondition("sfd:attacking", (ctx, params) => {
  const ref = typeof params.ref === "string" ? params.ref : "target:0";
  const [id] = refIds(ctx, ref);
  return !!id && ctx.room.rules?.objects[id]?.designation === "attacker";
});

/**
 * The object bound to `ref` was controlled by the ability's controller (`friendly: true`) or by
 * an opponent (`friendly: false`) — read through last-known information after it left the board
 * (359.3.e.13).
 */
registerCustomCondition("sfd:ref-was-friendly", (ctx, params) => {
  const ref = typeof params.ref === "string" ? params.ref : "target:0";
  const ids = idsFromEnv(ctx.env.vars[ref] ?? ctx.env.choices[ref]);
  const id = ids[0];
  if (!id) return false;
  const controller = lkiOf(ctx.env, id)?.controller ?? controllerOf(ctx.room, ctx.host, id);
  if (!controller) return false;
  return (controller === ctx.env.controller) === (params.friendly !== false);
});

function idsFromEnv(value: unknown): string[] {
  if (typeof value === "string") return value ? [value] : [];
  if (Array.isArray(value))
    return value.filter((entry): entry is string => typeof entry === "string");
  return [];
}

/** Deathknell "If I died alone" (808 / reminder: no other friendly units at my location). */
registerCustomCondition("sfd:died-alone", (ctx) => {
  const event = ctx.env.event;
  const zone = event?.zone;
  const player = event?.playerId;
  const self = event?.cardId;
  if (!zone || !player) return false;
  return unitsPresentAt(ctx.room, ctx.host, zone, player).every((card) => card.id === self);
});

/** Deathknell "If I was [Mighty]" (706: Might ≥ 5, last-known Might on the kill event). */
registerCustomCondition("sfd:event-might-at-least", (ctx, params) => {
  const might = eventData(ctx.env.event).might;
  const n = typeof params.n === "number" ? params.n : 5;
  return typeof might === "number" && might >= n;
});

/** "from anywhere other than your hand" (366.2.a: the card's own cost passive in another zone). */
registerCustomCondition("sfd:self-not-in-hand", (ctx) => {
  const source = ctx.env.sourceObjectId;
  if (!source) return false;
  const located = locate(ctx.room, ctx.host, source);
  return !!located && located.zone !== "hand";
});

/** The cards played by the controller this turn (history, 420.4). */
function playedThisTurn(
  ctx: Parameters<Parameters<typeof registerCustomCondition>[1]>[0],
): string[] {
  return ctx.room.rules?.history.effects?.played?.[ctx.env.controller] ?? [];
}

/** 716: Equipment is a gear tag. */
function isEquipment(
  ctx: Parameters<Parameters<typeof registerCustomCondition>[1]>[0],
  id: string,
): boolean {
  return tagsOf(locate(ctx.room, ctx.host, id)?.card).some(
    (tag) => tag.toLowerCase() === "equipment",
  );
}

/** "if you've played an Equipment this turn". */
registerCustomCondition("sfd:played-equipment-this-turn", (ctx) =>
  playedThisTurn(ctx).some((id) => {
    return isEquipment(ctx, id);
  }),
);

/** The source battlefield (`battlefield:<zone>`) is controlled by the ability's controller (190). */
registerCustomCondition("sfd:controls-source-battlefield", (ctx) => {
  const zone = ctx.env.sourceObjectId ? battlefieldZoneOf(ctx.env.sourceObjectId) : null;
  return !!zone && battlefieldController(ctx.room, ctx.host, zone) === ctx.env.controller;
});

/** The attach event put a card onto the source ("When you attach an Equipment to me"). */
registerCustomCondition("sfd:attached-to-self", (ctx) => {
  const event = ctx.env.event;
  const source = ctx.env.sourceObjectId;
  if (!event || !source || !(event.targetIds ?? []).includes(source)) return false;
  const card = event.cardId;
  if (!card) return false;
  return isEquipment(ctx, card);
});

/** The event's card has a Power cost of at least `n` (131.3). */
registerCustomCondition("sfd:event-card-power-at-least", (ctx, params) => {
  const card = ctx.env.event?.cardId;
  if (!card) return false;
  const costs = costsOf(ctx.room, ctx.host, card);
  const n = typeof params.n === "number" ? params.n : 2;
  return !!costs && costs.power >= n;
});

/** The event's card is of `type` (spell/unit/gear …). */
registerCustomCondition("sfd:event-card-type", (ctx, params) => {
  const card = ctx.env.event?.cardId;
  if (!card) return false;
  const wanted = String(params.type ?? "").toLowerCase();
  const type = (
    typeOf(ctx.room, ctx.host, card) ||
    ctx.host.cardInfo(ctx.room, card)?.type ||
    ""
  ).toLowerCase();
  return type.includes(wanted);
});

/** No friendly non-token gear has been played this turn other than the source (Ornn's Forge). */
registerCustomCondition(
  "sfd:no-nontoken-gear-played-this-turn",
  (ctx) =>
    !playedThisTurn(ctx).some((id) => {
      const info = ctx.host.cardInfo(ctx.room, id);
      const located = locate(ctx.room, ctx.host, id);
      if (located && isToken(located.card)) return false;
      return (info?.type ?? "").toLowerCase().includes("gear");
    }),
);

/** The unit bound to `ref` is at the same location as the source. */
registerCustomCondition("sfd:ref-here", (ctx, params) => {
  const ref = typeof params.ref === "string" ? params.ref : "it";
  const [id] = refIds(ctx, ref);
  const source = ctx.env.sourceObjectId;
  if (!id || !source) return false;
  const here = locationOf(ctx.room, ctx.host, source);
  return !!here && locationOf(ctx.room, ctx.host, id) === here;
});

/** `it` (a battlefield pseudo-object) is controlled by the ability's controller or an ally (491.2). */
registerCustomCondition("sfd:it-battlefield-friendly", (ctx) => {
  const zone = ctx.env.it ? battlefieldZoneOf(ctx.env.it) : null;
  if (!zone) return false;
  const controller = battlefieldController(ctx.room, ctx.host, zone);
  return !!controller && teamOf(ctx.room, ctx.env.controller).includes(controller);
});

/** The event's player is the ability's controller or an ally ("When you or an ally …", 491.2). */
registerCustomCondition("sfd:event-player-friendly", (ctx) => {
  const player = ctx.env.event?.playerId;
  return !!player && teamOf(ctx.room, ctx.env.controller).includes(player);
});

/** The kill event happened at the battlefield of the combat in progress ("When I die in combat"). */
registerCustomCondition("sfd:died-in-combat", (ctx) => {
  const event = ctx.env.event;
  const combat = ctx.room.rules?.combat;
  return !!event?.zone && !!combat && combat.battlefield === event.zone;
});

/* ---------------------------------------------------------------- custom effects */

/**
 * "Put it in your hand" for cards revealed / looked at in the Main Deck — a move to the owner's
 * hand that is not a draw (414 is not involved). `ref` names the bound cards.
 */
registerCustomEffect("sfd:to-hand-ref", (params, context) => {
  const host = context.step.host;
  const env = context.machine?.env ?? { controller: context.controller, choices: {}, vars: {} };
  const ref = typeof params.ref === "string" ? params.ref : "looked";
  const moved: string[] = [];
  for (const id of refIds({ room: context.room, host, env }, ref)) {
    const located = locate(context.room, host, id);
    if (!located || located.zone !== "deck") continue;
    if (!host.moveCardToOwnerZone(context.room, id, "hand")) continue;
    moved.push(id);
    pushEvent(context.step.events, {
      type: "put_in_hand",
      cardId: id,
      playerId: located.playerId,
      data: { from: "deck" },
    });
  }
  recordOutcome(context, moved, moved.length > 0);
  return RESOLVED;
});

/**
 * "Put the top N cards of your Main Deck into your trash" (Minefield). Not a discard (423) and not
 * a draw; cards move from the top of the deck to the trash (as many as possible, 055).
 */
registerCustomEffect("sfd:mill", (params, context) => {
  const host = context.step.host;
  const player = context.machine?.env.controller ?? context.controller;
  const amount = typeof params.amount === "number" ? params.amount : 1;
  const moved: string[] = [];
  for (const card of host.lookAtTop(context.room, player, "deck", amount)) {
    if (!host.moveCardToOwnerZone(context.room, card.id, "trash")) continue;
    moved.push(card.id);
    pushEvent(context.step.events, {
      type: "mill",
      cardId: card.id,
      playerId: player,
      data: { from: "deck", to: "trash" },
    });
  }
  recordOutcome(context, moved, moved.length > 0);
  return RESOLVED;
});

/**
 * "Draw it" for specific cards looked at / revealed from the top of the Main Deck (414: the card
 * is put into its owner's hand as a draw). `ref` names the bound cards (e.g. `looked`, a `choose`
 * key); cards no longer in their owner's deck are skipped (359.3.e.12).
 */
registerCustomEffect("sfd:draw-ref", (params, context) => {
  const host = context.step.host;
  const env = context.machine?.env ?? { controller: context.controller, choices: {}, vars: {} };
  const ref = typeof params.ref === "string" ? params.ref : "looked";
  const drawn: string[] = [];
  for (const id of refIds({ room: context.room, host, env }, ref)) {
    const located = locate(context.room, host, id);
    if (!located || located.zone !== "deck") continue;
    if (!host.moveCardToOwnerZone(context.room, id, "hand")) continue;
    drawn.push(id);
    pushEvent(context.step.events, {
      type: "draw",
      playerId: located.playerId,
      amount: 1,
      data: { cardIds: [id] },
    });
  }
  recordOutcome(context, drawn, drawn.length > 0);
  return RESOLVED;
});
