/**
 * Matchmaking queue core (party `matchmaking`).
 *
 * Queue room names follow the client:
 *   ["enam-v2", playMode, playMode === "constructed" ? "all" : pool,
 *    gameVariant !== "duel" ? "multiplayer" : matchFormat].join("-")
 * e.g. `enam-v2-constructed-all-bo1`.
 *
 * Socket protocol: start/resolve → searching|matched|expired|cancelled|error, ping → pong.
 * HTTP: cancel_exact / reset_exact (also used as the exact-result poll after a dropped socket).
 * Pairing is FIFO for compatible duel searches.
 */

import type { GameVariant, MatchFormat, PlayMode } from "@rift/protocol";
import { newId } from "./ids";
import type {
  CoreClock,
  CoreHttpResult,
  CoreTransport,
  Identity,
  MatchedRoomRequest,
  VerifyToken,
} from "./types";
import { isGameVariant, isMatchFormat, isPlayMode } from "./types";

export const SEARCH_ID_PATTERN = /^[A-Za-z0-9:_-]{8,128}$/u;
/** Original quick-match party id (`/^party:[A-Za-z0-9-]{8,64}$/`, `35qz5rkx7yexy.js:18919`). */
export const PARTY_ID_PATTERN = /^party:[A-Za-z0-9-]{8,64}$/u;
export const SEARCH_TTL_MS = 10 * 60 * 1_000;
export const SEARCH_WIDEN_MS = 90 * 1_000;
const RESULT_TTL_MS = 10 * 60 * 1_000;

export interface PartyMemberRecord {
  authSubject: string;
  playerId: string;
  playerName: string;
  friendCode: string;
  ready: boolean;
  connected: boolean;
  connectionId?: string | null;
  teamKeys?: Record<string, unknown>;
  joinedAt: number;
}

/**
 * Quick-match party/table (`party_join`/`party_update`/`party_start`/`party_stop`).
 * Parties are constructed-only, non-duel multiplayer tables; the leader picks the variant and
 * every member must be connected + ready before the round starts searching.
 */
export interface PartyRecord {
  partyId: string;
  gameVariant: GameVariant;
  status: "gathering" | "searching";
  leaderAuthSubject: string;
  searchRound: number;
  members: PartyMemberRecord[];
  createdAt: number;
  updatedAt: number;
}

async function friendCodeFor(authSubject: string): Promise<string> {
  const data = new TextEncoder().encode(`riftatlas-social:${authSubject}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest).slice(0, 10)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

export interface MatchmakingSearchRecord {
  searchId: string;
  authSubject: string;
  playerId: string;
  playerName: string;
  playMode: PlayMode;
  decklist?: string;
  constructedDeckRegistration?: Record<string, unknown>;
  sealedRegistration?: Record<string, unknown>;
  matchmakingPool: string;
  matchFormat: MatchFormat;
  gameVariant: GameVariant;
  extensions: string[];
  party?: Record<string, unknown>;
  createdAt: number;
  expiresAt: number;
  widenAt: number;
  searchScope: "specific";
  status: "waiting" | "paired" | "matched" | "cancelled" | "expired";
  connectionId?: string | null;
  roomCode?: string;
  matchedAt?: number;
  matchedPlayerName?: string;
}

export interface MatchmakingSerialized {
  version: 1;
  searches: MatchmakingSearchRecord[];
  nextSequence: number;
  /** Quick-match parties (B25, additive). */
  parties?: PartyRecord[];
}

export interface MatchmakingDeps {
  clock: CoreClock;
  transport: CoreTransport;
  verifyToken: VerifyToken;
  createMatchedRoom: (
    request: MatchedRoomRequest,
  ) => Promise<{ roomCode: string; playerIds: string[] }>;
}

/** Duel pairs two players; every non-duel table fills all seats (FFA3 = 3, FFA4/2v2 = 4). */
export function playersRequiredForVariant(variant: GameVariant): number {
  if (variant === "free_for_all_3") return 3;
  if (variant === "free_for_all_4" || variant === "teams_2v2") return 4;
  return 2;
}

interface ConnectionState {
  id: string;
  authSubject?: string | null;
  searchId?: string | null;
  joined: boolean;
}

function queueNameFor(input: {
  playMode: PlayMode;
  matchmakingPool: string;
  matchFormat: MatchFormat;
  gameVariant: GameVariant;
}): string {
  return [
    "enam-v2",
    input.playMode,
    input.playMode === "constructed" ? "all" : input.matchmakingPool,
    input.gameVariant !== "duel" ? "multiplayer" : input.matchFormat,
  ].join("-");
}

export function matchmakingQueueRoomName(input: {
  playMode: PlayMode;
  matchmakingPool: string;
  matchFormat: MatchFormat;
  gameVariant?: GameVariant;
}): string {
  return queueNameFor({
    playMode: input.playMode,
    matchmakingPool: input.matchmakingPool,
    matchFormat: input.matchFormat,
    gameVariant: input.gameVariant ?? "duel",
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizedVariant(value: unknown): GameVariant | null {
  if (value === undefined) return "duel";
  return isGameVariant(value) ? value : null;
}

export class MatchmakingCore {
  private readonly deps: MatchmakingDeps;
  private searches: MatchmakingSearchRecord[] = [];
  private parties: PartyRecord[] = [];
  private connections = new Map<string, ConnectionState>();
  private pairing = false;

  constructor(deps: MatchmakingDeps) {
    this.deps = deps;
  }

  static fromSerialized(data: MatchmakingSerialized, deps: MatchmakingDeps): MatchmakingCore {
    const core = new MatchmakingCore(deps);
    core.searches = data.searches ?? [];
    core.parties = data.parties ?? [];
    return core;
  }

  toSerialized(): MatchmakingSerialized {
    return {
      version: 1,
      searches: this.searches,
      nextSequence: 0,
      parties: this.parties,
    };
  }

  addConnection(connectionId: string): void {
    this.connections.set(connectionId, { id: connectionId, joined: false });
  }

  removeConnection(connectionId: string): void {
    this.connections.delete(connectionId);
    for (const search of this.searches) {
      if (search.connectionId === connectionId) search.connectionId = null;
    }
    for (const party of this.parties) {
      let changed = false;
      for (const member of party.members) {
        if (member.connectionId !== connectionId) continue;
        member.connectionId = null;
        member.connected = false;
        changed = true;
      }
      if (changed) this.broadcastPartyState(party);
    }
  }

  private send(connectionId: string, message: Record<string, unknown>): void {
    this.deps.transport.send(connectionId, message);
  }

  private sendError(
    connectionId: string | null | undefined,
    code: string,
    message: string,
    extra: Record<string, unknown> = {},
  ): void {
    if (!connectionId) return;
    this.send(connectionId, { type: "error", code, message, ...extra });
  }

  private connectionForSearch(search: MatchmakingSearchRecord): ConnectionState | undefined {
    if (!search.connectionId) return undefined;
    return this.connections.get(search.connectionId);
  }

  private searchingMessage(search: MatchmakingSearchRecord): Record<string, unknown> {
    return {
      type: "searching",
      searchId: search.searchId,
      ...(search.roomCode ? { roomCode: search.roomCode } : {}),
      expiresAt: search.expiresAt,
      widenAt: search.widenAt,
      searchScope: search.searchScope,
      playMode: search.playMode,
      matchmakingPool: search.matchmakingPool,
      matchFormat: search.matchFormat,
      ...(search.gameVariant !== "duel" ? { gameVariant: search.gameVariant } : {}),
      extensions: search.extensions,
      availableExtensions: [],
    };
  }

  private matchedMessage(search: MatchmakingSearchRecord): Record<string, unknown> {
    return {
      type: "matched",
      roomCode: search.roomCode,
      playerId: search.playerId,
      playerName: search.playerName,
      playMode: search.playMode,
    };
  }

  private pushSearchState(search: MatchmakingSearchRecord): void {
    const connection = this.connectionForSearch(search);
    if (!connection) return;
    if (search.status === "matched") this.send(connection.id, this.matchedMessage(search));
    else if (search.status === "waiting" || search.status === "paired") {
      this.send(connection.id, this.searchingMessage(search));
    } else if (search.status === "cancelled")
      this.send(connection.id, { type: "cancelled", searchId: search.searchId });
    else if (search.status === "expired") {
      this.send(connection.id, {
        type: "expired",
        searchId: search.searchId,
        expiresAt: search.expiresAt,
      });
    }
  }

  /* ------------------------------------------------------------------ quick-match parties */

  private partyForSubject(authSubject: string): PartyRecord | undefined {
    return this.parties.find((party) =>
      party.members.some((member) => member.authSubject === authSubject),
    );
  }

  private partyStateFor(party: PartyRecord, viewerAuthSubject: string): Record<string, unknown> {
    return {
      type: "party_state",
      party: {
        partyId: party.partyId,
        status: party.status,
        gameVariant: party.gameVariant,
        table: party.gameVariant,
        searchRound: party.searchRound,
        round: party.searchRound,
        createdAt: party.createdAt,
        updatedAt: party.updatedAt,
        members: party.members.map((member) => ({
          friendCode: member.friendCode,
          name: member.playerName,
          leader: member.authSubject === party.leaderAuthSubject,
          you: member.authSubject === viewerAuthSubject,
          connected: member.connected,
          ready: member.ready,
          ...(member.teamKeys ? { teamKeys: member.teamKeys } : {}),
        })),
      },
    };
  }

  private sendPartyState(party: PartyRecord): void {
    for (const member of party.members) {
      if (!member.connectionId) continue;
      this.send(member.connectionId, this.partyStateFor(party, member.authSubject));
    }
  }

  private broadcastPartyState(party: PartyRecord): void {
    party.updatedAt = this.deps.clock.now();
    this.sendPartyState(party);
  }

  private sendPartyClosed(party: PartyRecord, reason: string): void {
    for (const member of party.members) {
      if (!member.connectionId) continue;
      this.send(member.connectionId, {
        type: "party_closed",
        partyId: party.partyId,
        reason,
      });
    }
  }

  private partyError(connectionId: string, partyId: string, code: string, message: string): void {
    this.sendError(connectionId, code, message, {
      partyId,
      retryable: code !== "party_full" && code !== "party_busy",
    });
  }

  /** Handles the original quick-match party frames; returns false when `type` is not a party frame. */
  private async handlePartyMessage(
    connectionId: string,
    type: string,
    message: Record<string, unknown>,
  ): Promise<boolean> {
    if (
      type !== "party_join" &&
      type !== "party_update" &&
      type !== "party_leave" &&
      type !== "party_start" &&
      type !== "party_stop"
    ) {
      return false;
    }
    const partyId = typeof message.partyId === "string" ? message.partyId.trim() : "";
    if (!PARTY_ID_PATTERN.test(partyId)) {
      this.sendError(connectionId, "invalid_message", "The party identifier is malformed.", {
        ...(partyId ? { partyId } : {}),
      });
      return true;
    }
    const authToken = typeof message.authToken === "string" ? message.authToken : "";
    const identity = await this.deps.verifyToken(authToken);
    if (!identity) {
      this.sendError(
        connectionId,
        "invalid_auth_token",
        "Your session token could not be verified.",
        {
          retryable: true,
          authRecovery: "refresh_token",
          partyId,
        },
      );
      return true;
    }
    const now = this.deps.clock.now();
    let party = this.parties.find((candidate) => candidate.partyId === partyId);
    const existingParty = this.partyForSubject(identity.sub);

    if (type === "party_join") {
      if (existingParty && existingParty.partyId !== partyId) {
        this.partyError(connectionId, partyId, "party_conflict", "Leave your current party first.");
        return true;
      }
      if (!party) {
        const create = isRecord(message.create) ? message.create : null;
        const variant = create && isGameVariant(create.gameVariant) ? create.gameVariant : null;
        if (!variant || variant === "duel") {
          this.partyError(
            connectionId,
            partyId,
            "party_unavailable",
            "Create a party for a multiplayer table.",
          );
          return true;
        }
        const playerName =
          typeof message.playerName === "string" && message.playerName.trim()
            ? message.playerName.trim().slice(0, 32)
            : identity.name;
        party = {
          partyId,
          gameVariant: variant,
          status: "gathering",
          leaderAuthSubject: identity.sub,
          searchRound: 0,
          members: [],
          createdAt: now,
          updatedAt: now,
        };
        this.parties.push(party);
      } else if (party.status === "searching") {
        this.partyError(connectionId, partyId, "party_busy", "This party is already searching.");
        return true;
      }
      const seats = playersRequiredForVariant(party.gameVariant);
      let member = party.members.find((candidate) => candidate.authSubject === identity.sub);
      if (!member && party.members.length >= seats) {
        this.partyError(connectionId, partyId, "party_full", "This party is full.");
        return true;
      }
      if (!member) {
        member = {
          authSubject: identity.sub,
          playerId: identity.sub,
          playerName:
            typeof message.playerName === "string" && message.playerName.trim()
              ? message.playerName.trim().slice(0, 32)
              : identity.name,
          friendCode: await friendCodeFor(identity.sub),
          ready: false,
          connected: true,
          connectionId,
          joinedAt: now,
        };
        party.members.push(member);
      } else {
        member.connectionId = connectionId;
        member.connected = true;
        if (typeof message.playerName === "string" && message.playerName.trim()) {
          member.playerName = message.playerName.trim().slice(0, 32);
        }
      }
      this.broadcastPartyState(party);
      return true;
    }

    if (!party) {
      this.partyError(
        connectionId,
        partyId,
        "party_unavailable",
        "This party is no longer available.",
      );
      return true;
    }
    const member = party.members.find((candidate) => candidate.authSubject === identity.sub);
    if (!member) {
      this.partyError(connectionId, partyId, "party_unavailable", "You are not in this party.");
      return true;
    }
    member.connectionId = connectionId;
    member.connected = true;
    const isLeader = party.leaderAuthSubject === identity.sub;

    if (type === "party_update") {
      if (isRecord(message.teamKeys)) member.teamKeys = { ...message.teamKeys };
      if (typeof message.ready === "boolean") member.ready = message.ready;
      if (message.gameVariant !== undefined) {
        if (!isLeader) {
          this.partyError(
            connectionId,
            partyId,
            "party_access_denied",
            "Only the leader picks the table.",
          );
          return true;
        }
        if (party.status !== "gathering") {
          this.partyError(connectionId, partyId, "party_busy", "The party is already searching.");
          return true;
        }
        if (!isGameVariant(message.gameVariant) || message.gameVariant === "duel") {
          this.partyError(
            connectionId,
            partyId,
            "party_unavailable",
            "Choose a multiplayer table.",
          );
          return true;
        }
        if (party.members.length > playersRequiredForVariant(message.gameVariant)) {
          this.partyError(connectionId, partyId, "party_full", "Too few seats for your party.");
          return true;
        }
        party.gameVariant = message.gameVariant;
      }
      this.broadcastPartyState(party);
      return true;
    }

    if (type === "party_start") {
      if (!isLeader) {
        this.partyError(connectionId, partyId, "party_access_denied", "Only the leader can start.");
        return true;
      }
      if (party.status !== "gathering") {
        this.partyError(connectionId, partyId, "party_busy", "The party is already searching.");
        return true;
      }
      const seats = playersRequiredForVariant(party.gameVariant);
      if (
        party.members.length !== seats ||
        !party.members.every((candidate) => candidate.connected && candidate.ready)
      ) {
        this.partyError(
          connectionId,
          partyId,
          "party_not_ready",
          "Waiting for every member to connect and pick a deck.",
        );
        return true;
      }
      party.status = "searching";
      party.searchRound += 1;
      this.broadcastPartyState(party);
      return true;
    }

    if (type === "party_stop") {
      if (!isLeader) {
        this.partyError(connectionId, partyId, "party_access_denied", "Only the leader can stop.");
        return true;
      }
      party.status = "gathering";
      party.searchRound += 1;
      this.broadcastPartyState(party);
      return true;
    }

    // party_leave
    if (isLeader) {
      this.sendPartyClosed(party, "disbanded");
      this.parties = this.parties.filter((candidate) => candidate !== party);
      return true;
    }
    party.members = party.members.filter((candidate) => candidate !== member);
    this.broadcastPartyState(party);
    return true;
  }

  async handleMessage(connectionId: string, message: Record<string, unknown>): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;
    const type = typeof message.type === "string" ? message.type : "";

    if (type === "ping") {
      this.send(connectionId, {
        type: "pong",
        searchId: typeof message.searchId === "string" ? message.searchId : "",
        sentAt: message.sentAt,
      });
      return;
    }
    if (await this.handlePartyMessage(connectionId, type, message)) return;
    if (type !== "start" && type !== "resolve") {
      this.sendError(connectionId, "invalid_message", "The matchmaking message is malformed.");
      return;
    }

    const authToken = typeof message.authToken === "string" ? message.authToken : "";
    const identity = await this.deps.verifyToken(authToken);
    if (!identity) {
      this.sendError(
        connectionId,
        "invalid_auth_token",
        "Your session token could not be verified.",
        {
          retryable: true,
          authRecovery: "refresh_token",
          ...(typeof message.searchId === "string" ? { searchId: message.searchId } : {}),
        },
      );
      return;
    }
    connection.authSubject = identity.sub;

    const searchId = typeof message.searchId === "string" ? message.searchId : "";
    if (!SEARCH_ID_PATTERN.test(searchId)) {
      this.sendError(
        connectionId,
        "invalid_message",
        "The matchmaking search identifier is malformed.",
        {
          searchId: searchId || undefined,
        },
      );
      return;
    }
    connection.searchId = searchId;

    const existing = this.searches.find((search) => search.searchId === searchId);
    if (existing) {
      if (existing.authSubject !== identity.sub) {
        this.sendError(
          connectionId,
          "matchmaking_search_conflict",
          "This search belongs to another account.",
          {
            searchId,
            retryable: false,
          },
        );
        return;
      }
      existing.connectionId = connectionId;
      if (type === "resolve") {
        if (existing.status === "waiting") {
          existing.expiresAt = this.deps.clock.now() + SEARCH_TTL_MS;
          existing.widenAt = this.deps.clock.now() + SEARCH_WIDEN_MS;
        }
        this.pushSearchState(existing);
      } else {
        if (existing.status === "matched") this.send(connectionId, this.matchedMessage(existing));
        else if (existing.status === "waiting")
          this.send(connectionId, this.searchingMessage(existing));
        else this.pushSearchState(existing);
      }
      await this.tryPair();
      return;
    }

    if (type === "resolve") {
      this.sendError(
        connectionId,
        "matchmaking_search_expired",
        "This matchmaking search is no longer active.",
        {
          searchId,
          retryable: false,
        },
      );
      return;
    }

    const active = this.searches.find(
      (search) =>
        search.authSubject === identity.sub &&
        (search.status === "waiting" || search.status === "paired") &&
        search.searchId !== searchId,
    );
    if (active) {
      this.sendError(
        connectionId,
        "matchmaking_search_conflict",
        "Cancel the earlier match search before starting another search.",
        {
          searchId,
          activeSearchId: active.searchId,
          activeSearchExpiresAt: active.expiresAt,
          retryable: false,
        },
      );
      return;
    }

    const playMode = isPlayMode(message.playMode) ? message.playMode : null;
    const parsedFormat = isMatchFormat(message.matchFormat) ? message.matchFormat : null;
    const gameVariant = normalizedVariant(message.gameVariant);
    // Matches the client: 3/4-player tables always queue as BO1 (`o8(gameVariant) ? "multiplayer"`).
    const matchFormat = gameVariant && gameVariant !== "duel" ? "bo1" : parsedFormat;
    const matchmakingPool =
      typeof message.matchmakingPool === "string" ? message.matchmakingPool : "";
    const playerName = typeof message.playerName === "string" ? message.playerName.trim() : "";
    if (!playMode || !matchFormat || !gameVariant || !matchmakingPool || !playerName) {
      this.sendError(connectionId, "invalid_message", "The matchmaking message is malformed.", {
        searchId,
      });
      return;
    }
    const constructedDeckRegistration = isRecord(message.constructedDeckRegistration)
      ? message.constructedDeckRegistration
      : undefined;
    const sealedRegistration = isRecord(message.sealedRegistration)
      ? message.sealedRegistration
      : undefined;
    if (playMode === "sealed" && !sealedRegistration) {
      this.sendError(connectionId, "invalid_message", "A sealed registration is required.", {
        searchId,
      });
      return;
    }

    let partyMeta: { id: string; round: number; gameVariant: GameVariant } | null = null;
    if (message.party !== undefined) {
      const raw = isRecord(message.party) ? message.party : null;
      const partyId = typeof raw?.id === "string" ? raw.id.trim() : "";
      const round = raw?.round;
      if (
        !raw ||
        !PARTY_ID_PATTERN.test(partyId) ||
        !Number.isSafeInteger(round) ||
        Number(round) < 1
      ) {
        this.sendError(connectionId, "invalid_message", "The party search payload is malformed.", {
          searchId,
          ...(partyId ? { partyId } : {}),
        });
        return;
      }
      const party = this.parties.find((candidate) => candidate.partyId === partyId);
      const member = party?.members.find((candidate) => candidate.authSubject === identity.sub);
      if (
        !party ||
        !member ||
        party.status !== "searching" ||
        party.searchRound !== Number(round)
      ) {
        this.sendError(connectionId, "party_not_ready", "The party is not searching.", {
          searchId,
          partyId,
          retryable: true,
        });
        return;
      }
      if (party.gameVariant !== gameVariant || playMode !== "constructed") {
        this.sendError(connectionId, "invalid_message", "The party table does not match.", {
          searchId,
          partyId,
        });
        return;
      }
      member.connectionId = connectionId;
      member.connected = true;
      partyMeta = { id: party.partyId, round: Number(round), gameVariant: party.gameVariant };
    }

    const now = this.deps.clock.now();
    const search: MatchmakingSearchRecord = {
      searchId,
      authSubject: identity.sub,
      playerId: identity.sub,
      playerName: playerName.slice(0, 32),
      playMode,
      ...(typeof message.decklist === "string" ? { decklist: message.decklist } : {}),
      ...(constructedDeckRegistration ? { constructedDeckRegistration } : {}),
      ...(sealedRegistration ? { sealedRegistration } : {}),
      matchmakingPool,
      matchFormat,
      gameVariant,
      extensions: Array.isArray(message.extensions)
        ? message.extensions.filter(
            (value): value is string => value === "pools" || value === "tables",
          )
        : [],
      ...(partyMeta ? { party: { ...partyMeta } } : {}),
      createdAt: now,
      expiresAt: now + SEARCH_TTL_MS,
      widenAt: now + SEARCH_WIDEN_MS,
      searchScope: "specific",
      status: "waiting",
      connectionId,
    };
    this.searches.push(search);
    this.send(connectionId, this.searchingMessage(search));
    await this.tryPair();
  }

  private compatible(first: MatchmakingSearchRecord, second: MatchmakingSearchRecord): boolean {
    if (first.searchId === second.searchId) return false;
    if (first.authSubject === second.authSubject) return false;
    if (first.status !== "waiting" || second.status !== "waiting") return false;
    // Party members are grouped by `tryPair`; they never pair as ad-hoc solos.
    if (first.party || second.party) return false;
    if (first.gameVariant !== second.gameVariant) return false;
    return (
      first.playMode === second.playMode &&
      first.matchmakingPool === second.matchmakingPool &&
      first.matchFormat === second.matchFormat
    );
  }

  /**
   * Fill a table in FIFO order. Duel pairs two searches; FFA3 requires three; FFA4/2v2 require four.
   * All participants share play mode, pool, format and variant (the original's queue room groups
   * every non-duel table under `…-multiplayer`, then the `gameVariant` field splits them).
   */
  private async tryPair(): Promise<void> {
    if (this.pairing) return;
    this.pairing = true;
    try {
      for (;;) {
        const waiting = this.searches
          .filter((search) => search.status === "waiting")
          .sort((a, b) => a.createdAt - b.createdAt || a.searchId.localeCompare(b.searchId));
        // Solo/duo searches pair first; a party search waits for every member's search frame.
        const first =
          waiting.find((search) => !search.party) ?? waiting.find((search) => !!search.party);
        if (!first) return;
        const required = playersRequiredForVariant(first.gameVariant);
        let table: MatchmakingSearchRecord[];
        if (first.party) {
          const partyId = String(first.party.id ?? "");
          const round = Number(first.party.round ?? 0);
          table = waiting.filter(
            (search) =>
              search.party &&
              String(search.party.id ?? "") === partyId &&
              Number(search.party.round ?? 0) === round,
          );
          if (table.length < required) return;
          table = table.slice(0, required);
        } else {
          table = [first];
          for (const candidate of waiting) {
            if (candidate === first) continue;
            if (table.length >= required) break;
            if (this.compatible(first, candidate)) table.push(candidate);
          }
          if (table.length < required) return;
        }
        for (const search of table) search.status = "paired";
        try {
          const created = await this.deps.createMatchedRoom({
            playMode: first.playMode,
            deckRulesMode: "standard",
            matchFormat: first.matchFormat,
            gameVariant: first.gameVariant,
            players: table.map((search) => ({
              playerId: search.playerId,
              name: search.playerName,
              authSubject: search.authSubject,
              decklist: search.decklist ?? null,
              ...(search.constructedDeckRegistration
                ? { constructedDeckRegistration: search.constructedDeckRegistration }
                : {}),
              ...(search.sealedRegistration
                ? { sealedRegistration: search.sealedRegistration }
                : {}),
            })),
            seriesId: newId("series"),
          });
          const matchedAt = this.deps.clock.now();
          for (const search of table) {
            search.status = "matched";
            search.roomCode = created.roomCode;
            search.matchedAt = matchedAt;
            search.matchedPlayerName =
              table.find((candidate) => candidate.searchId !== search.searchId)?.playerName ??
              search.playerName;
          }
          for (const search of table) this.pushSearchState(search);
        } catch (error) {
          for (const search of table) search.status = "waiting";
          const message = error instanceof Error ? error.message : "Matchmaking failed.";
          for (const search of table) {
            this.sendError(search.connectionId, "matchmaking_failed", message, {
              searchId: search.searchId,
              retryable: true,
            });
          }
          return;
        }
      }
    } finally {
      this.pairing = false;
    }
  }

  /** Expire old searches; called from the DO alarm. */
  expire(now: number): void {
    for (const search of this.searches) {
      if (search.status === "waiting" && search.expiresAt <= now) {
        search.status = "expired";
        this.pushSearchState(search);
      } else if (
        search.status === "matched" &&
        (search.matchedAt ?? search.createdAt) + RESULT_TTL_MS <= now
      ) {
        search.status = "expired";
      }
    }
    // Keep the serialized state bounded.
    if (this.searches.length > 500) {
      this.searches = this.searches.slice(-500);
    }
  }

  nextAlarmAt(): number | null {
    let next: number | null = null;
    for (const search of this.searches) {
      if (search.status !== "waiting" && search.status !== "matched") continue;
      const at =
        search.status === "waiting"
          ? search.expiresAt
          : (search.matchedAt ?? search.createdAt) + RESULT_TTL_MS;
      if (next === null || at < next) next = at;
    }
    return next;
  }

  async handleHttp(
    action: string,
    body: Record<string, unknown>,
    identity: Identity,
  ): Promise<CoreHttpResult> {
    if (action !== "cancel_exact" && action !== "reset_exact") {
      return {
        status: 400,
        body: {
          ok: false,
          error: "unsupported_action",
          message: "This matchmaking action is not supported.",
        },
      };
    }
    const searchId = typeof body.searchId === "string" ? body.searchId : "";
    if (!SEARCH_ID_PATTERN.test(searchId)) {
      return {
        status: 400,
        body: {
          ok: false,
          error: "invalid_cancel",
          message: "The matchmaking search identifier is malformed.",
        },
      };
    }
    const search = this.searches.find((candidate) => candidate.searchId === searchId);
    if (!search || search.authSubject !== identity.sub) {
      return {
        status: 200,
        body: { ok: true, searchId, status: "expired" },
      };
    }
    if (search.status === "matched") {
      return {
        status: 200,
        body: {
          ok: true,
          searchId,
          status: "matched",
          roomCode: search.roomCode,
          playerId: search.playerId,
          playerName: search.playerName,
          playMode: search.playMode,
          matchmakingPool: search.matchmakingPool,
          matchFormat: search.matchFormat,
        },
      };
    }
    if (search.status === "waiting" || search.status === "paired") {
      search.status = "cancelled";
      this.pushSearchState(search);
      return { status: 200, body: { ok: true, searchId, status: "cancelled" } };
    }
    return { status: 200, body: { ok: true, searchId, status: "expired" } };
  }
}
