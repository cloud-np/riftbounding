"use client";

import { createContext, useContext } from "react";

import type { BoardInteractionValue, CardHoverPreviewApi } from "./types";

export const BoardInteractionContext = createContext<BoardInteractionValue | null>(null);

export function useBoardInteraction(): BoardInteractionValue {
  const value = useContext(BoardInteractionContext);
  if (!value) {
    throw new Error("useBoardInteraction must be used inside <BoardInteractionProvider>");
  }
  return value;
}

export function useBoardInteractionOptional(): BoardInteractionValue | null {
  return useContext(BoardInteractionContext);
}

/** Public hook for the match log (hover a card name → same preview layer). */
export function useCardHoverPreview(): CardHoverPreviewApi {
  const value = useContext(BoardInteractionContext);
  return {
    showCardPreview: (card, anchor, options) => value?.showCardPreview(card, anchor, options),
    showCardPreviewByName: (name, anchor, options) => value?.showCardPreviewByName(name, anchor, options),
    hideCardPreview: () => value?.hideCardPreview(),
  };
}
