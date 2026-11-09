/**
 * Unleashed (UNL) card-specific conditions and effects (`unl:` prefix). Import-time registry
 * entries only (no game state); each reads the room through the shared evaluator helpers.
 */
import type { Effect, Room } from "@rift/protocol";
import type { RulesHost } from "../../host";
import { pushEvent } from "../../types";
import { registerCustomCondition, refIds, mightOf } from "../../effects/evaluate";
import { registerCustomEffect } from "../../effects/ops";
import { RESOLVED } from "../../effects/execute";
import type { EvalContext } from "../../effects/env";
import { idsOf } from "../../effects/env";
import { evalContextOf, recordOutcome } from "../../effects/targets";
import {
  battlefieldZoneOf,
  isBattlefieldZone,
  locate,
  locationOf,
  ownerOf,
  tagsOf,
} from "../../effects/objects";
import { forgetObject } from "../../effects/ops/util";
import { movePrimitive } from "../../actions/move";
import { restrictionFor } from "../../layers/restrictions";
import { unitsPresentAt } from "../../state/presence";
import { battlefieldController } from "../../actions/control";
import { teamOf } from "../../scoring/teams";
import { removeChainItem } from "../../timing/fepr/chain";
import { addContinuousEffect } from "../../layers/mods";

/* ---------------------------------------------------------------- shared helpers */

/** The first object bound to a choice key, even if it is now an illegal target (359.3.e). */
function chosenId(ctx: EvalContext, ref: string): string | undefined {
  const value = ref in ctx.env.vars ? ctx.env.vars[ref] : ctx.env.choices[ref];
  return idsOf(value)[0];
}

/**
 * The location a chosen object was at when the chain item finalized (359.3.e snapshot), else its
 * current location. "There" / "that battlefield" refer to it even if the object left (359.3.f).
 */
function chosenLocation(ctx: EvalContext, ref: string): string | null {
  const id = chosenId(ctx, ref);
  if (!id) return null;
  return ctx.env.snapshot?.[id]?.zone ?? locationOf(ctx.room, ctx.host, id);
}

/** 740.1 "you or allies": the controller's team (2v2, 491) or just the controller. */
function teamPlayers(room: Room, playerId: string): string[] {
  const team = teamOf(room, playerId);
  return team.length > 0 ? team : [playerId];
}

/** A player controls a battlefield (190.2, stored control with the presence fallback). */
function controlsZone(room: Room, host: RulesHost, players: string[], zone: string): boolean {
  const controller = battlefieldController(room, zone, host);
  return !!controller && players.includes(controller);
}

/* ---------------------------------------------------------------- conditions */

/**
 * Loyal Poro — "If I didn't die alone" (740.2.a: alone = no other friendly units at its
 * location). The trigger event carries the location and controller it died at (383.2.c.3.b).
 */
registerCustomCondition("unl:died-not-alone", (ctx) => {
  const event = ctx.env.event;
  if (!event?.zone || !event.playerId) return false;
  const dead = event.cardId;
  return unitsPresentAt(ctx.room, ctx.host, event.zone, event.playerId).some(
    (card) => card.id !== dead,
  );
});

/**
 * Poppy, Paragon — "if an opponent's score is within 3 points of the Victory Score" (470.1). The
 * host's Victory Score already includes battlefield modifiers (Aspirant's Climb).
 */
registerCustomCondition("unl:opponent-within", (ctx, params) => {
  const points = typeof params.points === "number" ? params.points : 3;
  const target = ctx.host.victoryScore(ctx.room);
  return ctx.host
    .activePlayerIds(ctx.room)
    .filter((id) => id !== ctx.env.controller)
    .some((id) => target - ctx.host.score(ctx.room, id) <= points);
});

/**
 * An optional additional cost (by its R2-play id: "repeat", "repeat:1", "optional:0", …) was paid
 * for this chain item (355.1.a; R2-play records it as `choices["cost:<id>"]`). Used for Repeat
 * (820.1.d: "execute the instructions … one additional time").
 */
registerCustomCondition("unl:paid-cost", (ctx, params) => {
  const id = typeof params.id === "string" ? params.id : "repeat";
  return ctx.env.choices[`cost:${id}`] === true;
});

/**
 * `it` (a battlefield pseudo-object) is controlled by you or an ally (190.2; "battlefields you or
 * allies control").
 */
registerCustomCondition("unl:battlefield-controlled-by-team", (ctx) => {
  const zone = ctx.env.it ? battlefieldZoneOf(ctx.env.it) : null;
  if (!zone) return false;
  return controlsZone(ctx.room, ctx.host, teamPlayers(ctx.room, ctx.env.controller), zone);
});

/** "If you control a facedown card" (107.3: facedown cards at battlefields, 811). */
registerCustomCondition("unl:controls-facedown", (ctx) =>
  ctx.host
    .battlefieldZones(ctx.room)
    .some((zone) =>
      ctx.host.zoneCards(ctx.room, ctx.env.controller, zone).some((card) => card.hidden === true),
    ),
);

/** `it` is at the location the chosen object (`ref`) was at when the item finalized. */
registerCustomCondition("unl:at-chosen-location", (ctx, params) => {
  const ref = typeof params.ref === "string" ? params.ref : "target:0";
  const zone = chosenLocation(ctx, ref);
  return !!zone && !!ctx.env.it && locationOf(ctx.room, ctx.host, ctx.env.it) === zone;
});

/**
 * Isolate — "if there's an enemy unit alone at that battlefield" (740.2.a: alone = no other
 * friendly units of its controller there); "that battlefield" is where the chosen unit was.
 */
registerCustomCondition("unl:enemy-alone-at-chosen", (ctx, params) => {
  const ref = typeof params.ref === "string" ? params.ref : "target:0";
  const zone = chosenLocation(ctx, ref);
  if (!zone || !isBattlefieldZone(ctx.room, ctx.host, zone)) return false;
  return ctx.host
    .activePlayerIds(ctx.room)
    .filter((id) => id !== ctx.env.controller)
    .some((id) => unitsPresentAt(ctx.room, ctx.host, zone, id).length === 1);
});

/** "If you played this from your hand" — not from facedown (811.1.b) or another zone (354). */
registerCustomCondition("unl:played-from-hand", (ctx) => {
  const item = ctx.room.rules?.chain.find((entry) => entry.id === ctx.env.itemId);
  if (!item || item.playedFromFacedown) return false;
  const permission = item.process?.permission?.id;
  const from = item.process?.fromZone;
  return (
    (permission === undefined || permission === "hand") && (from === undefined || from === "hand")
  );
});

/**
 * "When it/I win(s) a combat" (468.3.c: units at the battlefield inherit their controller's result;
 * R2-combat's `combat_result` event lists them in `data.units`).
 */
registerCustomCondition("unl:unit-won-combat", (ctx, params) => {
  const event = ctx.env.event;
  if (event?.type !== "combat_result") return false;
  const ref = typeof params.ref === "string" ? params.ref : "self";
  const ids = ref === "self" ? [ctx.env.sourceObjectId ?? ""] : refIds(ctx, ref);
  const units = (event.data?.units ?? {}) as Record<string, string>;
  return ids.some((id) => units[id] === "win");
});

/** `it` (a battlefield pseudo-object) has at least one unit you control (107.3 presence). */
registerCustomCondition("unl:you-have-units-at-it", (ctx) => {
  const zone = ctx.env.it ? battlefieldZoneOf(ctx.env.it) : null;
  return !!zone && unitsPresentAt(ctx.room, ctx.host, zone, ctx.env.controller).length > 0;
});

/**
 * Kha'Zix, Mutating Horror — "if an enemy unit is alone here" (740.2.a): some opponent has
 * exactly one unit at my location.
 */
registerCustomCondition("unl:enemy-alone-here", (ctx) => {
  const source = ctx.env.sourceObjectId;
  const zone = source ? locationOf(ctx.room, ctx.host, source) : null;
  if (!zone) return false;
  return ctx.host
    .activePlayerIds(ctx.room)
    .filter((id) => id !== ctx.env.controller)
    .some((id) => unitsPresentAt(ctx.room, ctx.host, zone, id).length === 1);
});

/** "When you or an ally …": the trigger event's player is the controller or a teammate (491). */
registerCustomCondition("unl:event-player-in-team", (ctx) => {
  const player = ctx.env.event?.playerId;
  return !!player && teamPlayers(ctx.room, ctx.env.controller).includes(player);
});

/** `it` is an attacking unit (466.2.c.3 Attacker designation). */
registerCustomCondition("unl:is-attacking", (ctx) => {
  const id = ctx.env.it;
  return !!id && ctx.room.rules?.objects[id]?.designation === "attacker";
});

/**
 * Crimson Pigeons — "while I'm attacking with another unit": I am an Attacker and another unit at
 * my battlefield is an Attacker too (466.2.c.3).
 */
registerCustomCondition("unl:attacking-with-another", (ctx) => {
  const source = ctx.env.sourceObjectId;
  const objects = ctx.room.rules?.objects ?? {};
  if (!source || objects[source]?.designation !== "attacker") return false;
  const zone = locationOf(ctx.room, ctx.host, source);
  if (!zone) return false;
  return unitsPresentAt(ctx.room, ctx.host, zone).some(
    (card) => card.id !== source && objects[card.id]?.designation === "attacker",
  );
});

/** One of the objects bound to `ref` has one of `tags` (143.1; e.g. "a Bird, Cat, Dog or Poro"). */
registerCustomCondition("unl:ref-has-any-tag", (ctx, params) => {
  const ref = typeof params.ref === "string" ? params.ref : "kept";
  const tags = (Array.isArray(params.tags) ? params.tags : []).map((tag) =>
    String(tag).toLowerCase(),
  );
  return refIds(ctx, ref).some((id) =>
    tagsOf(locate(ctx.room, ctx.host, id)?.card).some((tag) => tags.includes(tag.toLowerCase())),
  );
});

/** `it` has one of `tags` (143.1). */
registerCustomCondition("unl:it-has-any-tag", (ctx, params) => {
  const tags = (Array.isArray(params.tags) ? params.tags : []).map((tag) =>
    String(tag).toLowerCase(),
  );
  const id = ctx.env.it;
  return (
    !!id &&
    tagsOf(locate(ctx.room, ctx.host, id)?.card).some((tag) => tags.includes(tag.toLowerCase()))
  );
});

/** A showdown is in progress (340–348). */
registerCustomCondition("unl:in-showdown", (ctx) => !!ctx.room.rules?.showdown);

/**
 * Forbidding Waste — "While a unit here is defending alone" (466.2.c.3 Defender; 740.2.a alone:
 * no other friendly units here). Evaluated for `it`.
 */
registerCustomCondition("unl:defending-alone", (ctx) => {
  const id = ctx.env.it;
  if (!id || ctx.room.rules?.objects[id]?.designation !== "defender") return false;
  const zone = locationOf(ctx.room, ctx.host, id);
  const controller = locate(ctx.room, ctx.host, id)?.playerId;
  if (!zone || !controller) return false;
  return unitsPresentAt(ctx.room, ctx.host, zone, controller).every((card) => card.id === id);
});

/**
 * Smoke and Mirrors — "another unit you control at a different location": `it` (the candidate) is
 * not at the location of the object bound to `ref` (107.3).
 */
registerCustomCondition("unl:at-different-location", (ctx, params) => {
  const ref = typeof params.ref === "string" ? params.ref : "target:0";
  const other = chosenId(ctx, ref);
  const mine = ctx.env.it;
  if (!other || !mine) return true;
  return locationOf(ctx.room, ctx.host, mine) !== locationOf(ctx.room, ctx.host, other);
});

/**
 * The controller's units (at battlefields or bases) carry every one of `tags` among them (143.1;
 * Ivern, Friend to all; Daisy!).
 */
registerCustomCondition("unl:units-have-all-tags", (ctx, params) => {
  const tags = (Array.isArray(params.tags) ? params.tags : []).map((tag) =>
    String(tag).toLowerCase(),
  );
  const owned = new Set<string>();
  const zones = ["base", ...(ctx.host.battlefieldZones(ctx.room) as string[])];
  for (const zone of zones) {
    for (const card of ctx.host.zoneCards(ctx.room, ctx.env.controller, zone)) {
      if (!ctx.host.cardInfo(ctx.room, card.id)?.type?.toLowerCase().includes("unit")) continue;
      for (const tag of tagsOf(card)) owned.add(tag.toLowerCase());
    }
  }
  return tags.every((tag) => owned.has(tag));
});

/**
 * Maduli the Gatekeeper — `it` (a battlefield pseudo-object) is occupied by enemy units whose
 * total Might is less than my Might (140.x; 107.3 presence).
 */
registerCustomCondition("unl:enemy-battlefield-weaker", (ctx) => {
  const zone = ctx.env.it ? battlefieldZoneOf(ctx.env.it) : null;
  const source = ctx.env.sourceObjectId;
  if (!zone || !source) return false;
  const mine = mightOf(ctx, source) ?? 0;
  const enemies = ctx.host
    .activePlayerIds(ctx.room)
    .filter((id) => id !== ctx.env.controller)
    .flatMap((id) => unitsPresentAt(ctx.room, ctx.host, zone, id));
  if (enemies.length === 0) return false;
  const total = enemies.reduce((sum, card) => sum + (mightOf(ctx, card.id) ?? 0), 0);
  return mine > total;
});

/* ---------------------------------------------------------------- effects */

/**
 * "The next time it would die this turn, <replace> instead" (367–370 delayed replacement, 391.3;
 * Smite, Tactical Retreat). Created for `it` (the chosen unit, validated by the enclosing
 * `for_each`) with the object bound literally, because a delayed replacement's matcher does not
 * see the creating ability's choices; `replace` refers to the unit as `{ targetRef: "event" }`.
 */
registerCustomEffect("unl:replace-next-death", (params, context) => {
  const ctx = evalContextOf(context);
  const id = ctx.env.it;
  const replace = params.replace as Effect | undefined;
  if (!id || !replace) return RESOLVED;
  addContinuousEffect(context.room, ctx.host, {
    controller: ctx.env.controller,
    duration: "this-turn",
    modifier: {
      kind: "custom",
      id: "replacement",
      params: {
        matches: { type: "kill", subject: { targetRef: `obj:${id}` } },
        replace,
        once: true,
      },
    },
    ...(ctx.env.sourceObjectId ? { sourceObjectId: ctx.env.sourceObjectId } : {}),
  });
  pushEvent(context.step.events, {
    type: "replacement_created",
    playerId: ctx.env.controller,
    cardId: id,
  });
  recordOutcome(context, [id], true);
  return RESOLVED;
});

/**
 * Abandon — "Counter a spell. Return it to its owner's hand instead of putting it in their
 * trash." (426.1.a: a countered card leaves the chain; the replacement sends the card to its
 * owner's hand, 056). Acts on `it` (the chosen spell). Costs are not refunded (426.1.c).
 */
registerCustomEffect("unl:counter-to-hand", (_params, context) => {
  const ctx = evalContextOf(context);
  const id = ctx.env.it;
  const item = id ? context.room.rules?.chain.find((entry) => entry.id === id) : undefined;
  if (!item) {
    recordOutcome(context, [], false);
    return RESOLVED;
  }
  removeChainItem(context.room, item.id);
  if (item.kind === "card" && item.cardSnapshot) {
    const owner = item.cardSnapshot.ownerPlayerId ?? item.controller;
    ctx.host.putCard(context.room, owner, "hand", item.cardSnapshot);
  }
  pushEvent(context.step.events, {
    type: "counter",
    playerId: ctx.env.controller,
    cardName: item.cardName,
    ...(item.cardSnapshot ? { cardId: item.cardSnapshot.id } : {}),
    data: { itemId: item.id, controller: item.controller, kind: item.kind, to: "hand" },
  });
  recordOutcome(context, [item.id], true);
  return RESOLVED;
});

/**
 * Lilting Lullaby — "Its controller can't play spells this turn." A player-level restriction
 * (054.1 can't beats can) expressed as `play` restrictions on that player's spell cards in hand and
 * facedown at battlefields (811.1.b), for this turn. Acts on `it` (the chosen spell).
 */
registerCustomEffect("unl:no-spells-this-turn", (_params, context) => {
  const ctx = evalContextOf(context);
  const id = ctx.env.it;
  const item = id ? context.room.rules?.chain.find((entry) => entry.id === id) : undefined;
  if (!item) return RESOLVED;
  const player = item.controller;
  const zones: Array<"hand" | "battlefield"> = ["hand", "battlefield"];
  for (const zone of zones) {
    addContinuousEffect(context.room, ctx.host, {
      controller: ctx.env.controller,
      duration: "this-turn",
      modifier: {
        kind: "restriction",
        restriction: "play",
        target: { cardType: "spell", zone, controller: { kind: "player", id: player } },
      },
      ...(ctx.env.sourceObjectId ? { sourceObjectId: ctx.env.sourceObjectId } : {}),
    });
  }
  recordOutcome(context, [], true);
  return RESOLVED;
});

/**
 * "Draw it" for a card picked from among the looked-at top cards of your Main Deck (414.1: the
 * card is put into its owner's hand from the Main Deck; `draw` event so draw triggers see it).
 */
registerCustomEffect("unl:draw-ref", (params, context) => {
  const ctx = evalContextOf(context);
  const ref = typeof params.ref === "string" ? params.ref : "kept";
  const drawn: string[] = [];
  for (const id of refIds(ctx, ref)) {
    const located = locate(context.room, ctx.host, id);
    if (!located || located.zone !== "deck") continue;
    if (!ctx.host.moveCardToOwnerZone(context.room, id, "hand")) continue;
    drawn.push(id);
  }
  if (drawn.length > 0) {
    const owner = ctx.env.controller;
    pushEvent(context.step.events, {
      type: "draw",
      playerId: owner,
      amount: drawn.length,
      data: { cardIds: drawn },
    });
  }
  recordOutcome(context, drawn, drawn.length > 0);
  return RESOLVED;
});

/**
 * Keeper's Verdict — "Its owner places it on the top or bottom of their Main Deck." The owner
 * makes the choice (412.4 / 355.18: a choice made on resolution by the instructed player); the
 * object leaves the board and loses its rules state (705, 186.1 for tokens). Acts on `it`.
 */
registerCustomEffect("unl:owner-top-or-bottom", (_params, context) => {
  const ctx = evalContextOf(context);
  const machine = context.machine;
  const id = ctx.env.it;
  if (!id || !machine) return RESOLVED;
  const owner = ownerOf(context.room, ctx.host, id);
  const located = locate(context.room, ctx.host, id);
  if (!owner || !located) {
    recordOutcome(context, [], false);
    return RESOLVED;
  }
  const answer = machine.frame.answer;
  const picked = Array.isArray(answer) ? answer[0] : answer;
  if (picked !== "top" && picked !== "bottom") {
    return machine.ask({
      kind: "choose-mode",
      playerId: owner,
      options: [
        { id: "top", label: "Top" },
        { id: "bottom", label: "Bottom" },
      ],
      min: 1,
      max: 1,
      rule: "412.4",
      promptKey: "rules.prompt.topOrBottom",
      data: { answer: "options" },
    });
  }
  machine.frame.answer = undefined;
  if (located.card.attachedToCardId) ctx.host.detach(context.room, id);
  if (!ctx.host.moveCardToOwnerZone(context.room, id, "deck", picked)) {
    recordOutcome(context, [], false);
    return RESOLVED;
  }
  forgetObject(context.room, ctx.host, id);
  // Not a Move (421: moves are between locations), so no "move" event.
  pushEvent(context.step.events, {
    type: "place_in_deck",
    cardId: id,
    playerId: owner,
    zone: "deck",
    cardName: located.card.name,
    data: { from: located.zone, position: picked },
  });
  recordOutcome(context, [id], true);
  return RESOLVED;
});

/**
 * Vex, Mocking — "move me to that battlefield": move the source to the location of the trigger
 * event's subject (421, 355.4.a, 451.2, 054/358.3.a restrictions; the Cleanup after the move
 * stages the showdown, 455).
 */
registerCustomEffect("unl:move-to-event-subject", (_params, context) => {
  const ctx = evalContextOf(context);
  const source = ctx.env.sourceObjectId;
  const subject = ctx.env.event?.cardId;
  const destination = subject ? locationOf(context.room, ctx.host, subject) : null;
  const from = source ? locationOf(context.room, ctx.host, source) : null;
  if (!source || !destination || !from || from === destination) {
    recordOutcome(context, [], false);
    return RESOLVED;
  }
  const controller = ownerOf(context.room, ctx.host, source);
  const crowded = ctx.host
    .activePlayerIds(context.room)
    .filter(
      (player) =>
        player !== controller &&
        isBattlefieldZone(context.room, ctx.host, destination) &&
        unitsPresentAt(context.room, ctx.host, destination, player).length > 0,
    );
  const moved =
    crowded.length < 2 &&
    !restrictionFor(context.room, ctx.host, { kind: "move", objectId: source, to: destination }) &&
    movePrimitive(context.room, source, destination, context.step);
  recordOutcome(context, moved ? [source] : [], !!moved);
  return RESOLVED;
});

/**
 * "Discard it" for a card picked from your hand (423.1: it goes from the hand to its owner's
 * Trash; `discard` event so discard triggers see it). Acts on the objects bound to `ref`.
 */
registerCustomEffect("unl:discard-ref", (params, context) => {
  const ctx = evalContextOf(context);
  const ref = typeof params.ref === "string" ? params.ref : "kept";
  const discarded: string[] = [];
  for (const id of refIds(ctx, ref)) {
    const located = locate(context.room, ctx.host, id);
    if (!located || located.zone !== "hand") continue;
    if (!ctx.host.moveCardToOwnerZone(context.room, id, "trash")) continue;
    discarded.push(id);
    pushEvent(context.step.events, {
      type: "discard",
      playerId: located.playerId,
      cardId: id,
      cardName: located.card.name,
      amount: 1,
    });
  }
  recordOutcome(context, discarded, discarded.length > 0);
  return RESOLVED;
});

/**
 * Diana, Lunari — "reveal the top card of your Main Deck. If it's a spell, draw it." (425 reveal,
 * 414 draw; the card stays on top otherwise.)
 */
registerCustomEffect("unl:reveal-top-draw-spell", (_params, context) => {
  const ctx = evalContextOf(context);
  const player = ctx.env.controller;
  const top = ctx.host.lookAtTop(context.room, player, "deck", 1)[0];
  if (!top) {
    recordOutcome(context, [], false);
    return RESOLVED;
  }
  pushEvent(context.step.events, {
    type: "reveal",
    playerId: player,
    cardId: top.id,
    cardName: top.name,
    zone: "deck",
  });
  const isSpell = !!ctx.host.cardInfo(context.room, top.id)?.type?.toLowerCase().includes("spell");
  if (isSpell && ctx.host.moveCardToOwnerZone(context.room, top.id, "hand")) {
    pushEvent(context.step.events, {
      type: "draw",
      playerId: player,
      amount: 1,
      data: { cardIds: [top.id] },
    });
    recordOutcome(context, [top.id], true);
    return RESOLVED;
  }
  recordOutcome(context, [], false);
  return RESOLVED;
});

/**
 * Ivern, Friend to all — "I gain that tag" (143.1): add `tag` to my tags (the catalog tags stay).
 */
registerCustomEffect("unl:gain-tag", (params, context) => {
  const ctx = evalContextOf(context);
  const source = ctx.env.sourceObjectId;
  const tag = typeof params.tag === "string" ? params.tag : "";
  const located = source ? locate(context.room, ctx.host, source) : null;
  if (!located || !tag) {
    recordOutcome(context, [], false);
    return RESOLVED;
  }
  located.card.subtypes = [...new Set([...tagsOf(located.card), tag])];
  recordOutcome(context, source ? [source] : [], true);
  return RESOLVED;
});
