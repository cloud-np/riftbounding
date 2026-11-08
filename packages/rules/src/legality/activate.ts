/**
 * Activated ability verdicts — rules 376–381, 399–407, 403.3, 430, 818, §6.4 (NEW-12).
 *
 * `activateIntentVerdict` is the one verdict for a `rules_activate` intent (write path and
 * `explainIllegal`); `activationVerdict` (R1 signature) checks a bare activation (no choices,
 * auto payment). Refs come from `play/abilities.ts`: scripted `activated:<i>`, unscripted
 * `manual:<n>` (R2-effects' `listActivatedAbilities`; resolves in the manual window), Basic
 * Rune `rune:exhaust`/`rune:recycle` and `equip:<n>`.
 */
import type { Room, RulesActivateIntent } from "@rift/protocol";
import type { LocatedCard, RulesHost } from "../host";
import type { RulesFailure } from "../types";
import { activatedAbilitiesOf, type ActivatedAbility } from "../play/abilities";
import { planActivation, type ActivationPlan } from "../play/activation";
import { requestFromIntent } from "../play/request";
import { boardZones } from "./timing";

export type { ActivatedAbility };

export interface ActivationVerdictOk extends ActivationPlan {
  located: LocatedCard;
  ability: ActivatedAbility;
  ref: string;
  keywords: string[];
}

export type ActivationVerdict = ActivationVerdictOk | RulesFailure;

function withAbility(plan: ReturnType<typeof planActivation>): ActivationVerdict {
  return plan.ok ? { ...plan, ability: plan.entry.ability } : plan;
}

/** 376–381/403.3: a bare activation verdict (R1 signature). */
export function activationVerdict(
  room: Room,
  playerId: string,
  objectId: string,
  abilityRef: string | undefined,
  host: RulesHost,
): ActivationVerdict {
  return withAbility(planActivation(room, playerId, objectId, abilityRef, { choices: {}, optionalCosts: [] }, host));
}

/** The full verdict for a `rules_activate` intent (choices, optional costs, payment). */
export function activateIntentVerdict(room: Room, playerId: string, intent: RulesActivateIntent, host: RulesHost): ActivationVerdict {
  return withAbility(planActivation(room, playerId, intent.objectId, intent.ability, requestFromIntent(intent), host));
}

/**
 * Every activation `playerId` could make now (one stable ref scheme, F7): only abilities whose
 * verdict passes — timing, conditions, legal choices and an affordable cost.
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
      const located = host.findCard(room, card.id);
      if (!located) continue;
      for (const entry of activatedAbilitiesOf(room, host, located)) {
        if (activationVerdict(room, playerId, card.id, entry.ref, host).ok) {
          result.push({ objectId: card.id, ability: entry.ref });
        }
      }
    }
  }
  return result;
}
