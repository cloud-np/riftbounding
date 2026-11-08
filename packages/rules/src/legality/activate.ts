/** Activated ability verdicts — rules 376–381, 399, 403.3. */
import type { Ability, Room } from "@rift/protocol";
import type { LocatedCard, RulesHost } from "../host";
import type { RulesFailure } from "../types";
import { fail } from "../types";
import { getCardScript, lookupAbility } from "../cards/registry";
import { abilityTimingVerdict, boardZones } from "./timing";

export type ActivatedAbility = Extract<Ability, { kind: "activated" }>;

export interface ActivationVerdictOk {
  ok: true;
  located: LocatedCard;
  ability: ActivatedAbility;
  ref: string;
  keywords: string[];
}

export type ActivationVerdict = ActivationVerdictOk | RulesFailure;

/**
 * 376–381/403.3: an Activated Ability can only be activated from a Game Object on the Board
 * (107/056.1), must resolve to an ability of kind "activated", and must be legally timed. The
 * ability's own keywords drive timing; `addsResources` never grants an Action permission
 * (430.3 only says Reaction-tagged Add abilities may be activated while paying resources).
 */
export function activationVerdict(
  room: Room,
  playerId: string,
  objectId: string,
  abilityRef: string | undefined,
  host: RulesHost,
): ActivationVerdict {
  const located = host.findCard(room, objectId);
  if (!located || located.playerId !== playerId) return fail("card_not_found", "399");
  if (!boardZones(room, host).includes(located.zone)) {
    return fail("illegal_action", "380", "source is not on the board");
  }
  const ref = typeof abilityRef === "string" && abilityRef.length > 0 ? abilityRef : "activated:0";
  const lookup = lookupAbility(located.card.name, ref);
  if (!lookup || lookup.ability.kind !== "activated") {
    return fail("illegal_action", "403.3", "ability is not an activated ability");
  }
  const keywords = (lookup.ability.keywords ?? []).map((keyword) => String(keyword));
  const timing = abilityTimingVerdict(room, playerId, keywords);
  if (!timing.ok) return timing;
  return { ok: true, located, ability: lookup.ability, ref, keywords };
}

/**
 * One stable ability-ref scheme everywhere: `activated:<index>` indexes the script's full
 * `abilities` array (not the filtered activated-only list). Returns refs that
 * `lookupAbility`/`activationVerdict` resolve identically.
 */
export function activatableAbilities(
  room: Room,
  playerId: string,
  host: RulesHost,
): Array<{ objectId: string; ability: string }> {
  const result: Array<{ objectId: string; ability: string }> = [];
  if (!room.rules || room.gameOutcome) return result;
  for (const zone of boardZones(room, host)) {
    for (const card of host.zoneCards(room, playerId, zone)) {
      const script = getCardScript(card.name);
      if (!script) continue;
      script.abilities.forEach((ability, index) => {
        if (ability.kind !== "activated") return;
        const keywords = (ability.keywords ?? []).map((keyword) => String(keyword));
        if (abilityTimingVerdict(room, playerId, keywords).ok) {
          result.push({ objectId: card.id, ability: `activated:${index}` });
        }
      });
    }
  }
  return result;
}
