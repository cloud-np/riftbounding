/**
 * Response windows — can the Priority/Focus holder respond, and can everyone else tell?
 *
 * A "response" is any Discretionary Action legal right now (338.1.a / 347.1: a legally timed
 * play, Hide or activation). Passing is the only legal action when there is none, so the pass is
 * forced; but an *instant* pass then tells the opponent the player had no response, which
 * reveals hand information (`docs/rules/auto-pass.md` § hidden information).
 *
 * `provablyNone` is the information-safe subset: the player has no legal response AND nothing
 * that could hold one is hidden from the opponent — an empty hand and no facedown card. Every
 * remaining source of a response (activated abilities of board objects, plays from the trash /
 * face-up banishment / Champion zone, pools, timing, targets) is public, so the opponent could
 * compute the same answer. A card script that grants plays from a hidden zone other than the hand
 * (none does today; `test/auto/auto-pass-registry.test.ts` guards it) would have to be added here.
 */
import type { Room } from "@rift/protocol";
import type { RulesHost } from "../host";
import { legalIntents } from "../view/legal";

export interface ResponseCheck {
  /** The player has at least one legal Discretionary Action besides passing. */
  canRespond: boolean;
  /** No legal response, and public information alone proves it. */
  provablyNone: boolean;
}

const HIDDEN_RESPONSE_ZONES = ["base", "champion", "banished"] as const;

/** Does the player hold anything an opponent cannot see that might be a response? */
export function holdsHiddenCards(room: Room, host: RulesHost, playerId: string): boolean {
  if (host.zoneCards(room, playerId, "hand").length > 0) return true;
  const zones = [...HIDDEN_RESPONSE_ZONES, ...(host.battlefieldZones(room) as string[])];
  for (const zone of zones) {
    if (host.zoneCards(room, playerId, zone).some((card) => card.hidden === true)) return true;
  }
  return false;
}

/**
 * 164.2.a / 164.2.b: a Basic Rune's `[Reaction]` abilities only Add resources (or recycle the
 * rune for them). Resources alone change nothing — the pool empties at the end of the turn
 * (317.2.d) — so they are not a response and not "something to do". Every other ability counts.
 */
function meaningfulActivations(activatable: ReadonlyArray<{ ability: string }>): number {
  return activatable.filter((entry) => !entry.ability.startsWith("rune:")).length;
}

/** Legal responses of `playerId` (their own legal intents; reads their own hidden cards). */
export function hasLegalResponse(room: Room, host: RulesHost, playerId: string): boolean {
  const legal = legalIntents(room, playerId, host);
  return (
    legal.playableCardIds.length > 0 ||
    meaningfulActivations(legal.activatable) > 0 ||
    (legal.hideable?.length ?? 0) > 0
  );
}

/** Any legal Discretionary Action at all, Standard Moves included (Neutral Open, 411.1). */
export function hasLegalAction(room: Room, host: RulesHost, playerId: string): boolean {
  const legal = legalIntents(room, playerId, host);
  return (
    legal.playableCardIds.length > 0 ||
    meaningfulActivations(legal.activatable) > 0 ||
    legal.moves.length > 0 ||
    (legal.hideable?.length ?? 0) > 0
  );
}

/** Nothing legal to do, and public information alone proves it. */
export function provablyNoAction(room: Room, host: RulesHost, playerId: string): boolean {
  if (holdsHiddenCards(room, host, playerId)) return false;
  return !hasLegalAction(room, host, playerId);
}

/** Both answers (always runs the full legal-intent enumeration; used by measurements). */
export function responseCheck(room: Room, host: RulesHost, playerId: string): ResponseCheck {
  const hidden = holdsHiddenCards(room, host, playerId);
  const canRespond = hasLegalResponse(room, host, playerId);
  return { canRespond, provablyNone: !canRespond && !hidden };
}

/** The information-safe check alone (cheap when the player holds hidden cards). */
export function provablyNoResponse(room: Room, host: RulesHost, playerId: string): boolean {
  if (holdsHiddenCards(room, host, playerId)) return false;
  return !hasLegalResponse(room, host, playerId);
}
