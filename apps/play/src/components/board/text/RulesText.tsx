"use client";

import { Fragment, useMemo, type CSSProperties, type ReactNode } from "react";

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

/** Inline glyphs shown whenever the static icon image is missing or has not loaded (never a gap). */
const GLYPHS: Record<string, ReactNode> = {
  might: (
    <>
      <path d="M19.5 2.5 21.5 4.5 11 15 9 13Z" fill="currentColor" />
      <path d="M8 12.5 11.5 16 9.5 18 6 14.5Z" fill="currentColor" />
      <path d="M5.5 15.5 8.5 18.5 5 22 2 19Z" fill="currentColor" opacity="0.8" />
    </>
  ),
  rune: (
    <>
      <path d="M12 1.8 20 8.4 12 22.2 4 8.4Z" fill="currentColor" />
      <path d="M12 1.8 12 22.2M4 8.4h16" fill="none" stroke="rgba(0,0,0,0.4)" strokeWidth="1.2" />
    </>
  ),
  tap: (
    <>
      <path
        d="M19.5 12a7.5 7.5 0 1 1-2.4-5.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path d="M20.5 2.8v5.6h-5.6Z" fill="currentColor" />
    </>
  ),
};

function StaticIcon({ name, label, kind }: { name: string; label: string; kind: string }) {
  return (
    <span
      className="rules-icon-wrap relative mx-[0.08em] inline-block text-[var(--rb-gold-bright,#f0d48a)]"
      style={ICON_STYLE}
      data-rules-icon-wrap={kind}
      title={label}
    >
      <svg
        viewBox="0 0 24 24"
        className="rules-icon-glyph absolute inset-0 h-full w-full"
        data-rules-glyph={kind}
        role="img"
        aria-label={label}
      >
        {GLYPHS[kind]}
      </svg>
      <SafeImg
        src={staticAsset(`icons/${name}.webp`)}
        alt={label}
        title={label}
        data-rules-icon={kind}
        className="absolute inset-0 h-full w-full object-contain"
        draggable={false}
      />
    </span>
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
