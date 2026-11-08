import { resolveCard, type Card, type DeckSections, type ParsedDeckEntry } from "@rift/cards";

import { DOMAIN_ORDER, normalizedDomainOrder } from "./catalog";
import { T } from "./strings";

export interface StatBucket {
  key: string;
  label: string;
  count: number;
  percent: number;
}

export interface DomainRow {
  key: string;
  label: string;
  cards: number;
  power: number;
  runes: number | null;
  domains: string[];
}

export interface PowerSegment {
  key: string;
  label: string;
  power: number;
  percent: number;
  domains: string[];
}

export interface KeywordRow {
  keyword: string;
  count: number;
}

export interface TypeDistribution {
  unit: number;
  spell: number;
  gear: number;
  champion: number;
  unknown: number;
}

export interface DeckStats {
  totalMainDeckCards: number;
  knownMainDeckCards: number;
  unknownMainDeckCards: number;
  averageEnergy: number | null;
  averageMight: number | null;
  unitCount: number;
  powerCardCount: number;
  typeDistribution: TypeDistribution;
  energyCurve: StatBucket[];
  mightCurve: StatBucket[];
  powerCostCurve: StatBucket[];
  powerSegments: PowerSegment[];
  runeSegments: StatBucket[];
  domainRows: DomainRow[];
  keywords: KeywordRow[];
}

interface UniqueCard {
  card: Card;
  count: number;
}

function percent(count: number, total: number): number {
  return total > 0 ? (count / total) * 100 : 0;
}

function uniqueMainDeck(entries: readonly ParsedDeckEntry[]): UniqueCard[] {
  const byName = new Map<string, UniqueCard>();
  for (const entry of entries) {
    const card = resolveCard(entry.cardCode, entry.name);
    if (!card) continue;
    const key = card.name.trim().toLowerCase();
    const existing = byName.get(key);
    if (existing) existing.count += entry.count;
    else byName.set(key, { card, count: entry.count });
  }
  return [...byName.values()];
}

function comboOf(domains: readonly string[] | undefined): string[] {
  return normalizedDomainOrder(domains);
}

function comboLabel(domains: readonly string[]): string {
  return domains.length > 0 ? domains.join(" / ") : T.unknown;
}

function fillBuckets(
  counts: Map<number, number>,
  min: number,
  max: number,
  total: number,
  label: (value: number) => string,
): StatBucket[] {
  const out: StatBucket[] = [];
  for (let value = min; value <= max; value += 1) {
    const count = counts.get(value) ?? 0;
    out.push({
      key: String(value),
      label: label(value),
      count,
      percent: percent(count, total),
    });
  }
  return out;
}

/** `18660` — the original deck stats, computed from the Main Deck only. */
export function computeDeckStats(
  sections: DeckSections,
  options: { championCount?: number } = {},
): DeckStats {
  const cards = uniqueMainDeck(sections.mainDeck);
  const total = cards.reduce((sum, item) => sum + item.count, 0);
  const known = cards.filter((item) => Number.isFinite(item.card.energyCost));
  const knownCards = known.reduce((sum, item) => sum + item.count, 0);
  const unknownCards = total - knownCards;
  const energySum = known.reduce((sum, item) => sum + item.card.energyCost * item.count, 0);

  const units = cards.filter(
    (item) => item.card.type.includes("Unit") && Number(item.card.might) > 0,
  );
  const unitCount = cards
    .filter((item) => item.card.type.includes("Unit"))
    .reduce((sum, item) => sum + item.count, 0);
  const mightSum = units.reduce((sum, item) => sum + (item.card.might ?? 0) * item.count, 0);
  const mightCount = units.reduce((sum, item) => sum + item.count, 0);

  const powerCards = cards.filter((item) => (item.card.powerCost ?? 0) > 0);
  const powerCardCount = powerCards.reduce((sum, item) => sum + item.count, 0);
  const totalPower = powerCards.reduce(
    (sum, item) => sum + (item.card.powerCost ?? 0) * item.count,
    0,
  );

  const typeDistribution: TypeDistribution = {
    unit: 0,
    spell: 0,
    gear: 0,
    champion: options.championCount ?? 0,
    unknown: 0,
  };
  for (const item of cards) {
    const type = item.card.type.toLowerCase();
    if (type.includes("unit")) typeDistribution.unit += item.count;
    else if (type.includes("spell")) typeDistribution.spell += item.count;
    else if (type.includes("gear")) typeDistribution.gear += item.count;
    else typeDistribution.unknown += item.count;
  }

  const energyCounts = new Map<number, number>();
  for (const item of known) {
    energyCounts.set(
      item.card.energyCost,
      (energyCounts.get(item.card.energyCost) ?? 0) + item.count,
    );
  }
  const maxEnergy = Math.max(0, ...known.map((item) => item.card.energyCost));
  const energyCurve = fillBuckets(energyCounts, 0, maxEnergy, total, (value) => String(value));
  if (unknownCards > 0) {
    energyCurve.push({
      key: "unknown",
      label: T.unknown,
      count: unknownCards,
      percent: percent(unknownCards, total),
    });
  }

  const mightCounts = new Map<number, number>();
  for (const item of units) {
    mightCounts.set(item.card.might, (mightCounts.get(item.card.might) ?? 0) + item.count);
  }
  const mightValues = units.map((item) => item.card.might);
  const mightCurve =
    mightValues.length > 0
      ? fillBuckets(
          mightCounts,
          Math.min(...mightValues),
          Math.max(...mightValues),
          mightCount,
          (value) => String(value),
        )
      : [];

  const powerCounts = new Map<number, number>();
  for (const item of powerCards) {
    powerCounts.set(
      item.card.powerCost ?? 0,
      (powerCounts.get(item.card.powerCost ?? 0) ?? 0) + item.count,
    );
  }
  const maxPower = Math.max(0, ...powerCards.map((item) => item.card.powerCost ?? 0));
  const powerCostCurve = fillBuckets(powerCounts, 1, Math.max(1, maxPower), total, (value) =>
    String(value),
  );

  const comboBuckets = new Map<string, { domains: string[]; cards: number; power: number }>();
  for (const item of cards) {
    const domains = comboOf(item.card.domains);
    const key = comboLabel(domains);
    const bucket = comboBuckets.get(key) ?? { domains, cards: 0, power: 0 };
    bucket.cards += item.count;
    bucket.power += (item.card.powerCost ?? 0) * item.count;
    comboBuckets.set(key, bucket);
  }

  const powerSegments: PowerSegment[] = [...comboBuckets.values()]
    .filter((bucket) => bucket.power > 0)
    .sort((a, b) => {
      if (a.domains.length !== b.domains.length) return a.domains.length - b.domains.length;
      return (
        DOMAIN_ORDER.indexOf((a.domains[0] ?? "Unknown") as (typeof DOMAIN_ORDER)[number]) -
        DOMAIN_ORDER.indexOf((b.domains[0] ?? "Unknown") as (typeof DOMAIN_ORDER)[number])
      );
    })
    .map((bucket) => ({
      key: comboLabel(bucket.domains),
      label: comboLabel(bucket.domains),
      power: bucket.power,
      percent: percent(bucket.power, totalPower),
      domains: bucket.domains,
    }));

  const runeCounts = new Map<string, number>();
  for (const entry of sections.runes) {
    const card = resolveCard(entry.cardCode, entry.name);
    const domains = comboOf(card?.domains);
    const domain = domains[0] ?? T.unknown;
    runeCounts.set(domain, (runeCounts.get(domain) ?? 0) + entry.count);
  }
  const totalRunes = [...runeCounts.values()].reduce((sum, count) => sum + count, 0);
  const runeSegments: StatBucket[] = [...runeCounts.entries()].map(([domain, count]) => ({
    key: domain,
    label: domain,
    count,
    percent: percent(count, totalRunes),
  }));

  const domainRows: DomainRow[] = [];
  for (const domain of DOMAIN_ORDER) {
    const cardsWithDomain = cards
      .filter((item) => item.card.domains.includes(domain))
      .reduce((sum, item) => sum + item.count, 0);
    const runes = runeCounts.get(domain) ?? 0;
    if (cardsWithDomain === 0 && runes === 0) continue;
    const exact = comboBuckets.get(domain);
    domainRows.push({
      key: domain,
      label: domain,
      cards: cardsWithDomain,
      power: exact?.power ?? 0,
      runes: runes > 0 ? runes : 0,
      domains: [domain],
    });
  }
  const comboRows: DomainRow[] = [...comboBuckets.entries()]
    .filter(([, bucket]) => bucket.domains.length > 1)
    .sort(([, a], [, b]) => {
      for (let index = 0; index < Math.max(a.domains.length, b.domains.length); index += 1) {
        const left = DOMAIN_ORDER.indexOf(
          (a.domains[index] ?? "Unknown") as (typeof DOMAIN_ORDER)[number],
        );
        const right = DOMAIN_ORDER.indexOf(
          (b.domains[index] ?? "Unknown") as (typeof DOMAIN_ORDER)[number],
        );
        if (left !== right) return left - right;
      }
      return 0;
    })
    .map(([label, bucket]) => ({
      key: label,
      label,
      cards: bucket.cards,
      power: bucket.power,
      runes: null,
      domains: bucket.domains,
    }));

  const keywordCounts = new Map<string, number>();
  for (const item of cards) {
    for (const keyword of item.card.keywords ?? []) {
      keywordCounts.set(keyword, (keywordCounts.get(keyword) ?? 0) + item.count);
    }
  }
  const keywords = [...keywordCounts.entries()]
    .map(([keyword, count]) => ({ keyword, count }))
    .sort((a, b) => (b.count !== a.count ? b.count - a.count : a.keyword.localeCompare(b.keyword)));

  return {
    totalMainDeckCards: total,
    knownMainDeckCards: knownCards,
    unknownMainDeckCards: unknownCards,
    averageEnergy: knownCards > 0 ? energySum / knownCards : null,
    averageMight: mightCount > 0 ? mightSum / mightCount : null,
    unitCount,
    powerCardCount,
    typeDistribution,
    energyCurve,
    mightCurve,
    powerCostCurve,
    powerSegments,
    runeSegments,
    domainRows: [...domainRows, ...comboRows],
    keywords,
  };
}
