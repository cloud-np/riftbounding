/**
 * Ignoring effects — rules 764–767.
 *
 * `{ kind: "ignore-keyword", keyword, action, here? }` modifiers make
 * their controller treat a keyword as Inactive (766) for one game action or procedure only, and
 * only for that player (767). `here: true` limits it to the source's location ("… while
 * assigning combat damage here", EX[293]).
 *
 * Consumer (to wire at merge): R2-combat's damage assignment (`action: "assign-combat-damage"`)
 * and R2-play's cost payment (`action: "pay-costs"`, EX[292] Deflect).
 */
import type { Room } from "@rift/protocol";
import type { RulesHost } from "../host";
import { activeModifiers } from "./passives";

export interface IgnoreQuery {
  /** The player performing the action (767: only the directed player ignores). */
  playerId: string;
  /** The game action or procedure, e.g. "assign-combat-damage" or "pay-costs". */
  action: string;
  /** Where the action happens (for "here" restrictions). */
  zone?: string;
}

function locationOfSource(room: Room, host: RulesHost, sourceId: string): string | null {
  if (sourceId.startsWith("battlefield:")) return sourceId.slice("battlefield:".length);
  const located = host.findCard(room, sourceId);
  if (!located) return null;
  return ["base", ...host.battlefieldZones(room)].includes(located.zone) ? located.zone : null;
}

/** Keywords the player ignores (treats as Inactive) for this action. */
export function ignoredKeywords(room: Room, host: RulesHost, query: IgnoreQuery): string[] {
  const out: string[] = [];
  for (const active of activeModifiers(room, host)) {
    const modifier = active.modifier;
    if (modifier.kind !== "ignore-keyword") continue;
    if (active.controller !== query.playerId) continue;
    if (modifier.action !== query.action) continue;
    if (modifier.here === true) {
      const location = locationOfSource(room, host, active.sourceId);
      if (!location || location !== query.zone) continue;
    }
    const keyword = modifier.keyword;
    if (!out.includes(keyword)) out.push(keyword);
  }
  return out;
}
