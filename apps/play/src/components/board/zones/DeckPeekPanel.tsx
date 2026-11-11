"use client";

import { useMemo } from "react";

import { createTranslator } from "@rift/i18n";

import { cardImageUrl } from "@/lib/assets";

import { useBoardInteractionOptional } from "../interaction/context";
import { playBoardSound } from "../interaction/sfx";
import type { GameActionIntent } from "../slot-types";
import { SafeImg } from "../card/SafeImg";

const t = createTranslator("en");

/**
 * Minimal `gb-deck-peek` surface: cards peeked from the top/bottom of the main
 * deck or rune deck, with the original Reveal / Recycle / On Top / To hand
 * actions. The full drag-and-drop peeking UI is a wave-3 follow-up.
 */
export function DeckPeekPanel() {
  const interaction = useBoardInteractionOptional();
  const state = interaction?.slotProps.state;
  const viewerId = interaction?.viewerId;
  const viewer = state?.players.find((player) => player.id === viewerId);
  const board = viewer?.board;
  const peek = board?.deckPeek;
  const zone = peek?.zone === "runeDeck" ? "runeDeck" : "deck";
  const cards = useMemo(() => {
    if (!peek || !board) return [];
    const list = zone === "runeDeck" ? board.runeDeck : board.deck;
    return peek.cardIds
      .map((cardId) => list.find((card) => card.id === cardId))
      .filter((card): card is NonNullable<typeof card> => !!card);
  }, [peek, board, zone]);

  if (!interaction || !state || state.phase !== "in_game" || !peek || cards.length === 0) return null;

  const send = (intent: GameActionIntent) => {
    playBoardSound("card_click");
    interaction.sendIntent(intent);
  };
  const revealed = new Set(peek.revealedCardIds);

  return (
    <div
      data-deck-peek="true"
      className="gb-deck-peek pointer-events-auto fixed bottom-[0.7rem] left-1/2 z-200 flex w-[min(46rem,calc(100vw-1rem))] -translate-x-1/2 flex-col overflow-hidden rounded-[0.4rem] border border-[rgba(215,218,225,0.24)] bg-[rgba(15,14,13,0.98)] text-[#e6e7ec] shadow-[0_18px_40px_rgba(7,6,5,0.64),inset_0_1px_0_rgba(239,240,241,0.06)] backdrop-blur-xl"
    >
      <header className="flex items-center justify-between gap-2 border-b border-[rgba(192,198,204,0.16)] px-[0.6rem] py-[0.42rem]">
        <div className="flex items-baseline gap-2">
          <strong className="text-[0.68rem] font-bold uppercase tracking-[0.1em] text-[#f6f5f5]">
            {t("sim.deckPeek.title") ?? "Deck Peek"}
          </strong>
          <span className="text-[0.54rem] uppercase tracking-[0.06em] text-[#a1a8af]">
            {zone === "runeDeck" ? t("sim.runeDeck") ?? "Rune Deck" : t("sim.mainDeck") ?? "Main Deck"}
          </span>
        </div>
        <div className="flex items-center gap-[0.24rem]">
          <button
            type="button"
            className="rounded-[0.2rem] border border-[rgba(177,207,210,0.28)] bg-[rgba(29,28,27,0.76)] px-[0.42rem] py-[0.24rem] text-[0.56rem] font-semibold uppercase tracking-[0.04em] text-[#ebf3f1] hover:bg-[rgba(39,38,37,0.9)]"
            onClick={() => send({ type: "peek_deck_top", count: 1, ...(zone === "runeDeck" ? { zone: "runeDeck" as const } : {}) } as GameActionIntent)}
          >
            {t("sim.lookAtOneMore") ?? "Look at 1 More"}
          </button>
          <button
            type="button"
            className="rounded-[0.2rem] border border-[rgba(177,207,210,0.28)] bg-[rgba(29,28,27,0.76)] px-[0.42rem] py-[0.24rem] text-[0.56rem] font-semibold uppercase tracking-[0.04em] text-[#ebf3f1] hover:bg-[rgba(39,38,37,0.9)]"
            onClick={() => send({ type: "set_deck_peek_cards_reveal", cardIds: peek.cardIds, reveal: !peek.cardIds.every((id) => revealed.has(id)), ...(zone === "runeDeck" ? { zone: "runeDeck" as const } : {}) } as GameActionIntent)}
          >
            {t("sim.revealAll") ?? "Reveal All"}
          </button>
          <button
            type="button"
            aria-label="Close deck peek"
            className="grid h-[1.7rem] w-[1.7rem] place-items-center rounded-[0.2rem] border border-[rgba(206,209,214,0.2)] text-[#e7e8eb] hover:bg-white/10"
            onClick={() => send({ type: "dismiss_deck_peek", ...(zone === "runeDeck" ? { zone: "runeDeck" as const } : {}) } as GameActionIntent)}
          >
            ×
          </button>
        </div>
      </header>
      <div className="flex min-h-0 flex-wrap items-start gap-[0.4rem] overflow-x-auto p-[0.5rem]">
        {cards.map((card) => (
          <article
            key={card.id}
            className="relative flex w-[5.2rem] shrink-0 flex-col overflow-hidden rounded-[0.26rem] border border-[rgba(180,183,188,0.24)] bg-[rgba(16,15,14,0.66)]"
          >
            <div className="relative aspect-[63/88] w-full overflow-hidden bg-[#121110]">
              <SafeImg src={cardImageUrl(card, "thumb")} alt={card.name} loading="lazy" className="h-full w-full object-contain" />
              {revealed.has(card.id) ? (
                <span className="absolute left-[0.12rem] top-[0.12rem] rounded-[0.12rem] border border-[rgba(177,207,210,0.52)] bg-[rgba(48,47,46,0.92)] px-[0.18rem] py-[0.04rem] text-[0.44rem] font-bold uppercase tracking-[0.05em] text-[#ebf3f1]">
                  {t("sim.reveal") ?? "Reveal"}
                </span>
              ) : null}
            </div>
            <p className="m-0 truncate px-[0.22rem] py-[0.14rem] text-[0.52rem] font-bold" title={card.name}>
              {card.name}
            </p>
            <div className="mt-auto grid grid-cols-2 gap-[0.14rem] p-[0.2rem]">
              <button
                type="button"
                className="rounded-[0.16rem] border border-[rgba(177,207,210,0.26)] bg-[rgba(29,28,27,0.78)] px-[0.1rem] py-[0.18rem] text-[0.46rem] font-semibold text-[#ebf3f1] hover:bg-[rgba(39,38,37,0.9)]"
                onClick={() =>
                  send({
                    type: "set_deck_peek_card_reveal",
                    cardId: card.id,
                    reveal: !revealed.has(card.id),
                    ...(zone === "runeDeck" ? { zone: "runeDeck" as const } : {}),
                  } as GameActionIntent)
                }
              >
                {revealed.has(card.id) ? t("sim.hide") ?? "Hide" : t("sim.reveal") ?? "Reveal"}
              </button>
              <button
                type="button"
                className="rounded-[0.16rem] border border-[rgba(215,218,225,0.16)] bg-[rgba(25,24,23,0.74)] px-[0.1rem] py-[0.18rem] text-[0.46rem] font-semibold text-[#e6e7ec] hover:bg-[rgba(32,31,30,0.88)]"
                onClick={() =>
                  send({ type: "put_deck_peek_card_on_top", cardId: card.id, ...(zone === "runeDeck" ? { zone: "runeDeck" as const } : {}) } as GameActionIntent)
                }
              >
                {t("sim.onTop") ?? "On Top"}
              </button>
              <button
                type="button"
                className="rounded-[0.16rem] border border-[rgba(191,182,202,0.24)] bg-[rgba(29,28,27,0.84)] px-[0.1rem] py-[0.18rem] text-[0.46rem] font-semibold text-[#e6e0e8] hover:bg-[rgba(35,34,33,0.9)]"
                onClick={() =>
                  send({ type: "recycle_deck_peek_card", cardId: card.id, ...(zone === "runeDeck" ? { zone: "runeDeck" as const } : {}) } as GameActionIntent)
                }
              >
                {t("sim.recycle") ?? "Recycle"}
              </button>
              <button
                type="button"
                className="rounded-[0.16rem] border border-[rgba(224,200,171,0.26)] bg-[rgba(46,34,26,0.84)] px-[0.1rem] py-[0.18rem] text-[0.46rem] font-semibold text-[#f3e4d8] hover:bg-[rgba(58,42,31,0.9)]"
                onClick={() =>
                  send({ type: "take_card_from_deck", cardId: card.id, to: "hand" } as GameActionIntent)
                }
              >
                {t("sim.toHand") ?? "To hand"}
              </button>
            </div>
          </article>
        ))}
      </div>
      <footer className="flex items-center justify-between border-t border-[rgba(192,198,204,0.14)] px-[0.55rem] py-[0.3rem]">
        <div className="flex items-center gap-[0.24rem]">
          {zone === "deck" ? (
            <>
              <button
                type="button"
                className="rounded-[0.18rem] border border-[rgba(177,207,210,0.24)] bg-[rgba(29,28,27,0.7)] px-[0.4rem] py-[0.2rem] text-[0.52rem] font-semibold text-[#ebf3f1] hover:bg-[rgba(39,38,37,0.88)]"
                onClick={() => send({ type: "peek_deck_bottom" } as GameActionIntent)}
              >
                {t("sim.deckPeek.lookAtBottom") ?? "Look at Bottom"}
              </button>
              <button
                type="button"
                className="rounded-[0.18rem] border border-[rgba(177,207,210,0.24)] bg-[rgba(29,28,27,0.7)] px-[0.4rem] py-[0.2rem] text-[0.52rem] font-semibold text-[#ebf3f1] hover:bg-[rgba(39,38,37,0.88)]"
                onClick={() => send({ type: "shuffle_deck", preserveRecycledBottom: true } as GameActionIntent)}
              >
                {t("sim.deckPeek.shuffleUnrecycled") ?? "Shuffle Unrecycled"}
              </button>
              <button
                type="button"
                className="rounded-[0.18rem] border border-[rgba(215,218,225,0.16)] bg-[rgba(25,24,23,0.72)] px-[0.4rem] py-[0.2rem] text-[0.52rem] font-semibold text-[#e6e7ec] hover:bg-[rgba(32,31,30,0.88)]"
                onClick={() => send({ type: "shuffle_deck" } as GameActionIntent)}
              >
                {t("sim.shuffleDeck") ?? "Shuffle Deck"}
              </button>
            </>
          ) : null}
        </div>
        <span className="text-[0.5rem] uppercase tracking-[0.06em] text-[#91969f]">
          {cards.length} / {zone === "runeDeck" ? board?.runeDeck.length ?? 0 : board?.deck.length ?? 0}
        </span>
      </footer>
    </div>
  );
}
