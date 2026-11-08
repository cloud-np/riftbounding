/** Legal Standard Moves — rules 144/450. */
import type { LegalMove, Room } from "@rift/protocol";
import type { RulesHost } from "../host";
import { moveTimingVerdict } from "../legality/move";

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
        if (!info.keywords.some((keyword) => keyword.toLowerCase() === "ganking")) continue;
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
