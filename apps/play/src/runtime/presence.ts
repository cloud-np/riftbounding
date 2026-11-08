/**
 * Presence store — port of `.recon/pretty/playapp/0ltxa4_95njgw.js` module 371465
 * (`presenceStore` with `hoveredCardIdByPlayerId`, `cardPingByPlayerId`, `boardEmoteByPlayerId`,
 * `chatTypingByPlayerId`; equality helpers `o`/`z`/`G`; `B` reducer; `Q`/`W` empty state).
 */

import type { EmoteId } from "@rift/protocol";
import { createStore, type ExternalStore } from "./store";

export interface CardPing {
  cardId: string;
  pingedAt: number;
  receivedAt: number;
  intent: "general" | "trigger_ability" | "discard_target";
}

export interface BoardEmote {
  emoteId: EmoteId;
  emoteAt: number;
}

export interface PresenceSnapshot {
  hoveredCardIdByPlayerId: Readonly<Record<string, string | null>>;
  cardPingByPlayerId: Readonly<Record<string, CardPing | null>>;
  boardEmoteByPlayerId: Readonly<Record<string, BoardEmote | null>>;
  chatTypingByPlayerId: Readonly<Record<string, boolean>>;
}

/** `371465.Q` — frozen empty state. */
export const EMPTY_PRESENCE: PresenceSnapshot = Object.freeze({
  hoveredCardIdByPlayerId: Object.freeze({}),
  cardPingByPlayerId: Object.freeze({}),
  boardEmoteByPlayerId: Object.freeze({}),
  chatTypingByPlayerId: Object.freeze({}),
});

export type PresenceAction =
  | { type: "hover_state"; playerId: string; hoveredCardId: string | null }
  | { type: "card_ping"; playerId: string; cardPing: CardPing | null }
  | { type: "board_emote"; playerId: string; boardEmote: BoardEmote | null }
  | { type: "chat_typing"; playerId: string; isTyping: boolean }
  | { type: "player_offline"; playerId: string }
  | { type: "clear" };

/** `371465.o` — card ping equality. */
export function cardPingEqual(a: CardPing | null, b: CardPing | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.cardId === b.cardId && a.pingedAt === b.pingedAt && a.intent === b.intent;
}

/** `371465.z` — set when changed. */
export function setCardPing(
  map: Map<string, CardPing | null>,
  playerId: string,
  next: CardPing | null,
): boolean {
  if (cardPingEqual(map.get(playerId) ?? null, next)) return false;
  map.set(playerId, next);
  return true;
}

/** `371465.B` reducer. */
export function reducePresence(state: PresenceSnapshot, action: PresenceAction): PresenceSnapshot {
  switch (action.type) {
    case "hover_state":
      if (state.hoveredCardIdByPlayerId[action.playerId] === action.hoveredCardId) return state;
      return {
        ...state,
        hoveredCardIdByPlayerId: {
          ...state.hoveredCardIdByPlayerId,
          [action.playerId]: action.hoveredCardId,
        },
      };
    case "card_ping": {
      const current = state.cardPingByPlayerId[action.playerId] ?? null;
      if (cardPingEqual(current, action.cardPing)) return state;
      return {
        ...state,
        cardPingByPlayerId: { ...state.cardPingByPlayerId, [action.playerId]: action.cardPing },
      };
    }
    case "board_emote": {
      const current = state.boardEmoteByPlayerId[action.playerId] ?? null;
      const next = action.boardEmote;
      if (
        current === next ||
        (current && next && current.emoteId === next.emoteId && current.emoteAt === next.emoteAt)
      ) {
        return state;
      }
      return {
        ...state,
        boardEmoteByPlayerId: { ...state.boardEmoteByPlayerId, [action.playerId]: next },
      };
    }
    case "chat_typing":
      if (Boolean(state.chatTypingByPlayerId[action.playerId]) === action.isTyping) return state;
      return {
        ...state,
        chatTypingByPlayerId: { ...state.chatTypingByPlayerId, [action.playerId]: action.isTyping },
      };
    case "player_offline": {
      const { playerId } = action;
      const next: PresenceSnapshot = {
        hoveredCardIdByPlayerId:
          playerId in state.hoveredCardIdByPlayerId
            ? { ...state.hoveredCardIdByPlayerId, [playerId]: null }
            : state.hoveredCardIdByPlayerId,
        cardPingByPlayerId:
          playerId in state.cardPingByPlayerId
            ? { ...state.cardPingByPlayerId, [playerId]: null }
            : state.cardPingByPlayerId,
        boardEmoteByPlayerId:
          playerId in state.boardEmoteByPlayerId
            ? { ...state.boardEmoteByPlayerId, [playerId]: null }
            : state.boardEmoteByPlayerId,
        chatTypingByPlayerId:
          playerId in state.chatTypingByPlayerId
            ? { ...state.chatTypingByPlayerId, [playerId]: false }
            : state.chatTypingByPlayerId,
      };
      return next.hoveredCardIdByPlayerId === state.hoveredCardIdByPlayerId &&
        next.cardPingByPlayerId === state.cardPingByPlayerId &&
        next.boardEmoteByPlayerId === state.boardEmoteByPlayerId &&
        next.chatTypingByPlayerId === state.chatTypingByPlayerId
        ? state
        : next;
    }
    case "clear":
      return EMPTY_PRESENCE;
  }
}

export interface PresenceStore extends ExternalStore<PresenceSnapshot> {
  dispatch: (action: PresenceAction) => void;
}

/** `371465.W` — create a presence store. */
export function createPresenceStore(): PresenceStore {
  const store = createStore(EMPTY_PRESENCE);
  return {
    ...store,
    dispatch: (action: PresenceAction) =>
      store.setSnapshot(reducePresence(store.getSnapshot(), action)),
  };
}
