/**
 * Additional costs — rules 204.2, 355.1.a, 356.2, 805 (Accelerate), 809 (Deflect), 820 (Repeat).
 *
 * Sources of additional costs for one play/activation:
 *
 * - keyword-derived: Accelerate (805.1.b, optional `[1][C]`), Repeat (820.1.c, optional, one id
 *   per instance), Deflect (809.1.c/d, mandatory `[A]` × value per opponent target chosen);
 * - printed “as an additional cost” phrases (204.2, optional when worded with “may”);
 * - static registrations for scripted cards (`registerAdditionalCosts`, R2-effects/tests) and
 *   providers (`registerAdditionalCostProvider`) for costs imposed by other cards (356.2.a.1).
 *
 * Ids are stable and appear in `legalIntents` (`PlayableCardDetail.optionalCosts`) and in
 * `rules_play.optionalCosts`: "accelerate", "repeat", "repeat:<n>", "optional:<n>",
 * "mandatory:<n>", "deflect:<objectId>", or the registered id.
 */
import type { ChoiceRecord, Cost, Room, RuleRef } from "@rift/protocol";
import type { CardInfo, RulesHost } from "../host";
import { parseAdditionalCosts, parseRepeatCosts } from "./cost-text";
import { hasKeyword, keywordValue } from "./keywords";

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

const BY_CARD = new Map<string, AdditionalCostSpec[]>();
const PROVIDERS: AdditionalCostProvider[] = [];

/** Static registration for a card's own additional costs (replaces text parsing for it). */
export function registerAdditionalCosts(cardName: string, specs: AdditionalCostSpec[]): () => void {
  BY_CARD.set(cardName, specs);
  return () => {
    if (BY_CARD.get(cardName) === specs) BY_CARD.delete(cardName);
  };
}

/** Costs imposed by other cards/effects (356.2.a.1). Returns an unsubscribe function. */
export function registerAdditionalCostProvider(provider: AdditionalCostProvider): () => void {
  PROVIDERS.push(provider);
  return () => {
    const index = PROVIDERS.indexOf(provider);
    if (index >= 0) PROVIDERS.splice(index, 1);
  };
}

function cardOwnCosts(query: AdditionalCostQuery): AdditionalCostSpec[] {
  const name = query.info?.name;
  const registered = name ? BY_CARD.get(name) : undefined;
  if (registered) return registered.map((spec) => ({ ...spec }));
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
 */
function deflectCosts(room: Room, host: RulesHost, query: AdditionalCostQuery, keywordsOf: (id: string) => string[]): AdditionalCostSpec[] {
  const out: AdditionalCostSpec[] = [];
  for (const key of query.targetKeys) {
    const value = query.choices[key];
    const ids = typeof value === "string" ? [value] : Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
    for (const id of ids) {
      const located = host.findCard(room, id);
      if (!located || located.playerId === query.playerId) continue;
      const deflect = keywordValue(keywordsOf(id), "Deflect");
      if (deflect <= 0) continue;
      out.push({ id: `deflect:${id}`, optional: false, cost: { power: { any: deflect } }, rule: "809.1.c", label: "Deflect" });
    }
  }
  return out;
}

/** Every additional cost that applies to this play/activation (mandatory and optional). */
export function additionalCostsFor(
  room: Room,
  host: RulesHost,
  query: AdditionalCostQuery,
  keywordsOf: (id: string) => string[],
): AdditionalCostSpec[] {
  return [
    ...cardOwnCosts(query),
    ...deflectCosts(room, host, query, keywordsOf),
    ...PROVIDERS.flatMap((provider) => provider(room, host, query)),
  ];
}
