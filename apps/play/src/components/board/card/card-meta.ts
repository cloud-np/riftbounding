import { effectiveMight, resolveCard } from "@rift/cards";
import type { CardInstance } from "@rift/protocol";

import { domainName, domainPalettes, type DomainName, type DomainPalette } from "../theme/domain-colors";

export type CardKind = "unit" | "spell" | "gear" | "rune" | "legend" | "battlefield";

export interface CardMeta {
  kind: CardKind;
  /** Champion / legend cards get the ornate frame. */
  ornate: boolean;
  typeLabel: string;
  domains: DomainName[];
  palettes: [DomainPalette, DomainPalette];
  dual: boolean;
  energyCost?: number;
  powerCost?: number;
  /** Printed might (token/catalog resolved). */
  might?: number;
  text?: string;
  keywords: string[];
}

function finite(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/**
 * Display data for a card: the live instance wins, the catalog fills any gaps (cards created from
 * a bare name/code in sandbox rooms only carry a few fields).
 */
export function cardMeta(card: CardInstance): CardMeta {
  const printed = card.name ? resolveCard(card.cardCode, card.name) : undefined;
  const rawType = (card.type ?? printed?.type ?? "").toLowerCase();
  const subtypes = [...(card.subtypes ?? printed?.subtypes ?? [])].map((s) => s.toLowerCase());
  const champion = card.source === "champion" || rawType.includes("champion") || subtypes.includes("champion");

  let kind: CardKind = "unit";
  if (card.source === "legend" || rawType.includes("legend")) kind = "legend";
  else if (card.source === "rune" || rawType.includes("rune")) kind = "rune";
  else if (card.source === "battlefield" || rawType.includes("battlefield")) kind = "battlefield";
  else if (rawType.includes("spell")) kind = "spell";
  else if (rawType.includes("gear")) kind = "gear";

  const domainsRaw = card.domains?.length ? card.domains : (printed?.domains ?? []);
  const domains = domainsRaw.map(domainName).filter((d) => d !== "Unknown");
  const palettes = domainPalettes(domains);
  const dual = domains.length > 1 && domains[0] !== domains[1];

  const typeWords = (card.type ?? printed?.type ?? "").trim();
  const typeLabel = champion && kind === "unit" ? `Champion ${typeWords || "Unit"}` : typeWords || kindLabel(kind);

  return {
    kind,
    ornate: champion || kind === "legend",
    typeLabel,
    domains,
    palettes,
    dual,
    energyCost: finite(card.energyCost) ?? finite(printed?.energyCost),
    powerCost: finite(card.powerCost) ?? finite(printed?.powerCost),
    might: effectiveMight(card),
    text: card.text ?? printed?.text,
    keywords: card.keywords?.length ? card.keywords : (printed?.keywords ?? []),
  };
}

export function kindLabel(kind: CardKind): string {
  switch (kind) {
    case "unit":
      return "Unit";
    case "spell":
      return "Spell";
    case "gear":
      return "Gear";
    case "rune":
      return "Rune";
    case "legend":
      return "Legend";
    case "battlefield":
      return "Battlefield";
  }
}

/** Strip simple markup tokens from catalog rules text so it reads as plain prose. */
export function plainRulesText(text: string | undefined): string {
  if (!text) return "";
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/:rb_([a-z_]+):/gi, (_m, name: string) => `[${name.replace(/_/g, " ")}]`)
    .replace(/\s+\n/g, "\n")
    .trim();
}

/** Two/three letter keyword abbreviation for compact chips. */
export function keywordAbbr(keyword: string): string {
  const words = keyword.trim().split(/\s+/);
  if (words.length > 1) return words.map((w) => w[0]).join("").slice(0, 3).toUpperCase();
  return keyword.slice(0, 3).toUpperCase();
}

/** Might shown on a unit in play: printed + buffs, plus strict-rules modifiers when known. */
export function currentMight(
  base: number | undefined,
  card: CardInstance,
  rules?: { buffs?: number; temporaryMight?: number } | null,
): number | undefined {
  if (base === undefined) return undefined;
  return base + Math.max(0, Math.trunc(card.temporaryMightBuff ?? 0)) + (rules?.buffs ?? 0) + (rules?.temporaryMight ?? 0);
}
