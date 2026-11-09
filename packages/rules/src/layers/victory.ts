/**
 * Victory Score adjustments — "Increase the points needed to win the game by N" (Aspirant's
 * Climb). Sums `{ kind: "victory-score", amount }` modifiers.
 * Consumer (to wire at merge): wherever the Victory Score is compared (474 / 432.3.c).
 */
import type { Room } from "@rift/protocol";
import type { RulesHost } from "../host";
import { activeModifiers } from "./passives";

export function victoryScoreAdjustment(room: Room, host: RulesHost): number {
  let total = 0;
  for (const active of activeModifiers(room, host)) {
    const modifier = active.modifier;
    if (modifier.kind !== "victory-score") continue;
    const amount = modifier.amount;
    total += typeof amount === "number" ? amount : 0;
  }
  return total;
}
