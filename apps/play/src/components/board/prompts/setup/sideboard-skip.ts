import type { MatchFormat, PlayMode, RoomMode } from "@rift/protocol";

export type SideboardSkipControlState =
  | "hidden"
  | "immediate"
  | "request"
  | "requester_waiting"
  | "recipient_pending"
  | "recipient_accepted_waiting"
  | "declined";

interface SideboardSkipRequest {
  requesterPlayerId?: string;
  acceptedPlayerIds: string[];
  declinedPlayerId?: string;
  championSelectionOnly?: boolean;
}

/** Original `ej` sideboard-skip control resolver (`2atnqtfqvj-z4.js:307-329`). */
export function resolveSideboardSkipControlState({
  roomMode,
  matchFormat,
  playMode,
  request,
  playerId,
}: {
  roomMode?: RoomMode;
  matchFormat?: MatchFormat;
  playMode?: PlayMode;
  request?: SideboardSkipRequest | null;
  playerId?: string | null;
}): SideboardSkipControlState {
  if (playMode === "sealed" || matchFormat === "bo3" || request?.championSelectionOnly) {
    return "hidden";
  }
  if (roomMode === "single_player" || roomMode === "solo_lab") return "immediate";
  if ((roomMode ?? "multiplayer") !== "multiplayer" || !playerId) return "hidden";
  if (!request) return "request";
  if (request.declinedPlayerId) return "declined";
  if (request.requesterPlayerId === playerId) return "requester_waiting";
  if (request.acceptedPlayerIds.includes(playerId)) return "recipient_accepted_waiting";
  return "recipient_pending";
}

/** `tf` — requester + accepted responders, ignoring a declined responder. */
export function acceptedSkipCount(request: SideboardSkipRequest | null | undefined): number {
  if (!request) return 0;
  return new Set(
    [request.requesterPlayerId, ...request.acceptedPlayerIds].filter(
      (playerId): playerId is string => !!playerId && playerId !== request.declinedPlayerId,
    ),
  ).size;
}

export type SideboardSkipResponseStatus = "accepted" | "declined" | "pending";

/** `th` — per-player status rows shown in the requester/responder popover. */
export function sideboardSkipRows<
  T extends { id: string; name: string; seat?: number },
>({
  players,
  request,
  playerLabel,
  labels,
}: {
  players: readonly T[];
  request: SideboardSkipRequest | null | undefined;
  playerLabel: (player: T, index: number) => string;
  labels: { accepted: string; declined: string; pending: string };
}): Array<T & { playerLabel: string; responseStatus: SideboardSkipResponseStatus; statusLabel: string }> {
  if (!request) return [];
  const accepted = new Set(
    [request.requesterPlayerId, ...request.acceptedPlayerIds].filter(
      (playerId): playerId is string => !!playerId,
    ),
  );
  return players.map((player, index) => {
    const responseStatus: SideboardSkipResponseStatus =
      player.id === request.declinedPlayerId
        ? "declined"
        : accepted.has(player.id)
          ? "accepted"
          : "pending";
    return {
      ...player,
      playerLabel: playerLabel(player, index),
      responseStatus,
      statusLabel:
        responseStatus === "accepted"
          ? labels.accepted
          : responseStatus === "declined"
            ? labels.declined
            : labels.pending,
    };
  });
}
