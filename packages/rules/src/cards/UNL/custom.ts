/**
 * Unleashed (UNL) card-specific conditions and effects (`unl:` prefix). Import-time registry
 * entries only (no game state); each reads the room through the shared evaluator helpers.
 */
import { pushEvent } from "../../types";
import { registerCustomCondition, refIds } from "../../effects/evaluate";
import { registerCustomEffect } from "../../effects/ops";
import { RESOLVED } from "../../effects/execute";
import { recordOutcome } from "../../effects/targets";
import { locate } from "../../effects/objects";
import { unitsPresentAt } from "../../state/presence";
import { evalContextOf } from "../../effects/targets";

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
