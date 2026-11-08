/**
 * Deterministic, legal solo-lab decks built from the real `@rift/cards` catalog.
 *
 * Shape matches the deck-building rules used by the setup flow:
 *   1 legend · 1 matching champion · 40 main-deck cards (max 3 copies)
 *   3 unique battlefields · 12 runes (split across the legend's domains)
 *
 * Two fixed legends are used so a dev game always has two distinct, legal decks:
 * Kai'Sa, Daughter of the Void (Fury/Mind) and Jinx, Loose Cannon (Fury/Chaos).
 */
import type { DeckSections, DecklistEntry } from "@rift/protocol";
import {
  bestPrintCards,
  cardTypeMatches,
  getCardById,
  getCardByName,
  isChampionForLegend,
  type Card,
} from "@rift/cards";

const LEGEND_IDS = ["OGN-247", "OGN-251"] as const;
const MAIN_DECK_SIZE = 40;
const BATTLEFIELD_COUNT = 3;
const RUNE_COUNT = 12;
const MAX_COPIES = 3;

const MAIN_DECK_TYPES = ["unit", "spell", "gear"] as const;

function isBannedInStandard(card: Card): boolean {
  return (
    card.isBanned === true ||
    (card.bannedIn ?? []).some((ban) => ban.format === "Standard Constructed")
  );
}

function isUnique(card: Card): boolean {
  return (
    (card.keywords ?? []).some((keyword) => keyword.trim().toLowerCase() === "unique") ||
    /\[\s*unique\s*\]/i.test(card.text ?? "")
  );
}

function entry(card: Card, count: number): DecklistEntry {
  return { name: card.name, count, cardCode: card.id };
}

function legendFor(id: string): Card {
  const card = getCardById(id);
  if (!card) throw new Error(`dev decks: legend ${id} is missing from @rift/cards`);
  return card;
}

/** First legal champion unit whose subtype matches the legend's champion tag. */
function championFor(legend: Card): Card {
  const tag = legend.subtypes?.[0]?.trim() ?? "";
  const candidate = bestPrintCards().find(
    (card) =>
      isChampionForLegend(card, tag) && card.name !== legend.name && !isBannedInStandard(card),
  );
  if (!candidate) throw new Error(`dev decks: no champion found for legend ${legend.name}`);
  return candidate;
}

/** Cards legal in the main deck: types Unit/Spell/Gear, inside the legend's domains. */
function mainDeckPool(legend: Card, champion: Card): Card[] {
  const domains = new Set(legend.domains.filter((domain) => domain !== "Unknown"));
  return bestPrintCards().filter((card) => {
    if (!MAIN_DECK_TYPES.some((type) => cardTypeMatches(card, type))) return false;
    if (card.signatureType) return false;
    if (isBannedInStandard(card) || isUnique(card)) return false;
    if (card.name === legend.name || card.name === champion.name) return false;
    if ((card.subtypes ?? []).some((subtype) => subtype.trim() === legend.subtypes?.[0]?.trim())) {
      return false;
    }
    const cardDomains = card.domains.filter((domain) => domain !== "Unknown");
    return cardDomains.every((domain) => domains.has(domain));
  });
}

function buildMainDeck(legend: Card, champion: Card): DecklistEntry[] {
  const pool = mainDeckPool(legend, champion);
  const entries: DecklistEntry[] = [];
  let remaining = MAIN_DECK_SIZE;
  for (const card of pool) {
    if (remaining <= 0) break;
    const count = Math.min(MAX_COPIES, remaining);
    entries.push(entry(card, count));
    remaining -= count;
  }
  if (remaining !== 0) {
    throw new Error(
      `dev decks: only ${MAIN_DECK_SIZE - remaining} legal main-deck cards for ${legend.name}`,
    );
  }
  return entries;
}

function buildBattlefields(usedNames: Set<string>): DecklistEntry[] {
  const entries: DecklistEntry[] = [];
  for (const card of bestPrintCards()) {
    if (entries.length >= BATTLEFIELD_COUNT) break;
    if (!cardTypeMatches(card, "battlefield") || isBannedInStandard(card)) continue;
    const key = card.name.trim().toLowerCase();
    if (usedNames.has(key)) continue;
    usedNames.add(key);
    entries.push(entry(card, 1));
  }
  if (entries.length !== BATTLEFIELD_COUNT) {
    throw new Error("dev decks: not enough unique battlefields in @rift/cards");
  }
  return entries;
}

function buildRunes(legend: Card): DecklistEntry[] {
  const domains = legend.domains.filter((domain) => domain !== "Unknown");
  if (domains.length === 0) throw new Error(`dev decks: legend ${legend.name} has no domains`);
  const perDomain = Math.floor(RUNE_COUNT / domains.length);
  const remainder = RUNE_COUNT - perDomain * domains.length;
  const entries: DecklistEntry[] = [];
  domains.forEach((domain, index) => {
    const rune = getCardByName(`${domain} Rune`);
    if (!rune) throw new Error(`dev decks: ${domain} Rune is missing from @rift/cards`);
    entries.push(entry(rune, perDomain + (index < remainder ? 1 : 0)));
  });
  return entries;
}

/**
 * Build both solo-lab decks. Battlefield names are unique across the pair; legends,
 * champions and rune bases differ so the board shows two real identities.
 */
export function buildSoloLabDecks(): [DeckSections, DeckSections] {
  const usedBattlefields = new Set<string>();
  const build = (legendId: string): DeckSections => {
    const legend = legendFor(legendId);
    const champion = championFor(legend);
    return {
      legend: [entry(legend, 1)],
      champion: [entry(champion, 1)],
      mainDeck: buildMainDeck(legend, champion),
      battlefields: buildBattlefields(usedBattlefields),
      runes: buildRunes(legend),
      sideboard: [],
    };
  };
  return [build(LEGEND_IDS[0]), build(LEGEND_IDS[1])];
}

/** Small helper for the debug panel: totals as a compact string. */
export function deckSummary(sections: DeckSections): string {
  const total = (entries: DecklistEntry[]) => entries.reduce((sum, item) => sum + item.count, 0);
  return `L${total(sections.legend)} C${total(sections.champion)} M${total(sections.mainDeck)} B${total(sections.battlefields)} R${total(sections.runes)}`;
}
