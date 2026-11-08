/** Legal playable cards — rule 420.1.a. */
import type { Room } from "@rift/protocol";
import type { RulesHost } from "../host";
import { playCardVerdict } from "../legality/play";

export function legalPlayableCardIds(room: Room, playerId: string, host: RulesHost): string[] {
  const result: string[] = [];
  // 420.1.a: cards are played from hand or the Chosen Champion zone.
  for (const zone of ["hand", "champion"] as const) {
    for (const card of host.zoneCards(room, playerId, zone)) {
      if (playCardVerdict(room, playerId, card.id, host).ok) result.push(card.id);
    }
  }
  return result;
}
