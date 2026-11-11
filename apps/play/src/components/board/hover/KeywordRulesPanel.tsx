"use client";

import { createTranslator } from "@rift/i18n";
import { getLocalizedRulesText } from "@rift/i18n";
import { getCard } from "@rift/cards";

import type { CardInstance } from "@rift/protocol";

import { cardMeta } from "../card/card-meta";
import { labelColors } from "../menus/label-presets";
import { RulesText } from "../text/RulesText";

const t = createTranslator("en");

export interface KeywordRulesPanelProps {
  card: CardInstance;
  locale?: string;
  className?: string;
  style?: React.CSSProperties;
}

/** Rules text + keyword chips + the original `S RESOLVE` / `T TARGET` hints. */
export function KeywordRulesPanel({ card, locale = "en", className, style }: KeywordRulesPanelProps) {
  const catalogCard = card.cardCode ? getLocalizedRulesText(locale, card.cardCode) : null;
  const englishCatalogText = card.cardCode ? getCard(card.cardCode)?.text ?? null : null;
  const rules =
    locale === "en"
      ? card.text ?? englishCatalogText
      : catalogCard ?? card.text ?? englishCatalogText;
  const meta = cardMeta(card);
  const keywords = card.keywords?.length ? card.keywords : meta.keywords;

  return (
    <div className={className} style={style} data-hover-card-rules="true">
      <div className="flex flex-wrap items-start justify-between gap-x-[0.6em] gap-y-[0.4em]">
        <div className="min-w-0">
          <p
            className="m-0 text-[1.2em] font-semibold leading-tight text-[var(--rb-gold-bright,#f0d48a)]"
            style={{ fontFamily: "var(--font-heading), ui-serif, Georgia, serif" }}
          >
            {card.name}
          </p>
          <div className="mt-[0.3em] flex flex-wrap items-center gap-[0.3em]">
            <span className="hv-chip">{meta.typeLabel}</span>
            {meta.energyCost !== undefined ? <span className="hv-chip" data-kind="cost">Cost {meta.energyCost}{meta.powerCost ? ` + ${meta.powerCost}` : ""}</span> : null}
            {meta.might !== undefined && meta.kind !== "spell" ? <span className="hv-chip" data-kind="might">Might {meta.might}</span> : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-[0.24em]" data-hover-preview-hotkeys="true">
          <span className="inline-flex items-center gap-[0.18em] rounded-[0.14em] border border-[rgba(171,191,238,0.34)] bg-[rgba(17,30,50,0.9)] px-[0.28em] py-[0.1em] text-[0.72em] font-bold uppercase tracking-[0.04em] text-[#dbe7ff]">
            <kbd className="grid h-[1.1em] min-w-[1.1em] place-items-center rounded-[0.08em] border border-white/20 bg-black/25 text-[0.85em]">S</kbd>
            {t("sim.resolve") ?? "Resolve"}
          </span>
          <span className="inline-flex items-center gap-[0.18em] rounded-[0.14em] border border-[rgba(171,191,238,0.34)] bg-[rgba(17,30,50,0.9)] px-[0.28em] py-[0.1em] text-[0.72em] font-bold uppercase tracking-[0.04em] text-[#dbe7ff]">
            <kbd className="grid h-[1.1em] min-w-[1.1em] place-items-center rounded-[0.08em] border border-white/20 bg-black/25 text-[0.85em]">T</kbd>
            {t("sim.tablet.target") ?? "Target"}
          </span>
        </div>
      </div>

      {keywords.length > 0 ? (
        <div className="mt-[0.42em] flex flex-wrap gap-[0.22em]">
          {keywords.map((keyword) => {
            const colors = labelColors(keyword);
            return (
              <span
                key={keyword}
                className="card-keyword-tag inline-flex items-center px-[0.3em] py-[0.06em] text-[0.7em] uppercase"
                style={{
                  backgroundColor: colors.backgroundColor,
                  borderColor: colors.borderColor,
                  color: colors.textColor,
                }}
              >
                <span>{keyword}</span>
              </span>
            );
          })}
        </div>
      ) : null}

      {rules ? (
        <p
          className="mb-0 mt-[0.5em] whitespace-pre-line text-[1em] leading-[1.5] text-[var(--rb-text,#ece6da)]"
          style={{ fontFamily: "var(--font-ui), system-ui, sans-serif" }}
        >
          <RulesText text={rules} />
        </p>
      ) : null}
    </div>
  );
}
