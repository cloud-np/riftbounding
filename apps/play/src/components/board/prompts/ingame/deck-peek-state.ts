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

/** True only while a deck peek is actually showing for the viewer (in game, with resolvable cards). */
export function isDeckPeekOpen(options: {
  phase: string;
  peekCardIds: readonly string[] | undefined;
  resolvedCardCount: number;
}): boolean {
  return options.phase === "in_game" && !!options.peekCardIds && options.resolvedCardCount > 0;
}

/**
 * Whether Escape / close may dispatch `dismiss_deck_peek`: only when a peek is open, and never in
 * a strict room (peeks are a sandbox-only action there, the rule contract rejects it).
 */
export function shouldDispatchPeekDismiss(options: { open: boolean; rulesMode?: string }): boolean {
  return options.open && options.rulesMode !== "strict";
}
