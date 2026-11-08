/**
 * Card movement engine — original module 60594 (`cb`), plus the movement legality and
 * zone predicates from 375934 / 780855 and the auto-chain/showdown bridges (487939).
 *
 * All functions mutate the draft room. They validate before moving a card; on failure they
 * return null and leave the room untouched for that card.
 */
import type { BattlefieldZone, CardInstance, PlayerBoard, Room } from "@rift/protocol";
import {
  BATTLEFIELD_ZONES,
  CARD_LOCATION_ZONES,
  FIELD_ZONES,
  allCardIds,
  applyDestinationExhaustion,
  battlefieldZones,
  clearHidden,
  clearPileCard,
  clearReveals,
  cloneCard,
  deckPeekZone,
  detachAttachmentsFrom,
  findCardInZone,
  hasUnitAt,
  insertAfterAttachments,
  isBattlefieldZone,
  isBoardZone,
  isFieldZone,
  isTokenOrDuplicate,
  moveCardCleanup,
  pruneDeckPeek,
  recycledBottomCount,
  resetDeckPeek,
  setRecycledBottomCount,
  zoneList,
} from "../state/board";
import {
  getCard,
  hasHidden,
  isDeployGear,
  isGearCardType,
  isUnitCardType,
  hasWhenYouPlayMeText,
} from "../catalog";
import {
  allyControlsZone,
  battlefieldCount,
  cardOwnerId,
  ownerIndexForCard,
  thirdPartyEntryBlocked,
  transferWouldCreateThirdParty,
} from "../state/selectors";
import { autoChainOnPlay, refreshConquerAssist, tryTriggerConquerAssist } from "./chain";
import { cleanupPostBeginningPresence } from "./chain";
import { isGoldToken } from "../state/board";
import type { HandlerContext } from "../types";

export interface MoveEvent {
  playerIndex: number;
  sourceCard: CardInstance;
  movedCard: CardInstance;
  unitZones: BattlefieldZone[];
  autoChainZone?: BattlefieldZone;
  /** transfer_card_control: the receiving player (for the post-transfer conquer check). */
  targetPlayerIndex?: number;
  showdown?:
    | { kind: "move"; from: string; to: string }
    | { kind: "vacated"; zone: BattlefieldZone };
}

function clampIndex(value: unknown, max: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(Math.trunc(value), max))
    : max;
}

function isHandTrashBanished(zone: string): boolean {
  return zone === "hand" || zone === "trash" || zone === "banished";
}

function cardZoneHasHidden(card: CardInstance): boolean {
  return !!card.hidden;
}

const AUTO_CHAIN_PLAY_ZONES: ReadonlySet<string> = new Set([
  "hand",
  "champion",
  "trash",
  "banished",
]);
const AUTO_CHAIN_DECK_ZONES: ReadonlySet<string> = new Set(["deck"]);

/** 375934 `I`: auto-chain when a "when you play me" card enters base/battlefield. */
export function autoChainZone(
  from: string,
  to: string,
  hidden: boolean,
  card: CardInstance,
  fromZones: ReadonlySet<string> = AUTO_CHAIN_PLAY_ZONES,
): boolean {
  return (
    fromZones.has(from) &&
    !hidden &&
    (to === "base" || isBattlefieldZone(to)) &&
    (card.hasWhenYouPlayMe === true || hasWhenYouPlayMeText(card.text))
  );
}

/** 375934 `p`: battlefield zones for unit movement (empty for non-units). */
export function eventUnitZones(card: CardInstance, zones: readonly string[]): BattlefieldZone[] {
  return isUnitCardType(card) ? (zones.filter(isBattlefieldZone) as BattlefieldZone[]) : [];
}

/** 60441 `T`: Baron Nashor token destinations (it must create/enter the Baron Pit). */
export function baronDestinationAllowed(zone: string): boolean {
  return (
    zone === "battlefieldToken" ||
    zone === "trash" ||
    zone === "hand" ||
    zone === "banished"
  );
}

/** 60441 `c`: Baron Nashor token identity (never in a normal zone). */
function isBaronToken(card: CardInstance | undefined, room: Room): boolean {
  if (!card) return false;
  const name = card.name?.trim().toLowerCase();
  const catalogName = getCard(card.cardCode, card.name)?.name?.trim().toLowerCase();
  return (name === "baron nashor" || catalogName === "baron nashor") && room.sharedBattlefieldToken?.active !== true;
}

function addSharedBattlefieldToken(room: Room): void {
  if (room.sharedBattlefieldToken?.active) return;
  room.sharedBattlefieldToken = {
    kind: "baron_pit",
    zone: "battlefieldToken",
    title: "Baron Pit",
    active: true,
  };
}

/** 371460 `f`: handle gear attachments when a unit moves. */
function settleAttachments(room: Room, sourceCard: CardInstance, to: string): void {
  if (!isUnitCardType(sourceCard)) return;
  if (isHandTrashBanished(to)) {
    detachAttachmentsFrom(room, new Set([sourceCard.id]));
  } else {
    moveAttachedCardsToZone(room, sourceCard.id, to);
  }
}

function moveAttachedCardsToZone(room: Room, hostId: string, to: string): void {
  for (const player of room.players) {
    const board = player.board;
    if (!board) continue;
    const found: Array<{ zone: string; card: CardInstance }> = [];
    // 437381 `T`: every card zone, in zone/index order.
    for (const zone of CARD_LOCATION_ZONES) {
      for (const card of zoneList(board, zone)) {
        if (card.attachedToCardId === hostId) found.push({ zone, card });
      }
    }
    if (found.length === 0) continue;
    for (const { zone, card } of found) {
      const list = zoneList(board, zone);
      const index = list.findIndex((candidate) => candidate.id === card.id);
      if (index >= 0) list.splice(index, 1);
    }
    const destination = zoneList(board, to);
    for (const { card } of found) insertAfterAttachments(destination, hostId, card);
  }
}

/** 375934 `V`: can a card enter a destination zone? */
export function canCardGoToZone(card: CardInstance, to: string, from: string): boolean {
  // 375934 `V`: Deploy gear may only be played to a battlefield (or stay in base).
  if (isDeployGear(card) && !card.hidden) {
    if (isBattlefieldZone(to)) return true;
    if (to === "base" && from !== "base" && (!from || !isBattlefieldZone(from))) return false;
  }
  if (to === "champion") return card.source === "champion";
  if (to === "runeArea") return card.source === "rune";
  const hidden = !!card.hidden;
  if (hidden && isBattlefieldZone(to)) return true;
  if (hidden && (from === "hand" || from === "champion") && to === "base") return false;
  if (isGearCardType(card) && !isUnitCardType(card) && isBattlefieldZone(to)) {
    return from === to && !!card.attachedToCardId;
  }
  return !(isSpellCardTypeSafe(card) && (to === "base" || isBattlefieldZone(to)));
}

function isSpellCardTypeSafe(card: CardInstance): boolean {
  return !!card.type && /spell/i.test(card.type);
}

/** 375934 `n`: hidden reveal behaviour. */
export function hiddenRevealPlan(isGearNotDeploy: boolean, isUnit: boolean): { moveToBase: boolean; exhaustOnReveal: boolean } {
  if (isUnit) return { moveToBase: false, exhaustOnReveal: true };
  if (isGearNotDeploy) return { moveToBase: true, exhaustOnReveal: false };
  return { moveToBase: false, exhaustOnReveal: false };
}

/** 375934 `c`: hidden play type (hand/champion → battlefield). */
export function hiddenPlayType(
  card: CardInstance,
  from: string,
  to: string,
  hasHiddenKeyword: boolean,
): "spell" | "unit" | "gear" | undefined {
  if (!(from === "hand" || from === "champion") || !isBattlefieldZone(to) || !hasHiddenKeyword) return undefined;
  if (isSpellCardTypeSafe(card)) return "spell";
  if (isUnitCardType(card)) return "unit";
  if (isGearCardType(card)) return "gear";
  return undefined;
}

/** 375934 `o`: default chain destination. */
export function defaultChainDestination(entry: { flowEnabled?: boolean; card: CardInstance }): string {
  return entry.flowEnabled && isSpellCardTypeSafe(entry.card) ? "banished" : "trash";
}

/** 375934 `F`: tokens / duplicates never enter hand/trash/banished/champion. */
export function isTokenOrDuplicateCard(card: CardInstance): boolean {
  return isTokenOrDuplicate(card);
}

/**
 * 60594 `u` / `m`: the core move_card implementation.
 * Returns null when the original would reject the move.
 */
export function moveCard(
  room: Room,
  playerIndex: number,
  input: {
    from: string;
    to: string;
    cardId: string;
    toIndex?: number;
    asHidden?: boolean;
    forced?: boolean;
  },
): MoveEvent | null {
  const { from, to, cardId } = input;
  if (
    from === "legend" ||
    !isRevealable(from) ||
    !(isBoardZone(to) || to === "banished" || to === "champion" || to === "runeArea") ||
    (to === "runeArea") !== (from === "runeArea")
  ) {
    return null;
  }
  const player = room.players[playerIndex];
  const board = player?.board;
  if (!player || !board) return null;
  const sourceList = zoneList(board, from);
  const sourceIndex = sourceList.findIndex((card) => card.id === cardId);
  const source = sourceList[sourceIndex];
  if (!source) return null;
  if (to === "champion" && from !== "champion" && !isTokenOrDuplicateCard(source) && board.champion.length > 0) {
    return null;
  }
  const isUnit = isUnitCardType(source);
  const fromField = from === "base" || isBattlefieldZone(from);
  const toBattlefield = isBattlefieldZone(to);
  const fallbackToBase = (): MoveEvent | null =>
    moveCard(room, playerIndex, { ...input, to: "base", toIndex: undefined });

  if (from !== to && toBattlefield && (isUnit && fromField || source.hidden || input.asHidden === true)) {
    if (allyControlsZone(room, playerIndex, to)) {
      return input.forced === true && isUnit && isBattlefieldZone(from) ? fallbackToBase() : null;
    }
  }
  if (from !== to && toBattlefield && isUnit && thirdPartyEntryBlocked(room, playerIndex, to)) {
    if (input.forced === true && (from === "base" || isBattlefieldZone(from))) {
      return from === "base" ? null : fallbackToBase();
    }
    if (from === "hand" || from === "champion" || from === "trash" || from === "banished") {
      return fallbackToBase();
    }
    return null;
  }
  const baron = isBaronToken(source, room);
  if (baron && !baronDestinationAllowed(to)) return null;
  if (to === "battlefieldToken" && !baron && !room.sharedBattlefieldToken?.active) return null;

  const hiddenType = hiddenPlayType(source, from, to, hasHidden(source));
  const playingHidden = !!input.asHidden && !!hiddenType;
  const movingCard = playingHidden ? { ...source, hidden: true } : source;
  if (!canCardGoToZone(movingCard, to, from)) return null;
  const autoChain = autoChainZone(from, to, !!movingCard.hidden, source);

  if (baron && to === "battlefieldToken") addSharedBattlefieldToken(room);

  const sourceCopy = sourceList[sourceIndex];
  if (!sourceCopy) return null;
  const moved = cloneCard(movingCard);
  moveCardCleanup(moved, from, to, { controllerId: player.id, isUnitCardType: isUnitCardType });
  const isAttachedGearSameZone = from === to && isGearCardType(moved) && !!moved.attachedToCardId;
  if (isAttachedGearSameZone || from !== to) detachCardFromHost(moved);

  if (from === to) {
    let targetIndex = sourceList.length - 1;
    if (typeof input.toIndex === "number" && Number.isFinite(input.toIndex)) {
      targetIndex = Math.trunc(input.toIndex);
      if (targetIndex > sourceIndex) targetIndex -= 1;
      targetIndex = Math.max(0, Math.min(targetIndex, sourceList.length - 1));
    }
    if (targetIndex === sourceIndex && !isAttachedGearSameZone && !playingHidden) return null;
    sourceList.splice(sourceIndex, 1);
    sourceList.splice(targetIndex, 0, moved);
    settleAttachments(room, source, to);
    return {
      playerIndex,
      sourceCard: source,
      movedCard: moved,
      unitZones: playingHidden ? eventUnitZones(source, [from, to]) : [],
      autoChainZone: autoChain ? (to as BattlefieldZone) : undefined,
      showdown: { kind: "move", from, to },
    };
  }

  const tokenToPile = (isHandTrashBanished(to) || to === "champion") && isTokenOrDuplicateCard(moved);
  const destinationIndex = isHandTrashBanished(to)
    ? ownerIndexForCard(room, moved, player.id, playerIndex)
    : playerIndex;
  if (!tokenToPile && !room.players[destinationIndex]?.board) return null;
  sourceList.splice(sourceIndex, 1);
  if (!tokenToPile) {
    const destination = room.players[destinationIndex]?.board;
    if (destination) {
      const list = zoneList(destination, to);
      list.splice(clampIndex(input.toIndex, list.length), 0, moved);
    }
  }
  settleAttachments(room, source, tokenToPile ? "trash" : to);
  return {
    playerIndex,
    sourceCard: source,
    movedCard: moved,
    unitZones: eventUnitZones(source, [from, to]),
    autoChainZone: autoChain ? (to as BattlefieldZone) : undefined,
    showdown: { kind: "move", from, to },
  };
}

function detachCardFromHost(card: CardInstance): void {
  if (card.attachedToCardId) delete card.attachedToCardId;
}

function isRevealable(zone: string): boolean {
  return isBoardZone(zone) || zone === "banished" || zone === "champion" || zone === "legend" || zone === "runeArea";
}

/**
 * 60594 `B` / `q`: take a specific card from the top of the deck (or a chosen deck card).
 */
export function takeCardFromDeck(
  room: Room,
  playerIndex: number,
  input: { cardId: string; to: string; toIndex?: number },
): MoveEvent | null {
  const { cardId, to } = input;
  if (!isBoardZone(to) && to !== "banished") return null;
  const board = room.players[playerIndex]?.board;
  if (!board) return null;
  const deckIndex = board.deck.findIndex((card) => card.id === cardId);
  const source = board.deck[deckIndex];
  if (!source) return null;
  const useBase = isBattlefieldZone(to) && isUnitCardType(source) && thirdPartyEntryBlocked(room, playerIndex, to);
  const destination = useBase ? "base" : to;
  const baron = isBaronToken(source, room);
  if (
    (baron && !useBase && !baronDestinationAllowed(destination)) ||
    (destination === "battlefieldToken" && !baron && !room.sharedBattlefieldToken?.active) ||
    !canCardGoToZone(source, destination, "deck")
  ) {
    return null;
  }
  const player = room.players[playerIndex];
  if (!player) return null;
  if (baron && destination === "battlefieldToken") addSharedBattlefieldToken(room);
  const bottom = recycledBottomCount(board);
  board.deck.splice(deckIndex, 1);
  setRecycledBottomCount(board, bottom - Number(deckIndex < bottom));
  const moved = cloneCard(source);
  moveCardCleanup(moved, "deck", destination, { controllerId: player.id });
  if (!(isHandTrashBanished(destination) && isTokenOrDuplicateCard(moved))) {
    const list = zoneList(board, destination);
    list.splice(clampIndex(input.toIndex, list.length), 0, moved);
  }
  pruneDeckPeek(board);
  if (board.deckPeek.cardIds.length === 0) resetDeckPeek(board);
  const autoChain = autoChainZone("deck", destination, !!source.hidden, source, AUTO_CHAIN_DECK_ZONES);
  return {
    playerIndex,
    sourceCard: source,
    movedCard: moved,
    unitZones: eventUnitZones(source, [destination]),
    autoChainZone: autoChain ? (destination as BattlefieldZone) : undefined,
    showdown: { kind: "move", from: "deck", to: destination },
  };
}

/** 60594 `o`: send_to_deck (top/bottom). */
export function sendToDeck(
  room: Room,
  playerIndex: number,
  input: { from: string; cardId: string; position: "top" | "bottom" },
): MoveEvent | null {
  const { from, cardId, position } = input;
  if (!isRevealable(from)) return null;
  const board = room.players[playerIndex]?.board;
  if (!board) return null;
  const list = zoneList(board, from);
  const index = list.findIndex((card) => card.id === cardId);
  const source = list[index];
  if (!source) return null;
  const moved = cloneCard(source);
  if (moved.hidden) moved.hidden = false;
  delete moved.attachedToCardId;
  moved.exhausted = false;
  clearPileCard(moved);
  delete moved.banishedByCardId;
  delete moved.banishedByHiddenSourcePlayerId;
  delete moved.banishedUntilEndingPlayerId;
  const destinationIndex = ownerIndexForCard(room, source, room.players[playerIndex]?.id ?? "", playerIndex);
  const destination = room.players[destinationIndex]?.board ?? null;
  const token = isTokenOrDuplicateCard(source);
  if (!token && !destination) return null;
  list.splice(index, 1);
  if (!token && destination) {
    const bottom = recycledBottomCount(destination);
    if (position === "top") destination.deck.push(moved);
    else destination.deck.unshift(moved);
    setRecycledBottomCount(destination, bottom + Number(position !== "top"));
    pruneDeckPeek(destination);
    // 60594 `o`: sending a card to the main deck closes a deck peek session.
    if (deckPeekZone(destination.deckPeek) === "deck") resetDeckPeek(destination);
  }
  if (isUnitCardType(source)) detachAttachmentsFrom(room, new Set([source.id]));
  return {
    playerIndex,
    sourceCard: source,
    movedCard: moved,
    unitZones: eventUnitZones(source, [from]),
    showdown: isBattlefieldZone(from) && isUnitCardType(source) ? { kind: "vacated", zone: from } : undefined,
  };
}

/** 60594 `C` / `g`: transfer control to another player. */
export function transferCardControl(
  room: Room,
  playerIndex: number,
  input: { zone: string; cardId: string; targetPlayerId?: string },
): MoveEvent | null {
  const { zone, cardId } = input;
  if (!isFieldZone(zone)) return null;
  const others = room.players.flatMap((player, index) =>
    index !== playerIndex && player.board && !player.leftAt ? [index] : [],
  );
  const targetIndex = input.targetPlayerId
    ? room.players.findIndex(
        (player, index) => index !== playerIndex && player.id === input.targetPlayerId && !!player.board && !player.leftAt,
      )
    : others.length === 1
      ? (others[0] ?? -1)
      : -1;
  if (targetIndex < 0) return null;
  const target = room.players[targetIndex];
  const sourceBoard = room.players[playerIndex]?.board;
  const targetBoard = target?.board;
  if (!target || !sourceBoard || !targetBoard) return null;
  const list = zoneList(sourceBoard, zone);
  const index = list.findIndex((card) => card.id === cardId);
  const source = list[index];
  if (!source || source.hidden) return null;
  if (
    isBattlefieldZone(zone) &&
    isUnitCardType(source) &&
    transferWouldCreateThirdParty(room, playerIndex, targetIndex, zone, source.id)
  ) {
    return null;
  }
  const moved = cloneCard(source);
  moved.ownerPlayerId = cardOwnerId(source, room.players[playerIndex]?.id ?? "");
  list.splice(index, 1);
  zoneList(targetBoard, zone).push(moved);
  return {
    playerIndex,
    sourceCard: source,
    movedCard: moved,
    unitZones: eventUnitZones(source, [zone]),
    targetPlayerIndex: targetIndex,
    showdown: { kind: "move", from: zone, to: zone },
  };
}

/** 60594 `H`: close the deck-peek session around a card that stays in the deck. */
export function recyclePeekCardInPlace(room: Room, playerIndex: number, cardId: string, zone: "deck" | "runeDeck" = "deck"): boolean {
  const board = room.players[playerIndex]?.board;
  if (!board) return false;
  pruneDeckPeek(board);
  const peekZone = board.deckPeek?.zone === "runeDeck" ? "runeDeck" : "deck";
  if (peekZone !== zone || !board.deckPeek.cardIds.includes(cardId)) return false;
  const list = zone === "runeDeck" ? board.runeDeck : board.deck;
  const index = list.findIndex((card) => card.id === cardId);
  if (index < 0) return false;
  const bottom = zone === "deck" ? recycledBottomCount(board) : 0;
  const wasRecycled = zone === "deck" && index < bottom;
  const [card] = list.splice(index, 1);
  if (card) {
    if (zone === "runeDeck") card.exhausted = false;
    list.unshift(card);
  }
  if (zone === "deck") setRecycledBottomCount(board, bottom - (wasRecycled ? 1 : 0) + 1);
  board.deckPeek.cardIds = board.deckPeek.cardIds.filter((id) => id !== cardId);
  pruneDeckPeek(board);
  if (board.deckPeek.cardIds.length === 0) resetDeckPeek(board);
  return true;
}

/**
 * 60594 `Q` / `y`: apply a batch of movement events (auto-chain, showdown, presence).
 */
export function applyMoveEvents(room: Room, events: MoveEvent[], context: HandlerContext): Room {
  const unitZones: BattlefieldZone[] = [];
  for (const event of events) {
    unitZones.push(...event.unitZones);
    if (event.autoChainZone) {
      autoChainOnPlay(room, event.playerIndex, event.movedCard, event.autoChainZone, context);
    }
    if (
      event.showdown?.kind === "move" &&
      !event.sourceCard.hidden &&
      !event.movedCard.hidden
    ) {
      triggerMoveShowdown(room, event, context);
    }
  }
  afterUnitEvents(room, unitZones);
  for (const event of events) {
    if (event.showdown?.kind === "vacated" && !room.pendingBattlefieldConquerAssist) {
      tryTriggerConquerAssist(room, { preferredZone: event.showdown.zone });
    }
  }
  return room;
}

function triggerMoveShowdown(room: Room, event: MoveEvent, _context: HandlerContext): void {
  const showdown = event.showdown;
  if (!showdown || showdown.kind !== "move") return;
  const { from, to } = showdown;
  if (from === to || !isUnitCardType(event.sourceCard)) return;
  const destination = isBattlefieldZone(to) ? to : undefined;
  const source = from !== "deck" && isBattlefieldZone(from) ? from : undefined;
  const zone = destination ?? source;
  if (!zone) return;
  const player = room.players[event.playerIndex];
  if (!player?.board) return;
  // clear excluded zone before checking for a pending assist (487939.G)
  const excluded = room.battlefieldConquerAssistExcludedZones ?? [];
  const filtered = excluded.filter((item) => item !== zone);
  if (filtered.length !== excluded.length) {
    room.battlefieldConquerAssistExcludedZones = filtered.length > 0 ? filtered : undefined;
  }
  if (room.pendingBattlefieldConquerAssist) return;
  const set = filtered.length > 0 ? new Set(filtered) : undefined;
  tryTriggerConquerAssist(room, {
    preferredAttackerId: destination ? player.id : undefined,
    preferredZone: zone,
    excludedZones: set,
    carryExcludedZones: set,
  });
}

/** 487939 `Z` + `h`: refresh assists after unit movements. */
export function afterUnitEvents(room: Room, zones: BattlefieldZone[]): Room {
  if (zones.length > 0) {
    refreshConquerAssist(room);
    const pendingZone = room.pendingBattlefieldConquerAssist?.zone;
    if (pendingZone && zones.includes(pendingZone)) {
      room.pendingBattlefieldConquerAssist = {
        ...room.pendingBattlefieldConquerAssist!,
        optionalPassedPlayerIds: undefined,
      };
    }
  }
  return cleanupPostBeginningPresence(room);
}

/** Helper used by tests and a few handlers. */
export function findCardInBoard(board: PlayerBoard, cardId: string): CardInstance | undefined {
  for (const zone of FIELD_ZONES) {
    const found = findCardInZone(board, zone, cardId);
    if (found) return found;
  }
  return undefined;
}

export { BATTLEFIELD_ZONES, battlefieldZones, hasUnitAt, isGoldToken, allCardIds, applyDestinationExhaustion, clearReveals, insertAfterAttachments };
