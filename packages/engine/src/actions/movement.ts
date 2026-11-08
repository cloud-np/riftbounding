import type { CardInstance, PlayerBoard, Room, Zone } from "@rift/protocol";
import type { ActionHandler } from "../types";
import {
  BOARD_ZONES,
  allCardIds,
  clearPileCard,
  cloneCard,
  cloneDeckPeek,
  deckPeekZone,
  findCardAnywhere,
  hasUnitAt,
  insertAfterAttachments,
  isBattlefieldZone,
  isFieldZone,
  isGoldToken,
  isTokenOrDuplicate,
  moveCardCleanup,
  pruneDeckPeek,
  recycledBottomCount,
  resetDeckPeek,
  setNeekoController,
  setRecycledBottomCount,
  shuffleIds,
  takeCardId,
  zoneList,
} from "../state/board";
import {
  applyMoveEvents,
  canCardGoToZone,
  eventUnitZones,
  moveCard,
  recyclePeekCardInPlace,
  sendToDeck,
  takeCardFromDeck,
  transferCardControl,
  type MoveEvent,
} from "../rules/movement";
import { afterUnitEvents } from "../rules/movement";
import { afterChainResolved, tryTriggerConquerAssist } from "../rules/chain";
import {
  hasBanishTopCardText,
  hasEquip,
  hasQuickDraw,
  hasUntilNextEndingPhase,
  isDeployGear,
  isGearCardType,
  isUnitCardType,
  tokenDefaultsExhausted,
  tokenImage,
  tokenType,
  getCardByCode,
  hasWhenYouPlayMeText,
} from "../catalog";
import {
  entityScore,
  thirdPartyEntryBlocked,
  playerIndexById,
} from "../state/selectors";
import { deepClone } from "../state/board";
import { restoreRoom, bool, int, num, str } from "./common";
import { logDraft } from "../log/entries";
import { battlefieldLabel } from "../rules/victory";

function logMove(context: Parameters<ActionHandler>[0]["context"], event: MoveEvent, actionType: string): void {
  const from = event.showdown?.kind === "move" ? event.showdown.from : "zone";
  const to = event.showdown?.kind === "move" ? event.showdown.to : "zone";
  if (from === to) return;
  const key =
    from === "deck"
      ? "movedCardFromDeck"
      : to === "trash"
        ? "movedCardToTrash"
        : (from === "hand" || from === "trash" || from === "banished" || from === "champion") && (to === "base" || isBattlefieldZone(to))
          ? "playedFromZoneTo"
          : "movedToZone";
  if (key === "movedCardFromDeck") {
    context.log(logDraft(key, { card: event.movedCard.name, zone: to }, { actionKind: "board", at: context.now }));
  } else if (key === "movedCardToTrash") {
    context.log(logDraft(key, { card: event.movedCard.name, source: from }, { actionKind: "board", at: context.now }));
  } else if (key === "playedFromZoneTo") {
    context.log(logDraft(key, { card: event.movedCard.name, source: from, zone: to }, {
      authorPlayerId: context.actorId,
      actionKind: "board",
      at: context.now,
    }));
  } else {
    context.log(logDraft(key, { card: event.movedCard.name, zone: to }, {
      authorPlayerId: context.actorId,
      actionKind: "board",
      at: context.now,
    }));
  }
}

/** orig: 35qz5rkx7yexy.js:23819 "move_card" */
export const moveCardAction: ActionHandler = ({ room, playerIndex, action, context }) => {
  const from = str(action.from);
  const to = str(action.to);
  const cardId = str(action.cardId);
  if (!from || !to || !cardId) return;
  const event = moveCard(room, playerIndex, {
    from,
    to,
    cardId,
    ...(typeof action.toIndex === "number" ? { toIndex: action.toIndex } : {}),
    ...(action.asHidden === true ? { asHidden: true } : {}),
    ...(action.forced === true ? { forced: true } : {}),
  });
  if (!event) return;
  applyMoveEvents(room, [event], context);
  logMove(context, event, "move_card");
};

/** orig: 35qz5rkx7yexy.js:23832 "move_cards_to_trash_batch" */
export const moveCardsToTrashBatch: ActionHandler = ({ room, playerIndex, action, context }) => {
  const cardIds = Array.isArray(action.cardIds) ? action.cardIds.filter((id): id is string => typeof id === "string") : [];
  const from = str(action.from);
  if (cardIds.length === 0 || !from) return;
  const backup = deepClone(room);
  const events: MoveEvent[] = [];
  for (const cardId of cardIds) {
    const event = moveCard(room, playerIndex, { from, to: "trash", cardId });
    if (!event) {
      restoreRoom(room, backup);
      return;
    }
    events.push(event);
  }
  applyMoveEvents(room, events, context);
  context.log(
    logDraft("movedCardsToTrash", { count: events.length, source: from }, {
      authorPlayerId: context.actorId,
      actionKind: "trash",
      at: context.now,
    }),
  );
};

/** orig: 35qz5rkx7yexy.js:23853 "move_off_board_cards_batch" */
export const moveOffBoardCardsBatch: ActionHandler = ({ room, playerIndex, action, context }) => {
  const cardIds = Array.isArray(action.cardIds) ? action.cardIds.filter((id): id is string => typeof id === "string") : [];
  const from = str(action.from);
  const to = str(action.to);
  if (cardIds.length === 0 || !from || !to) return;
  if (from === to && to !== "deck") return;
  const backup = deepClone(room);
  const ordered = to === "deck" ? shuffleIds(cardIds, { random: context.rng }).reverse() : cardIds;
  const events: MoveEvent[] = [];
  for (const cardId of ordered) {
    if (from === "deck") {
      if (to === "deck") {
        if (!recyclePeekCardInPlace(room, playerIndex, cardId, "deck")) {
          restoreRoom(room, backup);
          return;
        }
        continue;
      }
      const event = takeCardFromDeck(room, playerIndex, { cardId, to });
      if (!event) {
        restoreRoom(room, backup);
        return;
      }
      events.push(event);
      continue;
    }
    const event =
      to === "deck"
        ? sendToDeck(room, playerIndex, { from, cardId, position: "bottom" })
        : moveCard(room, playerIndex, { from, to, cardId });
    if (!event) {
      restoreRoom(room, backup);
      return;
    }
    events.push(event);
  }
  if (events.length > 0) applyMoveEvents(room, events, context);
  context.log(
    to === "deck"
      ? logDraft("recycledSelectedCards", { count: cardIds.length, source: from }, {
          authorPlayerId: context.actorId,
          actionKind: "deck",
          at: context.now,
        })
      : logDraft("movedSelectedCards", { count: events.length, source: from, zone: to }, {
          authorPlayerId: context.actorId,
          actionKind: "board",
          at: context.now,
        }),
  );
};

/** orig: 35qz5rkx7yexy.js:23926 "transfer_card_control" */
export const transferCardControlAction: ActionHandler = ({ room, playerIndex, action, context }) => {
  const event = transferCardControl(room, playerIndex, {
    zone: str(action.zone),
    cardId: str(action.cardId),
    ...(typeof action.targetPlayerId === "string" ? { targetPlayerId: action.targetPlayerId } : {}),
  });
  if (!event) return;
  // 35qz transfer_card_control: 487939 `Z` only (no move-events/presence cleanup).
  afterChainResolved(room, eventUnitZones(event.movedCard, [str(action.zone)]));
  const zone = str(action.zone);
  if (
    event.targetPlayerIndex !== undefined &&
    isBattlefieldZone(zone) &&
    isUnitCardType(event.movedCard) &&
    !room.pendingBattlefieldConquerAssist
  ) {
    tryTriggerConquerAssist(room, {
      preferredAttackerId: room.players[event.targetPlayerIndex]?.id,
      preferredZone: zone,
    });
  }
  context.log(
    logDraft("gaveControl", { card: event.movedCard.name }, {
      authorPlayerId: context.actorId,
      actionKind: "board",
      at: context.now,
    }),
  );
};

/** orig: 35qz5rkx7yexy.js:23586 "equip_card" */
export const equipCard: ActionHandler = ({ room, playerIndex, board, action, context }) => {
  const equipmentCardId = str(action.equipmentCardId);
  const unitCardId = str(action.unitCardId);
  if (!equipmentCardId || !unitCardId || equipmentCardId === unitCardId) return;
  const equipment = findCardAnywhere(board, equipmentCardId);
  const unit = findCardAnywhere(board, unitCardId);
  if (!equipment || !unit) return;
  const fromHandAttachment =
    equipment.zone === "hand" && action.asAttachment === true && hasQuickDraw(equipment.card);
  if (
    (!isFieldZone(equipment.zone) && !fromHandAttachment) ||
    equipment.card.hidden ||
    (action.asAttachment !== true && (equipment.zone !== "base" || !!equipment.card.attachedToCardId)) ||
    equipment.card.attachedToCardId === unitCardId ||
    !isFieldZone(unit.zone) ||
    equipment.card.oriannaAnimation ||
    !isGearCardType(equipment.card) ||
    !hasEquip(equipment.card) ||
    unit.card.hidden ||
    !isUnitCardType(unit.card)
  ) {
    return;
  }
  const fromZone = equipment.zone;
  zoneList(board, fromZone).splice(equipment.index, 1);
  const attached = cloneCard(equipment.card);
  const toZone = unit.zone;
  moveCardCleanup(attached, fromZone, toZone);
  if (attached.hidden) {
    delete attached.hidden;
    delete attached.revealedToPlayerIds;
    delete attached.revealedToOpponent;
  }
  attached.attachedToCardId = unitCardId;
  attached.exhausted = equipment.card.exhausted;
  insertAfterAttachments(zoneList(board, toZone), unitCardId, attached);
  afterUnitEvents(room, eventUnitZones(equipment.card, [fromZone, toZone]));
  context.log(
    logDraft("equipped", { card: attached.name, target: unit.card.name }, {
      authorPlayerId: context.actorId,
      actionKind: "board",
      at: context.now,
    }),
  );
};

/** orig: 35qz5rkx7yexy.js:23973 "send_to_deck" */
export const sendToDeckAction: ActionHandler = ({ room, playerIndex, action, context }) => {
  const from = str(action.from);
  const position = action.position === "top" ? "top" : "bottom";
  const event = sendToDeck(room, playerIndex, { from, cardId: str(action.cardId), position });
  if (!event) return;
  applyMoveEvents(room, [event], context);
  context.log(
    logDraft("movedIntoDeck", { card: event.movedCard.name, position }, {
      authorPlayerId: context.actorId,
      actionKind: "deck",
      at: context.now,
    }),
  );
};

/** 437381 `k` / `dO`: flip exhaustion, consuming Gold tokens. */
/** orig: 35qz5rkx7yexy.js:22891 "toggle_exhausted" */
export const toggleExhausted: ActionHandler = ({ room, playerIndex, board, action, context }) => {
  const zone = str(action.zone);
  const cardId = str(action.cardId);
  if (zone === "champion" || typeof action.expectedExhausted !== "boolean") return;
  const list = zone === "deck" || zone === "runeDeck" ? null : zoneList(board, zone);
  if (!list) return;
  const index = list.findIndex((card) => card.id === cardId);
  const card = list[index];
  if (!card || card.exhausted !== action.expectedExhausted) return;
  if (!card.exhausted && isFieldZone(zone) && isGoldToken(card)) {
    list.splice(index, 1);
    context.log(
      logDraft("usedGoldToken", undefined, {
        authorPlayerId: context.actorId,
        actionKind: "board",
        at: context.now,
      }),
    );
    return;
  }
  list[index] = { ...card, exhausted: !card.exhausted };
  context.log(
    logDraft(card.exhausted ? "readied" : "exhausted", { card: card.name }, {
      authorPlayerId: context.actorId,
      actionKind: "board",
      at: context.now,
    }),
  );
};

/** orig: 35qz5rkx7yexy.js:22950 "draw_cards" */
export const drawCards: ActionHandler = ({ room, playerIndex, board, action, context }) => {
  const count = Math.max(1, Math.min(int(action.count) || 1, 15));
  const to = typeof action.to === "string" ? action.to : "hand";
  if (board.deck.length === 0) return;
  if (!(BOARD_ZONES as string[]).includes(to)) return;
  const drawnCount = Math.min(count, board.deck.length);
  const kept = board.deck.slice(0, board.deck.length - drawnCount);
  const topCards = board.deck.slice(board.deck.length - drawnCount);
  if (
    isBattlefieldZone(to) &&
    topCards.some((card) => isUnitCardType(card)) &&
    thirdPartyEntryBlocked(room, playerIndex, to)
  ) {
    return;
  }
  if (to !== "hand") {
    const backup = deepClone(room);
    const events: MoveEvent[] = [];
    for (const card of [...topCards].reverse()) {
      const event = takeCardFromDeck(room, playerIndex, { cardId: card.id, to });
      if (!event) {
        restoreRoom(room, backup);
        return;
      }
      events.push(event);
    }
    applyMoveEvents(room, events, context);
    // 35qz draw_cards (non-hand): `"deck" === deckPeekZone(...) && dz.Z(board)` after the batch.
    if (deckPeekZone(board.deckPeek) === "deck") resetDeckPeek(board);
    context.log(
      logDraft("drewCards", { count: events.length }, {
        authorPlayerId: context.actorId,
        actionKind: "draw",
        at: context.now,
      }),
    );
    return;
  }
  const drawn = [...topCards].reverse().filter((card) => !isTokenOrDuplicate(card));
  board.deck = kept;
  for (const card of drawn) {
    const copy = cloneCard(card);
    moveCardCleanup(copy, "deck", "hand");
    board.hand.push(copy);
  }
  setRecycledBottomCount(board, Math.min(recycledBottomCount(board), board.deck.length));
  if (deckPeekZone(board.deckPeek) !== "runeDeck") {
    board.deckPeek = {
      cardIds: [],
      revealedCardIds: [],
      ...(board.deckPeek?.revision !== undefined ? { revision: board.deckPeek.revision } : {}),
    };
  }
  if (drawn.some((card) => isUnitCardType(card)) && isBattlefieldZone(to)) afterUnitEvents(room, [to]);
  context.log(
    logDraft("drewCards", { count: drawn.length }, {
      authorPlayerId: context.actorId,
      actionKind: "draw",
      at: context.now,
    }),
  );
  const burned = topCards.length - drawn.length;
  if (burned > 0) {
    context.log(
      logDraft("burnedCards", { count: burned }, {
        authorPlayerId: context.actorId,
        actionKind: "draw",
        at: context.now,
      }),
    );
  }
};

/** orig: 35qz5rkx7yexy.js:23540 "take_top_from_deck" */
export const takeTopFromDeck: ActionHandler = ({ room, playerIndex, board, action, context }) => {
  const top = board.deck[board.deck.length - 1];
  const to = str(action.to);
  if (!top || (!(BOARD_ZONES as string[]).includes(to) && to !== "banished")) return;
  const sourceCardId = typeof action.sourceCardId === "string" ? action.sourceCardId : undefined;
  let temporaryBanish = false;
  if (sourceCardId) {
    const source = findDocksideSource(room, playerIndex, sourceCardId);
    if (to !== "banished" || !source) return;
    temporaryBanish = hasUntilNextEndingPhase(source);
  }
  const event = takeCardFromDeck(room, playerIndex, { cardId: top.id, to });
  if (!event) return;
  if (to === "banished" && sourceCardId) {
    event.movedCard.banishedByCardId = sourceCardId;
    if (temporaryBanish) event.movedCard.banishedUntilEndingPlayerId = room.players[playerIndex]?.id;
  }
  if (to !== "banished") closeDeckPeekAfterTake(board, top.id);
  applyMoveEvents(room, [event], context);
  const sourceName = sourceCardId ? findDocksideSource(room, playerIndex, sourceCardId)?.name : undefined;
  context.log(
    logDraft(
      sourceCardId ? "banishedTopCardWith" : to === "banished" ? "banishedTopCard" : "movedTopCard",
      { card: event.movedCard.name, ...(sourceName ? { source: sourceName } : {}), ...(sourceCardId ? {} : { zone: to }) },
      { authorPlayerId: context.actorId, actionKind: "draw", at: context.now },
    ),
  );
};

/** 78176 `k`: after taking a card from the top, return the rest of the peeked cards. */
function closeDeckPeekAfterTake(board: PlayerBoard, takenCardId: string): void {
  pruneDeckPeek(board);
  if (deckPeekZone(board.deckPeek) !== "deck" || board.deckPeek.cardIds.length === 0) return;
  const remaining = board.deckPeek.cardIds.filter((id) => id !== takenCardId);
  if (remaining.length === 0) {
    resetDeckPeek(board);
    return;
  }
  const bottom = recycledBottomCount(board);
  const bottomIds = new Set(board.deck.slice(0, bottom).map((card) => card.id));
  const returned: CardInstance[] = [];
  for (const id of remaining) {
    const index = board.deck.findIndex((card) => card.id === id);
    if (index < 0) continue;
    const [card] = board.deck.splice(index, 1);
    if (card) returned.push(card);
  }
  const shuffled = shuffleIds(returned, {
    seedKey: `take-top:${takenCardId}|${returned.map((card) => card.id).join(",")}`,
  });
  if (shuffled.length > 0) {
    board.deck.unshift(...shuffled);
    setRecycledBottomCount(
      board,
      bottom - returned.filter((card) => bottomIds.has(card.id)).length + shuffled.length,
    );
  }
  resetDeckPeek(board);
}

function findDocksideSource(room: Room, playerIndex: number, cardId: string): CardInstance | undefined {
  const board = room.players[playerIndex]?.board;
  if (!board) return undefined;
  for (const zone of ["base", "champion", "legend", "battlefieldA", "battlefieldB", "battlefieldC", "battlefieldToken", "trash"] as const) {
    const card = (board as PlayerBoard)[zone]?.find((candidate) => candidate.id === cardId);
    if (card && !card.hidden && hasBanishTopCardText(card)) return card;
  }
  return undefined;
}

/** orig: 35qz5rkx7yexy.js:23571 "take_card_from_deck" */
export const takeCardFromDeckAction: ActionHandler = ({ room, playerIndex, action, context }) => {
  const cardId = str(action.cardId);
  const to = str(action.to);
  if (!cardId || !to) return;
  const event = takeCardFromDeck(room, playerIndex, {
    cardId,
    to,
    ...(typeof action.toIndex === "number" ? { toIndex: action.toIndex } : {}),
  });
  if (!event) return;
  applyMoveEvents(room, [event], context);
  context.log(
    logDraft("movedCardFromDeck", { card: event.movedCard.name, zone: to }, {
      authorPlayerId: context.actorId,
      actionKind: "draw",
      at: context.now,
    }),
  );
};

/** orig: 35qz5rkx7yexy.js:23899 "recycle_all_trash_to_deck" */
export const recycleAllTrashToDeck: ActionHandler = ({ room, playerIndex, board, context }) => {
  if (board.trash.length === 0) return;
  const order = shuffleIds(board.trash.map((card) => card.id), { random: context.rng });
  const backup = deepClone(room);
  const events: MoveEvent[] = [];
  for (let index = order.length - 1; index >= 0; index -= 1) {
    const cardId = order[index];
    if (!cardId) continue;
    const event = sendToDeck(room, playerIndex, { from: "trash", cardId, position: "bottom" });
    if (!event) {
      restoreRoom(room, backup);
      return;
    }
    events.push(event);
  }
  applyMoveEvents(room, events, context);
  context.log(
    logDraft("recycledTrashCards", { count: events.length }, {
      authorPlayerId: context.actorId,
      actionKind: "deck",
      at: context.now,
    }),
  );
};

/** orig: 35qz5rkx7yexy.js:23395 "shuffle_deck" */
export const shuffleDeck: ActionHandler = ({ room, playerIndex, board, action, context }) => {
  if (board.deck.length === 0) return;
  const runePeek = deckPeekZone(board.deckPeek) === "runeDeck";
  const preserve = action.preserveRecycledBottom === true ? recycledBottomCount(board) : 0;
  const bottom = board.deck.slice(0, preserve);
  const rest = board.deck.slice(preserve);
  board.deck = [...bottom, ...shuffleIds(rest, { random: context.rng })];
  setRecycledBottomCount(board, preserve);
  board.deckPeek = runePeek
    ? cloneDeckPeek(board)
    : {
        cardIds: [],
        revealedCardIds: [],
        ...(board.deckPeek?.revision !== undefined ? { revision: board.deckPeek.revision } : {}),
      };
  context.log(
    logDraft(preserve > 0 ? "shuffledKeepingRecycled" : "shuffledDeck", preserve > 0 ? { count: preserve } : undefined, {
      authorPlayerId: context.actorId,
      actionKind: "deck",
      at: context.now,
    }),
  );
};

function makeToken(
  name: string,
  ownerId: string,
  exhausted: boolean,
  context: Parameters<ActionHandler>[0]["context"],
  unavailable: Set<string>,
  requested?: string,
): CardInstance {
  const displayName = name.slice(0, 60);
  const imageUrl = tokenImage(displayName);
  const type = tokenType(displayName);
  const code = imageUrl?.match(/^\/cards\/([A-Z0-9-]+)\.webp$/)?.[1];
  const catalog = code ? getCardByCode(code) : undefined;
  return {
    id: takeCardId(requested, unavailable, context.idFactory),
    name: displayName,
    source: "token",
    ownerPlayerId: ownerId,
    exhausted,
    createdAt: context.now,
    ...(imageUrl ? { imageUrl } : {}),
    ...(type ? { type } : {}),
    ...(catalog
      ? { cardCode: catalog.id, ...(catalog.keywords ? { keywords: [...catalog.keywords] } : {}) }
      : {}),
  };
}

/** orig: 35qz5rkx7yexy.js:23144 "create_token" */
export const createToken: ActionHandler = ({ room, playerIndex, player, board, action, context }) => {
  const zone = str(action.zone);
  if (!(BOARD_ZONES as string[]).includes(zone)) return;
  const name = str(action.name).trim();
  if (!name) return;
  const count = Math.max(1, Math.min(int(action.count) || 1, 99));
  const exhausted = typeof action.exhausted === "boolean" ? action.exhausted : tokenDefaultsExhausted(name);
  const requested = Array.isArray(action.clientCardIds)
    ? action.clientCardIds.filter((id): id is string => typeof id === "string")
    : [];
  const unavailable = requested.length > 0 ? allCardIds(room) : new Set<string>();
  const tokens = Array.from({ length: count }, (_, index) =>
    makeToken(name, player.id, exhausted, context, unavailable, requested[index]),
  );
  const first = tokens[0];
  if (!first) return;
  if (tokens.some((token) => isDeployGear(token)) && !isBattlefieldZone(zone)) return;
  if (
    isBattlefieldZone(zone) &&
    tokens.some((token) => isUnitCardType(token)) &&
    thirdPartyEntryBlocked(room, playerIndex, zone)
  ) {
    return;
  }
  if (isFieldZone(zone)) for (const token of tokens) setNeekoController(token, player.id);
  const list = zoneList(board, zone);
  const insertIndex = tokenInsertionIndex(list, first);
  list.splice(insertIndex, 0, ...tokens);
  if (isBattlefieldZone(zone)) {
    const unit = tokens.find((token) => isUnitCardType(token));
    if (unit) {
      const event: MoveEvent = {
        playerIndex,
        sourceCard: unit,
        movedCard: unit,
        unitZones: [zone],
        showdown: { kind: "move", from: "hand", to: zone },
      };
      applyMoveEvents(room, [event], context);
    }
  }
  context.log(
    logDraft("playedTokens", { count: tokens.length, token: name, zone }, {
      authorPlayerId: player.id,
      actionKind: "board",
      at: context.now,
    }),
  );
};

function tokenInsertionIndex(list: CardInstance[], token: CardInstance): number {
  if (
    token.source !== "token" ||
    Math.max(0, Math.trunc(token.temporaryMightBuff ?? 0)) > 0 ||
    hasCounters(token)
  ) {
    return list.length;
  }
  const key = token.name.trim().toLowerCase();
  const attachedHosts = new Set<string>();
  for (const card of list) {
    if (typeof card.attachedToCardId === "string" && card.attachedToCardId) attachedHosts.add(card.attachedToCardId);
  }
  let match = -1;
  for (let index = 0; index < list.length; index += 1) {
    const card = list[index];
    if (!card) continue;
    if (
      card.source !== "token" ||
      Math.max(0, Math.trunc(card.temporaryMightBuff ?? 0)) > 0 ||
      hasCounters(card) ||
      card.attachedToCardId ||
      attachedHosts.has(card.id)
    ) {
      continue;
    }
    if (card.name.trim().toLowerCase() === key && !!card.exhausted === !!token.exhausted) match = index;
  }
  if (match < 0) return list.length;
  let index = match + 1;
  const hostId = list[match]?.id;
  while (index < list.length && hostId && list[index]?.attachedToCardId === hostId) index += 1;
  return index;
}

function hasCounters(card: CardInstance): boolean {
  return (
    (typeof card.whiteCounter === "number" && Number.isFinite(card.whiteCounter)) ||
    (typeof card.redCounter === "number" && Number.isFinite(card.redCounter))
  );
}

/** orig: 35qz5rkx7yexy.js:23238 "duplicate_card" */
export const duplicateCard: ActionHandler = ({ room, playerIndex, player, board, action, context }) => {
  const zone = str(action.zone);
  if (
    !(BOARD_ZONES as string[]).includes(zone) &&
    zone !== "banished" &&
    zone !== "champion"
  ) {
    return;
  }
  const ownerIndex = resolveOwner(room, playerIndex, action.owner === "opponent" ? "opponent" : "self", typeof action.targetPlayerId === "string" ? action.targetPlayerId : undefined);
  if (ownerIndex < 0) return;
  const ownerBoard = room.players[ownerIndex]?.board;
  if (!ownerBoard) return;
  const list = zoneList(ownerBoard, zone);
  const sourceIndex = list.findIndex((card) => card.id === str(action.cardId));
  const source = list[sourceIndex];
  if (!source || source.hidden) return;
  if (
    ownerIndex !== playerIndex &&
    zone === "hand" &&
    !context.authorizedPlayerIds?.includes(room.players[ownerIndex]?.id ?? "") &&
    !handVisibleTo(ownerBoard, source, player.id)
  ) {
    return;
  }
  const duplicate = cloneCard(source);
  duplicate.id = takeCardId(
    typeof action.clientCardId === "string" ? action.clientCardId : undefined,
    typeof action.clientCardId === "string" ? allCardIds(room) : new Set(),
    context.idFactory,
  );
  duplicate.ownerPlayerId = player.id;
  duplicate.createdAt = context.now;
  duplicate.exhausted = false;
  duplicate.isDuplicate = true;
  duplicate.neekoLegendControllerId = null;
  clearForDuplicate(duplicate);
  if (ownerIndex !== playerIndex) {
    const actorBoard = board;
    actorBoard.base.push(duplicate);
    if (isBattlefieldZone(zone) && isUnitCardType(duplicate)) afterUnitEvents(room, [zone]);
    context.log(
      logDraft("duplicatedOpponentCard", { card: duplicate.name }, {
        authorPlayerId: player.id,
        actionKind: "board",
        at: context.now,
      }),
    );
    return;
  }
  list.splice(sourceIndex + 1, 0, duplicate);
  if (isBattlefieldZone(zone) && isUnitCardType(duplicate)) {
    const event: MoveEvent = {
      playerIndex,
      sourceCard: duplicate,
      movedCard: duplicate,
      unitZones: [zone],
      showdown: { kind: "move", from: "hand", to: zone },
    };
    applyMoveEvents(room, [event], context);
  }
  context.log(
    logDraft("duplicatedInZone", { card: duplicate.name, zone }, {
      authorPlayerId: player.id,
      actionKind: "board",
      at: context.now,
    }),
  );
};

function resolveOwner(
  room: Room,
  actorIndex: number,
  owner: "self" | "opponent",
  targetPlayerId: string | undefined,
): number {
  if (owner !== "opponent") return targetPlayerId && targetPlayerId !== room.players[actorIndex]?.id ? -1 : actorIndex;
  const others = room.players.flatMap((candidate, index) =>
    index !== actorIndex && candidate.board && !candidate.leftAt ? [index] : [],
  );
  if (targetPlayerId) return others.find((index) => room.players[index]?.id === targetPlayerId) ?? -1;
  return others.length === 1 ? (others[0] ?? -1) : -1;
}

function handVisibleTo(board: PlayerBoard, card: CardInstance, viewerId: string): boolean {
  if (board.handRevealToOpponent) {
    return board.handRevealedToPlayerIds === undefined || board.handRevealedToPlayerIds.includes(viewerId);
  }
  if (card.revealedToOpponent) {
    return card.revealedToPlayerIds === undefined || card.revealedToPlayerIds.includes(viewerId);
  }
  return card.revealedToPlayerIds?.includes(viewerId) ?? false;
}

function clearForDuplicate(card: CardInstance): void {
  clearPileCard(card);
  delete card.hidden;
  delete card.attachedToCardId;
  delete card.banishedByCardId;
  delete card.banishedByHiddenSourcePlayerId;
  delete card.banishedUntilEndingPlayerId;
  card.neekoLegendControllerId = null;
}
