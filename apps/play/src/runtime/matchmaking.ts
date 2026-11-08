/**
 * Matchmaking client — websocket search (`party "matchmaking"`) + HTTP cancel/resolve.
 *
 * Ported from `.recon/pretty/playapp/35qz5rkx7yexy.js`:
 *  - queue room `["enam-v2", playMode, playMode === "constructed" ? "all" : pool,
 *    gameVariant !== duel ? "multiplayer" : matchFormat].join("-")` (`st`)
 *  - socket options `minReconnectionDelay 1000, maxReconnectionDelay 3000,
 *    reconnectionDelayGrowFactor 3, minUptime 0, maxRetries 2`; id `matchmaking:<uuid>`;
 *    12s connect timeout and 12s response timeout; liveness probe `{type:"ping", searchId, sentAt}`
 *    with `onDead → reconnect(4009, "Matchmaking liveness probe timed out")`
 *  - client messages `start` / `resolve` with `{searchId, playerName, playMode, decklist?,
 *    sealedRegistration?, matchmakingPool, matchFormat, gameVariant?, extensions?, party?, authToken}`
 *  - server `searching` / `matched` / `expired` / `cancelled` / `pong` / `error`
 *    (+ `party_state`/`party_closed` ignored here) and the `matchmaking_search_conflict` recovery
 *    record persisted under `riftbound_matchmaking_conflict_recovery_v1`
 *  - search bookkeeping persisted under `riftbound_matchmaking_search_continuation_v1` (attempt +
 *    cancellationRequested, 1.3h TTL) so a reload can `resolve`/`cancel` exactly
 */

import type { ConstructedDeckRegistration, GameVariant, MatchFormat, PlayMode } from "@rift/protocol";
import { getAuthToken } from "./auth";
import { realtimeHost } from "./config";
import { matchmakingCancelExact, matchmakingQueueRoom } from "./roomApi";
import { createMatchmakingSocket } from "./socket";
import { createStore, type ExternalStore } from "./store";

export const MATCHMAKING_PARTY = "matchmaking";
export const MATCHMAKING_SEARCH_CONTINUATION_KEY = "riftbound_matchmaking_search_continuation_v1";
export const MATCHMAKING_CONFLICT_RECOVERY_KEY = "riftbound_matchmaking_conflict_recovery_v1";
export const MATCHMAKING_SEARCH_TTL_MS = 4_680_000; // 1.3h (original validity window)
export const MATCHMAKING_WIDEN_AFTER_MS = 90_000;
export const MATCHMAKING_CONNECT_TIMEOUT_MS = 12_000;
export const MATCHMAKING_RESPONSE_TIMEOUT_MS = 12_000;
export const MATCHMAKING_EXTENSIONS = ["pools", "tables"] as const;

const SEARCH_ID_PATTERN = /^[A-Za-z0-9:_-]{8,128}$/;

export function isMatchmakingSearchId(value: unknown): value is string {
  return typeof value === "string" && SEARCH_ID_PATTERN.test(value);
}

/** Original `o4` extension filter. */
export function filterExtensions(value: unknown): Array<"pools" | "tables"> {
  return Array.isArray(value)
    ? MATCHMAKING_EXTENSIONS.filter((extension) => value.includes(extension))
    : [];
}

export interface MatchmakingSearchAttempt {
  searchId: string;
  initiatingUserId: string;
  playerName: string;
  playMode: PlayMode;
  decklist?: string;
  constructedDeckRegistration?: ConstructedDeckRegistration;
  sealedRegistration?: unknown;
  matchmakingPool: string;
  matchFormat: MatchFormat;
  gameVariant?: GameVariant;
  extensions?: Array<"pools" | "tables">;
  party?: { id: string; round: number };
}

export interface MatchmakingSearchResult {
  searchId: string;
  roomCode?: string;
  playerId?: string;
  expiresAt: number;
  widenAt: number;
  searchScope: string;
  playMode: PlayMode;
  matchmakingPool: string;
  matchFormat: MatchFormat;
  gameVariant?: GameVariant;
  extensions?: Array<"pools" | "tables">;
  availableExtensions?: Array<"pools" | "tables">;
  recentOpponentCooldownUntil?: number;
  recentOpponentRetryAfterMs?: number;
  constructedDeckRegistration?: unknown;
  sealedRegistration?: unknown;
  party?: { id: string; round: number };
}

export type MatchmakingStatus =
  | { status: "idle" }
  | { status: "preparing" }
  | { status: "connecting" }
  | { status: "searching"; expiresAt: number; widenAt: number; searchScope: string }
  | { status: "reconnecting"; attempt: number }
  | { status: "cancelling" }
  | { status: "matched"; roomCode: string; playerId: string; playerName: string }
  | { status: "expired"; expiresAt: number }
  | { status: "conflict"; expiresAt: number }
  | { status: "disconnected" };

export interface MatchmakingState {
  status: MatchmakingStatus;
  search: MatchmakingSearchResult | null;
  /** UX error text (localized by the UI layer through i18n keys where available) */
  error: string | null;
  lastError: { code: string; message: string; retryable?: boolean } | null;
}

export const INITIAL_MATCHMAKING_STATE: MatchmakingState = {
  status: { status: "idle" },
  search: null,
  error: null,
  lastError: null,
};

export interface MatchmakingSocketLike {
  readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  reconnect(code?: number, reason?: string): void;
  addEventListener(
    type: "open" | "message" | "close" | "error",
    listener: (event: never) => void,
  ): void;
  removeEventListener(type: string, listener: (event: never) => void): void;
}

export interface MatchmakingClientOptions {
  socketFactory?: (options: { room: string; id: string }) => MatchmakingSocketLike;
  authTokenProvider?: () => Promise<string | null>;
  storage?: Storage | null;
  now?: () => number;
  random?: () => number;
  /** called on `matched` (the lobby navigates to the room) */
  onMatched?: (result: {
    roomCode: string;
    playerId: string;
    playerName: string;
    playMode: PlayMode;
  }) => void;
}

interface ActiveSearchInternals {
  socket: MatchmakingSocketLike | null;
  searchId: string | null;
  attempt: MatchmakingSearchAttempt | null;
  started: boolean;
  resolved: boolean;
  connectTimer: ReturnType<typeof setTimeout> | null;
  responseTimer: ReturnType<typeof setTimeout> | null;
  cooldownTimer: ReturnType<typeof setTimeout> | null;
  disposed: boolean;
}

function uuid(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}:${Math.random().toString(36).slice(2)}`;
}

function safeStorage(provided: Storage | null | undefined): Storage | null {
  if (provided !== undefined) return provided;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export class MatchmakingClient {
  readonly store: ExternalStore<MatchmakingState>;
  private readonly options: MatchmakingClientOptions;
  private readonly now: () => number;
  private readonly internals: ActiveSearchInternals = {
    socket: null,
    searchId: null,
    attempt: null,
    started: false,
    resolved: false,
    connectTimer: null,
    responseTimer: null,
    cooldownTimer: null,
    disposed: false,
  };
  private readonly setState: (updater: (state: MatchmakingState) => MatchmakingState) => void;

  constructor(options: MatchmakingClientOptions = {}) {
    this.options = options;
    this.now = options.now ?? (() => Date.now());
    const store = createStore<MatchmakingState>(INITIAL_MATCHMAKING_STATE);
    this.store = store;
    this.setState = (updater) => store.setSnapshot(updater(store.getSnapshot()));
  }

  /** Persisted search attempt (for reload recovery). */
  readPersistedAttempt(): {
    version: 1;
    createdAt: number;
    cancellationRequested: boolean;
    attempt: MatchmakingSearchAttempt;
  } | null {
    const storage = safeStorage(this.options.storage);
    if (!storage) return null;
    try {
      const raw = storage.getItem(MATCHMAKING_SEARCH_CONTINUATION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as {
        version?: unknown;
        createdAt?: unknown;
        cancellationRequested?: unknown;
        attempt?: unknown;
      };
      if (
        parsed.version !== 1 ||
        typeof parsed.createdAt !== "number" ||
        !Number.isFinite(parsed.createdAt) ||
        parsed.createdAt > this.now() + 60_000 ||
        parsed.createdAt + MATCHMAKING_SEARCH_TTL_MS <= this.now() ||
        typeof parsed.cancellationRequested !== "boolean" ||
        !isValidAttempt(parsed.attempt)
      ) {
        storage.removeItem(MATCHMAKING_SEARCH_CONTINUATION_KEY);
        return null;
      }
      return {
        version: 1,
        createdAt: parsed.createdAt,
        cancellationRequested: parsed.cancellationRequested,
        attempt: parsed.attempt,
      };
    } catch {
      return null;
    }
  }

  persistAttempt(attempt: MatchmakingSearchAttempt, cancellationRequested = false): void {
    const storage = safeStorage(this.options.storage);
    if (!storage || !isValidAttempt(attempt)) return;
    try {
      storage.setItem(
        MATCHMAKING_SEARCH_CONTINUATION_KEY,
        JSON.stringify({
          version: 1,
          createdAt: this.now(),
          cancellationRequested,
          attempt,
        }),
      );
    } catch {
      /* ignore */
    }
  }

  clearPersistedAttempt(): void {
    try {
      safeStorage(this.options.storage)?.removeItem(MATCHMAKING_SEARCH_CONTINUATION_KEY);
    } catch {
      /* ignore */
    }
  }

  /** Persisted conflict recovery (`matchmaking_search_conflict`). */
  readConflictRecovery(): {
    version: 1;
    createdAt: number;
    activeSearchId: string;
    activeSearchExpiresAt: number;
    initiatingUserId: string;
    playMode: PlayMode;
    matchmakingPool: string;
    matchFormat: MatchFormat;
    gameVariant?: GameVariant;
  } | null {
    const storage = safeStorage(this.options.storage);
    if (!storage) return null;
    try {
      const raw = storage.getItem(MATCHMAKING_CONFLICT_RECOVERY_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (
        parsed.version !== 1 ||
        !isMatchmakingSearchId(parsed.activeSearchId) ||
        typeof parsed.activeSearchExpiresAt !== "number" ||
        !Number.isFinite(parsed.activeSearchExpiresAt) ||
        parsed.activeSearchExpiresAt <= 0 ||
        typeof parsed.initiatingUserId !== "string" ||
        !parsed.initiatingUserId.trim()
      ) {
        storage.removeItem(MATCHMAKING_CONFLICT_RECOVERY_KEY);
        return null;
      }
      return parsed as never;
    } catch {
      return null;
    }
  }

  persistConflictRecovery(record: {
    activeSearchId: string;
    activeSearchExpiresAt: number;
    initiatingUserId: string;
    playMode: PlayMode;
    matchmakingPool: string;
    matchFormat: MatchFormat;
    gameVariant?: GameVariant;
  }): void {
    const storage = safeStorage(this.options.storage);
    if (!storage) return;
    try {
      storage.setItem(
        MATCHMAKING_CONFLICT_RECOVERY_KEY,
        JSON.stringify({ version: 1, createdAt: this.now(), ...record }),
      );
    } catch {
      /* ignore */
    }
  }

  clearConflictRecovery(): void {
    try {
      safeStorage(this.options.storage)?.removeItem(MATCHMAKING_CONFLICT_RECOVERY_KEY);
    } catch {
      /* ignore */
    }
  }

  /** `st()` queue room for an attempt. */
  queueRoom(attempt: MatchmakingSearchAttempt): string {
    return matchmakingQueueRoom({
      playMode: attempt.playMode,
      matchmakingPool: attempt.matchmakingPool,
      matchFormat: attempt.matchFormat,
      ...(attempt.gameVariant ? { gameVariant: attempt.gameVariant } : {}),
    });
  }

  /**
   * Start (or resume) a search. `resume: true` sends `resolve` instead of `start` (exact-result
   * poll after a dropped websocket).
   */
  async search(
    attempt: MatchmakingSearchAttempt,
    options: { resume?: boolean } = {},
  ): Promise<void> {
    const internals = this.internals;
    if (internals.disposed) return;
    this.stop();
    this.persistAttempt(attempt, false);
    internals.attempt = attempt;
    internals.searchId = attempt.searchId;
    internals.started = false;
    internals.resolved = Boolean(options.resume);
    this.setState(() => ({
      status: { status: "preparing" },
      search: null,
      error: null,
      lastError: null,
    }));

    const socketFactory =
      this.options.socketFactory ??
      ((opts: { room: string; id: string }) =>
        createMatchmakingSocket({
          host: realtimeHost(),
          room: opts.room,
          id: opts.id,
        }) as unknown as MatchmakingSocketLike);
    let socket: MatchmakingSocketLike;
    try {
      socket = socketFactory({
        room: this.queueRoom(attempt),
        id: `matchmaking:${uuid()}`,
      });
    } catch (error) {
      this.setState((state) => ({
        ...state,
        status: { status: "disconnected" },
        error: error instanceof Error ? error.message : "Could not connect to matchmaking.",
      }));
      return;
    }
    internals.socket = socket;
    this.setState((state) => ({ ...state, status: { status: "connecting" } }));

    internals.connectTimer = setTimeout(() => {
      if (internals.disposed || internals.socket !== socket || internals.started) return;
      this.setState((state) => ({
        ...state,
        status: { status: "disconnected" },
        error: "Could not connect to matchmaking. Try again.",
      }));
      this.stop({ clearAttempt: false });
    }, MATCHMAKING_CONNECT_TIMEOUT_MS);

    socket.addEventListener("open", () => {
      if (internals.disposed || internals.socket !== socket) {
        socket.close();
        return;
      }
      this.clearTimer("connect");
      void this.sendMessage(options.resume ? "resolve" : "start");
    });
    socket.addEventListener("message", (event: unknown) => {
      const data = (event as { data?: unknown }).data;
      if (typeof data !== "string") return;
      let message: { type?: unknown; [k: string]: unknown };
      try {
        message = JSON.parse(data) as { type?: unknown };
      } catch {
        return;
      }
      if (!message || typeof message.type !== "string") return;
      if (message.type === "party_state" || message.type === "party_closed") return;
      if (internals.disposed || internals.socket !== socket) return;
      if (
        internals.searchId &&
        typeof message.searchId === "string" &&
        message.searchId !== internals.searchId
      )
        return;
      this.clearTimer("response");
      if (message.type === "pong") return;
      this.handleMessage({ ...message, type: message.type });
    });
    socket.addEventListener("error", () => {
      if (internals.socket !== socket) return;
      this.setState((state) => ({ ...state, status: { status: "disconnected" } }));
    });
    socket.addEventListener("close", () => {
      if (internals.socket !== socket) return;
      const current = this.store.getSnapshot().status.status;
      if (current === "matched" || current === "expired" || current === "cancelling") return;
      this.setState((state) => ({ ...state, status: { status: "disconnected" } }));
    });
  }

  private async sendMessage(type: "start" | "resolve" | "ping"): Promise<void> {
    const internals = this.internals;
    const socket = internals.socket;
    const attempt = internals.attempt;
    if (!socket || !attempt || socket.readyState !== 1) return;
    const provider = this.options.authTokenProvider ?? getAuthToken;
    let token: string | null;
    try {
      token = await provider();
    } catch {
      this.setState((state) => ({
        ...state,
        status: { status: "disconnected" },
        error:
          "Could not verify your sign-in session. Check your connection (or ad blocker) and try again.",
      }));
      this.stop({ clearAttempt: false });
      return;
    }
    if (!token || internals.socket !== socket || internals.disposed) return;
    const payload =
      type === "ping"
        ? { type, searchId: attempt.searchId, sentAt: this.now() }
        : {
            type,
            searchId: attempt.searchId,
            playerName: attempt.playerName,
            playMode: attempt.playMode,
            ...(attempt.decklist ? { decklist: attempt.decklist } : {}),
            ...(attempt.sealedRegistration
              ? { sealedRegistration: attempt.sealedRegistration }
              : {}),
            matchmakingPool: attempt.matchmakingPool,
            matchFormat: attempt.matchFormat,
            ...(attempt.gameVariant && attempt.gameVariant !== "duel"
              ? { gameVariant: attempt.gameVariant }
              : {}),
            ...(attempt.extensions && attempt.extensions.length > 0
              ? { extensions: attempt.extensions }
              : {}),
            ...(attempt.party ? { party: attempt.party } : {}),
            authToken: token,
          };
    try {
      socket.send(JSON.stringify(payload));
    } catch {
      this.setState((state) => ({ ...state, status: { status: "disconnected" } }));
      return;
    }
    if (type !== "ping") {
      internals.started = true;
      this.armResponseTimer();
    }
  }

  private armResponseTimer(): void {
    const internals = this.internals;
    this.clearTimer("response");
    const socket = internals.socket;
    internals.responseTimer = setTimeout(() => {
      if (internals.disposed || internals.socket !== socket) return;
      if (this.store.getSnapshot().status.status === "matched") return;
      this.setState((state) => ({
        ...state,
        status: { status: "disconnected" },
        error: "The room service is taking too long to respond. Try again.",
      }));
      this.stop({ clearAttempt: false });
    }, MATCHMAKING_RESPONSE_TIMEOUT_MS);
  }

  private handleMessage(message: { type: string; [k: string]: unknown }): void {
    const internals = this.internals;
    const attempt = internals.attempt;
    if (!attempt) return;
    switch (message.type) {
      case "searching": {
        internals.started = true;
        this.clearTimer("connect");
        const extensions = filterExtensions([
          ...(attempt.extensions ?? []),
          ...filterExtensions(message.extensions),
        ]);
        const availableExtensions = filterExtensions(message.availableExtensions).filter(
          (extension) => !extensions.includes(extension),
        );
        const cooldownUntil =
          typeof message.recentOpponentCooldownUntil === "number" &&
          Number.isFinite(message.recentOpponentCooldownUntil)
            ? message.recentOpponentCooldownUntil
            : undefined;
        const retryAfterMs =
          typeof message.recentOpponentRetryAfterMs === "number" &&
          Number.isFinite(message.recentOpponentRetryAfterMs) &&
          message.recentOpponentRetryAfterMs >= 0
            ? message.recentOpponentRetryAfterMs
            : cooldownUntil !== undefined
              ? Math.max(0, cooldownUntil - this.now())
              : undefined;
        const search: MatchmakingSearchResult = {
          searchId: typeof message.searchId === "string" ? message.searchId : attempt.searchId,
          ...(typeof message.roomCode === "string" ? { roomCode: message.roomCode } : {}),
          ...(typeof message.playerId === "string" ? { playerId: message.playerId } : {}),
          expiresAt: Number(message.expiresAt ?? 0),
          widenAt: Number(message.widenAt ?? 0),
          searchScope: String(message.searchScope ?? "specific"),
          playMode: (message.playMode as PlayMode | undefined) ?? attempt.playMode,
          matchmakingPool: String(message.matchmakingPool ?? attempt.matchmakingPool),
          matchFormat: (message.matchFormat as MatchFormat | undefined) ?? attempt.matchFormat,
          ...(typeof message.gameVariant === "string"
            ? { gameVariant: message.gameVariant as GameVariant }
            : attempt.gameVariant
              ? { gameVariant: attempt.gameVariant }
              : {}),
          ...(extensions.length > 0 ? { extensions } : {}),
          ...(availableExtensions.length > 0 ? { availableExtensions } : {}),
          ...(attempt.party ? { party: attempt.party } : {}),
          ...(attempt.constructedDeckRegistration
            ? { constructedDeckRegistration: attempt.constructedDeckRegistration }
            : {}),
          ...(attempt.sealedRegistration ? { sealedRegistration: attempt.sealedRegistration } : {}),
          ...(cooldownUntil !== undefined ? { recentOpponentCooldownUntil: cooldownUntil } : {}),
        };
        this.setState((state) => ({
          ...state,
          search,
          error: null,
          status: {
            status: "searching",
            expiresAt: search.expiresAt,
            widenAt: search.widenAt,
            searchScope: search.searchScope,
          },
        }));
        // resume → once `searching` confirms the search, send `start` (original `eO.sendStart`)
        if (internals.resolved) {
          internals.resolved = false;
          void this.sendMessage("start");
        }
        if (retryAfterMs !== undefined && retryAfterMs > 0) {
          this.clearTimer("cooldown");
          const currentSocket = internals.socket;
          internals.cooldownTimer = setTimeout(() => {
            if (internals.disposed || internals.socket !== currentSocket) return;
            void this.sendMessage("start");
          }, retryAfterMs);
        }
        return;
      }
      case "matched": {
        this.clearTimer("connect");
        this.clearPersistedAttempt();
        const roomCode = String(message.roomCode ?? "");
        const playerId = String(message.playerId ?? "");
        const playerName = String(message.playerName ?? attempt.playerName);
        const playMode = (message.playMode as PlayMode | undefined) ?? attempt.playMode;
        this.setState((state) => ({
          ...state,
          error: null,
          status: { status: "matched", roomCode, playerId, playerName },
        }));
        this.stop({ clearAttempt: true, keepStatus: true });
        this.options.onMatched?.({ roomCode, playerId, playerName, playMode });
        return;
      }
      case "expired": {
        this.clearPersistedAttempt();
        this.setState((state) => ({
          ...state,
          error: "Match search timed out. Try again.",
          status: { status: "expired", expiresAt: Number(message.expiresAt ?? 0) },
        }));
        this.stop({ clearAttempt: true, keepStatus: true });
        return;
      }
      case "cancelled": {
        this.clearPersistedAttempt();
        this.setState(() => ({
          status: { status: "idle" },
          search: null,
          error: null,
          lastError: null,
        }));
        this.stop({ clearAttempt: true, keepStatus: true });
        return;
      }
      case "error": {
        const code = String(message.code ?? "");
        this.setState((state) => ({
          ...state,
          lastError: {
            code,
            message: String(message.message ?? ""),
            ...(typeof message.retryable === "boolean" ? { retryable: message.retryable } : {}),
          },
        }));
        if (code === "matchmaking_search_conflict") {
          const record = {
            activeSearchId: String(message.activeSearchId ?? ""),
            activeSearchExpiresAt: Number(message.activeSearchExpiresAt ?? 0),
            initiatingUserId: attempt.initiatingUserId,
            playMode: attempt.playMode,
            matchmakingPool: attempt.matchmakingPool,
            matchFormat: attempt.matchFormat,
            ...(attempt.gameVariant ? { gameVariant: attempt.gameVariant } : {}),
          };
          if (isMatchmakingSearchId(record.activeSearchId) && record.activeSearchExpiresAt > 0) {
            this.persistConflictRecovery(record);
            this.setState((state) => ({
              ...state,
              status: { status: "conflict", expiresAt: record.activeSearchExpiresAt },
              error:
                String(message.message ?? "") ||
                "Cancel the earlier match search before starting another search.",
            }));
            this.stop({ clearAttempt: true, keepStatus: true });
            return;
          }
        }
        const terminal =
          code === "matchmaking_assignment_expired" ||
          code === "matchmaking_search_expired" ||
          code === "invalid_auth_token" ||
          code === "authentication_required" ||
          code === "authentication_service_unavailable" ||
          code === "matchmaking_failed" ||
          code === "matchmaking_result_uncertain";
        if (terminal) {
          this.clearPersistedAttempt();
          this.setState((state) => ({
            ...state,
            status: { status: "disconnected" },
            error: String(message.message ?? "Matchmaking failed."),
          }));
          this.stop({ clearAttempt: true, keepStatus: true });
          return;
        }
        this.setState((state) => ({
          ...state,
          status: { status: "disconnected" },
          error: String(message.message ?? "Matchmaking failed."),
        }));
        this.stop({ clearAttempt: false, keepStatus: true });
        return;
      }
      default:
        return;
    }
  }

  /**
   * Cancel the active search. The protocol has no websocket cancel message — cancellation is the
   * HTTP `cancel_exact` call (or `reset_exact` when leaving a matched room), which also acts as the
   * exact-result poll after a dropped socket (`35qz5rkx7yexy.js:21990`).
   */
  async cancel(options: { leaveMatchedRoom?: boolean } = {}): Promise<void> {
    const internals = this.internals;
    const attempt = internals.attempt ?? this.readPersistedAttempt()?.attempt ?? null;
    if (!attempt) return;
    this.setState((state) => ({ ...state, status: { status: "cancelling" } }));
    try {
      const token = await (this.options.authTokenProvider ?? getAuthToken)();
      if (!token) throw new Error("authentication_required");
      const result = await matchmakingCancelExact({
        queueRoom: this.queueRoom(attempt),
        searchId: attempt.searchId,
        authToken: token,
        ...(options.leaveMatchedRoom ? { leaveMatchedRoom: true } : {}),
      });
      if (options.leaveMatchedRoom) this.stop({ clearAttempt: true, keepStatus: true });
      if (result.status === "matched" && result.roomCode && result.playerId) {
        this.setState((state) => ({
          ...state,
          status: {
            status: "matched",
            roomCode: result.roomCode as string,
            playerId: result.playerId as string,
            playerName: result.playerName ?? attempt.playerName,
          },
        }));
        this.options.onMatched?.({
          roomCode: result.roomCode,
          playerId: result.playerId,
          playerName: result.playerName ?? attempt.playerName,
          playMode: result.playMode ?? attempt.playMode,
        });
      } else {
        this.clearPersistedAttempt();
        this.setState(() => ({
          status: { status: "idle" },
          search: null,
          error: null,
          lastError: null,
        }));
      }
    } catch (error) {
      this.setState((state) => ({
        ...state,
        status: { status: "disconnected" },
        error: error instanceof Error ? error.message : "Could not cancel the match search.",
      }));
    }
  }

  stop(options: { clearAttempt?: boolean; keepStatus?: boolean } = {}): void {
    const internals = this.internals;
    this.clearTimer("connect");
    this.clearTimer("response");
    this.clearTimer("cooldown");
    if (internals.socket) {
      const socket = internals.socket;
      internals.socket = null;
      try {
        socket.close();
      } catch {
        /* ignore */
      }
    }
    if (options.clearAttempt !== false) {
      internals.attempt = null;
      internals.searchId = null;
      internals.started = false;
      if (!options.keepStatus) {
        this.setState(() => INITIAL_MATCHMAKING_STATE);
      }
    }
  }

  dispose(): void {
    this.internals.disposed = true;
    this.stop({ clearAttempt: false });
  }

  private clearTimer(kind: "connect" | "response" | "cooldown"): void {
    const internals = this.internals;
    const key =
      kind === "connect" ? "connectTimer" : kind === "response" ? "responseTimer" : "cooldownTimer";
    const timer = internals[key];
    if (timer !== null) clearTimeout(timer);
    internals[key] = null;
  }
}

function isValidAttempt(value: unknown): value is MatchmakingSearchAttempt {
  if (!value || typeof value !== "object") return false;
  const attempt = value as Record<string, unknown>;
  return (
    isMatchmakingSearchId(attempt.searchId) &&
    typeof attempt.initiatingUserId === "string" &&
    attempt.initiatingUserId.trim().length > 0 &&
    typeof attempt.playerName === "string" &&
    attempt.playerName.trim().length > 0 &&
    (attempt.playMode === "constructed" || attempt.playMode === "sealed") &&
    typeof attempt.matchmakingPool === "string" &&
    (attempt.matchFormat === "bo1" || attempt.matchFormat === "bo3")
  );
}
