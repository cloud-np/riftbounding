"use client";

import type { ParsedDeck } from "./types";
import { getDeckStats } from "./deck-adapter";
import { strings } from "./strings";

const TYPE_COLORS: Record<string, string> = {
  Unit: "#63c8f2",
  Spell: "#b991ff",
  Gear: "#f0c86e",
  Champion: "#7bdeb7",
  Legend: "#7bdeb7",
  Battlefield: "#f0c86e",
};

const DOMAIN_COLORS: Record<string, string> = {
  Fury: "#ff8a8a",
  Calm: "#7bdeb7",
  Mind: "#9db8ff",
  Body: "#f0c86e",
  Chaos: "#c99cff",
  Order: "#8fd8ff",
  Unknown: "#94a3b8",
};

const ENERGY_COSTS = [0, 1, 2, 3, 4, 5, 6, 7, 8] as const;
const ENERGY_SERIES = ["Unit", "Spell", "Gear", "Champion"] as const;

function colorFor(key: string, index: number): string {
  return (
    TYPE_COLORS[key] ??
    DOMAIN_COLORS[key] ??
    ["#7edcff", "#b991ff", "#f0c86e", "#7bdeb7", "#c99cff"][index % 5] ??
    "#7edcff"
  );
}

function formatNumber(value: number | null, digits = 1): string {
  if (value === null || !Number.isFinite(value)) return "N/A";
  return value.toFixed(digits).replace(/\.0$/, "");
}

function domainSlug(domain: string): string {
  return domain.trim().toLowerCase().replace(/\s+/g, "");
}

function DomainIcon({ domain, className = "size-3.5" }: { domain: string; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      alt=""
      aria-hidden="true"
      width={24}
      height={24}
      className={`${className} shrink-0 object-contain`}
      src={`/riftbound/static/icons/${domainSlug(domain)}.webp`}
    />
  );
}

function DomainBadge({ domains }: { domains: string[] }) {
  return (
    <span className="inline-flex items-center">
      {domains.map((domain, index) => (
        <span
          key={domain}
          className={index > 0 ? "-ml-1 inline-flex" : "inline-flex"}
          title={domain}
        >
          <DomainIcon domain={domain} />
        </span>
      ))}
    </span>
  );
}

export function DeckStats({ deck }: { deck: ParsedDeck }) {
  const stats = getDeckStats(deck);
  const typeCounts = new Map(stats.typeDistribution.map((entry) => [entry.type, entry.count]));

  const buckets = ENERGY_COSTS.map((cost) => {
    const entries = deck.sections.mainDeck.filter((entry) => entry.energyCost === cost);
    const byType = ENERGY_SERIES.map((type) => ({
      type,
      count: entries
        .filter((entry) => (entry.types?.[0] ?? "") === type)
        .reduce((sum, entry) => sum + entry.count, 0),
    })).filter((series) => series.count > 0);
    const total = entries.reduce((sum, entry) => sum + entry.count, 0);
    return { cost, total, byType };
  });
  const maxCurve = Math.max(1, ...buckets.map((bucket) => bucket.total));

  const powerTotal = stats.powerDemand.reduce((sum, bucket) => sum + bucket.power, 0);
  const runeTotal = stats.runeDistribution.reduce((sum, bucket) => sum + bucket.count, 0);

  const powerCosts = new Map<number, number>();
  for (const entry of deck.sections.mainDeck) {
    const cost = entry.powerCost ?? 0;
    if (cost > 0) powerCosts.set(cost, (powerCosts.get(cost) ?? 0) + entry.count);
  }

  const mightBuckets = Object.entries(
    deck.sections.mainDeck.reduce<Record<string, number>>((acc, entry) => {
      if ((entry.might ?? 0) <= 0) return acc;
      const key = String(entry.might);
      acc[key] = (acc[key] ?? 0) + entry.count;
      return acc;
    }, {}),
  )
    .map(([might, count]) => ({ might: Number(might), count }))
    .sort((a, b) => a.might - b.might);
  const maxMight = Math.max(1, ...mightBuckets.map((bucket) => bucket.count));

  return (
    <div
      id="deck-stats-panel"
      role="tabpanel"
      aria-labelledby="deck-stats-tab"
      className="grid gap-5"
    >
      <div className="flex flex-wrap items-start gap-x-10 gap-y-4">
        <Stat
          label={strings["current.deckStats.mainDeck"]}
          value={String(stats.totalMainDeckCards)}
        />
        <Stat
          label={strings["current.deckStats.avgEnergy"]}
          value={formatNumber(stats.averageEnergy)}
        />
        <Stat
          label={strings["current.deckStats.avgMight"]}
          value={formatNumber(stats.averageMight)}
        />
        <Stat
          label={strings["current.deckStats.powerCards"]}
          value={String(stats.powerCardCount)}
        />
      </div>

      {stats.energyCurve.length > 0 ? (
        <section className="grid gap-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[#9fb2c8]">
              {strings["current.deckStats.energyCurve"]}
            </p>
            <div className="flex flex-wrap items-center gap-3 text-[0.62rem] text-[#c7d4e4]">
              {ENERGY_SERIES.map((type) => (
                <span key={type} className="inline-flex items-center gap-1.5">
                  <span
                    className="size-2 rounded-[2px]"
                    style={{ background: colorFor(type, 0) }}
                  />
                  {type}
                  {typeCounts.get(type) ? (
                    <span className="text-[#eef6ff]">{typeCounts.get(type)}</span>
                  ) : null}
                </span>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-9 items-end gap-2 border-b border-[rgba(132,150,184,0.22)] px-1 pb-1 pt-5">
            {buckets.map((bucket) => (
              <div key={bucket.cost} className="grid min-w-0 justify-items-center gap-1">
                <span className="text-[0.66rem] leading-none text-[#dce8f6]">
                  {bucket.total > 0 ? bucket.total : ""}
                </span>
                <div
                  className="flex w-full max-w-11 flex-col justify-end overflow-hidden"
                  style={{ height: `${Math.max(3, (bucket.total / maxCurve) * 110)}px` }}
                  aria-hidden="true"
                >
                  {bucket.byType.map((series) => (
                    <span
                      key={series.type}
                      title={`${series.type} · ${series.count}`}
                      style={{
                        background: colorFor(series.type, 0),
                        flexGrow: series.count,
                        minHeight: 2,
                      }}
                    />
                  ))}
                </div>
                <span className="text-[0.62rem] leading-none text-[#9fb2c8]">{bucket.cost}</span>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <p className="text-[0.8rem] text-[#8f8499]">{strings["current.deckStats.empty"]}</p>
      )}

      {stats.powerDemand.length > 0 || stats.runeDistribution.length > 0 ? (
        <section className="grid gap-2.5">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[#9fb2c8]">
            {strings["current.deckStats.powerAndRunes"]}
          </p>
          {stats.powerDemand.length > 0 ? (
            <div className="grid grid-cols-[3.4rem_minmax(0,1fr)] items-center gap-2 text-[0.7rem] text-[#d7e5f5]">
              <span>{strings["current.deckStats.power"]}</span>
              <span className="flex h-5 overflow-hidden rounded-[2px]">
                {stats.powerDemand.map((bucket, index) => {
                  const share = Math.round((bucket.power / Math.max(1, powerTotal)) * 100);
                  const color = colorFor(bucket.domains[0] ?? "Unknown", index);
                  const stripe =
                    bucket.domains.length > 1
                      ? `repeating-linear-gradient(135deg, ${color} 0 6px, ${colorFor(
                          bucket.domains[1] ?? "Unknown",
                          index + 1,
                        )} 6px 12px)`
                      : color;
                  return (
                    <span
                      key={bucket.domains.join("/")}
                      className="flex items-center justify-center text-[0.58rem] font-semibold text-[#07101c]"
                      style={{ background: stripe, flexGrow: bucket.power }}
                      title={`${bucket.domains.join("/")} · ${bucket.power}`}
                    >
                      {share >= 7 ? `${share}%` : ""}
                    </span>
                  );
                })}
              </span>
            </div>
          ) : null}
          {stats.runeDistribution.length > 0 ? (
            <div className="grid grid-cols-[3.4rem_minmax(0,1fr)] items-center gap-2 text-[0.7rem] text-[#d7e5f5]">
              <span>{strings["current.deckStats.runes"]}</span>
              <span className="flex h-5 overflow-hidden rounded-[2px]">
                {stats.runeDistribution.map((bucket, index) => (
                  <span
                    key={bucket.domain}
                    className="flex items-center justify-center text-[0.58rem] font-semibold text-[#07101c]"
                    style={{
                      background: colorFor(bucket.domain, index),
                      flexGrow: bucket.count,
                    }}
                    title={`${bucket.domain} · ${bucket.count}`}
                  >
                    {Math.round((bucket.count / Math.max(1, runeTotal)) * 100)}%
                  </span>
                ))}
              </span>
            </div>
          ) : null}
          {stats.powerDemand.length > 0 ? (
            <div className="grid gap-1 text-[0.72rem] text-[#b9c7da]">
              <div className="grid grid-cols-[minmax(0,1fr)_3rem_3rem_3rem] gap-2 border-b border-[rgba(132,150,184,0.18)] pb-1 text-[0.58rem] uppercase tracking-[0.1em] text-[#8fa3be]">
                <span>{strings["current.deckStats.domain"]}</span>
                <span className="text-right">{strings["current.deckStats.cards"]}</span>
                <span className="text-right">{strings["current.deckStats.power"]}</span>
                <span className="text-right">{strings["current.deckStats.runes"]}</span>
              </div>
              {stats.powerDemand.map((bucket) => {
                const rune =
                  bucket.domains.length === 1
                    ? stats.runeDistribution.find((rune) => rune.domain === bucket.domains[0])
                    : undefined;
                return (
                  <div
                    key={bucket.domains.join("/")}
                    className="grid grid-cols-[minmax(0,1fr)_3rem_3rem_3rem] items-center gap-2"
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      <DomainBadge domains={bucket.domains} />
                      <span className="truncate">{bucket.domains.join("/")}</span>
                    </span>
                    <span className="text-right">{bucket.cards}</span>
                    <span className="text-right">{bucket.power}</span>
                    <span className="text-right">{rune?.count ?? "–"}</span>
                  </div>
                );
              })}
            </div>
          ) : null}
          {powerCosts.size > 0 ? (
            <div className="flex flex-wrap items-center gap-2 pt-1 text-[0.68rem] text-[#9fb2c8]">
              <span>{strings["current.deckStats.powerCost"]}</span>
              {[...powerCosts.entries()]
                .sort(([a], [b]) => a - b)
                .map(([cost, count]) => (
                  <span key={cost} className="inline-flex items-center gap-1">
                    <span className="grid size-4 place-items-center rounded-full bg-[rgba(123,222,183,0.18)] text-[0.6rem] font-semibold text-[#9cf0cd]">
                      {cost}
                    </span>
                    <span className="text-[0.68rem] font-semibold text-[#c7a9ff]">{count}</span>
                  </span>
                ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {stats.hasCardMetadata && mightBuckets.length > 0 ? (
        <section className="grid gap-2">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[#9fb2c8]">
            {strings["current.deckStats.unitMight"]}
          </p>
          <div className="grid grid-cols-9 items-end gap-2 border-b border-[rgba(132,150,184,0.22)] px-1 pb-1 pt-2">
            {Array.from({ length: 9 }, (_, index) => {
              const bucket = mightBuckets.find((entry) => entry.might === index + 1);
              return (
                <div key={index} className="grid min-w-0 justify-items-center gap-1">
                  <span className="text-[0.62rem] leading-none text-[#cfe0f2]">
                    {bucket?.count ?? ""}
                  </span>
                  {bucket ? (
                    <span
                      className="w-full max-w-11 bg-[#63c8f2]"
                      style={{
                        height: `${Math.max(6, (bucket.count / maxMight) * 96)}px`,
                      }}
                    />
                  ) : (
                    <span className="w-full max-w-11" style={{ height: 0 }} />
                  )}
                  <span className="text-[0.62rem] leading-none text-[#9fb2c8]">
                    {bucket ? bucket.might : ""}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-0.5">
      <span className="text-[1.5rem] font-semibold leading-none text-[#f2f6ff]">{value}</span>
      <span className="text-[0.62rem] uppercase tracking-[0.08em] text-[#8fa3be]">{label}</span>
    </div>
  );
}
