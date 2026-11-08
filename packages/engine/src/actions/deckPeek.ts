import type { DeckPeek } from "@rift/protocol";
import type { ActionHandler } from "../types";
import {
  cloneDeckPeek,
  deckPeekZone,
  isAutoRevealPeek,
  peekList,
  pruneDeckPeek,
  recycledBottomCount,
  resetDeckPeek,
  revealedSubset,
  setRecycledBottomCount,
  shuffleIds,
} from "../state/board";
import { deepClone } from "../state/board";
import { int, num, str } from "./common";
import { logDraft } from "../log/entries";

function sameIds(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/** 35qz `cj`: deck-peek equality. */
function deckPeekEqual(a: DeckPeek | undefined, b: DeckPeek | undefined): boolean {
  return (
    deckPeekZone(a) === deckPeekZone(b) &&
    a?.revision === b?.revision &&
    isAutoRevealPeek(a) === isAutoRevealPeek(b) &&
    sameIds(a?.cardIds ?? [], b?.cardIds ?? []) &&
    sameIds(revealedSubset(a), revealedSubset(b))
  );
}

/** orig: 35qz5rkx7yexy.js:23281 "peek_deck_top" */
export const peekDeckTop: ActionHandler = ({ room, playerIndex, board, action, context }) => {
  const zone = action.zone === "runeDeck" ? "runeDeck" : "deck";
  const count = Math.max(1, Math.min(int(action.count) || 1, 12));
  if (peekList(board, zone).length === 0) return;
  const before = deepClone(board.deckPeek);
  board.deckPeek = cloneDeckPeek(board);
  pruneDeckPeek(board);
  if (board.deckPeek.cardIds.length > 0 && deckPeekZone(board.deckPeek) !== zone) resetDeckPeek(board);
  if (zone === "runeDeck") board.deckPeek.zone = "runeDeck";
  else delete board.deckPeek.zone;
  if (board.deckPeek.cardIds.length === 0) board.deckPeek.revision = (board.deckPeek.revision ?? 0) + 1;
  const list = peekList(board, zone);
  const peeked = new Set(board.deckPeek.cardIds);
  let consecutive = 0;
  for (let index = list.length - 1; index >= 0; index -= 1) {
    const card = list[index];
    if (!card || !peeked.has(card.id)) break;
    consecutive += 1;
  }
  const take = Math.min(list.length, consecutive + count);
  const ids = list
    .slice(list.length - take)
    .reverse()
    .map((card) => card.id);
  const existing = new Set(board.deckPeek.cardIds);
  board.deckPeek.cardIds = [...board.deckPeek.cardIds, ...ids.filter((id) => !existing.has(id))];
  pruneDeckPeek(board);
  if (isAutoRevealPeek(board.deckPeek)) {
    board.deckPeek.revealedCardIds = [...board.deckPeek.cardIds];
  }
  if (deckPeekEqual(before, board.deckPeek)) {
    board.deckPeek = before;
    return;
  }
  room.players[playerIndex]!.board = board;
  const rune = zone === "runeDeck";
  context.log(
    logDraft(
      rune ? (count === 1 ? "lookedAtTopRune" : "lookedAtTopRunes") : "lookedAtTopCards",
      { count },
      { authorPlayerId: context.actorId, actionKind: "inspect", at: context.now },
    ),
  );
};

/** orig: 35qz5rkx7yexy.js:23325 "peek_deck_bottom" */
export const peekDeckBottom: ActionHandler = ({ room, playerIndex, board, context }) => {
  if (board.deck.length === 0) return;
  const before = deepClone(board.deckPeek);
  board.deckPeek = cloneDeckPeek(board);
  pruneDeckPeek(board);
  if (board.deckPeek.cardIds.length > 0 && deckPeekZone(board.deckPeek) !== "deck") resetDeckPeek(board);
  delete board.deckPeek.zone;
  const peeked = new Set(board.deckPeek.cardIds);
  const card = board.deck.find((item) => !peeked.has(item.id));
  if (!card) {
    board.deckPeek = before;
    return;
  }
  if (board.deckPeek.cardIds.length === 0) board.deckPeek.revision = (board.deckPeek.revision ?? 0) + 1;
  board.deckPeek.cardIds = [...board.deckPeek.cardIds, card.id];
  board.deckPeek.revealedCardIds = revealedSubset(board.deckPeek);
  delete board.deckPeek.autoRevealNewCards;
  pruneDeckPeek(board);
  room.players[playerIndex]!.board = board;
  context.log(
    logDraft("lookedAtBottomCard", undefined, {
      authorPlayerId: context.actorId,
      actionKind: "inspect",
      at: context.now,
    }),
  );
};

/** orig: 35qz5rkx7yexy.js:23345 "dismiss_deck_peek" */
export const dismissDeckPeek: ActionHandler = ({ room, playerIndex, board, action, context }) => {
  const zone = action.zone === "runeDeck" ? "runeDeck" : "deck";
  const before = deepClone(board.deckPeek);
  board.deckPeek = cloneDeckPeek(board);
  pruneDeckPeek(board);
  if (board.deckPeek.cardIds.length === 0 || deckPeekZone(board.deckPeek) !== zone) {
    board.deckPeek = before;
    return;
  }
  resetDeckPeek(board);
  room.players[playerIndex]!.board = board;
  context.log(
    logDraft(zone === "runeDeck" ? "closedRuneDeckPeek" : "closedDeckPeek", undefined, {
      authorPlayerId: context.actorId,
      actionKind: "inspect",
      at: context.now,
    }),
  );
};

/** orig: 35qz5rkx7yexy.js:23360 "clear_deck_peek" */
export const clearDeckPeek: ActionHandler = ({ room, playerIndex, board, action, context }) => {
  const zone = action.zone === "runeDeck" ? "runeDeck" : "deck";
  const before = board.deckPeek;
  board.deckPeek = cloneDeckPeek(board);
  pruneDeckPeek(board);
  if (board.deckPeek.cardIds.length === 0 || deckPeekZone(board.deckPeek) !== zone) {
    board.deckPeek = before;
    return;
  }
  const list = peekList(board, zone);
  const ids = [...board.deckPeek.cardIds];
  const bottom = zone === "deck" ? recycledBottomCount(board) : 0;
  const recycled = new Set(zone === "deck" ? list.slice(0, bottom).map((card) => card.id) : []);
  const cards = [];
  for (const id of ids) {
    const index = list.findIndex((card) => card.id === id);
    if (index < 0) continue;
    const [card] = list.splice(index, 1);
    if (card) cards.push(card);
  }
  const shuffled = zone === "deck" ? shuffleIds(cards, { seedKey: `clear-deck-peek|${cards.map((card) => card.id).join(",")}` }) : cards;
  list.unshift(...shuffled);
  if (zone === "deck") {
    const recycledCount = cards.filter((card) => recycled.has(card.id)).length;
    setRecycledBottomCount(board, bottom - recycledCount + shuffled.length);
  }
  resetDeckPeek(board);
  room.players[playerIndex]!.board = board;
  context.log(
    logDraft(
      zone === "runeDeck" ? "recycledLookedAtRunes" : "recycledLookedAtCards",
      { count: cards.length },
      { authorPlayerId: context.actorId, actionKind: "deck", at: context.now },
    ),
  );
};

/** orig: 35qz5rkx7yexy.js:23421 "recycle_deck_peek_card" */
export const recycleDeckPeekCard: ActionHandler = ({ room, playerIndex, board, action, context }) => {
  const zone = action.zone === "runeDeck" ? "runeDeck" : "deck";
  const before = deepClone(board.deckPeek);
  board.deckPeek = cloneDeckPeek(board);
  pruneDeckPeek(board);
  if (deckPeekZone(board.deckPeek) !== zone || !board.deckPeek.cardIds.includes(str(action.cardId))) {
    board.deckPeek = before;
    return;
  }
  const list = peekList(board, zone);
  const cardId = str(action.cardId);
  const index = list.findIndex((card) => card.id === cardId);
  if (index < 0) {
    board.deckPeek = before;
    return;
  }
  const bottom = zone === "deck" ? recycledBottomCount(board) : 0;
  const wasRecycled = zone === "deck" && index < bottom;
  const [card] = list.splice(index, 1);
  if (card) list.unshift(card);
  if (zone === "deck") setRecycledBottomCount(board, bottom - (wasRecycled ? 1 : 0) + 1);
  board.deckPeek.cardIds = board.deckPeek.cardIds.filter((id) => id !== cardId);
  pruneDeckPeek(board);
  if (board.deckPeek.cardIds.length === 0) resetDeckPeek(board);
  room.players[playerIndex]!.board = board;
  context.log(
    logDraft(zone === "runeDeck" ? "recycledLookedAtRune" : "recycledLookedAtCard", undefined, {
      authorPlayerId: context.actorId,
      actionKind: "deck",
      at: context.now,
    }),
  );
};

/** orig: 35qz5rkx7yexy.js:23435 "put_deck_peek_card_on_top" */
export const putDeckPeekCardOnTop: ActionHandler = ({ room, playerIndex, board, action, context }) => {
  const zone = action.zone === "runeDeck" ? "runeDeck" : "deck";
  const before = deepClone(board.deckPeek);
  board.deckPeek = cloneDeckPeek(board);
  pruneDeckPeek(board);
  const cardId = str(action.cardId);
  if (deckPeekZone(board.deckPeek) !== zone || !board.deckPeek.cardIds.includes(cardId)) {
    board.deckPeek = before;
    return;
  }
  const list = peekList(board, zone);
  const index = list.findIndex((card) => card.id === cardId);
  if (index < 0) {
    board.deckPeek = before;
    return;
  }
  const bottom = zone === "deck" ? recycledBottomCount(board) : 0;
  const wasRecycled = zone === "deck" && index < bottom;
  const [card] = list.splice(index, 1);
  if (card) list.push(card);
  if (zone === "deck" && wasRecycled) setRecycledBottomCount(board, bottom - 1);
  board.deckPeek.cardIds = board.deckPeek.cardIds.filter((id) => id !== cardId);
  pruneDeckPeek(board);
  if (board.deckPeek.cardIds.length === 0) resetDeckPeek(board);
  room.players[playerIndex]!.board = board;
  context.log(
    logDraft("putLookedAtCardOnTop", undefined, {
      authorPlayerId: context.actorId,
      actionKind: "deck",
      at: context.now,
    }),
  );
};

/** orig: 35qz5rkx7yexy.js:23358 "set_deck_peek_card_reveal"/"set_deck_peek_cards_reveal" (cN) */
export const setDeckPeekCardReveal: ActionHandler = ({ room, playerIndex, board, action, context }) => {
  const zone = action.zone === "runeDeck" ? "runeDeck" : "deck";
  const before = deepClone(board.deckPeek);
  board.deckPeek = cloneDeckPeek(board);
  pruneDeckPeek(board);
  if (deckPeekZone(board.deckPeek) !== zone) {
    board.deckPeek = before;
    return;
  }
  const ids =
    action.type === "set_deck_peek_card_reveal"
      ? [str(action.cardId)]
      : Array.isArray(action.cardIds)
        ? action.cardIds.filter((id): id is string => typeof id === "string")
        : [];
  if (ids.length === 0 || ids.some((id) => !board.deckPeek.cardIds.includes(id))) {
    board.deckPeek = before;
    return;
  }
  const reveal = action.reveal === true;
  const revealed = new Set(board.deckPeek.revealedCardIds ?? []);
  for (const id of ids) {
    if (reveal) revealed.add(id);
    else revealed.delete(id);
  }
  board.deckPeek.revealedCardIds = board.deckPeek.cardIds.filter((id) => revealed.has(id));
  if (action.type === "set_deck_peek_card_reveal") {
    if (!reveal) delete board.deckPeek.autoRevealNewCards;
  } else if (action.autoRevealNewCards === true && reveal) {
    board.deckPeek.autoRevealNewCards = true;
    board.deckPeek.revealedCardIds = [...board.deckPeek.cardIds];
  } else if (!(reveal && action.autoRevealNewCards !== false)) {
    delete board.deckPeek.autoRevealNewCards;
  }
  pruneDeckPeek(board);
  if (deckPeekEqual(before, board.deckPeek)) {
    board.deckPeek = before;
    return;
  }
  room.players[playerIndex]!.board = board;
  const visibility = reveal ? "revealed" : "hid";
  context.log(
    logDraft(
      action.type === "set_deck_peek_card_reveal"
        ? zone === "runeDeck"
          ? "changedLookedAtRuneVisibility"
          : "changedLookedAtCardVisibility"
        : zone === "runeDeck"
          ? "changedLookedAtRunesVisibility"
          : "changedLookedAtCardsVisibility",
      { visibility },
      { authorPlayerId: context.actorId, actionKind: "inspect", at: context.now },
    ),
  );
};
