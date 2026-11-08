/**
 * Persisted /game session handoff (lobby ↔ game screen).
 *
 * The original simulator keeps the active room in localStorage and navigates to `/game` with the
 * locale prefix only (`35qz5rkx7yexy.js`: `riftbound_simulator_active_room` /
 * `riftbound_simulator_last_room`). We keep the same keys and additionally accept query params on
 * `/game` (`room`, `gameInstanceId`, `playerId`, `viewer`) for deep links and e2e tests.
 */

export const ACTIVE_ROOM_KEY = "riftbound_simulator_active_room";
export const LAST_ROOM_KEY = "riftbound_simulator_last_room";

export type GameSessionViewerRole = "player" | "spectator";

export interface GameSession {
  version: 1;
  roomCode: string;
  /** Realtime socket room. Our worker uses the room code (same as the original client). */
  gameInstanceId: string;
  playerId: string;
  playerName: string;
  viewerRole: GameSessionViewerRole;
  playMode: "constructed" | "sealed";
  deckRulesMode: "standard" | "unrestricted";
  roomMode?: "multiplayer" | "solo_lab" | "single_player";
  controlledPlayerIds?: string[];
  lastKnownPhase?: string;
  savedAt: number;
}

export interface GameSessionInput {
  roomCode: string;
  gameInstanceId?: string;
  playerId: string;
  playerName: string;
  viewerRole?: GameSessionViewerRole;
  playMode?: "constructed" | "sealed";
  deckRulesMode?: "standard" | "unrestricted";
  roomMode?: GameSession["roomMode"];
  controlledPlayerIds?: string[];
  lastKnownPhase?: string;
}

function safeStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function createGameSession(input: GameSessionInput): GameSession {
  const roomCode = input.roomCode.trim().toUpperCase();
  return {
    version: 1,
    roomCode,
    gameInstanceId: (input.gameInstanceId ?? roomCode).trim(),
    playerId: input.playerId,
    playerName: input.playerName,
    viewerRole: input.viewerRole ?? "player",
    playMode: input.playMode ?? "constructed",
    deckRulesMode: input.deckRulesMode ?? "standard",
    ...(input.roomMode ? { roomMode: input.roomMode } : {}),
    ...(input.controlledPlayerIds && input.controlledPlayerIds.length > 0
      ? { controlledPlayerIds: [...input.controlledPlayerIds] }
      : {}),
    ...(input.lastKnownPhase ? { lastKnownPhase: input.lastKnownPhase } : {}),
    savedAt: Date.now(),
  };
}

function parseGameSession(raw: string | null): GameSession | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<GameSession> | null;
    if (!value || typeof value !== "object") return null;
    if (typeof value.roomCode !== "string" || !value.roomCode.trim()) return null;
    if (typeof value.playerId !== "string" || !value.playerId.trim()) return null;
    return {
      version: 1,
      roomCode: value.roomCode.trim().toUpperCase(),
      gameInstanceId:
        typeof value.gameInstanceId === "string" && value.gameInstanceId.trim()
          ? value.gameInstanceId
          : value.roomCode.trim(),
      playerId: value.playerId,
      playerName: typeof value.playerName === "string" ? value.playerName : "Player",
      viewerRole: value.viewerRole === "spectator" ? "spectator" : "player",
      playMode: value.playMode === "sealed" ? "sealed" : "constructed",
      deckRulesMode: value.deckRulesMode === "unrestricted" ? "unrestricted" : "standard",
      ...(value.roomMode === "solo_lab" ||
      value.roomMode === "single_player" ||
      value.roomMode === "multiplayer"
        ? { roomMode: value.roomMode }
        : {}),
      ...(Array.isArray(value.controlledPlayerIds)
        ? { controlledPlayerIds: value.controlledPlayerIds.filter((id) => typeof id === "string") }
        : {}),
      ...(typeof value.lastKnownPhase === "string"
        ? { lastKnownPhase: value.lastKnownPhase }
        : {}),
      savedAt: typeof value.savedAt === "number" ? value.savedAt : Date.now(),
    };
  } catch {
    return null;
  }
}

export function saveGameSession(session: GameSession): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    const raw = JSON.stringify(session);
    storage.setItem(ACTIVE_ROOM_KEY, raw);
    storage.setItem(LAST_ROOM_KEY, raw);
  } catch {
    /* ignore quota / privacy mode */
  }
}

export function readActiveGameSession(): GameSession | null {
  const storage = safeStorage();
  if (!storage) return null;
  try {
    return parseGameSession(storage.getItem(ACTIVE_ROOM_KEY));
  } catch {
    return null;
  }
}

export function readLastGameSession(): GameSession | null {
  const storage = safeStorage();
  if (!storage) return null;
  try {
    return parseGameSession(storage.getItem(LAST_ROOM_KEY));
  } catch {
    return null;
  }
}

export function clearActiveGameSession(): void {
  try {
    safeStorage()?.removeItem(ACTIVE_ROOM_KEY);
  } catch {
    /* ignore */
  }
}

export function clearGameSessions(): void {
  try {
    const storage = safeStorage();
    storage?.removeItem(ACTIVE_ROOM_KEY);
    storage?.removeItem(LAST_ROOM_KEY);
  } catch {
    /* ignore */
  }
}

/** `/game?room=…&gameInstanceId=…&playerId=…&viewer=player|spectator` */
export function gameHref(session: GameSession): string {
  const params = new URLSearchParams({
    room: session.roomCode,
    gameInstanceId: session.gameInstanceId,
    playerId: session.playerId,
    viewer: session.viewerRole,
  });
  return `/game?${params.toString()}`;
}

export interface GameQueryInput {
  room?: string | null;
  gameInstanceId?: string | null;
  playerId?: string | null;
  viewer?: string | null;
}

/** Resolve the game session from URL params first, then the persisted handoff. */
export function resolveGameSession(
  query: GameQueryInput = {},
  storage: { active?: GameSession | null; last?: GameSession | null } = {},
): GameSession | null {
  const active = storage.active ?? readActiveGameSession();
  const last = storage.last ?? readLastGameSession();
  const roomCode = query.room?.trim().toUpperCase();
  const playerId = query.playerId?.trim();
  if (roomCode && playerId) {
    return createGameSession({
      roomCode,
      gameInstanceId: query.gameInstanceId?.trim() || roomCode,
      playerId,
      playerName: active?.playerId === playerId ? active.playerName : (active?.playerName ?? "Player"),
      viewerRole: query.viewer === "spectator" ? "spectator" : "player",
      playMode: active?.playMode ?? last?.playMode ?? "constructed",
      deckRulesMode: active?.deckRulesMode ?? last?.deckRulesMode ?? "standard",
      ...(active?.roomMode ?? last?.roomMode
        ? { roomMode: active?.roomMode ?? last?.roomMode }
        : {}),
      ...(active?.controlledPlayerIds
        ? { controlledPlayerIds: active.controlledPlayerIds }
        : {}),
      ...(active?.lastKnownPhase ? { lastKnownPhase: active.lastKnownPhase } : {}),
    });
  }
  return active ?? last;
}
