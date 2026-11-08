/**
 * Teams — rules 485.2, 491 (2v2), 491.6.a, 491.8.
 *
 * Mirrors the engine's entity grouping (`state/variant.ts` `entityGroups`): only the `teams_2v2`
 * mode has teammates; the team comes from `Room.teamIdByPlayerId` or, when absent, the seat-index
 * parity in `room.players` order. Pure: reads the room only.
 */
import type { Room } from "@rift/protocol";

/** 491: the only Mode of Play with teammates. */
export function isTeamMode(room: Room): boolean {
  return room.gameVariant === "teams_2v2";
}

function teamKey(room: Room, playerId: string): string {
  const explicit = room.teamIdByPlayerId?.[playerId]?.trim();
  if (explicit) return `team:${explicit}`;
  const index = room.players.findIndex((player) => player.id === playerId);
  return `team:${Math.abs(index) % 2}`;
}

/** 491.2: the player's team (the player first, then teammates in seat order). */
export function teamOf(room: Room, playerId: string): string[] {
  if (!isTeamMode(room)) return [playerId];
  const key = teamKey(room, playerId);
  return [
    playerId,
    ...room.players.map((player) => player.id).filter((id) => id !== playerId && teamKey(room, id) === key),
  ];
}

/** 491.2: the player's teammates (excluding the player). */
export function teammatesOf(room: Room, playerId: string): string[] {
  return teamOf(room, playerId).slice(1);
}

/** 740.1.b / 485.2.b: two different players are opponents unless they are teammates. */
export function areOpponents(room: Room, a: string, b: string): boolean {
  if (a === b) return false;
  return !teamOf(room, a).includes(b);
}
