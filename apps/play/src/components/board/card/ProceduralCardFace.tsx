"use client";

import type { CSSProperties } from "react";

import type { CardInstance } from "@rift/protocol";

import { useAnimationLevel } from "../theme/motion";
import type { DomainPalette } from "../theme/domain-colors";
import { cardMeta, kindLabel, plainRulesText, type CardMeta } from "./card-meta";
import { DomainSigil } from "./DomainSigil";

/** CSS custom properties every procedural surface reads (frame, art window, glow). */
export function domainStyleVars(meta: Pick<CardMeta, "palettes">): CSSProperties {
  const [a, b]: [DomainPalette, DomainPalette] = meta.palettes;
  return {
    ["--d1" as string]: a.base,
    ["--d1l" as string]: a.light,
    ["--d1d" as string]: a.dark,
    ["--d2" as string]: b.base,
    ["--d2l" as string]: b.light,
    ["--d2d" as string]: b.dark,
    ["--glow" as string]: a.glow,
    ["--glow2" as string]: b.glow,
  };
}

/** Layered gradient "illustration" with a domain sigil: the art stand-in. */
export function ProceduralArtWindow({ meta, className }: { meta: CardMeta; className?: string }) {
  const [first, second] = meta.domains.length ? meta.domains : (["Unknown"] as const);
  return (
    <div className={"pcf-art" + (className ? ` ${className}` : "")} data-kind={meta.kind} aria-hidden="true">
      <div className="pcf-art-sky" />
      <div className="pcf-art-rays" />
      <div className="pcf-art-grain" />
      <div className="pcf-art-rings" />
      <div className="pcf-art-sigil">
        <DomainSigil domain={first ?? "Unknown"} />
      </div>
      {meta.dual && second ? (
        <div className="pcf-art-sigil pcf-art-sigil-2">
          <DomainSigil domain={second} />
        </div>
      ) : null}
      <div className="pcf-art-vignette" />
      <div className="pcf-sheen" />
    </div>
  );
}

function PowerPips({ count, meta }: { count: number; meta: CardMeta }) {
  const pips = Math.min(count, 4);
  return (
    <div className="pcf-power" aria-hidden="true">
      {Array.from({ length: pips }).map((_, index) => (
        <span key={index} className="pcf-pip" data-alt={meta.dual && index % 2 === 1 ? "true" : undefined} />
      ))}
    </div>
  );
}

export interface ProceduralCardFaceProps {
  card: CardInstance;
  /** `crop` renders only the art window (board tokens). */
  mode?: "full" | "crop";
  className?: string;
  style?: CSSProperties;
}

/**
 * Original, CSS/SVG-only card frame. Used whenever art is missing, fails to load, or is still
 * loading, so a card never reads as a broken image.
 */
export function ProceduralCardFace({ card, mode = "full", className, style }: ProceduralCardFaceProps) {
  const meta = cardMeta(card);
  const level = useAnimationLevel();
  let hash = 0;
  for (let i = 0; i < card.id.length; i++) hash = (hash * 31 + card.id.charCodeAt(i)) % 997;
  const vars = { ...domainStyleVars(meta), ["--sheen-delay" as string]: `${-(hash % 7)}s`, ...style };

  if (mode === "crop") {
    return (
      <div className={"pcf pcf-crop" + (className ? ` ${className}` : "")} data-motion={level} data-kind={meta.kind} style={vars}>
        <ProceduralArtWindow meta={meta} />
      </div>
    );
  }

  const rules = plainRulesText(meta.text);
  const showMight = (meta.kind === "unit" || meta.kind === "legend") && meta.might !== undefined;
  const subtypes = (card.subtypes ?? []).slice(0, 2).join(" ");
  const typeLine = [meta.typeLabel || kindLabel(meta.kind), subtypes].filter(Boolean).join(" • ");
  const [first] = meta.domains.length ? meta.domains : (["Unknown"] as const);

  if (meta.kind === "rune") {
    return (
      <div
        className={"pcf pcf-rune" + (className ? ` ${className}` : "")}
        data-motion={level}
        data-kind="rune"
        data-dual={meta.dual ? "true" : undefined}
        style={vars}
      >
        <div className="pcf-frame" />
        <div className="pcf-inner">
          <div className="pcf-rune-gem">
            <DomainSigil domain={first ?? "Unknown"} />
            <div className="pcf-sheen" />
          </div>
          <div className="pcf-rune-name">{card.name || "Rune"}</div>
        </div>
      </div>
    );
  }

  if (meta.kind === "battlefield") {
    return (
      <div
        className={"pcf pcf-battlefield" + (className ? ` ${className}` : "")}
        data-motion={level}
        data-kind="battlefield"
        data-dual={meta.dual ? "true" : undefined}
        style={vars}
      >
        <div className="pcf-frame" />
        <div className="pcf-inner">
          <ProceduralArtWindow meta={meta} />
          <div className="pcf-bf-plate">
            <div className="pcf-name">
              <span>{card.name}</span>
            </div>
            {rules ? <p className="pcf-bf-text">{rules}</p> : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={"pcf pcf-portrait" + (className ? ` ${className}` : "")}
      data-motion={level}
      data-kind={meta.kind}
      data-ornate={meta.ornate ? "true" : undefined}
      data-dual={meta.dual ? "true" : undefined}
      style={vars}
    >
      <div className="pcf-frame" />
      <div className="pcf-inner">
        <ProceduralArtWindow meta={meta} />
        <div className="pcf-name">
          <span>{card.name}</span>
        </div>
        <div className="pcf-type">{typeLine}</div>
        <div className="pcf-text" data-empty={rules ? undefined : "true"}>
          <p>{rules}</p>
        </div>
      </div>
      {meta.energyCost !== undefined ? (
        <div className="pcf-cost" aria-hidden="true">
          <span>{meta.energyCost}</span>
        </div>
      ) : null}
      {meta.powerCost ? <PowerPips count={meta.powerCost} meta={meta} /> : null}
      {showMight ? (
        <div className="pcf-might" aria-hidden="true">
          <span>{meta.might}</span>
        </div>
      ) : null}
    </div>
  );
}
