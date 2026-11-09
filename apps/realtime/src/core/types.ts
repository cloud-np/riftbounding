/** Injected dependencies for the plain-TS room cores (unit-testable without workerd). */

import type { GameVariant, MatchFormat, PlayMode, RoomMode, RulesMode } from "@rift/protocol";
import type { GuestIdentity } from "../auth";

export interface CoreClock {
  now(): number;
  rng(): number;
}

export interface CoreTransport {
  send(connectionId: string, message: Record<string, unknown>): void;
  close(connectionId: string, code: number, reason: string): void;
}

export interface KvStore {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
  delete?(key: string): Promise<void>;
}

export interface Identity extends GuestIdentity {}

export type VerifyToken = (token: string) => Promise<Identity | null>;

export interface CoreHttpResult {
  status: number;
  body: Record<string, unknown>;
}

export interface MatchSeatSeed {
  playerId: string;
  name: string;
  seat: number;
  authSubject?: string | null;
  decklist?: string | null;
  constructedDeckRegistration?: unknown;
  sealedRegistration?: unknown;
  isSoloOpponent?: boolean;
  /** R4 bot-room: this seat is driven by the server-side practice bot. */
  isBot?: boolean;
  /** Player ids this auth subject controls once joined (solo modes). */
  controlledPlayerIds?: string[];
  seatReady?: boolean;
}

export interface MatchRoomSeed {
  roomCode: string;
  createdAt: number;
  roomMode: RoomMode;
  gameVariant: GameVariant;
  playMode: PlayMode;
  deckRulesMode: "standard" | "unrestricted";
  matchFormat: MatchFormat;
  /** Strict-rules toggle (R2-int, `set_lobby_rules_mode`). Absent = sandbox. */
  rulesMode?: RulesMode;
  players: MatchSeatSeed[];
  /** Quick-match rooms start the game immediately instead of waiting in the lobby. */
  autoStart?: boolean;
  origin?: string;
  seriesId?: string;
  seriesStartedAt?: number;
  gameNumber?: number;
  winsByPlayerId?: Record<string, number>;
  usedBattlefieldsByPlayerId?: Record<string, string[]>;
  previousRoomCode?: string;
  nextRoomCode?: string;
  returnLobbyRoomCode?: string;
  /** 2v2 team assignment (`team:*` ids keyed by player id). */
  teamIdByPlayerId?: Record<string, string>;
  testMode?: boolean;
  operationId?: string;
}

export interface CreateRoomSeedRequest extends Omit<MatchRoomSeed, "roomCode" | "createdAt"> {
  operationId?: string;
}

export interface MatchmakingPlayerSeed {
  playerId: string;
  name: string;
  authSubject: string;
  decklist?: string | null;
  constructedDeckRegistration?: unknown;
  sealedRegistration?: unknown;
}

export interface MatchedPlayerSeed {
  playerId: string;
  name: string;
  authSubject: string;
  decklist?: string | null;
  constructedDeckRegistration?: unknown;
  sealedRegistration?: unknown;
}

export interface MatchedRoomRequest {
  playMode: PlayMode;
  deckRulesMode: "standard" | "unrestricted";
  matchFormat: MatchFormat;
  gameVariant: GameVariant;
  /** 2 (duel) .. 4 (FFA4 / 2v2) players in seat order. */
  players: MatchedPlayerSeed[];
  /** 2v2 team assignment; seats alternate by default. */
  teamIdByPlayerId?: Record<string, string>;
  seriesId?: string;
}

export function isRoomMode(value: unknown): value is RoomMode {
  return value === "multiplayer" || value === "solo_lab" || value === "single_player";
}

export function isGameVariant(value: unknown): value is GameVariant {
  return (
    value === "duel" ||
    value === "free_for_all_3" ||
    value === "free_for_all_4" ||
    value === "teams_2v2"
  );
}

export function isPlayMode(value: unknown): value is PlayMode {
  return value === "constructed" || value === "sealed";
}

export function isMatchFormat(value: unknown): value is MatchFormat {
  return value === "bo1" || value === "bo3";
}
