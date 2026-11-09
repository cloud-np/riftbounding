/**
 * Additional costs — rules 204.2, 355.1.a, 356.2, 805 (Accelerate), 809 (Deflect), 820 (Repeat).
 *
 * Sources of additional costs for one play/activation:
 *
 * - keyword-derived: Accelerate (805.1.b, optional `[1][C]`), Repeat (820.1.c, optional, one id
 *   per instance), Deflect (809.1.c/d, mandatory `[A]` × value per opponent target chosen);
 * - printed “as an additional cost” phrases (204.2, optional when worded with “may”);
 * - the card script's own `additionalCosts` (a `condition` limits when one is offered,
 *   356.2.b.1), which replace the text parser for that card; tests may override them by name;
 * - providers (`registerAdditionalCostProvider`) for costs imposed by other cards (356.2.a.1).
 *
 * Ids are stable and appear in `legalIntents` (`PlayableCardDetail.optionalCosts`) and in
 * `rules_play.optionalCosts`: "accelerate", "repeat", "repeat:<n>", "optional:<n>",
 * "mandatory:<n>", "deflect:<objectId>", or the registered id.
 */
import type { ChoiceRecord, Cost, Room, RuleRef } from "@rift/protocol";
import type { CardInfo, RulesHost } from "../host";
import { effectiveKeywordValues } from "../layers";
import { parseAdditionalCosts, parseRepeatCosts } from "./cost-text";
import { hasKeyword, keywordValue } from "./keywords";
import { keyedRegistry, orderedRegistry } from "../registry-table";
import { getCardScript } from "../cards/registry";
import { makeEnv } from "../effects/env";
import { evaluateCondition } from "../effects/evaluate";

export interface AdditionalCostSpec {
  id: string;
  optional: boolean;
  cost: Cost;
  rule: RuleRef;
  label?: string;
}

export interface AdditionalCostQuery {
  playerId: string;
  /** The card being played (card plays) or the source object (activations). */
  cardId?: string;
  objectId?: string;
  abilityRef?: string;
  info: CardInfo | null;
  /** Effective keywords of the card/ability (printed + granted). */
  keywords: readonly string[];
  kind: "card" | "activated";
  choices: ChoiceRecord;
  /** Choice keys whose values are Targets (355.7), for Deflect. */
  targetKeys: readonly string[];
}

export type AdditionalCostProvider = (room: Room, host: RulesHost, query: AdditionalCostQuery) => AdditionalCostSpec[];

/** G1: a card's own additional costs, keyed by card name; duplicates throw (tests: `src/testing.ts`). */
export const ADDITIONAL_COSTS_BY_CARD = keyedRegistry<AdditionalCostSpec[]>("additional costs");
const PROVIDER_REGISTRY = orderedRegistry<AdditionalCostProvider>("additional cost provider");
const PROVIDERS = PROVIDER_REGISTRY.list;

/**
 * Engine/test registration of a card's own additional costs by name (replaces the script's
 * `additionalCosts` and the text parser). Card scripts declare `additionalCosts` instead.
 */
export function registerAdditionalCosts(cardName: string, specs: AdditionalCostSpec[]): () => void {
  ADDITIONAL_COSTS_BY_CARD.register(cardName, specs);
  return () => {
    if (ADDITIONAL_COSTS_BY_CARD.get(cardName) === specs) ADDITIONAL_COSTS_BY_CARD.unregister(cardName);
  };
}

/** Costs imposed by other cards/effects (356.2.a.1). Returns an unsubscribe function. */
export function registerAdditionalCostProvider(provider: AdditionalCostProvider): () => void {
  return PROVIDER_REGISTRY.register(provider);
}

function cardOwnCosts(room: Room, host: RulesHost, query: AdditionalCostQuery): AdditionalCostSpec[] {
  const name = query.info?.name;
  const registered = ADDITIONAL_COSTS_BY_CARD.get(name);
  if (registered) return registered.map((spec) => ({ ...spec }));
  const scripted = getCardScript(name)?.additionalCosts;
  if (scripted) {
    const source = query.cardId ?? query.objectId;
    const ctx = { room, host, env: makeEnv({ controller: query.playerId, ...(source ? { sourceObjectId: source } : {}) }) };
    return scripted
      .filter((spec) => !spec.condition || evaluateCondition(ctx, spec.condition))
      .map(({ condition: _condition, ...spec }) => ({ ...spec, rule: spec.rule as RuleRef }));
  }
  const out: AdditionalCostSpec[] = [];
  if (query.kind !== "card") return out;
  const type = (query.info?.type ?? "").toLowerCase();
  // 805.1.a/b: Accelerate on a Unit → "you may pay [1][C] as an additional cost".
  if (type.includes("unit") && hasKeyword(query.keywords, "Accelerate")) {
    out.push({ id: "accelerate", optional: true, cost: { energy: 1, additional: { "power:self": 1 } }, rule: "805.1.b", label: "Accelerate" });
  }
  // 820.1.c: each Repeat instance is its own optional additional cost.
  parseRepeatCosts(query.info?.text).forEach((cost, index) => {
    out.push({ id: index === 0 ? "repeat" : `repeat:${index}`, optional: true, cost, rule: "820.1.c", label: "Repeat" });
  });
  let optional = 0;
  let mandatory = 0;
  for (const entry of parseAdditionalCosts(query.info?.text)) {
    const id = entry.optional ? `optional:${optional++}` : `mandatory:${mandatory++}`;
    out.push({ id, optional: entry.optional, cost: entry.cost, rule: entry.optional ? "356.2.b.1" : "356.2.a.1", label: entry.text });
  }
  return out;
}

/**
 * 809.1.c/d: an opponent's Deflect makes each choice of it cost [A] × Deflect value more
 * (Power of any Domain, 809.1.c.1). Mandatory additional cost.
 *
 * The value comes from `effectiveKeywordValues` (printed text + object grants + keyword
 * passives/continuous effects, 809.2), with the array form as a fallback: the array carries bare
 * keyword names, so it charges [Deflect 2] as 1. Taking the max avoids double counting when the
 * catalog stores both "Deflect" and "Deflect 2" (verified on Nasus, Ascended).
 */
export function deflectCostsForTargets(
  room: Room,
  host: RulesHost,
  playerId: string,
  choices: ChoiceRecord,
  targetKeys: readonly string[],
  keywordsOf: (id: string) => string[] = () => [],
): AdditionalCostSpec[] {
  const out: AdditionalCostSpec[] = [];
  for (const key of targetKeys) {
    const value = choices[key];
    const ids = typeof value === "string" ? [value] : Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
    for (const id of ids) {
      const located = host.findCard(room, id);
      if (!located || located.playerId === playerId) continue;
      const deflect = Math.max(
        keywordValue(keywordsOf(id), "Deflect"),
        effectiveKeywordValues(room, id, host).deflect ?? 0,
      );
      if (deflect <= 0) continue;
      out.push({ id: `deflect:${id}`, optional: false, cost: { power: { any: deflect } }, rule: "809.1.c", label: "Deflect" });
    }
  }
  return out;
}

function deflectCosts(room: Room, host: RulesHost, query: AdditionalCostQuery, keywordsOf: (id: string) => string[]): AdditionalCostSpec[] {
  return deflectCostsForTargets(room, host, query.playerId, query.choices, query.targetKeys, keywordsOf);
}

/** Every additional cost that applies to this play/activation (mandatory and optional). */
export function additionalCostsFor(
  room: Room,
  host: RulesHost,
  query: AdditionalCostQuery,
  keywordsOf: (id: string) => string[],
): AdditionalCostSpec[] {
  return [
    ...cardOwnCosts(room, host, query),
    ...deflectCosts(room, host, query, keywordsOf),
    ...PROVIDERS.flatMap((provider) => provider(room, host, query)),
  ];
}
