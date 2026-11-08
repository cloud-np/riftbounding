import { createTranslator } from "@rift/i18n";

const t = createTranslator("en");

export type DeckPeekZone = "deck" | "runeDeck";

export function peekZone(peek: { zone?: string } | undefined): DeckPeekZone {
  return peek?.zone === "runeDeck" ? "runeDeck" : "deck";
}

export function deckPeekTitle(zone: DeckPeekZone) {
  return zone === "runeDeck"
    ? {
        title: t("sim.runePeek") ?? "Rune Peek",
        info: t("sim.runePeekHelp") ?? "",
        aria: t("sim.lookAtRunesInRuneDeck") ?? "Look at runes in your Rune Deck",
      }
    : {
        title: t("sim.deckPeek.title") ?? "Deck Peek",
        info: t("sim.deckPeek.cardHelp") ?? "",
        aria: t("sim.deckPeek.lookAtDeck") ?? "Look at cards in your deck",
      };
}

/** Next reveal-all target: hide when every card is already revealed. */
export function nextRevealAll(revealed: ReadonlySet<string>, cardIds: readonly string[]): boolean {
  return !(cardIds.length > 0 && cardIds.every((id) => revealed.has(id)));
}
