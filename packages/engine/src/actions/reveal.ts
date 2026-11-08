import type { CardInstance, PlayerBoard } from "@rift/protocol";
import type { ActionHandler } from "../types";
import {
  cloneCard,
  isBattlefieldZone,
  isFieldZone,
  moveCardCleanup,
  setNeekoController,
} from "../state/board";
import {
  allyPlayerIds,
  isPublicRevealAction,
  playerIndexById,
  revealRecipients,
  seatRelationship,
} from "../state/selectors";
import {
  hasHidden,
  hasWhenYouPlayMeText,
  isDeployGear,
  isGearCardType,
  isUnitCardType,
} from "../catalog";
import {
  autoChainOnPlay,
  tryTriggerConquerAssist,
} from "../rules/chain";
import { afterUnitEvents } from "../rules/movement";
import { logDraft } from "../log/entries";
import { bool, str } from "./common";

function publicRevealCard(card: CardInstance, reveal: boolean): CardInstance {
  const already =
    reveal ? card.revealedToOpponent === true : card.revealedToOpponent === undefined;
  if (card.revealedToPlayerIds === undefined && already) return card;
  const copy = { ...card };
  delete copy.revealedToPlayerIds;
  if (reveal) copy.revealedToOpponent = true;
  else delete copy.revealedToOpponent;
  return copy;
}

function recipientsRevealCard(card: CardInstance, recipients: string[]): CardInstance {
  if (recipients.length === 0) return publicRevealCard(card, false);
  if (
    card.revealedToOpponent === true &&
    card.revealedToPlayerIds !== undefined &&
    card.revealedToPlayerIds.length === recipients.length &&
    card.revealedToPlayerIds.every((id, index) => id === recipients[index])
  ) {
    return card;
  }
  return { ...card, revealedToPlayerIds: [...recipients], revealedToOpponent: true };
}

function handRevealBoard(board: PlayerBoard, recipients: string[]): PlayerBoard {
  if (recipients.length === 0) {
    if (board.handRevealedToPlayerIds === undefined && board.handRevealToOpponent === false) return board;
    const copy = { ...board, handRevealToOpponent: false };
    delete copy.handRevealedToPlayerIds;
    return copy;
  }
  if (
    board.handRevealToOpponent &&
    board.handRevealedToPlayerIds !== undefined &&
    board.handRevealedToPlayerIds.length === recipients.length &&
    board.handRevealedToPlayerIds.every((id, index) => id === recipients[index])
  ) {
    return board;
  }
  return { ...board, handRevealToOpponent: true, handRevealedToPlayerIds: [...recipients] };
}

/** orig: 35qz5rkx7yexy.js:22827 "set_hand_reveal" */
export const setHandReveal: ActionHandler = ({ room, playerIndex, board, player, action, context }) => {
  const reveal = bool(action.reveal);
  const allies = allyPlayerIds(room, playerIndex);
  let nextBoard = board;
  let mapCard: ((card: CardInstance) => CardInstance | null) | null = null;
  const publicAction = isPublicRevealAction({
    ...(typeof action.targetPlayerId === "string" ? { targetPlayerId: action.targetPlayerId } : {}),
    ...(typeof action.audience === "string" ? { audience: action.audience } : {}),
  });

  if (publicAction) {
    if (!reveal) nextBoard = handRevealBoard(nextBoard, allies);
    mapCard = (card) => publicRevealCard(card, reveal);
  } else {
    const targetPlayerId = typeof action.targetPlayerId === "string" ? action.targetPlayerId : undefined;
    const audience = typeof action.audience === "string" ? action.audience : undefined;
    let teammateAudience = false;
    if (reveal && audience === "teammates") teammateAudience = true;
    else if (reveal && targetPlayerId !== undefined) {
      const targetIndex = playerIndexById(room, targetPlayerId);
      teammateAudience = targetIndex >= 0 && seatRelationship(room, playerIndex, targetIndex) === "ally";
    }
    if (!reveal || teammateAudience) {
      const recipients = revealRecipients({
        room,
        actorPlayerIndex: playerIndex,
        reveal,
        ...(targetPlayerId ? { targetPlayerId } : {}),
        ...(audience ? { audience } : {}),
        currentRecipientIds: board.handRevealedToPlayerIds,
        publiclyRevealed: board.handRevealToOpponent,
      });
      if (!recipients) return;
      const ids = room.players.flatMap((candidate) =>
        recipients.includes(candidate.id) || allies.includes(candidate.id) ? [candidate.id] : [],
      );
      nextBoard = handRevealBoard(nextBoard, ids);
      if (teammateAudience) {
        room.players[playerIndex]!.board = nextBoard;
        context.log(
          logDraft(reveal ? "revealedHand" : "hidHand", undefined, {
            authorPlayerId: player.id,
            actionKind: "inspect",
            at: context.now,
          }),
        );
        return;
      }
    }
    mapCard = (card) => {
      const recipients = revealRecipients({
        room,
        actorPlayerIndex: playerIndex,
        reveal,
        ...(targetPlayerId ? { targetPlayerId } : {}),
        ...(audience ? { audience } : {}),
        currentRecipientIds: card.revealedToPlayerIds,
        publiclyRevealed: !!card.revealedToOpponent,
      });
      return recipients ? recipientsRevealCard(card, recipients) : null;
    };
  }

  const hand = nextBoard.hand.slice();
  let changed = nextBoard !== board;
  for (let index = 0; index < hand.length; index += 1) {
    const card = hand[index];
    if (!card || !mapCard) continue;
    const mapped = mapCard(card);
    if (!mapped) return;
    if (mapped !== card) {
      hand[index] = mapped;
      changed = true;
    }
  }
  if (changed) {
    nextBoard = { ...nextBoard, hand };
    room.players[playerIndex]!.board = nextBoard;
  }
  context.log(
    logDraft(publicAction ? (reveal ? "revealedHand" : "hidHand") : reveal ? "revealedHandCard" : "hidHandCard", undefined, {
      authorPlayerId: player.id,
      actionKind: "inspect",
      at: context.now,
    }),
  );
};

/** orig: 35qz5rkx7yexy.js:23449 "set_card_revealed_to_opponent" */
export const setCardRevealedToOpponent: ActionHandler = ({ room, playerIndex, board, action, context }) => {
  const zone = str(action.zone);
  const list = zone === "hand" ? board.hand : zone === "base" ? board.base : zone === "trash" ? board.trash : zone === "banished" ? board.banished : zone === "battlefieldA" ? board.battlefieldA : zone === "battlefieldB" ? board.battlefieldB : zone === "battlefieldC" ? (board.battlefieldC ?? []) : zone === "battlefieldToken" ? board.battlefieldToken : zone === "champion" ? board.champion : zone === "legend" ? board.legend : zone === "runeArea" ? board.runeArea : [];
  const index = list.findIndex((card) => card.id === str(action.cardId));
  const card = list[index];
  if (!card || (zone !== "hand" && !card.hidden)) return;
  const reveal = bool(action.revealed);
  let mapped: CardInstance;
  if (isPublicRevealAction({ ...(typeof action.targetPlayerId === "string" ? { targetPlayerId: action.targetPlayerId } : {}), ...(typeof action.audience === "string" ? { audience: action.audience } : {}) })) {
    mapped = publicRevealCard(card, reveal);
  } else {
    const recipients = revealRecipients({
      room,
      actorPlayerIndex: playerIndex,
      reveal,
      ...(typeof action.targetPlayerId === "string" ? { targetPlayerId: action.targetPlayerId } : {}),
      ...(typeof action.audience === "string" ? { audience: action.audience } : {}),
      currentRecipientIds: card.revealedToPlayerIds,
      publiclyRevealed: !!card.revealedToOpponent,
    });
    if (!recipients) return;
    mapped = recipientsRevealCard(card, recipients);
  }
  if (mapped === card) return;
  list[index] = mapped;
  context.log(
    logDraft(
      zone === "hand" ? (reveal ? "revealedHandCard" : "hidHandCard") : reveal ? "revealedHiddenBoardCard" : "hidHiddenBoardCard",
      undefined,
      { authorPlayerId: room.players[playerIndex]?.id, actionKind: "inspect", at: context.now },
    ),
  );
};

/** orig: 35qz5rkx7yexy.js:23477 "set_card_hidden" */
export const setCardHidden: ActionHandler = ({ room, playerIndex, board, player, action, context }) => {
  const zone = typeof action.zone === "string" ? action.zone : "hand";
  const hidden = bool(action.hidden);
  const cardId = str(action.cardId);
  if (zone === "hand" || zone === "champion") {
    const list = zone === "hand" ? board.hand : board.champion;
    const index = list.findIndex((card) => card.id === cardId);
    const card = list[index];
    if (!card || !hasHidden(card) || !!card.hidden === hidden) return;
    const copy = { ...card };
    if (hidden) copy.hidden = true;
    else {
      delete copy.hidden;
      delete copy.revealedToPlayerIds;
      delete copy.revealedToOpponent;
    }
    delete copy.revealedToPlayerIds;
    delete copy.revealedToOpponent;
    list[index] = copy;
    context.log(
      logDraft(hidden ? "hidHandCard" : "revealedHandCard", undefined, {
        authorPlayerId: player.id,
        actionKind: "inspect",
        at: context.now,
      }),
    );
    return;
  }
  if (!isBattlefieldZone(zone) || hidden) return;
  const list =
    zone === "battlefieldA"
      ? board.battlefieldA
      : zone === "battlefieldB"
        ? board.battlefieldB
        : zone === "battlefieldC"
          ? (board.battlefieldC ?? [])
          : board.battlefieldToken;
  const index = list.findIndex((card) => card.id === cardId);
  const card = list[index];
  if (!card?.hidden) return;
  const copy = cloneCard(card);
  delete copy.hidden;
  delete copy.revealedToPlayerIds;
  delete copy.revealedToOpponent;
  setNeekoController(copy, player.id);

  if (isUnitCardType(copy) && hasThirdParty(room, playerIndex, zone)) {
    list.splice(index, 1);
    moveCardCleanup(copy, zone, "base");
    board.base.push(copy);
    if (hasWhenYouPlayMe(copy)) autoChainOnPlay(room, playerIndex, copy, "base", context);
    return;
  }

  const unit = isUnitCardType(copy);
  const gearNotDeploy = isGearCardType(copy) && !isDeployGear(copy);
  if (!unit && gearNotDeploy) {
    list.splice(index, 1);
    moveCardCleanup(copy, zone, "base");
    board.base.push(copy);
    return;
  }
  if (unit) copy.exhausted = true;
  list[index] = copy;
  if (hasWhenYouPlayMe(copy)) autoChainOnPlay(room, playerIndex, copy, zone, context);
  afterUnitEvents(room, [zone]);
  if (unit) {
    tryTriggerConquerAssist(room, { preferredAttackerId: player.id, preferredZone: zone });
  }
  context.log(
    logDraft(unit ? "revealedHiddenBoardCard" : "revealedHiddenBoardCard", undefined, {
      authorPlayerId: player.id,
      actionKind: "inspect",
      at: context.now,
    }),
  );
};

function hasThirdParty(room: Parameters<typeof revealRecipients>[0]["room"], playerIndex: number, zone: string): boolean {
  if (room.players.length < 3) return false;
  const holders = room.players.flatMap((candidate, index) =>
    candidate.board && !candidate.leftAt && candidate.board && hasUnitAt(candidate.board, zone) ? [index] : [],
  );
  return !holders.includes(playerIndex) && holders.length >= 2;
}

function hasUnitAt(board: PlayerBoard, zone: string): boolean {
  return (board as unknown as Record<string, CardInstance[]>)[zone]?.some(
    (card) => !card.hidden && isUnitCardType(card),
  ) ?? false;
}

function hasWhenYouPlayMe(card: CardInstance): boolean {
  return card.hasWhenYouPlayMe === true || hasWhenYouPlayMeText(card.text);
}

/** Re-export for handlers. */
export { isPublicRevealAction, isFieldZone };
