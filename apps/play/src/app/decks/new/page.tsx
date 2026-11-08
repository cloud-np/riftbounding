import type { Metadata } from "next";

import { DeckbuilderPage } from "@/components/deckbuilder/DeckbuilderPage";

export const metadata: Metadata = {
  title: "New Deck | Rift Atlas",
  description:
    "Build a Riftbound deck with the Rift Atlas deck builder: Legend, Champion, Main Deck, Battlefields, Sideboard and Runes.",
  alternates: {
    canonical: "https://riftatlas.com/decks/new",
  },
};

export default function NewDeckPage() {
  return <DeckbuilderPage mode="new" />;
}
