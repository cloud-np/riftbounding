/**
 * Entry replacements — rule 369.3 ("I enter ready" / "units you play … enter ready").
 *
 * `{ kind: "enter-ready", target?, battlefieldYouControl? }` modifiers
 * replace a played unit entering exhausted with entering ready (EX[134]); 805.6/805.6.a: the
 * unit never becomes ready afterwards, so no "ready" event is emitted.
 */
import type { Room, Selector } from "@rift/protocol";
import type { RulesHost } from "../host";
import { activeModifiers } from "./passives";
import { modifierTargets } from "./index";
import { hasUnitPresentAt } from "../state/presence";

export function enterReadyApplies(
  room: Room,
  host: RulesHost,
  unitId: string,
  controller: string,
  zone: string,
): boolean {
  for (const active of activeModifiers(room, host)) {
    const modifier = active.modifier;
    if (modifier.kind !== "enter-ready") continue;
    if (active.controller !== controller) continue;
    if (modifier.battlefieldYouControl === true) {
      if (!(host.battlefieldZones(room) as string[]).includes(zone)) continue;
      const present = host.activePlayerIds(room).filter((id) => hasUnitPresentAt(room, host, id, zone));
      if (present.length !== 1 || present[0] !== controller) continue;
    }
    const target = modifier.target;
    if (target && !modifierTargets(room, host, active, unitId, 1, { target })) continue;
    return true;
  }
  return false;
}
