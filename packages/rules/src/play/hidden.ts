/**
 * Hide — rules 107.3, 422, 811.1.b, 811.1.c.
 *
 * 811.1.b: "While this card is in your hand or in your Champion Zone on your turn during an Open
 * State, you may pay [A] to hide this facedown at a battlefield you control that doesn't already
 * have a facedown card hidden there." Hiding is a Discretionary Action (422.2), not a Play
 * (811.1.c.1), and does not open a chain (811.1.c.2). It is sent as `rules_play` with
 * `hide: true` and `location` = the battlefield.
 *
 * The facedown card records `hiddenTurn`/`hiddenBy` on its object state so that, beginning on
 * the next turn, it may be played with Reaction ignoring its base cost (`permissions.ts`).
 */
import type { CardInstance, Room } from "@rift/protocol";
import type { LocatedCard, RulesHost } from "../host";
import type { RulesFailure, RulesStepContext } from "../types";
import { fail, pushEvent } from "../types";
import type { IntentResult } from "../intents/context";
import { isTurnPlayer, turnState } from "../state/turn";
import { baseActionVerdict } from "../legality/timing";
import { controlsBattlefield, facedownCardAt, isBattlefield } from "./control";
import { resolveCost } from "./cost-model";
import { cardKeywords, hasKeyword } from "./keywords";
import { applyPayment, planPayment, type PaymentPlan } from "./payment";
import type { PlayRequest } from "./request";

/** 811.1.b: the Hide cost is [A]. */
export const HIDE_COST = { power: { any: 1 } } as const;

export interface HidePlan {
  ok: true;
  located: LocatedCard;
  location: string;
  payment: PaymentPlan;
}

/** Battlefields this card could be hidden at now (controlled, Facedown Zone empty). */
export function hideLocations(room: Room, host: RulesHost, playerId: string): string[] {
  return (host.battlefieldZones(room) as string[]).filter(
    (zone) => controlsBattlefield(room, host, playerId, zone) && !facedownCardAt(room, host, zone),
  );
}

export function planHide(
  room: Room,
  playerId: string,
  cardId: string,
  request: Pick<PlayRequest, "location" | "plan">,
  host: RulesHost,
): HidePlan | RulesFailure {
  const located = host.findCard(room, cardId);
  if (!located || located.playerId !== playerId || (located.zone !== "hand" && located.zone !== "champion")) {
    return fail("not_in_hand", "811.1.b");
  }
  const base = baseActionVerdict(room, playerId);
  if (!base.ok) return base;
  // 811.1.b: on your turn during an Open State.
  if (!isTurnPlayer(room, playerId)) return fail("not_your_turn", "811.1.b");
  const state = turnState(room);
  if (state !== "neutral_open" && state !== "showdown_open") return fail("chain_not_empty", "811.1.b");
  if (!hasKeyword(cardKeywords(room, host, cardId), "Hidden")) {
    return fail("illegal_action", "811.1", "this card does not have Hidden");
  }
  const location = request.location;
  if (typeof location !== "string" || !isBattlefield(room, host, location)) {
    return fail("invalid_location", "811.1.b", "choose a battlefield you control");
  }
  if (!controlsBattlefield(room, host, playerId, location)) return fail("invalid_location", "422.1", location);
  // 107.3.b: a Facedown Zone holds at most one card.
  if (facedownCardAt(room, host, location)) return fail("invalid_location", "107.3.b", location);
  const payment = planPayment(room, host, playerId, resolveCost(HIDE_COST, []), {
    sourceObjectId: cardId,
    excludeIds: [cardId],
    ...(request.plan ? { plan: request.plan } : {}),
  });
  if (!payment.ok) return payment;
  if (!payment.plan) return fail("insufficient_resources", "811.1.b");
  return { ok: true, located, location, payment: payment.plan };
}

export function executeHide(room: Room, step: RulesStepContext, playerId: string, plan: HidePlan): IntentResult {
  const rules = room.rules;
  if (!rules) return fail("rules_require_strict", "contract:§1");
  const paid = applyPayment(room, step, playerId, resolveCost(HIDE_COST, []), plan.payment);
  if (!paid.ok) return paid;
  const cardId = plan.located.card.id;
  if (!step.host.moveCardTo(room, playerId, plan.located.zone, plan.location, cardId)) {
    return fail("invalid_location", "422.1");
  }
  step.host.hide(room, cardId);
  const object = (rules.objects[cardId] ??= {});
  object.hiddenTurn = rules.turn.number;
  object.hiddenBy = playerId;
  pushEvent(step.events, { type: "hide", cardId, playerId, zone: plan.location, data: { rule: "811.1.b" } });
  return { ok: true };
}

/** Hidden cards the player could play from facedown now are listed by `legalIntents`. */
export function facedownCardsOf(room: Room, host: RulesHost, playerId: string): CardInstance[] {
  return (host.battlefieldZones(room) as string[]).flatMap((zone) =>
    host.zoneCards(room, playerId, zone).filter((card) => card.hidden === true),
  );
}
