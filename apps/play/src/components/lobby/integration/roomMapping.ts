/**
 * RoomSessionDoc (`room_shell_sync`) → presentational `RoomState` for `<RoomShell>`.
 *
 * The room shell components are intentionally unaware of the wire document; this is the only
 * mapping layer. Keep `RoomState` semantics identical to the local mock (B7): seats, ready flags,
 * deck readiness, chat, spectators, host id and match completion.
 */
import type { RoomSessionDoc, Spectator } from "@rift/protocol";

import type {
  DeckRulesMode,
  GameVariant,
  MatchFormat,
  PlayMode,
  RoomChatEntry,
  RoomSeat,
  RoomState,
} from "../types";

const VARIANT_CAPACITY: Record<GameVariant, number> = {
  duel: 2,
  free_for_all_3: 3,
  free_for_all_4: 4,
  teams_2v2: 4,
};

function capacityOf(variant: GameVariant): number {
  return VARIANT_CAPACITY[variant] ?? 2;
}

export interface RoomMappingInput {
  sessionDoc: RoomSessionDoc;
  myPlayerId: string;
  viewerRole: "player" | "spectator";
  deckReadyFallback?: boolean;
  chatEntries?: Array<Record<string, unknown>>;
  spectators?: Spectator[];
}

function variantOf(doc: RoomSessionDoc): GameVariant {
  return doc.gameVariant ?? "duel";
}

function playerDeckReady(player: RoomSessionDoc["players"][number]): boolean {
  return Boolean(player.submittedDeck ?? player.decklistRaw ?? player.deck);
}

export function roomStateFromSessionDoc(input: RoomMappingInput): RoomState {
  const { sessionDoc, myPlayerId, viewerRole } = input;
  const variant = variantOf(sessionDoc);
  const capacity = capacityOf(variant);
  const activePlayers = sessionDoc.players.filter((player) => !player.leftAt);
  const sorted = activePlayers.slice().sort((a, b) => a.seat - b.seat);
  const host = sorted.find((player) => player.seat === 0) ?? sorted[0];
  const readyIds = new Set(sessionDoc.lobbyReadyPlayerIds ?? []);
  const me = activePlayers.find((player) => player.id === myPlayerId);

  const seats: (RoomSeat | null)[] = Array.from({ length: capacity }, () => null);
  for (const player of sorted) {
    if (player.seat < 0 || player.seat >= capacity) continue;
    seats[player.seat] = {
      id: player.id,
      name: player.name,
      seat: player.seat,
      ready: readyIds.has(player.id),
      deckReady: playerDeckReady(player) || Boolean(input.deckReadyFallback && player.id === myPlayerId),
      isHost: player.id === (host?.id ?? ""),
    };
  }

  const chat: RoomChatEntry[] = (input.chatEntries ?? []).map((entry, index) => ({
    id: typeof entry.id === "string" ? entry.id : `chat-${index}`,
    author:
      typeof entry.authorName === "string" && entry.authorName.trim()
        ? entry.authorName
        : "Player",
    authorPlayerId: typeof entry.authorId === "string" ? entry.authorId : "",
    text: typeof entry.text === "string" ? entry.text : "",
    at: typeof entry.at === "number" ? entry.at : Date.now(),
  }));

  const terminated = sessionDoc.matchTermination?.status;
  return {
    code: sessionDoc.roomCode,
    origin:
      (sessionDoc.roomMode ?? "multiplayer") === "multiplayer" ? "private" : "solo",
    roomMode: sessionDoc.roomMode ?? "multiplayer",
    hostId: host?.id ?? myPlayerId,
    myId: myPlayerId,
    mySeat: me?.seat ?? null,
    viewerRole,
    variant,
    playMode: (sessionDoc.playMode ?? "constructed") as PlayMode,
    format: (sessionDoc.matchFormat ?? "bo1") as MatchFormat,
    deckRules: (sessionDoc.deckRulesMode ?? "standard") as DeckRulesMode,
    seats,
    chat,
    spectators: (input.spectators ?? []).map((spectator) => ({
      id: spectator.authSubject,
      name: spectator.displayName,
    })),
    started: sessionDoc.phase !== "lobby",
    matchComplete: terminated === "completed" || terminated === "aborted",
    gameNumber: sessionDoc.gameNumber ?? 1,
  };
}

/** Minimal room shown while the first `room_shell_sync` is in flight. */
export function pendingRoomState(input: {
  roomCode: string;
  myPlayerId: string;
  myPlayerName: string;
  viewerRole: "player" | "spectator";
  roomMode: "multiplayer" | "solo_lab" | "single_player";
  variant?: GameVariant;
  playMode?: PlayMode;
  format?: MatchFormat;
  deckRules?: DeckRulesMode;
  deckReady?: boolean;
  controlledPlayerIds?: string[];
}): RoomState {
  const variant = input.variant ?? "duel";
  const capacity = capacityOf(variant);
  const seats: (RoomSeat | null)[] = Array.from({ length: capacity }, () => null);
  if (input.viewerRole === "player") {
    seats[0] = {
      id: input.myPlayerId,
      name: input.myPlayerName,
      seat: 0,
      ready: false,
      deckReady: Boolean(input.deckReady),
      isHost: true,
    };
  }
  if (input.roomMode !== "multiplayer") {
    const opponentId = input.controlledPlayerIds?.find((id) => id !== input.myPlayerId);
    if (opponentId) {
      seats[1] = {
        id: opponentId,
        name: "Opponent",
        seat: 1,
        ready: false,
        deckReady: Boolean(input.deckReady),
        isHost: false,
      };
    }
  }
  return {
    code: input.roomCode,
    origin: input.roomMode === "multiplayer" ? "private" : "solo",
    roomMode: input.roomMode,
    hostId: input.myPlayerId,
    myId: input.myPlayerId,
    mySeat: input.viewerRole === "player" ? 0 : null,
    viewerRole: input.viewerRole,
    variant,
    playMode: input.playMode ?? "constructed",
    format: input.format ?? "bo1",
    deckRules: input.deckRules ?? "standard",
    seats,
    chat: [],
    spectators: [],
    started: false,
    matchComplete: false,
    gameNumber: 1,
  };
}
