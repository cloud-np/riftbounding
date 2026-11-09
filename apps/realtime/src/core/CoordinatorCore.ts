/**
 * Coordinator core — room-code allocation + initial `sessionDoc` seed.
 *
 * Mirrors `POST /parties/coordinator/global-enam-v1 {action:"create_room"}`:
 *  - `operationId` is 8–128 chars of `[A-Za-z0-9:_-]` and idempotent;
 *  - `roomMode` defaults to `multiplayer`; solo modes force duel/BO1 and create a controlled
 *    opponent seat;
 *  - response `{ok, operationId, roomCode, playerId, controlledPlayerIds?, phase?}`.
 */

import type { RoomPhase } from "@rift/protocol";
import { newId } from "./ids";
import type {
  CoreClock,
  CoreHttpResult,
  Identity,
  MatchRoomSeed,
  MatchedRoomRequest,
} from "./types";
import { isGameVariant, isMatchFormat, isPlayMode, isRoomMode } from "./types";

export const COORDINATOR_ROOM = "global-enam-v1";
export const OPERATION_ID_PATTERN = /^[A-Za-z0-9:_-]{8,128}$/u;
const OPERATION_TTL_MS = 24 * 60 * 60 * 1_000;

interface StoredOperation {
  createdAt: number;
  owner: string;
  response: Record<string, unknown>;
}

export interface CoordinatorSerialized {
  version: 1;
  operations: Record<string, StoredOperation>;
}

export interface CoordinatorDeps {
  clock: CoreClock;
  createMatchRoom: (
    seed: MatchRoomSeed,
  ) => Promise<{ roomCode: string; phase?: RoomPhase; created?: boolean }>;
}

function error(
  status: number,
  code: string,
  message: string,
  extra: Record<string, unknown> = {},
): CoreHttpResult {
  return { status, body: { ok: false, error: code, message, ...extra } };
}

export class CoordinatorCore {
  private readonly deps: CoordinatorDeps;
  private operations: Record<string, StoredOperation> = {};

  constructor(deps: CoordinatorDeps) {
    this.deps = deps;
  }

  static fromSerialized(data: CoordinatorSerialized, deps: CoordinatorDeps): CoordinatorCore {
    const core = new CoordinatorCore(deps);
    core.operations = data.operations ?? {};
    return core;
  }

  toSerialized(): CoordinatorSerialized {
    return { version: 1, operations: this.operations };
  }

  private prune(): void {
    const cutoff = this.deps.clock.now() - OPERATION_TTL_MS;
    for (const [id, operation] of Object.entries(this.operations)) {
      if (operation.createdAt < cutoff) delete this.operations[id];
    }
  }

  async createRoom(body: Record<string, unknown>, identity: Identity): Promise<CoreHttpResult> {
    const operationId = typeof body.operationId === "string" ? body.operationId.trim() : "";
    if (!OPERATION_ID_PATTERN.test(operationId)) {
      return error(
        400,
        "invalid_operation_id",
        "A valid room creation operation id is required (8 to 128 letters, digits, ':', '_' or '-').",
      );
    }
    this.prune();
    const existing = this.operations[operationId];
    if (existing) {
      if (existing.owner !== identity.sub) {
        return error(
          409,
          "create_operation_conflict",
          "The room creator authorization does not match the operation.",
        );
      }
      return { status: 200, body: { ...existing.response, ok: true } };
    }

    const roomMode = isRoomMode(body.roomMode) ? body.roomMode : "multiplayer";
    const playMode = isPlayMode(body.playMode) ? body.playMode : "constructed";
    let gameVariant = isGameVariant(body.gameVariant) ? body.gameVariant : "duel";
    let matchFormat = isMatchFormat(body.matchFormat) ? body.matchFormat : "bo1";
    if (roomMode !== "multiplayer") {
      gameVariant = "duel";
      matchFormat = "bo1";
    }
    if (gameVariant !== "duel") matchFormat = "bo1";

    const playerName = sanitizePlayerName(body.playerName, identity.name);
    const hostId = identity.sub;
    const decklist =
      typeof body.decklist === "string"
        ? body.decklist
        : isRecord(body.constructedDeckRegistration) &&
            typeof body.constructedDeckRegistration.decklistRaw === "string"
          ? body.constructedDeckRegistration.decklistRaw
          : null;
    const constructedDeckRegistration = isRecord(body.constructedDeckRegistration)
      ? body.constructedDeckRegistration
      : undefined;
    const sealedRegistration = isRecord(body.sealedRegistration)
      ? body.sealedRegistration
      : undefined;
    if (playMode === "sealed" && !sealedRegistration) {
      return error(
        400,
        "invalid_room_request",
        "A sealed registration is required for sealed rooms.",
      );
    }

    // R4 bot-room: `opponent: "bot"` turns a single-player room into practice vs the server bot.
    // The bot seat is never controlled by the host and the room is forced strict.
    const botOpponent = roomMode !== "multiplayer" && body.opponent === "bot";
    const rulesMode: "strict" | undefined =
      botOpponent || body.rulesMode === "strict" ? "strict" : undefined;

    const controlledPlayerIds: string[] = [hostId];
    const players: MatchRoomSeed["players"] = [
      {
        playerId: hostId,
        name: playerName,
        seat: 0,
        authSubject: identity.sub,
        decklist,
        ...(constructedDeckRegistration ? { constructedDeckRegistration } : {}),
        ...(sealedRegistration ? { sealedRegistration } : {}),
        controlledPlayerIds,
      },
    ];
    if (roomMode !== "multiplayer") {
      const opponentId = newId("player");
      if (!botOpponent) controlledPlayerIds.push(opponentId);
      players.push({
        playerId: opponentId,
        name: botOpponent ? "Practice Bot" : "Opponent",
        seat: 1,
        authSubject: null,
        decklist: typeof body.opponentDecklist === "string" ? body.opponentDecklist : decklist,
        ...(constructedDeckRegistration ? { constructedDeckRegistration } : {}),
        isSoloOpponent: true,
        ...(botOpponent ? { isBot: true } : {}),
        ...(!botOpponent ? { controlledPlayerIds } : {}),
      });
    }

    const seed: MatchRoomSeed = {
      roomCode: "",
      createdAt: this.deps.clock.now(),
      roomMode,
      gameVariant,
      playMode,
      deckRulesMode:
        playMode === "constructed" && roomMode !== "multiplayer" ? "unrestricted" : "standard",
      matchFormat,
      ...(rulesMode ? { rulesMode } : {}),
      players,
      autoStart: false,
      origin: roomMode === "multiplayer" ? "private_hosted" : roomMode,
      seriesId: newId("series"),
      gameNumber: 1,
      winsByPlayerId: {},
      ...(body.testMode === true || roomMode === "solo_lab" ? { testMode: true } : {}),
    };
    try {
      const created = await this.deps.createMatchRoom(seed);
      const response: Record<string, unknown> = {
        ok: true,
        operationId,
        roomCode: created.roomCode,
        playerId: hostId,
        ...(roomMode !== "multiplayer" ? { controlledPlayerIds } : {}),
        phase: created.phase ?? "lobby",
      };
      this.operations[operationId] = {
        createdAt: this.deps.clock.now(),
        owner: identity.sub,
        response,
      };
      return { status: 200, body: response };
    } catch (cause) {
      return error(
        500,
        "room_allocation_failed",
        cause instanceof Error ? cause.message : "Could not allocate a room.",
        { retryable: true },
      );
    }
  }

  /**
   * Internal RPC used by a match room to allocate a linked room (next BO3 game, series rematch or
   * fresh return-to-lobby room). The seed is fully built by the caller: same player ids, auth
   * subjects and decks. Allocation/collision handling is the same as `create_room`.
   */
  async createLinkedRoom(seed: MatchRoomSeed): Promise<{ roomCode: string }> {
    const created = await this.deps.createMatchRoom({
      ...seed,
      roomCode: "",
      createdAt: this.deps.clock.now(),
    });
    return { roomCode: created.roomCode };
  }

  /**
   * Internal RPC used by the matchmaking party (all players are already authenticated).
   *
   * Seats follow the pairing order 0..n-1. 2v2 uses explicit `team:*` ids when supplied; otherwise
   * seats alternate teams, matching the engine's implicit seat-parity rule (`509396.i`).
   */
  async createMatchedRoom(
    request: MatchedRoomRequest,
  ): Promise<{ roomCode: string; playerIds: string[] }> {
    if (request.players.length < 2 || request.players.length > 4) {
      throw new Error("Matched rooms require between two and four players.");
    }
    const players: MatchRoomSeed["players"] = request.players.map((player, seat) => ({
      playerId: player.playerId,
      name: player.name,
      seat,
      authSubject: player.authSubject,
      decklist: player.decklist ?? null,
      ...(player.constructedDeckRegistration
        ? { constructedDeckRegistration: player.constructedDeckRegistration }
        : {}),
      ...(player.sealedRegistration ? { sealedRegistration: player.sealedRegistration } : {}),
    }));
    const teamIdByPlayerId =
      request.gameVariant === "teams_2v2"
        ? Object.fromEntries(
            players.map((player, seat) => [
              player.playerId,
              request.teamIdByPlayerId?.[player.playerId] ?? `team:${seat % 2}`,
            ]),
          )
        : undefined;
    const seed: MatchRoomSeed = {
      roomCode: "",
      createdAt: this.deps.clock.now(),
      roomMode: "multiplayer",
      gameVariant: request.gameVariant,
      playMode: request.playMode,
      deckRulesMode: request.deckRulesMode,
      matchFormat: request.matchFormat,
      players,
      ...(teamIdByPlayerId ? { teamIdByPlayerId } : {}),
      autoStart: true,
      origin: "matchmaking",
      seriesId: request.seriesId ?? newId("series"),
      gameNumber: 1,
      winsByPlayerId: {},
    };
    const created = await this.deps.createMatchRoom(seed);
    return { roomCode: created.roomCode, playerIds: players.map((player) => player.playerId) };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizePlayerName(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const name = value.trim().replace(/\s+/gu, " ");
  return name.length > 0 ? name.slice(0, 32) : fallback;
}
