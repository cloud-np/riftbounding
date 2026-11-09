/**
 * Legal playable cards — rules 354, 355.2, 356, 357, 420.1.a/420.2.a, 811.1.b.
 *
 * A card is listed when a play of it passes the full verdict (`planCardPlay`): permission and
 * zone, timing, at least one valid Location, legal choices available, and an affordable total
 * cost (auto payment, no optional costs). `legalPlayDetails` adds what a client needs to build a
 * complete intent: the valid Locations, the optional additional costs and the cost.
 */
import type { PlayableCardDetail, Room } from "@rift/protocol";
import type { RulesHost } from "../host";
import { planCardPlay } from "../play/process";
import { playLocations } from "../play/locations";
import { cardKeywords, hasKeyword } from "../play/keywords";
import { costSummary } from "../play/cost-model";
import { facedownCardsOf, hideLocations, planHide } from "../play/hidden";
import { EXTRA_PLAY_ZONES, hasPlayPermissionProviders } from "../play/permissions";
import { flowCosts } from "../play/flow";

function candidateCards(room: Room, playerId: string, host: RulesHost): string[] {
  const ids: string[] = [];
  // 420.1.a: hand and Chosen Champion zone; 811.1.b: own facedown cards.
  for (const zone of ["hand", "champion"] as const) {
    for (const card of host.zoneCards(room, playerId, zone)) ids.push(card.id);
  }
  for (const card of facedownCardsOf(room, host, playerId)) ids.push(card.id);
  // Other zones only when an effect may grant permission (354).
  if (hasPlayPermissionProviders()) {
    for (const zone of EXTRA_PLAY_ZONES) {
      for (const card of host.zoneCards(room, playerId, zone)) ids.push(card.id);
    }
  } else {
    // 829.1.b: Flow spells in the player's own trash.
    for (const card of host.zoneCards(room, playerId, "trash")) {
      if (flowCosts(room, host, card.id).length > 0) ids.push(card.id);
    }
  }
  return ids;
}

/** One detail per playable card (the first passing location is the bare-intent default). */
export function legalPlayDetails(room: Room, playerId: string, host: RulesHost): PlayableCardDetail[] {
  const out: PlayableCardDetail[] = [];
  for (const cardId of candidateCards(room, playerId, host)) {
    const base = planCardPlay(room, playerId, cardId, { choices: {}, optionalCosts: [] }, host);
    let plan = base;
    if (!plan.ok && plan.code === "invalid_location") {
      // 355.2: the default Location may be invalid while another one works (e.g. Deploy).
      const info = host.cardInfo(room, cardId);
      const keywords = info ? cardKeywords(room, host, cardId, info) : [];
      for (const option of playLocations(room, host, { playerId, cardId, info, keywords })) {
        const attempt = planCardPlay(room, playerId, cardId, { choices: {}, optionalCosts: [], location: option.zone }, host);
        if (attempt.ok) {
          plan = attempt;
          break;
        }
      }
    }
    if (!plan.ok) continue;
    const locations = playLocations(room, host, {
      playerId,
      cardId,
      info: plan.info,
      keywords: plan.keywords,
      ...(plan.permission.facedownAt ? { facedownAt: plan.permission.facedownAt } : {}),
    })
      .map((option) => option.zone)
      .filter((zone) => planCardPlay(room, playerId, cardId, { choices: {}, optionalCosts: [], location: zone }, host).ok);
    out.push({
      cardId,
      locations,
      optionalCosts: plan.additional.filter((spec) => spec.optional).map((spec) => spec.id),
      cost: costSummary(plan.cost),
      ...(plan.permission.facedownAt ? { fromFacedown: true } : {}),
    });
  }
  return out;
}

export function legalPlayableCardIds(room: Room, playerId: string, host: RulesHost): string[] {
  return legalPlayDetails(room, playerId, host).map((detail) => detail.cardId);
}

/** 811.1.b: cards that may be hidden now and where. */
export function legalHides(room: Room, playerId: string, host: RulesHost): Array<{ cardId: string; locations: string[] }> {
  const out: Array<{ cardId: string; locations: string[] }> = [];
  const zones = hideLocations(room, host, playerId);
  if (zones.length === 0) return out;
  for (const zone of ["hand", "champion"] as const) {
    for (const card of host.zoneCards(room, playerId, zone)) {
      if (!hasKeyword(cardKeywords(room, host, card.id), "Hidden")) continue;
      const locations = zones.filter((location) => planHide(room, playerId, card.id, { location }, host).ok);
      if (locations.length > 0) out.push({ cardId: card.id, locations });
    }
  }
  return out;
}
