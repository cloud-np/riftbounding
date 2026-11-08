/** Legal Standard Moves — rules 144/450 (one entry per destination; its Units may move together, 144.3). */
import type { LegalMove, Room } from "@rift/protocol";
import type { RulesHost } from "../host";
import { moveTimingVerdict } from "../legality/move";
import { cardKeywords, hasKeyword } from "../play/keywords";

export function legalMoves(room: Room, playerId: string, host: RulesHost): LegalMove[] {
  const result: LegalMove[] = [];
  const destinations = host.battlefieldZones(room);
  const units = [
    ...host.zoneCards(room, playerId, "base").map((card) => ({ card, zone: "base" })),
    ...destinations.flatMap((zone) => host.zoneCards(room, playerId, zone).map((card) => ({ card, zone }))),
  ];
  for (const { card, zone } of units) {
    const info = host.cardInfo(room, card.id);
    if (!info?.type.toLowerCase().includes("unit")) continue;
    if (host.isExhausted(room, card.id)) continue;
    for (const to of ["base", ...destinations] as const) {
      if (to === zone) continue;
      if (zone !== "base" && to !== "base") {
        if (!hasKeyword(cardKeywords(room, host, card.id, info), "Ganking")) continue;
      }
      if (moveTimingVerdict(room, playerId, [card.id], to, host).ok) {
        const existing = result.find((move) => move.to === to);
        if (existing) existing.unitIds.push(card.id);
        else result.push({ unitIds: [card.id], to });
      }
    }
  }
  return result;
}
