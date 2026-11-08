import type { Metadata } from "next";

import { DeckbuilderPage } from "@/components/deckbuilder/DeckbuilderPage";

export const metadata: Metadata = {
  title: "Edit Deck | Rift Atlas",
  description:
    "Edit a saved Riftbound deck in the Rift Atlas deck builder, or resume your local browser draft.",
  alternates: {
    canonical: "https://riftatlas.com/decks",
  },
};

export default async function EditDeckPage({
  params,
}: {
  params: Promise<{ savedDeckId: string }>;
}) {
  const { savedDeckId } = await params;
  return <DeckbuilderPage mode="saved" savedDeckId={savedDeckId} />;
}
