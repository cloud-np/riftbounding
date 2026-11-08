"use client";

import type { DeckSections } from "@rift/cards";

import { computeDeckStats, type DomainRow, type StatBucket } from "./stats";
import { SECTION_LABELS, T } from "./strings";
import { DomainIcon } from "./ui";

const DOMAIN_COLORS: Record<string, string> = {
  Fury: "#fb7185",
  Calm: "#4ade80",
  Mind: "#a78bfa",
  Body: "#f59e0b",
  Chaos: "#c084fc",
  Order: "#34d399",
  Unknown: "#94a3b8",
};

function domainColor(domains: readonly string[]): string {
  if (domains.length === 0) return DOMAIN_COLORS.Unknown!;
  if (domains.length === 1) return DOMAIN_COLORS[domains[0]!] ?? DOMAIN_COLORS.Unknown!;
  return DOMAIN_COLORS[domains[0]!] ?? DOMAIN_COLORS.Unknown!;
}

function SegmentedBar({
  segments,
  label,
}: {
  segments: { label: string; percent: number; color: string }[];
  label?: string;
}) {
  return (
    <div className="flex h-6 w-full overflow-hidden rounded-sm bg-secondary" aria-label={label}>
      {segments.map((segment, index) => (
        <span
          key={`${segment.label}-${index}`}
          title={`${segment.label} ${Math.round(segment.percent)}%`}
          style={{ width: `${segment.percent}%`, backgroundColor: segment.color }}
          className="flex h-full min-w-0 items-center justify-center text-[9px] font-bold text-white/90"
        >
          {segment.percent >= 8 ? `${Math.round(segment.percent)}%` : ""}
        </span>
      ))}
    </div>
  );
}

function BarChart({
  buckets,
  colorFor,
  showCountAbove = true,
  height = 118,
}: {
  buckets: StatBucket[];
  colorFor?: (bucket: StatBucket, index: number) => string;
  showCountAbove?: boolean;
  height?: number;
}) {
  const max = Math.max(1, ...buckets.map((bucket) => bucket.count));
  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {buckets.map((bucket, index) => (
        <div
          key={bucket.key}
          className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1"
        >
          {showCountAbove ? (
            <span className="text-[10px] tabular-nums text-muted-foreground">
              {bucket.count > 0 ? bucket.count : ""}
            </span>
          ) : null}
          <div
            title={`${bucket.label}: ${bucket.count}`}
            className="w-full max-w-8 rounded-t-[2px] transition-[height]"
            style={{
              height: `${Math.max(2, (bucket.count / max) * (height - 34))}px`,
              backgroundColor:
                colorFor?.(bucket, index) ??
                (bucket.count > 0 ? "rgba(0,115,210,0.55)" : "rgba(214,215,222,0.6)"),
            }}
          />
          <span className="text-[10px] tabular-nums text-muted-foreground">{bucket.label}</span>
        </div>
      ))}
    </div>
  );
}

function DomainRowView({ row }: { row: DomainRow }) {
  return (
    <tr className="border-t border-border/40">
      <td className="py-1.5 pr-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium">
          {row.domains.map((domain) => (
            <DomainIcon key={domain} domain={domain} className="size-3.5" />
          ))}
          <span>{row.label}</span>
        </span>
      </td>
      <td className="px-2 py-1.5 text-right text-xs tabular-nums">{row.cards}</td>
      <td className="px-2 py-1.5 text-right text-xs tabular-nums">{row.power}</td>
      <td className="py-1.5 pl-2 text-right text-xs tabular-nums text-muted-foreground">
        {row.runes === null ? "–" : row.runes}
      </td>
    </tr>
  );
}

export function StatsView({ sections }: { sections: DeckSections }) {
  const stats = computeDeckStats(sections, {
    championCount: sections.champion.reduce((sum, entry) => sum + entry.count, 0),
  });
  if (stats.totalMainDeckCards === 0) {
    return (
      <div className="rounded-md border border-dashed border-border/70 bg-background/45 px-4 py-8 text-center text-sm text-muted-foreground">
        {T.statsEmpty}
      </div>
    );
  }

  const energyColors = stats.energyCurve.map((bucket) => {
    if (bucket.key === "unknown") return DOMAIN_COLORS.Unknown!;
    return "rgba(0,115,210,0.55)";
  });

  return (
    <div className="grid gap-6 pb-4">
      <dl className="grid grid-cols-4 gap-2">
        {[
          { label: T.mainDeck, value: String(stats.totalMainDeckCards) },
          {
            label: T.avgEnergy,
            value: stats.averageEnergy === null ? T.notAvailable : stats.averageEnergy.toFixed(1),
          },
          {
            label: T.avgMight,
            value: stats.averageMight === null ? T.notAvailable : stats.averageMight.toFixed(1),
          },
          { label: T.powerCards, value: String(stats.powerCardCount) },
        ].map((item) => (
          <div key={item.label} className="min-w-0">
            <dd className="text-2xl font-semibold leading-none tracking-tight">{item.value}</dd>
            <dt className="mt-1 text-[11px] text-muted-foreground">{item.label}</dt>
          </div>
        ))}
      </dl>

      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            {T.energyCurve}
          </h3>
          <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span className="size-2 rounded-[2px] bg-[#61d4ff]" /> Unit{" "}
              {stats.typeDistribution.unit}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="size-2 rounded-[2px] bg-[#a78bfa]" /> Spell{" "}
              {stats.typeDistribution.spell}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="size-2 rounded-[2px] bg-[#fbbf24]" /> Gear{" "}
              {stats.typeDistribution.gear}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="size-2 rounded-[2px] border border-dashed border-muted-foreground" />{" "}
              {T.champion} {stats.typeDistribution.champion}
            </span>
          </div>
        </div>
        <BarChart
          buckets={stats.energyCurve}
          colorFor={(bucket, index) => energyColors[index] ?? "rgba(0,115,210,0.55)"}
        />
      </section>

      <div className="grid gap-5">
        <section>
          <h3 className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            {T.powerAndRunes}
          </h3>
          <div className="flex items-center gap-3">
            <span className="w-12 shrink-0 text-[11px] text-muted-foreground">{T.power}</span>
            <div className="min-w-0 flex-1">
              <SegmentedBar
                label={T.power}
                segments={stats.powerSegments.map((segment) => ({
                  label: segment.label,
                  percent: segment.percent,
                  color: domainColor(segment.domains),
                }))}
              />
            </div>
          </div>
          <div className="mt-1.5 flex items-center gap-3">
            <span className="w-12 shrink-0 text-[11px] text-muted-foreground">
              {SECTION_LABELS.runes}
            </span>
            <div className="min-w-0 flex-1">
              <SegmentedBar
                label={SECTION_LABELS.runes}
                segments={stats.runeSegments.map((segment) => ({
                  label: segment.label,
                  percent: segment.percent,
                  color: DOMAIN_COLORS[segment.label] ?? DOMAIN_COLORS.Unknown!,
                }))}
              />
            </div>
          </div>
          <table className="mt-3 w-full border-collapse text-left">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                <th className="pb-1 pr-2 font-semibold">{T.domain}</th>
                <th className="px-2 pb-1 text-right font-semibold">{T.cards}</th>
                <th className="px-2 pb-1 text-right font-semibold">{T.power}</th>
                <th className="pb-1 pl-2 text-right font-semibold">{SECTION_LABELS.runes}</th>
              </tr>
            </thead>
            <tbody>
              {stats.domainRows.map((row) => (
                <DomainRowView key={row.key} row={row} />
              ))}
            </tbody>
          </table>
        </section>

        <section>
          <h3 className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            {T.powerCost}
          </h3>
          <BarChart buckets={stats.powerCostCurve} height={82} />
        </section>
      </div>

      <section>
        <h3 className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          {T.unitMight}
        </h3>
        {stats.mightCurve.length > 0 ? (
          <BarChart buckets={stats.mightCurve} height={96} />
        ) : (
          <p className="text-xs text-muted-foreground">{T.notAvailable}</p>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          {T.keywordsStat}
        </h3>
        {stats.keywords.length > 0 ? (
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {stats.keywords.map((keyword) => (
              <span key={keyword.keyword} className="inline-flex items-baseline gap-1.5 text-xs">
                <span className="font-medium text-foreground/75">{keyword.keyword}</span>
                <span className="tabular-nums text-muted-foreground">{keyword.count}</span>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{T.notAvailable}</p>
        )}
      </section>
    </div>
  );
}
