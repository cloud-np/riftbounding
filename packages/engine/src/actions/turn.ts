import type { ActiveTurnStep, Room } from "@rift/protocol";
import type { ActionHandler } from "../types";
import { str } from "./common";
import { endBeginningPhase, endTurn } from "../rules/turn";
import { setExtraTurn } from "../rules/chain";
import { logDraft } from "../log/entries";

interface Observed {
  turnNumber?: number;
  activePlayerId?: string;
  activeStep?: string;
}

function observed(action: Record<string, unknown>): Observed | null {
  const value = action.observed;
  if (!value || typeof value !== "object") return null;
  return value as Observed;
}

function observedMatches(room: Room, action: Record<string, unknown>): boolean {
  const seen = observed(action);
  if (!seen) return false;
  return (
    room.turnNumber === seen.turnNumber &&
    room.activeTurnPlayerId === seen.activePlayerId &&
    room.activeTurnStep === (seen.activeStep as ActiveTurnStep | undefined)
  );
}

/** 51407 `D` / `l`: can the actor end the turn on behalf of a departed active player? */
function controllerOfLeftActive(room: Room, actorId: string): boolean {
  const actor = room.players.find((player) => player.id === actorId);
  if (!actor || typeof actor.leftAt === "number" || room.activeTurnPlayerId === actor.id) return false;
  const active = room.players.find((player) => player.id === room.activeTurnPlayerId);
  return typeof active?.leftAt === "number";
}

/** orig: 35qz5rkx7yexy.js:22756 "end_turn" (51407.x) */
export const endTurnAction: ActionHandler = ({ room, player, action }) => {
  if (!observedMatches(room, action)) return;
  const allowLeft = controllerOfLeftActive(room, player.id);
  if (room.activeTurnPlayerId && room.activeTurnPlayerId !== player.id && !allowLeft) return;
  endTurn(room, room.players.findIndex((candidate) => candidate.id === player.id), allowLeft);
};

/** orig: 35qz5rkx7yexy.js:22755 "end_beginning_phase" (51407.v) */
export const endBeginningPhaseAction: ActionHandler = ({ room, playerIndex, player, action }) => {
  if (!observedMatches(room, action)) return;
  if (room.activeTurnPlayerId !== player.id || room.activeTurnStep !== "beginning") return;
  endBeginningPhase(room, playerIndex);
};

/** orig: 35qz5rkx7yexy.js:22757 "set_extra_turn" (408727.m) */
export const setExtraTurnAction: ActionHandler = ({ room, playerIndex, player, action, context }) => {
  if (typeof action.enabled !== "boolean") return;
  const entryId = str(action.entryId);
  const enabled = action.enabled;
  const before = room.pendingExtraTurns?.map((entry) => `${entry.sourceEntryId}:${entry.playerId}`).join("|") ?? "";
  setExtraTurn(room, playerIndex, entryId, enabled);
  const after = room.pendingExtraTurns?.map((entry) => `${entry.sourceEntryId}:${entry.playerId}`).join("|") ?? "";
  if (before === after) return;
  context.log(
    logDraft(enabled ? "queuedTimeWarpTurn" : "canceledTimeWarpTurn", undefined, {
      authorPlayerId: player.id,
      actionKind: "turn",
      at: context.now,
    }),
  );
};
