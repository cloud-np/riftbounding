"use client";

import type { CSSProperties } from "react";

import type { CardInstance } from "@rift/protocol";

import type { CardImageProfile } from "@/lib/assets";

import { SIDE_COLORS } from "../theme/domain-colors";
import { useAnimationLevel } from "../theme/motion";
import { CardArt } from "./CardArt";
import { cardMeta, keywordAbbr } from "./card-meta";
import { DomainSigil } from "./DomainSigil";
import { domainStyleVars } from "./ProceduralCardFace";
import type { CardSide } from "./types";

export interface CardTokenFaceProps {
  card: CardInstance;
  side: CardSide;
  profile?: CardImageProfile;
  exhausted?: boolean;
  /** Current might (printed + buffs). Falls back to the printed value. */
  might?: number;
  damage?: number;
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
  flip = false,
  className,
  style,
}: CardTokenFaceProps) {
  const meta = cardMeta(card);
  const level = useAnimationLevel();
  const sideColor = SIDE_COLORS[side];
  const printedMight = meta.might;
  const shownMight = might ?? printedMight;
  const buffed = shownMight !== undefined && printedMight !== undefined && shownMight > printedMight;
  const hurt = damage > 0;
  const keywords = meta.keywords.slice(0, 3);
  const vars: CSSProperties = {
    ...domainStyleVars(meta),
    ["--side" as string]: sideColor.base,
    ["--side-glow" as string]: sideColor.glow,
    ...style,
  };

  if (meta.kind === "rune") {
    const [first] = meta.domains.length ? meta.domains : (["Unknown"] as const);
    return (
      <div
        className={"rtoken rtoken-gem" + (className ? ` ${className}` : "")}
        data-kind="rune"
        data-motion={level}
        data-side={side}
        data-exhausted={exhausted || undefined}
        style={vars}
      >
        <div className="rtoken-gem-body">
          <div className="rtoken-gem-facets" />
          <DomainSigil domain={first ?? "Unknown"} className="rtoken-gem-sigil" />
          <div className="pcf-sheen" />
        </div>
        <span className="rtoken-gem-label">{card.name.replace(/\s*rune$/i, "") || "Rune"}</span>
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
        <div className="rtoken-plate" aria-hidden="true">
          <span>{card.name}</span>
        </div>
        {shownMight !== undefined && meta.kind !== "gear" ? (
          <div
            className="rtoken-might"
            data-state={hurt ? "damaged" : buffed ? "buffed" : undefined}
            aria-label={`Might ${shownMight}`}
          >
            <span>{shownMight}</span>
          </div>
        ) : null}
        {hurt ? (
          <div className="rtoken-damage" aria-label={`${damage} damage`}>
            <span>{"−"}{damage}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
