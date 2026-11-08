import type { CardInstance, PlayerBoard } from "@rift/protocol";
import type { ActionHandler } from "../types";
import {
  cloneCard,
  pruneDeckPeek,
  resetDeckPeek,
} from "../state/board";
import { validateBatch } from "../rules/batch";
import { deepClone } from "../state/board";
import { restoreRoom, int, num, str } from "./common";
import { logDraft } from "../log/entries";

function setFloating(board: PlayerBoard, resource: "energy" | "power", value: number): boolean {
  const next = Math.max(0, Math.min(99, Math.trunc(value)));
  const key = resource === "energy" ? "floatingEnergy" : "floatingPower";
  if (board[key] === next) return false;
  board[key] = next;
  return true;
}

function drawRuneInto(board: PlayerBoard, exhausted: boolean): CardInstance | null {
  const rune = board.runeDeck.pop();
  if (!rune) return null;
  const copy = cloneCard(rune);
  copy.exhausted = exhausted;
  board.runeArea.push(copy);
  pruneDeckPeek(board);
  return copy;
}

/** orig: 35qz5rkx7yexy.js:22771 "floating_resource_batch" */
export const floatingResourceBatch: ActionHandler = ({ room, playerIndex, board, action, context }) => {
  const operations = action.operations;
  if (validateBatch("floating_resource_batch", operations)) return;
  let changed = false;
  let cleared = false;
  for (const op of operations as Array<Record<string, unknown>>) {
    if (op.type === "clear_floating_resources") {
      if (board.floatingEnergy !== 0 || board.floatingPower !== 0) {
        board.floatingEnergy = 0;
        board.floatingPower = 0;
        changed = true;
        cleared = true;
      }
    } else if (op.type === "adjust_floating_resource") {
      const resource = op.resource === "power" ? "power" : "energy";
      const current = resource === "energy" ? board.floatingEnergy : board.floatingPower;
      if (setFloating(board, resource, current + num(op.delta))) changed = true;
    }
  }
  if (!changed) return;
  room.players[playerIndex]!.board = board;
  context.log(
    cleared
      ? logDraft("clearedFloatingResources", undefined, {
          authorPlayerId: room.players[playerIndex]?.id,
          actionKind: "resource",
          at: context.now,
        })
      : logDraft("adjustedFloatingResources", { energy: board.floatingEnergy, power: board.floatingPower }, {
          authorPlayerId: room.players[playerIndex]?.id,
          actionKind: "resource",
          at: context.now,
        }),
  );
};

/** orig: 35qz5rkx7yexy.js:22799 "adjust_floating_resource" */
export const adjustFloatingResource: ActionHandler = ({ room, playerIndex, board, action, context }) => {
  const resource = action.resource === "power" ? "power" : "energy";
  const current = resource === "energy" ? board.floatingEnergy : board.floatingPower;
  if (!setFloating(board, resource, current + num(action.delta))) return;
  room.players[playerIndex]!.board = board;
  context.log(
    logDraft("adjustedFloatingResource", {
      resource,
      value: resource === "energy" ? board.floatingEnergy : board.floatingPower,
    }, { authorPlayerId: room.players[playerIndex]?.id, actionKind: "resource", at: context.now }),
  );
};

/** orig: 35qz5rkx7yexy.js:22820 "clear_floating_resources" */
export const clearFloatingResources: ActionHandler = ({ room, playerIndex, board, context }) => {
  if (board.floatingEnergy === 0 && board.floatingPower === 0) return;
  board.floatingEnergy = 0;
  board.floatingPower = 0;
  room.players[playerIndex]!.board = board;
  context.log(
    logDraft("clearedFloatingResources", undefined, {
      authorPlayerId: room.players[playerIndex]?.id,
      actionKind: "resource",
      at: context.now,
    }),
  );
};

/** orig: 35qz5rkx7yexy.js:22899 "draw_rune" */
export const drawRune: ActionHandler = ({ room, playerIndex, board, action, context }) => {
  const rune = drawRuneInto(board, action.exhausted === true);
  if (!rune) return;
  room.players[playerIndex]!.board = board;
  context.log(
    logDraft("channeledRune", undefined, {
      authorPlayerId: room.players[playerIndex]?.id,
      actionKind: "resource",
      at: context.now,
    }),
  );
};

/** orig: 35qz5rkx7yexy.js:22902 "send_rune_to_deck_bottom" */
export const sendRuneToDeckBottom: ActionHandler = ({ room, playerIndex, board, action, context }) => {
  const index = board.runeArea.findIndex((rune) => rune.id === str(action.cardId));
  const rune = board.runeArea[index];
  if (!rune) return;
  board.runeArea.splice(index, 1);
  rune.exhausted = false;
  board.runeDeck.unshift(rune);
  room.players[playerIndex]!.board = board;
  context.log(
    logDraft("movedToRuneDeck", { card: rune.name, position: "bottom" }, {
      authorPlayerId: room.players[playerIndex]?.id,
      actionKind: "resource",
      at: context.now,
    }),
  );
};

/** orig: 35qz5rkx7yexy.js:22910 "recycle_rune_for_floating_energy" */
export const recycleRuneForFloatingEnergy: ActionHandler = ({ room, playerIndex, board, action, context }) => {
  const index = board.runeArea.findIndex((rune) => rune.id === str(action.cardId));
  const rune = board.runeArea[index];
  if (!rune) return;
  const wasReady = !rune.exhausted;
  board.runeArea.splice(index, 1);
  rune.exhausted = false;
  board.runeDeck.unshift(rune);
  let energy = 0;
  let power = 0;
  if (wasReady) {
    energy = 1;
    setFloating(board, "energy", board.floatingEnergy + 1);
  }
  if (action.paymentGroupOrigin !== "auto_pay_button") {
    power = 1;
    setFloating(board, "power", board.floatingPower + 1);
  }
  room.players[playerIndex]!.board = board;
  const resources = [energy > 0 ? `${energy} energy` : "", power > 0 ? `${power} power` : ""]
    .filter(Boolean)
    .join(" and ");
  context.log(
    logDraft("recycledToFloat", { source: "a rune", resources }, {
      authorPlayerId: room.players[playerIndex]?.id,
      actionKind: "resource",
      at: context.now,
    }),
  );
};

/** orig: 35qz5rkx7yexy.js:22924 "send_to_rune_deck" */
export const sendToRuneDeck: ActionHandler = ({ room, playerIndex, board, action, context }) => {
  if (action.from !== "runeArea") return;
  const index = board.runeArea.findIndex((rune) => rune.id === str(action.cardId));
  const rune = board.runeArea[index];
  if (!rune) return;
  board.runeArea.splice(index, 1);
  rune.exhausted = false;
  if (action.position === "top") {
    board.runeDeck.push(rune);
    if (board.deckPeek?.zone === "runeDeck") resetDeckPeek(board);
  } else {
    board.runeDeck.unshift(rune);
  }
  room.players[playerIndex]!.board = board;
  context.log(
    logDraft("movedToRuneDeck", { card: rune.name, position: action.position === "top" ? "top" : "bottom" }, {
      authorPlayerId: room.players[playerIndex]?.id,
      actionKind: "resource",
      at: context.now,
    }),
  );
};

/** Direct `set_rune_exhausted` (only an op in the original rune_batch; supported for completeness). */
export const setRuneExhausted: ActionHandler = ({ room, playerIndex, board, action }) => {
  const target = board.runeArea.find((rune) => rune.id === str(action.cardId));
  if (!target) return;
  const exhausted = action.exhausted === true;
  if (target.exhausted === exhausted) return;
  target.exhausted = exhausted;
  room.players[playerIndex]!.board = board;
};

/** orig: 35qz5rkx7yexy.js:23089 "rune_batch" */
export const runeBatch: ActionHandler = ({ room, playerIndex, board, action, context }) => {
  const operations = action.operations;
  if (validateBatch("rune_batch", operations)) return;
  const backup = deepClone(room);
  let changed = false;
  const drawn: CardInstance[] = [];
  for (const op of operations as Array<Record<string, unknown>>) {
    if (op.type === "draw_rune") {
      if (board.runeDeck.length === 0) continue;
      const rune = drawRuneInto(board, op.exhausted === true);
      if (!rune) {
        restoreRoom(room, backup);
        return;
      }
      drawn.push(rune);
      changed = true;
      continue;
    }
    if (op.type === "set_rune_exhausted") {
      const target = board.runeArea.find((rune) => rune.id === str(op.cardId));
      if (!target) {
        restoreRoom(room, backup);
        return;
      }
      if (target.exhausted === (op.exhausted === true)) continue;
      target.exhausted = op.exhausted === true;
      changed = true;
      continue;
    }
    if (op.type === "send_rune_to_deck_bottom" || op.type === "recycle_rune_for_floating_energy") {
      const index = board.runeArea.findIndex((rune) => rune.id === str(op.cardId));
      const rune = board.runeArea[index];
      if (!rune) {
        restoreRoom(room, backup);
        return;
      }
      const wasReady = !rune.exhausted;
      board.runeArea.splice(index, 1);
      rune.exhausted = false;
      board.runeDeck.unshift(rune);
      if (op.type === "recycle_rune_for_floating_energy") {
        if (wasReady) setFloating(board, "energy", board.floatingEnergy + 1);
        setFloating(board, "power", board.floatingPower + 1);
      }
      changed = true;
    }
  }
  if (!changed) return;
  room.players[playerIndex]!.board = board;
  if (drawn.length > 0) {
    context.log(
      logDraft("channeledRune", undefined, {
        authorPlayerId: room.players[playerIndex]?.id,
        actionKind: "resource",
        at: context.now,
      }),
    );
  }
};
