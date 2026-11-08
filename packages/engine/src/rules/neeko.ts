/**
 * Neeko legend-copy normalisation — original module 107126 `M`
 * (35_5a-hj_uv52.js:1838-1856).
 */
import type { BattlefieldZone, CardInstance, Room } from "@rift/protocol";
import {
  battlefieldZones,
  cloneCard,
  detachAttachmentsFrom,
  zoneList,
} from "../state/board";
import { battlefieldCount } from "../state/selectors";
import { isUnitCardType } from "../catalog";
import { afterUnitEvents } from "./movement";

/** Clear hidden/reveal + temporary fields on a restored legend. */
function restoredLegend(card: CardInstance): CardInstance {
  const copy = cloneCard(card);
  copy.exhausted = false;
  delete copy.neekoSourceCardId;
  delete copy.hidden;
  delete copy.revealedToPlayerIds;
  delete copy.revealedToOpponent;
  delete copy.temporaryMightBuff;
  delete copy.whiteCounter;
  delete copy.redCounter;
  delete copy.customLabels;
  delete copy.empowerTriggerUsed;
  return copy;
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

/** 107126 `u`: restore all Neeko-copied legends matching `predicate`. */
export function restoreNeekoLegends(room: Room, predicate: (sourceCardId: string) => boolean): Room {
  const removedLegendIds = new Set<string>();
  for (const player of room.players) {
    const board = player.board;
    if (!board) continue;
    const matching = board.legend.filter(
      (card) => !!card.neekoSourceCardId && predicate(card.neekoSourceCardId),
    );
    if (matching.length === 0) continue;
    for (const card of matching) removedLegendIds.add(card.id);
    board.legend = board.legend.filter((card) => !matching.includes(card));
    if (board.additionalLegends) board.additionalLegends.push(...matching.map(restoredLegend));
  }
  if (removedLegendIds.size === 0) return room;

  const detach = new Set<string>();
  const zones: BattlefieldZone[] = [];
  const field = battlefieldZones(room.sharedBattlefieldToken, battlefieldCount(room));
  for (const player of room.players) {
    const board = player.board;
    if (!board) continue;
    for (const zone of ["base", ...field]) {
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
  return room;
}

/** 107126 `M`: drop copied legends whose source card is no longer visible on the field. */
export function normalizeNeeko(room: Room): Room {
  if (!room.players.some((player) => player.board?.legend.some((card) => !!card.neekoSourceCardId))) {
    return room;
  }
  const visible = new Set<string>();
  const field = battlefieldZones(room.sharedBattlefieldToken, battlefieldCount(room));
  for (const player of room.players) {
    const board = player.board;
    if (!board) continue;
    for (const zone of ["base", ...field]) {
      for (const card of zoneList(board, zone)) {
        if (!card.hidden) visible.add(card.id);
      }
    }
  }
  return restoreNeekoLegends(room, (sourceId) => !visible.has(sourceId));
}
