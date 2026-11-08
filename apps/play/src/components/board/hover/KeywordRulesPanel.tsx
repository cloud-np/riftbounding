"use client";

import { createTranslator } from "@rift/i18n";
import { getLocalizedRulesText } from "@rift/i18n";
import { getCard } from "@rift/cards";

import type { CardInstance } from "@rift/protocol";

import { labelColors } from "../menus/label-presets";

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
  const keywords = card.keywords ?? [];

  return (
    <div className={className} style={style} data-hover-card-rules="true">
      <div className="flex items-start justify-between gap-[0.6em]">
        <div className="min-w-0">
          <p className="m-0 truncate text-[1.12em] font-bold leading-tight text-[#eef6ff]">{card.name}</p>
          <p className="m-0 mt-[0.12em] text-[0.78em] uppercase tracking-[0.08em] text-[#8fa9c8]">
            {[card.type, card.energyCost !== undefined ? `Cost ${card.energyCost}` : null, card.might !== undefined ? `Might ${card.might}` : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
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
          className="mb-0 mt-[0.4em] whitespace-pre-line text-[0.92em] leading-[1.35] text-[#cfe0f5]"
          style={{ fontFamily: "var(--font-heading), ui-serif, Georgia, serif" }}
        >
          {rules}
        </p>
      ) : null}
    </div>
  );
}
