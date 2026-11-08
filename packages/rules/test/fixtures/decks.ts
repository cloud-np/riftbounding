/**
 * Scenario deck fixture shared by the strict-rules suites.
 *
 * The decks are committed next to the tests (`decks.json`) so the suite is self-contained; the
 * scraped `.recon/oracle/` dumps are not part of the repository.
 */
import fs from "node:fs";
import path from "node:path";
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
