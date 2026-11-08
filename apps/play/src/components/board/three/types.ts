import type { RoomPlayer } from "@rift/protocol";

/** One competitor shown by the initiative dice stage. */
export interface InitiativeStagePlayer {
  id: string;
  name: string;
  relation: "self" | "ally" | "opponent";
  teamLabel?: string;
  value?: number;
  rolling?: boolean;
}

export interface InitiativeStagePlayerSource {
  player: RoomPlayer;
  relation?: "self" | "ally" | "opponent";
  teamLabel?: string;
}

/** Relation of another player, derived from the room's teams when present. */
export function relationForPlayer(
  viewerId: string,
  playerId: string,
  teamIdByPlayerId?: Record<string, string>,
): "self" | "ally" | "opponent" {
  if (viewerId === playerId) return "self";
  const viewerTeam = teamIdByPlayerId?.[viewerId];
  const otherTeam = teamIdByPlayerId?.[playerId];
  if (viewerTeam && otherTeam && viewerTeam === otherTeam) return "ally";
  return "opponent";
}

export function teamLabelFor(
  viewerId: string,
  playerId: string,
  teamIdByPlayerId?: Record<string, string>,
): string | undefined {
  const team = teamIdByPlayerId?.[playerId];
  if (!team) return undefined;
  return viewerId === playerId ? `Team ${team}` : `Team ${team}`;
}
