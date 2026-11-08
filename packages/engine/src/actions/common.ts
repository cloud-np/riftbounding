import type { CardInstance, PlayerBoard, Room } from "@rift/protocol";
import { deepClone } from "../state/board";

export function bool(value: unknown): boolean {
  // Match the original `!!action.field` coercions.
  return Boolean(value);
}

export function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function int(value: unknown): number {
  return Math.trunc(num(value));
}

export function boardOf(room: Room, playerIndex: number): PlayerBoard | null {
  return room.players[playerIndex]?.board ?? null;
}

export function cardInZone(board: PlayerBoard | null, zone: string, cardId: string): CardInstance | undefined {
  if (!board) return undefined;
  switch (zone) {
    case "hand":
      return board.hand.find((card) => card.id === cardId);
    case "base":
      return board.base.find((card) => card.id === cardId);
    case "trash":
      return board.trash.find((card) => card.id === cardId);
    case "banished":
      return board.banished.find((card) => card.id === cardId);
    case "battlefieldA":
      return board.battlefieldA.find((card) => card.id === cardId);
    case "battlefieldB":
      return board.battlefieldB.find((card) => card.id === cardId);
    case "battlefieldC":
      return (board.battlefieldC ?? []).find((card) => card.id === cardId);
    case "battlefieldToken":
      return board.battlefieldToken.find((card) => card.id === cardId);
    case "champion":
      return board.champion.find((card) => card.id === cardId);
    case "legend":
      return board.legend.find((card) => card.id === cardId);
    case "runeArea":
      return board.runeArea.find((card) => card.id === cardId);
    case "deck":
      return board.deck.find((card) => card.id === cardId);
    case "runeDeck":
      return board.runeDeck.find((card) => card.id === cardId);
    default:
      return undefined;
  }
}

/** Restore a room after a failed multi-step handler. */
export function restoreRoom(target: Room, snapshot: Room): void {
  for (const key of Object.keys(target) as Array<keyof Room>) {
    delete (target as unknown as Record<string, unknown>)[key as string];
  }
  Object.assign(target, deepClone(snapshot));
}
