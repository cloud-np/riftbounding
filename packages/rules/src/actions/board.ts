/** Board read helpers used by tasks/cleanups (no engine calls beyond the host). */
import type { CardInstance, Room } from "@rift/protocol";
import type { RulesStepContext } from "../types";

export function gatherUnits(room: Room, step: RulesStepContext): CardInstance[] {
  const out: CardInstance[] = [];
  const seen = new Set<string>();
  for (const playerId of step.host.activePlayerIds(room)) {
    for (const zone of ["base", ...step.host.battlefieldZones(room)]) {
      for (const card of step.host.zoneCards(room, playerId, zone)) {
        if (seen.has(card.id)) continue;
        const info = step.host.cardInfo(room, card.id);
        if (!info?.type.toLowerCase().includes("unit")) continue;
        seen.add(card.id);
        out.push(card);
      }
    }
  }
  return out;
}
