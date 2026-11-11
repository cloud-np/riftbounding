"use client";

import type { CSSProperties } from "react";

import type { CardInstance } from "@rift/protocol";

import { cardArtUrl, type CardImageProfile } from "@/lib/assets";

import { SIDE_COLORS } from "../theme/domain-colors";
import { useAnimationLevel } from "../theme/motion";
import { CardArt } from "./CardArt";
import { cardMeta, keywordAbbr } from "./card-meta";
import { DomainSigil } from "./DomainSigil";
import { domainStyleVars } from "./ProceduralCardFace";
import { rarityTier } from "./rarity";
import { SafeImg } from "./SafeImg";
import type { CardSide } from "./types";

export interface CardTokenFaceProps {
  card: CardInstance;
  side: CardSide;
  profile?: CardImageProfile;
  exhausted?: boolean;
  /** Current might (engine effective Might in strict rooms). Falls back to the printed value. */
  might?: number;
  damage?: number;
  /** Printed might, to tint the badge when `might` is above/below it. */
  printedMight?: number;
  /** Counter-rotate by 180deg (opponent zones live inside a rotated layer). */
  flip?: boolean;
  className?: string;
  style?: CSSProperties;
}

/**
 * Art-crop "shield" token for cards in play: only the illustration, in a bevelled frame with a
 * domain-coloured rim and an owner-side accent, plus might / damage / keyword badges. The full
 * card is always one hover away.
 */
export function CardTokenFace({
  card,
  side,
  profile = "board",
  exhausted = false,
  might,
  damage = 0,
  printedMight: printedOverride,
  flip = false,
  className,
  style,
}: CardTokenFaceProps) {
  const meta = cardMeta(card);
  const level = useAnimationLevel();
  const sideColor = SIDE_COLORS[side];
  const printedMight = printedOverride ?? meta.might;
  const shownMight = might ?? printedMight;
  const buffed = shownMight !== undefined && printedMight !== undefined && shownMight > printedMight;
  const debuffed = shownMight !== undefined && printedMight !== undefined && shownMight < printedMight;
  const hurt = damage > 0;
  const tier = rarityTier(card) ?? undefined;
  const keywords = meta.keywords.slice(0, 3);
  const vars: CSSProperties = {
    ...domainStyleVars(meta),
    ["--side" as string]: sideColor.base,
    ["--side-glow" as string]: sideColor.glow,
    ...style,
  };

  if (meta.kind === "rune") {
    const [first] = meta.domains.length ? meta.domains : (["Unknown"] as const);
    const runeName = card.name.replace(/\s*rune$/i, "") || "Rune";
    return (
      <div
        className={"rtoken rtoken-gem" + (className ? ` ${className}` : "")}
        data-kind="rune"
        data-motion={level}
        data-side={side}
        data-rarity-tier={tier}
        data-exhausted={exhausted || undefined}
        role="img"
        aria-label={`${runeName} rune${exhausted ? " (exhausted)" : ""}`}
        style={vars}
      >
        <div className="rtoken-flip" style={flip ? { transform: "rotate(180deg)" } : undefined}>
          <div className="rtoken-gem-body">
            {/* Procedural orb: the load-failure / loading fallback behind the real rune art. */}
            <div className="rtoken-gem-facets" />
            <DomainSigil domain={first ?? "Unknown"} className="rtoken-gem-sigil" />
            <SafeImg
              src={cardArtUrl(card, "board")}
              alt=""
              draggable={false}
              className="rtoken-gem-art"
              data-rift-image-kind="rune"
            />
            <div className="pcf-sheen" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={"rtoken" + (className ? ` ${className}` : "")}
      data-kind={meta.kind}
      data-motion={level}
      data-side={side}
      data-dual={meta.dual ? "true" : undefined}
      data-rarity-tier={tier}
      data-exhausted={exhausted || undefined}
      data-damaged={hurt || undefined}
      style={vars}
    >
      <div className="rtoken-flip" style={flip ? { transform: "rotate(180deg)" } : undefined}>
        <div className="rtoken-shape rtoken-rim" />
        <div className="rtoken-shape rtoken-art">
          <CardArt card={card} profile={profile} side={side} crop className="card-art-crop" />
          <div className="rtoken-shade" />
          <div className="pcf-sheen" />
        </div>
        <span className="rtoken-side" aria-hidden="true" />
        {keywords.length > 0 ? (
          <div className="rtoken-keywords" aria-hidden="true">
            {keywords.map((keyword) => (
              <span key={keyword} title={keyword}>
                {keywordAbbr(keyword)}
              </span>
            ))}
          </div>
        ) : null}
        {shownMight !== undefined && meta.kind !== "gear" ? (
          <div
            className="rtoken-might"
            data-state={hurt ? "damaged" : buffed ? "buffed" : debuffed ? "debuffed" : undefined}
            data-trend={buffed ? "up" : debuffed ? "down" : undefined}
            aria-label={`Might ${shownMight}${hurt ? `, ${damage} damage` : ""}`}
          >
            <span>{shownMight}</span>
            {buffed || debuffed ? (
              <i className="rtoken-might-chev" aria-hidden="true" data-dir={buffed ? "up" : "down"} />
            ) : null}
          </div>
        ) : null}
        {hurt ? (
          <div className="rtoken-damage" aria-label={`${damage} damage`}>
            <svg className="rtoken-damage-crack" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M13 1 8 9l5 2-6 6 4 1-3 6" />
            </svg>
            <span>{"−"}{damage}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
