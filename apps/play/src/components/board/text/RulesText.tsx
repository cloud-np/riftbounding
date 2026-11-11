"use client";

import { Fragment, useMemo, type CSSProperties } from "react";

import { domainAsset, staticAsset } from "@/lib/assets";

import { DomainSigil } from "../card/DomainSigil";
import { SafeImg } from "../card/SafeImg";
import { DOMAIN_PALETTES } from "../theme/domain-colors";
import { parseRulesText, rulesSegmentsToPlain, type RulesDomain, type RulesSegment } from "./rules-tokens";

const ICON_STYLE: CSSProperties = {
  width: "1.15em",
  height: "1.15em",
  verticalAlign: "-0.22em",
  display: "inline-block",
};

/** The game's domain icon; the original single-colour sigil when the static art is missing. */
function DomainIcon({ domain }: { domain: RulesDomain }) {
  const palette = DOMAIN_PALETTES[domain];
  return (
    <span
      className="relative mx-[0.08em] inline-block"
      style={{ ...ICON_STYLE, color: palette.light }}
      data-rules-icon="domain"
      data-domain={domain}
      title={domain}
    >
      <DomainSigil domain={domain} className="absolute inset-0 h-full w-full" />
      <SafeImg
        src={domainAsset(domain)}
        alt={domain}
        className="absolute inset-0 h-full w-full object-contain"
        draggable={false}
      />
    </span>
  );
}

function StaticIcon({ name, label, kind }: { name: string; label: string; kind: string }) {
  return (
    <SafeImg
      src={staticAsset(`icons/${name}.webp`)}
      alt={label}
      title={label}
      data-rules-icon={kind}
      className="mx-[0.08em] object-contain"
      style={ICON_STYLE}
      draggable={false}
    />
  );
}

function EnergyBadge({ amount }: { amount: number }) {
  return (
    <span
      data-rules-icon="energy"
      title={`${amount} energy`}
      className="mx-[0.08em] inline-grid place-items-center rounded-full font-bold tabular-nums"
      style={{
        ...ICON_STYLE,
        fontSize: "0.82em",
        lineHeight: 1,
        color: "#fff6dc",
        background: "radial-gradient(circle at 35% 30%, #5c6a8c, #27304a 70%)",
        boxShadow: "inset 0 0 0 1px rgba(240,212,138,0.7), 0 1px 2px rgba(0,0,0,0.5)",
      }}
    >
      {amount}
    </span>
  );
}

function Segment({ segment }: { segment: RulesSegment }) {
  switch (segment.kind) {
    case "text":
      return <>{segment.value}</>;
    case "energy":
      return <EnergyBadge amount={segment.amount} />;
    case "domain":
      return <DomainIcon domain={segment.domain} />;
    case "rune":
      return <StaticIcon name="rune" label="Rune" kind="rune" />;
    case "might":
      return <StaticIcon name="might" label="Might" kind="might" />;
    case "tap":
      return <StaticIcon name="tap" label="Exhaust" kind="tap" />;
    case "keyword":
      return (
        <strong data-rules-icon="keyword" className="font-semibold text-[var(--rb-gold-bright,#f0d48a)]">
          {segment.value}
        </strong>
      );
  }
}

export interface RulesTextProps {
  text: string | null | undefined;
  className?: string;
  style?: CSSProperties;
}

/** Rules / prompt text with inline rune, energy, might and exhaust icons. */
export function RulesText({ text, className, style }: RulesTextProps) {
  const segments = useMemo(() => parseRulesText(text), [text]);
  if (segments.length === 0) return null;
  return (
    <span className={className} style={style} data-rules-text="true" aria-label={rulesSegmentsToPlain(segments)}>
      {segments.map((segment, index) => (
        <Fragment key={index}>
          <Segment segment={segment} />
        </Fragment>
      ))}
    </span>
  );
}
