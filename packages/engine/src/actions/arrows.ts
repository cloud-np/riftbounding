/**
 * Coordination arrows — original module 662731 (35_5a-hj_uv52.js:1875-2126).
 * Arrows are never rewind-meaningful and do not go through the normal handler pipeline.
 */
import type { Room, TargetArrow } from "@rift/protocol";
import type { ActionHandler } from "../types";
import { battlefieldZones, isBattlefieldZone, zoneList } from "../state/board";
import { battlefieldCount } from "../state/selectors";
import { str } from "./common";

const BATTLEFIELD_MARKER = "battlefield-marker:";
const BASE_MARKER = "base-area-marker:";

function arrowZones(room: Room): string[] {
  return ["base", ...battlefieldZones(room.sharedBattlefieldToken, battlefieldCount(room)), "champion", "legend"];
}

function isAnchor(value: unknown): value is "board" | "chain" {
  return value === "board" || value === "chain";
}

function markerZone(room: Room, value: string): string | null {
  if (!value.startsWith(BATTLEFIELD_MARKER)) return null;
  const zone = value.slice(BATTLEFIELD_MARKER.length);
  if (!isBattlefieldZone(zone)) return null;
  return battlefieldZones(room.sharedBattlefieldToken, battlefieldCount(room)).includes(zone)
    ? zone
    : null;
}

function markerBase(value: string): string | null {
  if (!value.startsWith(BASE_MARKER)) return null;
  const id = value.slice(BASE_MARKER.length).trim();
  return id.length > 0 ? id : null;
}

function boardCardIds(room: Room): Set<string> {
  const ids = new Set<string>();
  for (const player of room.players) {
    const board = player.board;
    if (!board) continue;
    for (const zone of arrowZones(room)) {
      for (const card of zoneList(board, zone)) ids.add(card.id);
    }
  }
  return ids;
}

function cardInActorBoard(room: Room, playerIndex: number, cardId: string): boolean {
  const board = room.players[playerIndex]?.board;
  if (!board) return false;
  return arrowZones(room).some((zone) => zoneList(board, zone).some((card) => card.id === cardId));
}

function sameArrow(a: TargetArrow, b: TargetArrow): boolean {
  return (
    a.sourceCardId === b.sourceCardId &&
    a.targetCardId === b.targetCardId &&
    a.sourceAnchor === b.sourceAnchor &&
    a.targetAnchor === b.targetAnchor
  );
}

/** 662731 `G`: apply one arrow action. */
export function applyArrowAction(
  room: Room,
  playerIndex: number,
  action: Record<string, unknown> & { type: string },
): Room {
  const player = room.players[playerIndex];
  if (!player) return room;
  const arrows = room.targetArrowsByPlayer ?? {};
  const own = arrows[player.id] ?? [];
  if (action.type === "target_arrow_clear_all") {
    if (own.length === 0) return room;
    const next = { ...arrows };
    delete next[player.id];
    room.targetArrowsByPlayer = next;
    return room;
  }
  if (action.type === "target_arrow_remove_from_source") {
    const sourceCardId = str(action.sourceCardId).trim();
    if (!sourceCardId) return room;
    const sourceAnchor = action.sourceAnchor;
    const filtered = own.filter(
      (arrow) => arrow.sourceCardId !== sourceCardId || arrow.sourceAnchor !== sourceAnchor,
    );
    if (filtered.length === own.length) return room;
    const next = { ...arrows };
    if (filtered.length > 0) next[player.id] = filtered;
    else delete next[player.id];
    room.targetArrowsByPlayer = next;
    return room;
  }
  if (action.type === "target_arrow_remove") {
    if (!isAnchor(action.sourceAnchor) || !isAnchor(action.targetAnchor)) return room;
    const target: TargetArrow = {
      sourceCardId: str(action.sourceCardId).trim(),
      targetCardId: str(action.targetCardId).trim(),
      sourceAnchor: action.sourceAnchor,
      targetAnchor: action.targetAnchor,
    };
    if (!target.sourceCardId || !target.targetCardId) return room;
    const filtered = own.filter((arrow) => !sameArrow(arrow, target));
    if (filtered.length === own.length) return room;
    const next = { ...arrows };
    if (filtered.length > 0) next[player.id] = filtered;
    else delete next[player.id];
    room.targetArrowsByPlayer = next;
    return room;
  }
  if (action.type !== "target_arrow_add") return room;
  const sourceCardId = str(action.sourceCardId).trim();
  const targetCardId = str(action.targetCardId).trim();
  if (
    !sourceCardId ||
    !targetCardId ||
    (sourceCardId === targetCardId && action.sourceAnchor === action.targetAnchor) ||
    !isAnchor(action.sourceAnchor) ||
    !isAnchor(action.targetAnchor)
  ) {
    return room;
  }
  const top = room.chainEntries[0];
  const sourceValid =
    action.sourceAnchor === "chain"
      ? !!top && top.card.id === sourceCardId
      : cardInActorBoard(room, playerIndex, sourceCardId) ||
        markerZone(room, sourceCardId) !== null ||
        markerBase(sourceCardId) === player.id;
  if (!sourceValid) return room;
  const allIds = boardCardIds(room);
  const targetValid =
    action.targetAnchor === "chain"
      ? !!top && top.card.id === targetCardId
      : allIds.has(targetCardId) ||
        markerZone(room, targetCardId) !== null ||
        (!!markerBase(targetCardId) && room.players.some((candidate) => candidate.id === markerBase(targetCardId)));
  if (!targetValid) return room;
  const arrow: TargetArrow = {
    sourceCardId,
    targetCardId,
    sourceAnchor: action.sourceAnchor,
    targetAnchor: action.targetAnchor,
  };
  if (own.some((existing) => sameArrow(existing, arrow))) return room;
  const list = [...own, arrow];
  room.targetArrowsByPlayer = {
    ...arrows,
    [player.id]: list.length > 20 ? list.slice(list.length - 20) : list,
  };
  return room;
}

function removeArrowsForCard(room: Room, cardId: string): void {
  const arrows = room.targetArrowsByPlayer;
  if (!arrows) return;
  let changed = false;
  const next: Record<string, TargetArrow[]> = {};
  for (const [playerId, list] of Object.entries(arrows)) {
    const filtered = list.filter(
      (arrow) =>
        !(arrow.sourceAnchor === "board" && arrow.sourceCardId === cardId) &&
        !(arrow.targetAnchor === "board" && arrow.targetCardId === cardId),
    );
    if (filtered.length !== list.length) changed = true;
    if (filtered.length > 0) next[playerId] = filtered;
  }
  if (changed) room.targetArrowsByPlayer = next;
}

function removeArrowsForCards(room: Room, cardIds: readonly string[]): void {
  const ids = new Set(cardIds);
  const arrows = room.targetArrowsByPlayer;
  if (!arrows) return;
  let changed = false;
  const next: Record<string, TargetArrow[]> = {};
  for (const [playerId, list] of Object.entries(arrows)) {
    const filtered = list.filter(
      (arrow) =>
        !(arrow.sourceAnchor === "board" && ids.has(arrow.sourceCardId)) &&
        !(arrow.targetAnchor === "board" && ids.has(arrow.targetCardId)),
    );
    if (filtered.length !== list.length) changed = true;
    if (filtered.length > 0) next[playerId] = filtered;
  }
  if (changed) room.targetArrowsByPlayer = next;
}

function removeArrowsForChainCards(room: Room, cardIds: readonly string[]): void {
  const ids = new Set(cardIds);
  const arrows = room.targetArrowsByPlayer;
  if (!arrows) return;
  let changed = false;
  const next: Record<string, TargetArrow[]> = {};
  for (const [playerId, list] of Object.entries(arrows)) {
    const filtered = list.filter(
      (arrow) =>
        !(arrow.sourceAnchor === "chain" && ids.has(arrow.sourceCardId)) &&
        !(arrow.targetAnchor === "chain" && ids.has(arrow.targetCardId)),
    );
    if (filtered.length !== list.length) changed = true;
    if (filtered.length > 0) next[playerId] = filtered;
  }
  if (changed) room.targetArrowsByPlayer = next;
}

function isArrowZone(room: Room, zone: string): boolean {
  return arrowZones(room).includes(zone);
}

/** 662731 `c`: prune arrows whose endpoints left the board / chain. */
export function cleanupArrows(previous: Room, next: Room, action: Record<string, unknown> & { type: string }): Room {
  if (!next.targetArrowsByPlayer) return next;
  const current = boardCardIds(next);
  const removed = [...boardCardIds(previous)].filter((id) => !current.has(id));
  if (removed.length > 0) removeArrowsForCards(next, removed);
  switch (action.type) {
    case "move_card": {
      const from = str(action.from);
      const to = str(action.to);
      if (isArrowZone(previous, from) && !isArrowZone(previous, to)) removeArrowsForCard(next, str(action.cardId));
      break;
    }
    case "move_cards_to_trash_batch": {
      if (isArrowZone(previous, str(action.from)) && Array.isArray(action.cardIds)) {
        removeArrowsForCards(next, action.cardIds.filter((id): id is string => typeof id === "string"));
      }
      break;
    }
    case "transfer_card_control":
      if (isArrowZone(previous, str(action.zone))) removeArrowsForCard(next, str(action.cardId));
      break;
    case "send_to_deck":
      if (isArrowZone(previous, str(action.from))) removeArrowsForCard(next, str(action.cardId));
      break;
    case "chain_resolve": {
      const before = new Set(previous.chainEntries.map((entry) => entry.card.id));
      const after = new Set(next.chainEntries.map((entry) => entry.card.id));
      const gone = [...before].filter((id) => !after.has(id));
      if (gone.length > 0) removeArrowsForChainCards(next, gone);
      break;
    }
    default:
      break;
  }
  return next;
}

export const targetArrows: ActionHandler = ({ room, playerIndex, action }) => {
  applyArrowAction(room, playerIndex, action);
};
