import type { BattlefieldZone, CardInstance, PlayerBoard, Room } from "@rift/protocol";
import type { ActionHandler } from "../types";
import {
  battlefieldZones,
  clearPileCard,
  cloneCard,
  detachAttachmentsFrom,
  findCardAnywhere,
  hasUnitAt,
  isFieldZone,
  moveCardCleanup,
  zoneList,
} from "../state/board";
import {
  cardForInstance,
  getCard,
  hasDocksideText,
  isGearCardType,
  isUnitCardType,
} from "../catalog";
import {
  battlefieldCount,
  cardOwnerId,
  seatRelationship,
  thirdPartyEntryBlocked,
  allyControlsZone,
} from "../state/selectors";
import {
  autoChainZone,
  canCardGoToZone,
  eventUnitZones,
  moveCard,
  type MoveEvent,
} from "../rules/movement";
import { applyMoveEvents, afterUnitEvents } from "../rules/movement";
import { tryTriggerConquerAssist } from "../rules/chain";
import { findEmpoweredSlot } from "../rules/payment-sources";
import { deepClone } from "../state/board";
import { restoreRoom, bool, str } from "./common";
import { logDraft } from "../log/entries";

function resolvedName(card: CardInstance): string {
  return (getCard(card.cardCode, card.name)?.name ?? card.name ?? "").trim();
}

function unlinkFields(card: CardInstance): void {
  delete card.banishedByCardId;
  delete card.banishedByHiddenSourcePlayerId;
  delete card.banishedUntilEndingPlayerId;
}

/** orig: 35qz5rkx7yexy.js:23567 "unlink_banished_card" (329899.$) */
export const unlinkBanishedCard: ActionHandler = ({ room, playerIndex, action, context }) => {
  const cardId = str(action.cardId);
  if (!cardId) return;
  const actorBoard = room.players[playerIndex]?.board;
  if (!actorBoard) return;
  let targetBoard: PlayerBoard | null = null;
  let target: CardInstance | undefined;
  const own = actorBoard.banished.find(
    (card) => card.id === cardId && !!(card.banishedByCardId || card.banishedByHiddenSourcePlayerId),
  );
  if (own) {
    targetBoard = actorBoard;
    target = own;
  } else {
    const otherIndex = room.players.findIndex(
      (player, index) =>
        index !== playerIndex &&
        !!player.board?.banished.some(
          (card) =>
            card.id === cardId &&
            card.banishedByCardId !== undefined &&
            !!findCardAnywhere(actorBoard, card.banishedByCardId),
        ),
    );
    if (otherIndex >= 0) {
      targetBoard = room.players[otherIndex]?.board ?? null;
      target = targetBoard?.banished.find((card) => card.id === cardId);
    }
  }
  if (!targetBoard || !target) return;
  const source = target.banishedByCardId ? findCardAnywhere(actorBoard, target.banishedByCardId)?.card : undefined;
  unlinkFields(target);
  context.log(
    logDraft(source ? "unlinkedFrom" : "unlinked", source ? { card: target.name, source: source.name } : { card: target.name }, {
      authorPlayerId: context.actorId,
      actionKind: "board",
      at: context.now,
    }),
  );
};

function docksideSource(board: PlayerBoard, zone: string, cardId: string): CardInstance | null {
  if (!["battlefieldA", "battlefieldB", "battlefieldC", "battlefieldToken"].includes(zone)) return null;
  const card = zoneList(board, zone).find((item) => item.id === cardId);
  return card && !card.hidden && resolvedName(card) === "Dockside Lock-Up" ? card : null;
}

function linkedBanished(room: Room, sourceId: string): { boardIndex: number; card: CardInstance } | null {
  for (let index = 0; index < room.players.length; index += 1) {
    const board = room.players[index]?.board;
    const card = board?.banished.find((item) => item.banishedByCardId === sourceId);
    if (card) return { boardIndex: index, card };
  }
  return null;
}

/** orig: 35qz5rkx7yexy.js:23568 "dockside_banish_unit" (371460.Y) */
export const docksideBanishUnit: ActionHandler = ({ room, playerIndex, board, action, context }) => {
  const zone = str(action.zone);
  const source = docksideSource(board, zone, str(action.cardId));
  if (!source) return;
  if (linkedBanished(room, source.id)) return;
  const boards = room.players.map((player) => player.board);
  const target = boards.flatMap((entry, index) =>
    entry && isFieldZone(zone)
      ? zoneList(entry, zone)
          .filter((card) => card.id !== source.id && !card.hidden && isUnitCardType(card))
          .map((card) => ({ boardIndex: index, card }))
      : [],
  );
  const found = target.find((entry) => entry.card.id === str(action.targetCardId));
  if (!found) return;
  const event = moveCard(room, found.boardIndex, {
    from: zone,
    to: "banished",
    cardId: found.card.id,
  });
  if (!event) return;
  if (!(event.movedCard.source === "token" || event.movedCard.isDuplicate)) {
    event.movedCard.banishedByCardId = source.id;
  }
  applyMoveEvents(room, [event], context);
  context.log(
    logDraft("banishedWithSource", { card: event.movedCard.name, source: source.name }, {
      authorPlayerId: context.actorId,
      actionKind: "board",
      at: context.now,
    }),
  );
};

/** 60594 `C` variant: move a card from another player's zone into the actor's destination. */
function moveFromOtherPlayer(
  room: Room,
  actorIndex: number,
  sourceIndex: number,
  from: string,
  cardId: string,
  to: string,
): MoveEvent | null {
  if (to !== "base" && !["battlefieldA", "battlefieldB", "battlefieldC", "battlefieldToken"].includes(to)) {
    return null;
  }
  const sourcePlayer = room.players[sourceIndex];
  const actor = room.players[actorIndex];
  const sourceBoard = sourcePlayer?.board;
  const actorBoard = actor?.board;
  if (!sourcePlayer || !actor || !sourceBoard || !actorBoard) return null;
  const list = zoneList(sourceBoard, from);
  const index = list.findIndex((card) => card.id === cardId);
  const source = list[index];
  if (!source || source.hidden || source.source === "token" || source.isDuplicate) return null;
  const battlefieldDestination = ["battlefieldA", "battlefieldB", "battlefieldC", "battlefieldToken"].includes(to);
  const destination =
    battlefieldDestination && isUnitCardType(source) && thirdPartyEntryBlocked(room, actorIndex, to)
      ? "base"
      : to;
  if (!isFieldZone(destination)) return null;
  if (source.hidden || !canCardGoToZone(source, destination, from)) return null;
  const baron = /baron nashor/i.test(source.name ?? "");
  if (
    (baron && !["trash", "banished", "hand", "battlefieldToken"].includes(destination)) ||
    (destination === "battlefieldToken" && !baron && !room.sharedBattlefieldToken?.active)
  ) {
    return null;
  }
  const moved = cloneCard(source);
  moved.ownerPlayerId = cardOwnerId(source, sourcePlayer.id);
  list.splice(index, 1);
  moveCardCleanup(moved, from, destination, { controllerId: actor.id });
  zoneList(actorBoard, destination).push(moved);
  return {
    playerIndex: actorIndex,
    sourceCard: source,
    movedCard: moved,
    unitZones: eventUnitZones(source, [destination]),
    autoChainZone:
      autoChainZone(from, destination, !!source.hidden, source) && isFieldZone(destination)
        ? (destination as MoveEvent["autoChainZone"])
        : undefined,
    showdown: { kind: "move", from, to: destination },
  };
}

/** orig: 35qz5rkx7yexy.js:23569 "dockside_play_banished" (371460.m) */
export const docksidePlayBanished: ActionHandler = ({ room, playerIndex, board, action, context }) => {
  const zone = str(action.zone);
  const source = docksideSource(board, zone, str(action.cardId));
  if (!source) return;
  const linked = linkedBanished(room, source.id);
  if (!linked || linked.card.id !== str(action.banishedCardId)) return;
  const backup = deepClone(room);
  const sourceMove = moveCard(room, playerIndex, { from: zone, to: "trash", cardId: source.id });
  if (!sourceMove) {
    restoreRoom(room, backup);
    return;
  }
  const played = moveFromOtherPlayer(
    room,
    playerIndex,
    linked.boardIndex,
    "banished",
    linked.card.id,
    str(action.to),
  );
  if (!played) {
    restoreRoom(room, backup);
    return;
  }
  applyMoveEvents(room, [sourceMove, played], context);
  context.log(
    logDraft("killedToPlayFromBanished", {
      source: source.name,
      card: played.movedCard.name,
      zone: str(action.to),
    }, { authorPlayerId: context.actorId, actionKind: "board", at: context.now }),
  );
};

function kharoxSource(board: PlayerBoard, zone: string, cardId: string): CardInstance | null {
  if (!["hand", "base", "trash", "banished", "battlefieldA", "battlefieldB", "battlefieldC", "battlefieldToken", "champion"].includes(zone)) {
    return null;
  }
  const card = zoneList(board, zone).find((item) => item.id === cardId);
  if (!card || card.hidden || resolvedName(card) !== "Kharox" || card.empowerTriggerUsed) return null;
  return findEmpoweredSlot(card) !== null ? card : null;
}

/** orig: 35qz5rkx7yexy.js:23570 "kharox_play_from_trash" (371460.n) */
export const kharoxPlayFromTrash: ActionHandler = ({ room, playerIndex, board, action, context }) => {
  const zone = str(action.zone);
  const source = kharoxSource(board, zone, str(action.cardId));
  if (!source) return;
  const targetIndex = room.players.findIndex((player) => player.id === str(action.targetPlayerId));
  if (targetIndex < 0 || targetIndex === playerIndex) return;
  const opponentIndexes = room.players.flatMap((candidate, index) =>
    index !== playerIndex &&
    candidate.board &&
    !candidate.leftAt &&
    seatRelationship(room, playerIndex, index) === "opponent"
      ? [index]
      : [],
  );
  if (!opponentIndexes.includes(targetIndex)) return;
  const targetBoard = room.players[targetIndex]?.board;
  const trashCard = targetBoard?.trash.find((card) => card.id === str(action.trashCardId));
  if (!trashCard || !isUnitCardType(trashCard)) return;
  const played = moveFromOtherPlayer(room, playerIndex, targetIndex, "trash", trashCard.id, str(action.to));
  if (!played) return;
  const sourceCard = zoneList(board, zone).find((card) => card.id === source.id);
  if (!sourceCard) return;
  sourceCard.empowerTriggerUsed = true;
  applyMoveEvents(room, [played], context);
  context.log(
    logDraft("playedFromOpponentTrashWith", {
      card: played.movedCard.name,
      zone: str(action.to),
      source: source.name,
    }, { authorPlayerId: context.actorId, actionKind: "board", at: context.now }),
  );
};

function isOrianna(card: CardInstance): boolean {
  return resolvedName(card) === "Orianna, Lady of Clockwork";
}

function oriannaMight(card: CardInstance): number {
  const cost = card.energyCost ?? cardForInstance(card)?.energyCost ?? 0;
  return Number.isFinite(cost) ? Math.max(0, Math.min(99, Math.trunc(cost))) : 0;
}

function restoreOrianna(card: CardInstance): void {
  const animation = card.oriannaAnimation;
  if (!animation) return;
  for (const key of ["type", "might", "whiteCounter"] as const) {
    const value = animation[key];
    if (value === undefined) delete card[key];
    else (card as unknown as Record<string, unknown>)[key] = value;
  }
  delete card.oriannaAnimation;
}

/** orig: 35qz5rkx7yexy.js:23687 "animate_orianna_gear" */
export const animateOriannaGear: ActionHandler = ({ room, playerIndex, board, action, context }) => {
  const legend = board.legend.find((card) => card.id === str(action.legendId));
  const zone = str(action.zone);
  const target = isFieldZone(zone)
    ? zoneList(board, zone).find((card) => card.id === str(action.cardId))
    : undefined;
  if (!legend || !isOrianna(legend) || !target) return;
  if (!isFieldZone(zone) || target.hidden || !isGearCardType(target)) return;
  if (target.oriannaAnimation?.legendId === legend.id) return;
  if (
    !isUnitCardType(target) &&
    ["battlefieldA", "battlefieldB", "battlefieldC", "battlefieldToken"].includes(zone) &&
    (thirdPartyEntryBlocked(room, playerIndex, zone) || allyControlsZone(room, playerIndex, zone))
  ) {
    return;
  }
  const zones = ["base", "battlefieldA", "battlefieldB", "battlefieldC", "battlefieldToken"];
  const detach = new Set<string>();
  const animatedZones: BattlefieldZone[] = [];
  for (const player of room.players) {
    const playerBoard = player.board;
    if (!playerBoard) continue;
    for (const fieldZone of zones) {
      const list = zoneList(playerBoard, fieldZone);
      for (let index = 0; index < list.length; index += 1) {
        const card = list[index];
        if (!card) continue;
        const isTarget =
          player.id === room.players[playerIndex]?.id &&
          fieldZone === zone &&
          card.id === str(action.cardId);
        if (!isTarget && card.oriannaAnimation?.legendId !== legend.id) continue;
        const copy = cloneCard(card);
        restoreOrianna(copy);
        if (isTarget) {
          copy.oriannaAnimation = {
            legendId: legend.id,
            type: copy.type,
            might: copy.might,
            whiteCounter: copy.whiteCounter,
          };
          copy.type = "Unit Gear";
          copy.might = oriannaMight(copy);
          copy.whiteCounter = copy.might;
          delete copy.attachedToCardId;
        } else if (!isUnitCardType(copy)) {
          detach.add(copy.id);
        }
        list[index] = copy;
        if (["battlefieldA", "battlefieldB", "battlefieldC", "battlefieldToken"].includes(fieldZone)) {
          animatedZones.push(fieldZone as BattlefieldZone);
        }
      }
    }
  }
  detachAttachmentsFrom(room, detach);
  afterUnitEvents(room, ["battlefieldA", "battlefieldB", "battlefieldC", "battlefieldToken"]);
  if (!isUnitCardType(target) && ["battlefieldA", "battlefieldB", "battlefieldC", "battlefieldToken"].includes(zone)) {
    tryTriggerConquerAssist(room, { preferredAttackerId: room.players[playerIndex]?.id, preferredZone: zone as BattlefieldZone });
  }
  context.log(
    logDraft("madeUnitWithOrianna", { card: target.name }, {
      authorPlayerId: context.actorId,
      actionKind: "board",
      at: context.now,
    }),
  );
};

function isNeekoCard(card: CardInstance): boolean {
  return resolvedName(card) === "Neeko, Blending In";
}

function neekoControllerMatches(card: CardInstance, actorId: string): boolean {
  if (!isNeekoCard(card)) return false;
  if (card.neekoLegendControllerId === undefined) return !card.isDuplicate;
  return card.neekoLegendControllerId === actorId;
}

function findNeekoInPlayers(room: Room, cardId: string, zone: string): CardInstance | undefined {
  if (!isFieldZone(zone)) return undefined;
  for (const player of room.players) {
    const card = player.board ? zoneList(player.board, zone).find((item) => item.id === cardId) : undefined;
    if (card && !card.hidden) return card;
  }
  return undefined;
}

function anyLegendCopies(room: Room, sourceId: string): boolean {
  return room.players.some((player) => player.board?.legend.some((card) => card.neekoSourceCardId === sourceId));
}

function restoreLegendCopies(room: Room, sourceId: string): CardInstance[] {
  const restored: CardInstance[] = [];
  const removedLegendIds = new Set<string>();
  for (const player of room.players) {
    const board = player.board;
    if (!board) continue;
    const matching = board.legend.filter((card) => card.neekoSourceCardId === sourceId);
    if (matching.length === 0) continue;
    for (const card of matching) removedLegendIds.add(card.id);
    board.legend = board.legend.filter((card) => !matching.includes(card));
    const copies = matching.map((card) => {
      const copy = cloneCard(card);
      clearPileCard(copy);
      copy.exhausted = false;
      delete copy.neekoSourceCardId;
      delete copy.hidden;
      delete copy.revealedToPlayerIds;
      delete copy.revealedToOpponent;
      restored.push(copy);
      return copy;
    });
    if (board.additionalLegends) board.additionalLegends.push(...copies);
  }
  if (removedLegendIds.size === 0) return restored;

  // 107126 `cg.a`: undo Orianna animations whose legend was returned.
  const detach = new Set<string>();
  const zones: BattlefieldZone[] = [];
  for (const player of room.players) {
    const board = player.board;
    if (!board) continue;
    for (const zone of ["base", "battlefieldA", "battlefieldB", "battlefieldC", "battlefieldToken"]) {
      const list = zoneList(board, zone);
      let touched = false;
      for (let index = 0; index < list.length; index += 1) {
        const card = list[index];
        if (!card || !removedLegendIds.has(card.oriannaAnimation?.legendId ?? "")) continue;
        const copy = cloneCard(card);
        restoreOrianna(copy);
        if (!isUnitCardType(copy)) detach.add(copy.id);
        list[index] = copy;
        touched = true;
      }
      if (touched && zone !== "base") zones.push(zone as BattlefieldZone);
    }
  }
  detachAttachmentsFrom(room, detach);
  if (zones.length > 0) afterUnitEvents(room, zones);
  return restored;
}

/** orig: 35qz5rkx7yexy.js:23743 "choose_neeko_legend" */
export const chooseNeekoLegend: ActionHandler = ({ room, playerIndex, player, board, action, context }) => {
  const zone = str(action.zone);
  const neekoCardId = str(action.neekoCardId);
  const direct = isFieldZone(zone)
    ? zoneList(board, zone).find((card) => card.id === neekoCardId)
    : undefined;
  const copiedLegend = board.legend.find((card) => card.neekoSourceCardId === neekoCardId);
  const neeko = direct ?? findNeekoInPlayers(room, neekoCardId, zone);
  const returning = action.legendId === null && !!copiedLegend;
  if (!neeko || neeko.hidden) return;
  if (!returning && (!neekoControllerMatches(neeko, player.id) || (!direct && neeko.neekoLegendControllerId !== player.id))) {
    return;
  }
  const additional = board.additionalLegends?.find((card) => card.id === action.legendId);
  if ((!copiedLegend && anyLegendCopies(room, neeko.id)) || (action.legendId === null ? !copiedLegend : !additional)) {
    return;
  }
  if (copiedLegend) {
    restoreLegendCopies(room, neeko.id);
  }
  if (!additional) return;
  const actorBoard = room.players[playerIndex]?.board;
  if (!actorBoard) return;
  actorBoard.legend.push({ ...additional, neekoSourceCardId: neeko.id });
  actorBoard.additionalLegends = (actorBoard.additionalLegends ?? []).filter((card) => card.id !== additional.id);
  context.log(
    logDraft(
      returning ? "returnedAdditionalLegend" : "addedLegendWithNeeko",
      returning ? { card: additional.name } : { card: additional.name },
      { authorPlayerId: player.id, actionKind: "board", at: context.now },
    ),
  );
};
