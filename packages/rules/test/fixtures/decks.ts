/**
 * Scenario deck fixture shared by the strict-rules suites.
 *
 * The decks are committed next to the tests (`decks.json`) so the suite is self-contained; the
 * scraped `.recon/oracle/` dumps are not part of the repository.
 */
import fs from "node:fs";
import path from "node:path";
import { getCardByName } from "@rift/cards";
import type { DeckSections } from "@rift/protocol";

export const FIXTURE_DECKS_PATH = path.join(__dirname, "decks.json");

export interface DecksFile {
  deckA: { raw: string; sections: DeckSections };
  deckB: { raw: string; sections: DeckSections };
}

export function loadFixtureDecks(): DecksFile {
  if (!fs.existsSync(FIXTURE_DECKS_PATH)) {
    throw new Error(`scenario fixture missing: ${FIXTURE_DECKS_PATH}`);
  }
  return JSON.parse(fs.readFileSync(FIXTURE_DECKS_PATH, "utf8")) as DecksFile;
}

/** Extra Main Deck cards per player, by unique card name (one copy per entry). */
export interface ExtraDeckCards {
  p1?: readonly string[];
  p2?: readonly string[];
}

/**
 * Return a copy of `decks` with `extra` cards appended to each Main Deck, resolved through the
 * real card catalog. Lets a scenario use any printed card without editing `decks.json` (whose
 * contents and order the existing suites depend on). Throws on an unknown name.
 */
export function withExtraCards(decks: DecksFile, extra: ExtraDeckCards | undefined): DecksFile {
  if (!extra || (!extra.p1?.length && !extra.p2?.length)) return decks;
  const append = (deck: DecksFile["deckA"], names: readonly string[] | undefined) => {
    if (!names?.length) return deck;
    const mainDeck = [...deck.sections.mainDeck];
    for (const name of names) {
      const card = getCardByName(name);
      if (!card) throw new Error(`withExtraCards: unknown card name ${JSON.stringify(name)}`);
      mainDeck.push({ name: card.name, count: 1, cardCode: card.id });
    }
    return { raw: deck.raw, sections: { ...deck.sections, mainDeck } };
  };
  return { deckA: append(decks.deckA, extra.p1), deckB: append(decks.deckB, extra.p2) };
}
