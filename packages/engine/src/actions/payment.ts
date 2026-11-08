import type { PlayerBoard } from "@rift/protocol";
import type { ActionHandler } from "../types";
import {
  isBattlefieldZone,
  isFieldZone,
  isGoldToken,
  zoneList,
} from "../state/board";
import {
  getCard,
  isGearCardType,
  isHoneyfruit,
  isEnergyConduit,
  isSeal,
} from "../rules/payment-sources";
import {
  applyLabel,
  isSpendableLegend,
} from "../rules/payment-sources";
import { deepClone } from "../state/board";
import { restoreRoom, num, str } from "./common";
import { logDraft } from "../log/entries";

function setFloating(board: PlayerBoard, resource: "energy" | "power", value: number): boolean {
  const next = Math.max(0, Math.min(99, Math.trunc(value)));
  const key = resource === "energy" ? "floatingEnergy" : "floatingPower";
  if (board[key] === next) return false;
  board[key] = next;
  return true;
}

/** 437381 `dO` behaviour (mutates the zone list). */
function toggleCard(room: Parameters<ActionHandler>[0]["room"], playerIndex: number, board: PlayerBoard, zone: string, cardId: string, expected: boolean): boolean {
  if (zone === "champion") return false;
  const list = zoneList(board, zone);
  const index = list.findIndex((card) => card.id === cardId);
  const card = list[index];
  if (!card || card.exhausted !== expected) return false;
  if (!card.exhausted && isFieldZone(zone) && isGoldToken(card)) {
    list.splice(index, 1);
    return true;
  }
  list[index] = { ...card, exhausted: !card.exhausted };
  return true;
}

/** 437381 `dG`: rune → bottom of rune deck. */
function sendRuneBottom(board: PlayerBoard, cardId: string): boolean {
  const index = board.runeArea.findIndex((card) => card.id === cardId);
  const card = board.runeArea[index];
  if (!card) return false;
  board.runeArea.splice(index, 1);
  card.exhausted = false;
  board.runeDeck.unshift(card);
  return true;
}

/** 437381 `dK` with grantsFloatingPower false (payment batches). */
function recycleRunePayment(board: PlayerBoard, cardId: string): boolean {
  const index = board.runeArea.findIndex((card) => card.id === cardId);
  const card = board.runeArea[index];
  if (!card) return false;
  const wasReady = !card.exhausted;
  board.runeArea.splice(index, 1);
  card.exhausted = false;
  board.runeDeck.unshift(card);
  if (wasReady) setFloating(board, "energy", board.floatingEnergy + 1);
  return true;
}

function validPaymentSource(board: PlayerBoard, zone: string, cardId: string): string | null {
  const list = zoneList(board, zone);
  const card = list.find((item) => item.id === cardId);
  if (!card || card.exhausted) return "Card is not a valid payment source.";
  if (zone === "runeArea") return null;
  if (zone === "base" || isBattlefieldZone(zone)) {
    return isGoldToken(card) || isEnergyConduit(card) || isSeal(card) || isHoneyfruit(card)
      ? null
      : "Card is not a valid payment source.";
  }
  if (zone === "legend") {
    return isSpendableLegend(card) ? null : "Card is not a valid payment source.";
  }
  return "Card is not a valid payment source.";
}

/** orig: 35qz5rkx7yexy.js:22993 "payment_batch" */
export const paymentBatch: ActionHandler = ({ room, playerIndex, board, action, context }) => {
  const operations = action.operations;
  if (!Array.isArray(operations) || operations.length === 0 || operations.length > 128) return;
  const backupRoom = deepClone(room);
  const backupBoard = deepClone(board);
  let energyCleared = false;
  let powerCleared = false;
  let usedResources = false;

  for (const raw of operations as Array<Record<string, unknown>>) {
    if (raw.type === "toggle_exhausted") {
      if (typeof raw.expectedExhausted !== "boolean") {
        restoreRoom(room, backupRoom);
        return;
      }
      const zone = str(raw.zone);
      const cardId = str(raw.cardId);
      const card = zoneList(board, zone).find((item) => item.id === cardId);
      if (!card || card.exhausted !== raw.expectedExhausted) {
        restoreRoom(room, backupRoom);
        return;
      }
      const error = validPaymentSource(board, zone, cardId);
      if (error) {
        restoreRoom(room, backupRoom);
        return;
      }
      if (!toggleCard(room, playerIndex, board, zone, cardId, raw.expectedExhausted)) {
        restoreRoom(room, backupRoom);
        return;
      }
      usedResources = true;
      continue;
    }
    if (raw.type === "adjust_floating_resource") {
      const delta = Math.trunc(num(raw.delta));
      const resource = raw.resource === "power" ? "power" : "energy";
      if (delta >= 0) {
        restoreRoom(room, backupRoom);
        return;
      }
      const current = resource === "energy" ? board.floatingEnergy : board.floatingPower;
      if (-delta > current) {
        restoreRoom(room, backupRoom);
        return;
      }
      setFloating(board, resource, current + delta);
      if (resource === "energy") energyCleared = true;
      else powerCleared = true;
      usedResources = true;
      continue;
    }
    if (raw.type === "send_rune_to_deck_bottom" || raw.type === "recycle_rune_for_floating_energy") {
      const cardId = str(raw.cardId);
      if (!board.runeArea.some((card) => card.id === cardId)) {
        restoreRoom(room, backupRoom);
        return;
      }
      const ok =
        raw.type === "send_rune_to_deck_bottom"
          ? sendRuneBottom(board, cardId)
          : recycleRunePayment(board, cardId);
      if (!ok) {
        restoreRoom(room, backupRoom);
        return;
      }
      usedResources = true;
      continue;
    }
    if (raw.type === "set_card_label") {
      const label = str(raw.label);
      if (!label.trim()) {
        restoreRoom(room, backupRoom);
        return;
      }
      const zone = str(raw.zone);
      const cardId = str(raw.cardId);
      const card = zoneList(board, zone).find((item) => item.id === cardId);
      if (!card) {
        restoreRoom(room, backupRoom);
        return;
      }
      if (card.hidden) {
        restoreRoom(room, backupRoom);
        return;
      }
      const slot = typeof raw.slot === "number" ? raw.slot : -1;
      if (!applyLabel(board, zone, cardId, slot, label)) {
        restoreRoom(room, backupRoom);
        return;
      }
      continue;
    }
    restoreRoom(room, backupRoom);
    return;
  }

  // No realized change → leave the original state untouched.
  const equal = JSON.stringify(board) === JSON.stringify(backupBoard);
  if (equal) {
    restoreRoom(room, backupRoom);
    return;
  }
  room.players[playerIndex]!.board = board;
  if (action.paymentGroupOrigin === "auto_pay_button") {
    context.log(
      logDraft("autoPaidCardCosts", undefined, {
        authorPlayerId: context.actorId,
        actionKind: "resource",
        at: context.now,
      }),
    );
  } else if (usedResources) {
    context.log(
      logDraft("madePayment", undefined, {
        authorPlayerId: context.actorId,
        actionKind: "resource",
        at: context.now,
      }),
    );
  } else if (energyCleared || powerCleared) {
    context.log(
      logDraft("madePayment", undefined, {
        authorPlayerId: context.actorId,
        actionKind: "resource",
        at: context.now,
      }),
    );
  }
};

export { getCard, isGearCardType };
