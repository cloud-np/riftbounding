/**
 * Match room core — authoritative room + gameplay state machine, independent of workerd.
 *
 * The partyserver `Match` Durable Object is a thin adapter around this class (see `../parties.ts`):
 * it supplies a transport (send/close), an injected clock, JWT verification and persistence.
 *
 * Wire behaviour mirrors the original PartyKit room:
 *  - HTTP actions: join_room / switch_to_spectator / take_seat / resolve_room_membership /
 *    create_next_game / room_series_action / leave_room / abandon_match / claim_disconnect_win /
 *    return_to_lobby.
 *  - websocket frames: join_shell / join_game / resume_game / auth_refresh / ping / presence_update /
 *    room_shell_action / action_intent / chat_send / spectator_view_grant_update / …
 *  - authoritative state: `authoritative_snapshot`, `authoritative_patch_commit` (per-viewer
 *    redacted diffs), `authoritative_resume_ack`, `gameplay_action_noop_ack`, shell sync/acks.
 */

import type {
  AuthFailureReason,
  CardInstance,
  ChainEntry,
  DeckSections,
  EngineTimeline,
  GameplayLogEntry,
  MatchFormat,
  ParsedDeck,
  PlayMode,
  Room,
  RoomMode,
  RoomPhase,
  RoomPlayer,
  RawActionClock,
  RoomSessionDoc,
  RewindConfirmation,
  Spectator,
  ViewerRole,
} from "@rift/protocol";
import {
  CLOSE_CODE_CONTROL_SUPERSEDED,
  diffRuntimeState,
  isRecord,
  redactRuntimeStateForViewer,
  runeMultisetsPreserved,
  snapshotForViewer,
  type SnapshotViewer,
} from "@rift/sync";
import { parseDecklist } from "../decklist";
import { sanitizePlayerName } from "../auth";
import { applyGameAction, createInitialGameState } from "../engine-adapter";
import type { EngineSetupConfig } from "../engine-types";
import { BOT_ACTION_CAP, botMayAct, botPlayerIds, nextBotIntent } from "./bot-driver";
import { generateRoomCode, newId, normalizeRoomCode } from "./ids";
import type {
  CoreClock,
  CoreHttpResult,
  CoreTransport,
  Identity,
  MatchRoomSeed,
  VerifyToken,
} from "./types";

export interface ChatEntry {
  id: string;
  at: number;
  authorId: string;
  authorName?: string;
  text: string;
  clientEntryId?: string;
  judgeCallId?: string;
}

export interface JudgeCallRecord {
  id: string;
  clientRequestId: string;
  requestedAt: number;
  requestedByPlayerId: string;
  requestedByPlayerName: string;
  question: string;
  visibility: "public" | "private";
  status: "open" | "answered" | "closed" | "expired";
  delivery: "pending" | "posted" | "unavailable" | "failed";
  answer: null;
  closedAt?: number;
}

export type SessionDoc = RoomSessionDoc & {
  viewer?: { role: ViewerRole; playerId: string | null };
  [key: string]: unknown;
};

interface ConnectionState {
  id: string;
  queryPlayerId?: string | null;
  queryRoomCode?: string | null;
  authSubject?: string | null;
  playerId?: string | null;
  viewerRole: ViewerRole;
  displayName?: string | null;
  spectatorName?: string | null;
  broadcastView?: boolean;
  joinedShell: boolean;
  joinedGame: boolean;
}

export interface MatchRoomDeps {
  transport: CoreTransport;
  clock: CoreClock;
  verifyToken: VerifyToken;
  persist?: () => void | Promise<void>;
  /**
   * Allocate a fresh linked room through the coordinator (original `nextRoomCode` /
   * `lobbyRoomCode` semantics). The seed carries the moved players (ids, identities, decks) plus
   * the series fields. Tests inject a fake allocator; the Match Durable Object calls the real
   * coordinator.
   */
  createLinkedRoom?: (seed: MatchRoomSeed) => Promise<{ roomCode: string }>;
}

export interface MatchRoomSerialized {
  version: 1;
  seed: MatchRoomSeed;
  room: Room;
  /**
   * Server-only rewind v5 history. It is serialized with the room because Durable Objects can
   * be evicted at any time; it is never part of `Room` and therefore never reaches clients.
   */
  timeline?: EngineTimeline;
  actionClock?: RawActionClock | null;
  sessionDoc: SessionDoc;
  sessionSequence: number;
  sequence: number;
  gameplayLog: GameplayLogEntry[];
  spectators: Spectator[];
  chatEntries: ChatEntry[];
  judgeCalls: JudgeCallRecord[];
  recentActionIds: string[];
  globalGrantedPlayerIds: string[];
  authSubjectByPlayerId: Record<string, string>;
  controlledByAuthSubject: Record<string, string[]>;
}

type CoreHttpResultAlias = CoreHttpResult;

/** BO3 result/rematch actions are room-shell actions in the original protocol. */
const SERIES_ROOM_ACTIONS = new Set([
  "request_game_result_confirmation",
  "cancel_game_result_confirmation",
  "report_game_result",
  "request_bo3_rematch",
]);

function httpError(
  status: number,
  error: string,
  message: string,
  extra: Record<string, unknown> = {},
): CoreHttpResultAlias {
  return { status, body: { ok: false, error, message, ...extra } };
}

function httpOk(body: Record<string, unknown> = {}): CoreHttpResultAlias {
  return { status: 200, body: { ok: true, ...body } };
}

function phaseIsActive(phase: RoomPhase): boolean {
  return (
    phase === "sideboarding" ||
    phase === "battlefield_pick" ||
    phase === "initiative_roll" ||
    phase === "first_player_choice" ||
    phase === "mulligan" ||
    phase === "in_game"
  );
}

function maxSeatsForVariant(variant: MatchRoomSeed["gameVariant"]): number {
  if (variant === "free_for_all_3") return 3;
  if (variant === "free_for_all_4" || variant === "teams_2v2") return 4;
  return 2;
}

function deckForPlayer(player: RoomPlayer): ParsedDeck | null {
  const submitted = player.submittedDeck as ParsedDeck | undefined;
  if (submitted && Array.isArray(submitted.sections?.mainDeck)) return submitted;
  const registered = player.registeredDeck as ParsedDeck | undefined;
  if (registered && Array.isArray(registered.sections?.mainDeck)) return registered;
  const deck = player.deck as ParsedDeck | undefined;
  if (deck && Array.isArray(deck.sections?.mainDeck)) return deck;
  if (typeof player.decklistRaw === "string" && player.decklistRaw.trim().length > 0) {
    return parseDecklist(player.decklistRaw);
  }
  return null;
}

export class MatchRoomCore {
  readonly roomCode: string;
  readonly gameInstanceId: string;
  private readonly seed: MatchRoomSeed;
  private readonly deps: MatchRoomDeps;

  room: Room;
  sessionDoc: SessionDoc;
  /** Serializable rewind v5 timeline (server-only; never sent to clients). */
  timeline: EngineTimeline = { version: 1, entries: [], cursor: 0 };
  sessionSequence = 0;
  sequence = 0;
  gameplayLog: GameplayLogEntry[] = [];
  actionClockRaw: RawActionClock | null = null;
  spectators: Spectator[] = [];
  chatEntries: ChatEntry[] = [];
  judgeCalls: JudgeCallRecord[] = [];
  recentActionIds: string[] = [];
  globalGrantedPlayerIds: string[] = [];
  authSubjectByPlayerId: Record<string, string> = {};
  controlledByAuthSubject: Record<string, string[]> = {};

  private connections = new Map<string, ConnectionState>();

  private constructor(seed: MatchRoomSeed, deps: MatchRoomDeps) {
    this.seed = seed;
    this.deps = deps;
    this.roomCode = seed.roomCode.trim().toUpperCase();
    this.gameInstanceId = this.roomCode;
    this.sessionDoc = this.buildSessionDoc(seed);
    this.room = this.buildLobbyRoom(seed);
    for (const player of seed.players) {
      if (player.authSubject) this.authSubjectByPlayerId[player.playerId] = player.authSubject;
      if (player.controlledPlayerIds && player.authSubject) {
        this.controlledByAuthSubject[player.authSubject] = [...player.controlledPlayerIds];
      }
      if (player.seatReady) this.sessionDoc.lobbyReadyPlayerIds?.push(player.playerId);
    }
  }

  static async create(seed: MatchRoomSeed, deps: MatchRoomDeps): Promise<MatchRoomCore> {
    const core = new MatchRoomCore(seed, deps);
    if (seed.autoStart) await core.initializeGame();
    return core;
  }

  static fromSerialized(data: MatchRoomSerialized, deps: MatchRoomDeps): MatchRoomCore {
    const core = new MatchRoomCore(data.seed, deps);
    core.room = data.room;
    core.timeline = data.timeline ?? { version: 1, entries: [], cursor: 0 };
    core.sessionDoc = data.sessionDoc;
    core.sessionSequence = data.sessionSequence;
    core.sequence = data.sequence;
    core.gameplayLog = data.gameplayLog ?? [];
    core.actionClockRaw = data.actionClock ?? null;
    core.spectators = data.spectators ?? [];
    core.chatEntries = data.chatEntries ?? [];
    core.judgeCalls = data.judgeCalls ?? [];
    core.recentActionIds = data.recentActionIds ?? [];
    core.globalGrantedPlayerIds = data.globalGrantedPlayerIds ?? [];
    core.authSubjectByPlayerId = data.authSubjectByPlayerId ?? {};
    core.controlledByAuthSubject = data.controlledByAuthSubject ?? {};
    return core;
  }

  toSerialized(): MatchRoomSerialized {
    return {
      version: 1,
      seed: this.seed,
      room: this.room,
      timeline: this.timeline,
      sessionDoc: this.sessionDoc,
      sessionSequence: this.sessionSequence,
      sequence: this.sequence,
      gameplayLog: this.gameplayLog,
      actionClock: this.actionClockRaw,
      spectators: this.spectators,
      chatEntries: this.chatEntries,
      judgeCalls: this.judgeCalls,
      recentActionIds: this.recentActionIds,
      globalGrantedPlayerIds: this.globalGrantedPlayerIds,
      authSubjectByPlayerId: this.authSubjectByPlayerId,
      controlledByAuthSubject: this.controlledByAuthSubject,
    };
  }

  /**
   * Persistent room state without the rewind timeline. The Durable Object keeps timeline entries in
   * their own storage keys (`TimelinePersistence`), so this value stays small and cannot exceed the
   * per-value limit as a game gets longer.
   */
  toPersistedState(): MatchRoomSerialized {
    const state = this.toSerialized();
    delete state.timeline;
    return state;
  }

  /** Restore the timeline loaded from its own Durable Object keys (or legacy room state). */
  setTimeline(timeline: EngineTimeline): void {
    this.timeline = timeline;
  }

  /* ------------------------------------------------------------------ construction */

  private buildSessionDoc(seed: MatchRoomSeed): SessionDoc {
    const players: RoomPlayer[] = seed.players
      .slice()
      .sort((a, b) => a.seat - b.seat)
      .map((seat) => {
        const parsed = seat.decklist?.trim() ? parseDecklist(seat.decklist) : null;
        return {
          id: seat.playerId,
          seat: seat.seat,
          name: seat.name,
          joinedAt: seed.createdAt,
          ...(seat.decklist ? { decklistRaw: seat.decklist } : {}),
          ...(isRecord(seat.constructedDeckRegistration)
            ? {
                constructedDeckRegistration:
                  seat.constructedDeckRegistration as unknown as RoomPlayer["constructedDeckRegistration"],
              }
            : {}),
          ...(parsed ? { deck: parsed, submittedDeck: parsed } : {}),
          ...(seat.sealedRegistration ? { sealedRegistration: seat.sealedRegistration } : {}),
          ...(seat.isSoloOpponent ? { isSoloOpponent: true } : {}),
          ...(seat.isBot ? { isBot: true } : {}),
        } as RoomPlayer;
      });
    return {
      roomCode: this.roomCode,
      createdAt: seed.createdAt,
      phase: "lobby",
      roomMode: seed.roomMode,
      gameVariant: seed.gameVariant,
      ...(seed.teamIdByPlayerId ? { teamIdByPlayerId: { ...seed.teamIdByPlayerId } } : {}),
      playMode: seed.playMode,
      deckRulesMode: seed.deckRulesMode,
      ...(seed.rulesMode === "strict" ? { rulesMode: "strict" as const } : {}),
      matchFormat: seed.matchFormat,
      setupOrderVersion: 2,
      seriesId: seed.seriesId ?? seed.operationId ?? this.roomCode,
      seriesStartedAt: seed.seriesStartedAt ?? seed.createdAt,
      gameNumber: seed.gameNumber ?? 1,
      winsByPlayerId: seed.winsByPlayerId ?? {},
      ...(seed.usedBattlefieldsByPlayerId
        ? { usedBattlefieldsByPlayerId: { ...seed.usedBattlefieldsByPlayerId } }
        : {}),
      bo3CompletedGames: 0,
      lobbyReadyPlayerIds: [],
      lifecycleRevision: 1,
      ...(seed.previousRoomCode ? { previousRoomCode: seed.previousRoomCode } : {}),
      ...(seed.nextRoomCode ? { nextRoomCode: seed.nextRoomCode } : {}),
      ...(seed.returnLobbyRoomCode ? { returnLobbyRoomCode: seed.returnLobbyRoomCode } : {}),
      ...(seed.testMode ? { testMode: true } : {}),
      players,
      log: [],
    } as SessionDoc;
  }

  private buildLobbyRoom(seed: MatchRoomSeed): Room {
    const players: RoomPlayer[] = seed.players
      .slice()
      .sort((a, b) => a.seat - b.seat)
      .map((seat) => ({
        id: seat.playerId,
        seat: seat.seat,
        name: seat.name,
        joinedAt: seed.createdAt,
        ...(seat.isBot ? { isBot: true } : {}),
      }));
    return {
      roomCode: this.roomCode,
      createdAt: seed.createdAt,
      updatedAt: seed.createdAt,
      phase: "lobby",
      gameVariant: seed.gameVariant,
      roomMode: seed.roomMode,
      ...(seed.teamIdByPlayerId ? { teamIdByPlayerId: { ...seed.teamIdByPlayerId } } : {}),
      playMode: seed.playMode,
      deckRulesMode: seed.deckRulesMode,
      ...(seed.rulesMode === "strict" ? { rulesMode: "strict" as const } : {}),
      matchFormat: seed.matchFormat,
      gameNumber: seed.gameNumber ?? 1,
      winsByPlayerId: seed.winsByPlayerId ?? {},
      players,
      log: [],
      chainEntries: [],
      chainResolveVotes: [],
    };
  }

  get phase(): RoomPhase {
    return this.sessionDoc.phase;
  }

  get roomMode(): RoomMode {
    return this.seed.roomMode;
  }

  /* ------------------------------------------------------------------ transport helpers */

  private send(connectionId: string, message: Record<string, unknown>): void {
    this.deps.transport.send(connectionId, message);
  }

  private sendError(
    connectionId: string,
    code: string,
    message: string,
    extra: Record<string, unknown> = {},
  ): void {
    this.send(connectionId, {
      type: "error",
      gameInstanceId: this.gameInstanceId,
      code,
      message,
      ...extra,
    });
  }

  private sendAuthError(connectionId: string, reason: AuthFailureReason): void {
    const recovery =
      reason === "expired_token" || reason === "token_not_active"
        ? "refresh_token"
        : reason === "not_configured" ||
            reason === "verification_failed" ||
            reason === "unknown_key" ||
            reason === "token_provider_unavailable" ||
            reason === "token_provider_timeout"
          ? "retry_verification"
          : "reauthenticate";
    this.sendError(
      connectionId,
      "auth_token_rejected",
      "Your session token could not be verified.",
      {
        authReason: reason,
        authRecovery: recovery,
        retryable: recovery !== "reauthenticate",
      },
    );
  }

  private connectionsForRoom(): ConnectionState[] {
    return [...this.connections.values()].filter(
      (connection) => connection.joinedShell || connection.joinedGame,
    );
  }

  connectedPlayerIds(): string[] {
    const ids = new Set<string>();
    for (const connection of this.connections.values()) {
      if (
        connection.viewerRole === "player" &&
        connection.playerId &&
        (connection.joinedShell || connection.joinedGame)
      ) {
        ids.add(connection.playerId);
      }
    }
    return [...ids].sort();
  }

  private playerHasConnection(playerId: string): boolean {
    for (const connection of this.connections.values()) {
      if (connection.playerId === playerId && connection.viewerRole === "player") return true;
    }
    return false;
  }

  private controlledIdsFor(connection: ConnectionState): string[] {
    if (connection.authSubject) {
      const controlled = this.controlledByAuthSubject[connection.authSubject];
      if (controlled && controlled.length > 0) return controlled;
    }
    return connection.playerId ? [connection.playerId] : [];
  }

  private authorizeActor(
    connection: ConnectionState,
    actorPlayerId?: string | null,
  ): string | null {
    const requested = actorPlayerId?.trim() || connection.playerId || "";
    if (!requested) return null;
    if (this.controlledIdsFor(connection).includes(requested)) return requested;
    if (connection.playerId === requested) return requested;
    return null;
  }

  private spectatorsForRoom(): Spectator[] {
    return this.spectators
      .slice()
      .sort((a, b) => a.joinedAt - b.joinedAt || a.authSubject.localeCompare(b.authSubject));
  }

  private spectatorForSubject(authSubject: string): Spectator | undefined {
    return this.spectators.find((spectator) => spectator.authSubject === authSubject);
  }

  private upsertSpectator(identity: Identity, displayName: string): Spectator {
    const now = this.deps.clock.now();
    let spectator = this.spectatorForSubject(identity.sub);
    if (spectator) {
      spectator.displayName = displayName;
      spectator.updatedAt = now;
      for (const playerId of this.globalGrantedPlayerIds) {
        if (!spectator.grantedPrivatePlayerIds.includes(playerId)) {
          spectator.grantedPrivatePlayerIds.push(playerId);
        }
      }
      return spectator;
    }
    spectator = {
      authSubject: identity.sub,
      displayName,
      joinedAt: now,
      updatedAt: now,
      grantedPrivatePlayerIds: [...this.globalGrantedPlayerIds],
    };
    this.spectators.push(spectator);
    return spectator;
  }

  private viewerFor(connection: ConnectionState): SnapshotViewer {
    if (connection.viewerRole === "spectator" || connection.broadcastView) {
      const spectator = connection.authSubject
        ? this.spectatorForSubject(connection.authSubject)
        : undefined;
      return {
        playerId: null,
        viewerRole: "spectator",
        grantedPrivatePlayerIds: spectator?.grantedPrivatePlayerIds ?? this.globalGrantedPlayerIds,
        spectatorAuthSubject: connection.authSubject ?? null,
        broadcastView: connection.broadcastView,
      };
    }
    return {
      playerId: connection.playerId ?? null,
      viewerRole: "player",
      controlledPlayerIds: this.controlledIdsFor(connection),
    };
  }

  /* ------------------------------------------------------------------ session/shell sync */

  /**
   * Project room-shell/series metadata onto the authoritative `Room`.
   *
   * The original client derives a room from the session doc and then merges the live room on top,
   * re-applying the shell fields (`35qz5rkx7yexy.js:26880-27230`, 27160-27200):
   * `pendingGameResult`, `rematchRequestedPlayerIds`, `nextRoomCode`, `returnLobbyRoomCode`,
   * `previousRoomCode`, `manualStartRequired`, `lobbyReadyPlayerIds`, `seriesId` and — because the
   * shell doc is authoritative for series scoring — `winsByPlayerId` + `matchTermination`.
   *
   * Everything here is room-visible metadata (no hidden card info), so projecting it before
   * per-viewer redaction keeps snapshots and patches redaction-safe.
   */
  private projectedRoom(room: Room): Room {
    const projected: Room = { ...room };
    const wins = this.sessionDoc.winsByPlayerId;
    if (wins) projected.winsByPlayerId = { ...wins };
    if (this.sessionDoc.pendingGameResult) {
      projected.pendingGameResult = {
        ...this.sessionDoc.pendingGameResult,
        winnerByReporterPlayerId: {
          ...this.sessionDoc.pendingGameResult.winnerByReporterPlayerId,
        },
      };
    } else {
      delete projected.pendingGameResult;
    }
    if (this.sessionDoc.rematchRequestedPlayerIds) {
      projected.rematchRequestedPlayerIds = [...this.sessionDoc.rematchRequestedPlayerIds];
    } else {
      delete projected.rematchRequestedPlayerIds;
    }
    if (this.sessionDoc.matchTermination) {
      projected.matchTermination = {
        ...this.sessionDoc.matchTermination,
        ...(this.sessionDoc.matchTermination.winnerPlayerIds
          ? { winnerPlayerIds: [...this.sessionDoc.matchTermination.winnerPlayerIds] }
          : {}),
      };
    } else {
      delete projected.matchTermination;
    }
    if (this.sessionDoc.nextRoomCode) projected.nextRoomCode = this.sessionDoc.nextRoomCode;
    else delete projected.nextRoomCode;
    if (this.sessionDoc.returnLobbyRoomCode) {
      projected.returnLobbyRoomCode = this.sessionDoc.returnLobbyRoomCode;
    } else {
      delete projected.returnLobbyRoomCode;
    }
    if (this.sessionDoc.previousRoomCode) {
      projected.previousRoomCode = this.sessionDoc.previousRoomCode;
    } else {
      delete projected.previousRoomCode;
    }
    if (this.sessionDoc.seriesId) projected.seriesId = this.sessionDoc.seriesId;
    if (this.sessionDoc.manualStartRequired !== undefined) {
      projected.manualStartRequired = this.sessionDoc.manualStartRequired;
    }
    if (this.sessionDoc.lobbyReadyPlayerIds) {
      projected.lobbyReadyPlayerIds = [...this.sessionDoc.lobbyReadyPlayerIds];
    }
    return projected;
  }

  private sessionDocFor(connection: ConnectionState): SessionDoc {
    const viewer =
      connection.viewerRole === "spectator"
        ? { role: "spectator" as const, playerId: connection.playerId ?? null }
        : { role: "player" as const, playerId: connection.playerId ?? null };
    return { ...this.sessionDoc, viewer };
  }

  private sendShellSync(connection: ConnectionState, gameplayRuntimeReset = false): void {
    if (!connection.joinedShell && !connection.joinedGame) return;
    this.send(connection.id, {
      type: "room_shell_sync",
      gameInstanceId: this.gameInstanceId,
      sessionDoc: this.sessionDocFor(connection),
      sequence: this.sessionSequence,
      ...(gameplayRuntimeReset ? { gameplayRuntimeReset: true } : {}),
    });
  }

  private broadcastShellSync(gameplayRuntimeReset = false): void {
    for (const connection of this.connectionsForRoom()) {
      this.sendShellSync(connection, gameplayRuntimeReset);
    }
  }

  private sendSpectatorRoster(): void {
    const payload = {
      type: "spectator_roster_sync",
      gameInstanceId: this.gameInstanceId,
      spectators: this.spectatorsForRoom(),
    };
    for (const connection of this.connectionsForRoom()) this.send(connection.id, payload);
  }

  private sendChatSync(connection: ConnectionState): void {
    const canSend = connection.viewerRole === "player" && !!connection.playerId;
    this.send(connection.id, {
      type: "chat_sync",
      gameInstanceId: this.gameInstanceId,
      chatEntries: this.chatEntries,
      chatAccess: {
        canSend,
        authorId: canSend ? connection.playerId : null,
      },
    });
  }

  private sendPresenceSnapshot(connection: ConnectionState): void {
    if (!connection.playerId) return;
    this.send(connection.id, {
      type: "presence_event",
      gameInstanceId: this.gameInstanceId,
      event: {
        type: "presence_snapshot",
        playerId: connection.playerId,
        connectedPlayerIds: this.connectedPlayerIds(),
      },
    });
  }

  private broadcastPlayerPresence(
    playerId: string,
    state: "online" | "offline",
    exceptId?: string,
  ): void {
    const payload = {
      type: "presence_event",
      gameInstanceId: this.gameInstanceId,
      event: {
        type: "player_presence",
        playerId,
        state,
        connectedPlayerIds: this.connectedPlayerIds(),
      },
    };
    for (const connection of this.connectionsForRoom()) {
      if (connection.id === exceptId) continue;
      this.send(connection.id, payload);
    }
  }

  /* ------------------------------------------------------------------ action clock */

  /** `229172.l` — who is currently on the clock. */
  private actionClockTargets(
    room: Room,
  ): Array<{ playerId: string; reason: "turn" | "chain" | "showdown" }> {
    if (room.phase !== "in_game") return [];
    const assist = room.pendingBattlefieldConquerAssist;
    if (assist) {
      const playerId =
        assist.stage === "defender_response"
          ? (assist.actualDefenderPlayerId ?? assist.defenderPlayerId)
          : assist.attackerPlayerId;
      return playerId ? [{ playerId, reason: "showdown" }] : [];
    }
    const entry = room.chainEntries[0];
    if (entry) {
      const voted = new Set(room.chainResolveVotes ?? []);
      const waiting = room.players
        .filter((player) => !!player.board && !player.leftAt)
        .map((player) => player.id)
        .filter((playerId) => playerId !== entry.byPlayerId && !voted.has(playerId));
      if (waiting.length > 0) return waiting.map((playerId) => ({ playerId, reason: "chain" }));
      return [{ playerId: entry.byPlayerId, reason: "chain" }];
    }
    return room.activeTurnPlayerId ? [{ playerId: room.activeTurnPlayerId, reason: "turn" }] : [];
  }

  /** Materialize the chess clock up to `now`, accumulating the running segment. */
  private materializeActionClock(room: Room, now: number): RawActionClock | null {
    if (room.phase !== "in_game") {
      this.actionClockRaw = null;
      return null;
    }
    const scopeKey = `${this.roomCode}:${room.gameNumber ?? 1}`;
    const previous =
      this.actionClockRaw && this.actionClockRaw.scopeKey === scopeKey ? this.actionClockRaw : null;
    const totals: Record<string, number> = { ...(previous?.totals ?? {}) };
    if (previous && previous.runningSince !== null) {
      const elapsed = Math.max(0, Math.trunc(now - previous.runningSince));
      if (elapsed > 0) {
        for (const target of previous.activeTargets) {
          totals[target.playerId] = (totals[target.playerId] ?? 0) + elapsed;
        }
      }
    }
    const activeTargets = this.actionClockTargets(room);
    const clock: RawActionClock = {
      scopeKey,
      totals,
      activeTargets,
      runningSince: activeTargets.length > 0 ? now : null,
      serverNow: now,
    };
    this.actionClockRaw = clock;
    return clock;
  }

  /* ------------------------------------------------------------------ snapshot/patch */

  private sendSnapshot(connection: ConnectionState, extra: Record<string, unknown> = {}): void {
    const viewer = this.viewerFor(connection);
    const room = this.projectedRoom(this.room);
    const actionClock = this.materializeActionClock(room, this.deps.clock.now());
    const payload = snapshotForViewer(
      {
        room,
        gameplayLogEntries: this.gameplayLog,
        ...(actionClock ? { actionClock } : {}),
      },
      viewer,
    );
    this.send(connection.id, {
      type: "authoritative_snapshot",
      gameInstanceId: this.gameInstanceId,
      sequence: this.sequence,
      snapshot: payload.snapshot,
      gameplayLog: payload.gameplayLog,
      ...(payload.actionClock ? { actionClock: payload.actionClock } : {}),
      ...extra,
    });
  }

  private broadcastSnapshot(extra: Record<string, unknown> = {}): void {
    for (const connection of this.connectionsForRoom()) {
      if (!connection.playerId && connection.viewerRole !== "spectator") continue;
      this.sendSnapshot(connection, extra);
    }
  }

  /**
   * Rewind / forward / approved rewind answer with `authoritative_snapshot` (protocol v5,
   * `1w8d13szpogkp.js:2900-2960`) instead of a patch, so clients reset the branch epoch and play the
   * timeline-navigation animation. `action` travels on the snapshot exactly like the original.
   */
  private broadcastHistorySnapshot(
    actorConnectionId: string,
    action: Record<string, unknown>,
    clientActionId?: string,
  ): void {
    for (const connection of this.connectionsForRoom()) {
      if (!connection.joinedGame) continue;
      if (!connection.playerId && connection.viewerRole !== "spectator") continue;
      this.sendSnapshot(connection, {
        action,
        ...(connection.id === actorConnectionId && clientActionId ? { clientActionId } : {}),
      });
    }
  }

  /** `rewind_confirmation_state` (server → client) whenever the pending request changes. */
  private broadcastRewindConfirmation(confirmation: RewindConfirmation | null): void {
    for (const connection of this.connectionsForRoom()) {
      if (!connection.joinedGame) continue;
      if (!connection.playerId && connection.viewerRole !== "spectator") continue;
      this.send(connection.id, {
        type: "rewind_confirmation_state",
        gameInstanceId: this.gameInstanceId,
        confirmation,
      });
    }
  }

  private broadcastPatch(
    previousRoom: Room,
    previousLog: GameplayLogEntry[],
    nextRoom: Room,
    nextLog: GameplayLogEntry[],
    actionType: string,
    baseSequence: number,
    actorConnectionId: string,
    clientActionId?: string,
    previousActionClock: RawActionClock | null = null,
    nextActionClock: RawActionClock | null = null,
  ): void {
    for (const connection of this.connectionsForRoom()) {
      if (!connection.joinedGame) continue;
      if (!connection.playerId && connection.viewerRole !== "spectator") continue;
      const viewer = this.viewerFor(connection);
      const previous = redactRuntimeStateForViewer(
        {
          // The previous room is the snapshot captured before this action; it must not be
          // re-projected with the *new* session metadata or session-only changes disappear from
          // the diff (e.g. a game-ending `matchTermination`).
          room: previousRoom,
          gameplayLogEntries: previousLog,
          ...(previousActionClock ? { actionClock: previousActionClock } : {}),
        },
        viewer,
      );
      const next = redactRuntimeStateForViewer(
        {
          room: this.projectedRoom(nextRoom),
          gameplayLogEntries: nextLog,
          ...(nextActionClock ? { actionClock: nextActionClock } : {}),
        },
        viewer,
      );
      const patch = diffRuntimeState(previous, next);
      this.send(connection.id, {
        type: "authoritative_patch_commit",
        gameInstanceId: this.gameInstanceId,
        baseSequence,
        sequence: this.sequence,
        action: { type: actionType },
        patch,
        ...(connection.id === actorConnectionId && clientActionId ? { clientActionId } : {}),
      });
    }
  }

  /* ------------------------------------------------------------------ connection lifecycle */

  addConnection(
    connectionId: string,
    query: { playerId?: string | null; roomCode?: string | null } = {},
  ): void {
    this.connections.set(connectionId, {
      id: connectionId,
      queryPlayerId: query.playerId ?? null,
      queryRoomCode: query.roomCode ?? null,
      viewerRole: "player",
      joinedShell: false,
      joinedGame: false,
    });
  }

  removeConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;
    this.connections.delete(connectionId);
    if (
      connection.viewerRole === "player" &&
      connection.playerId &&
      !this.playerHasConnection(connection.playerId)
    ) {
      this.broadcastPlayerPresence(connection.playerId, "offline");
    }
  }

  private supersedeOtherConnections(connection: ConnectionState, playerId: string): void {
    for (const other of this.connections.values()) {
      if (
        other.id !== connection.id &&
        other.viewerRole === "player" &&
        other.playerId === playerId
      ) {
        this.sendError(
          other.id,
          "control_superseded",
          "A newer connection for this player took control of the match session.",
          { retryable: false },
        );
        this.deps.transport.close(
          other.id,
          CLOSE_CODE_CONTROL_SUPERSEDED,
          "This seat was resumed from another tab or device.",
        );
        this.connections.delete(other.id);
      }
    }
  }

  private playerIdForSubject(authSubject: string): string | undefined {
    return Object.entries(this.authSubjectByPlayerId).find(
      ([, subject]) => subject === authSubject,
    )?.[0];
  }

  private freeSeat(): number | null {
    const occupied = new Set(
      this.sessionDoc.players.filter((player) => !player.leftAt).map((player) => player.seat),
    );
    for (let seat = 0; seat < maxSeatsForVariant(this.seed.gameVariant); seat += 1) {
      if (!occupied.has(seat)) return seat;
    }
    return null;
  }

  private addLobbyPlayer(input: {
    playerId: string;
    name: string;
    authSubject: string | null;
    seat: number;
    decklist?: string | null;
    constructedDeckRegistration?: unknown;
    sealedRegistration?: unknown;
  }): RoomPlayer {
    const parsed = input.decklist?.trim() ? parseDecklist(input.decklist) : null;
    const player: RoomPlayer = {
      id: input.playerId,
      seat: input.seat,
      name: input.name,
      joinedAt: this.deps.clock.now(),
      ...(input.decklist ? { decklistRaw: input.decklist } : {}),
      ...(isRecord(input.constructedDeckRegistration)
        ? {
            constructedDeckRegistration:
              input.constructedDeckRegistration as unknown as RoomPlayer["constructedDeckRegistration"],
          }
        : {}),
      ...(parsed ? { deck: parsed, submittedDeck: parsed } : {}),
      ...(input.sealedRegistration ? { sealedRegistration: input.sealedRegistration } : {}),
    };
    this.sessionDoc.players = [...this.sessionDoc.players, player].sort((a, b) => a.seat - b.seat);
    if (input.authSubject) {
      this.authSubjectByPlayerId[input.playerId] = input.authSubject;
      const controlled = this.controlledByAuthSubject[input.authSubject] ?? [];
      if (!controlled.includes(input.playerId)) {
        this.controlledByAuthSubject[input.authSubject] = [...controlled, input.playerId];
      }
    }
    this.syncLobbyRoomPlayers();
    return player;
  }

  private syncLobbyRoomPlayers(): void {
    if (this.room.phase !== "lobby") return;
    this.room.players = this.sessionDoc.players.map((player) => ({
      id: player.id,
      seat: player.seat,
      name: player.name,
      joinedAt: player.joinedAt,
      ...(player.leftAt !== undefined ? { leftAt: player.leftAt } : {}),
      ...(player.leftReason !== undefined ? { leftReason: player.leftReason } : {}),
    }));
  }

  private async bindConnection(
    connection: ConnectionState,
    identity: Identity,
    message: Record<string, unknown>,
  ): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
    const wantsSpectator =
      message.viewerRole === "spectator" ||
      connection.viewerRole === "spectator" ||
      message.broadcastView === true;
    if (wantsSpectator) {
      const displayName = sanitizePlayerName(
        message.playerName ?? connection.queryPlayerId ?? identity.name,
        identity.name,
      );
      const spectator = this.upsertSpectator(identity, displayName);
      connection.authSubject = identity.sub;
      connection.playerId = null;
      connection.viewerRole = "spectator";
      connection.spectatorName = spectator.displayName;
      connection.displayName = spectator.displayName;
      connection.broadcastView = message.broadcastView === true;
      this.removePlayerIfDuplicateSpectator(identity.sub);
      return { ok: true };
    }

    const requestedId =
      (typeof message.playerId === "string" ? message.playerId : null) ??
      connection.queryPlayerId ??
      null;
    let playerId: string | undefined;
    if (requestedId) {
      const member = this.sessionDoc.players.find((player) => player.id === requestedId);
      if (
        member &&
        (this.authSubjectByPlayerId[member.id] === identity.sub ||
          this.controlledByAuthSubject[identity.sub]?.includes(member.id))
      ) {
        playerId = member.id;
      }
    }
    if (!playerId) playerId = this.playerIdForSubject(identity.sub);
    if (!playerId) {
      // Socket-first joins are tolerated in the lobby (the original client normally calls the HTTP
      // join first, but this keeps development clients working).
      if (this.room.phase === "lobby" && this.roomMode === "multiplayer" && !requestedId) {
        const seat = this.freeSeat();
        if (seat !== null) {
          const name = sanitizePlayerName(message.playerName, identity.name);
          const player = this.addLobbyPlayer({
            playerId: identity.sub,
            name,
            authSubject: identity.sub,
            seat,
          });
          playerId = player.id;
        }
      }
    }
    if (!playerId) {
      return {
        ok: false,
        code: "player_not_registered",
        message: "This player is not registered in the room.",
      };
    }
    const member = this.sessionDoc.players.find((player) => player.id === playerId);
    if (member?.leftAt) {
      member.leftAt = undefined;
      member.leftReason = undefined;
    }
    this.supersedeOtherConnections(connection, playerId);
    connection.authSubject = identity.sub;
    connection.playerId = playerId;
    connection.viewerRole = "player";
    connection.displayName = member?.name ?? identity.name;
    const controlled = (this.controlledByAuthSubject[identity.sub] ??= [playerId]);
    if (!controlled.includes(playerId)) controlled.push(playerId);
    // Taking a seat removes the spectator session for the same account.
    this.spectators = this.spectators.filter((spectator) => spectator.authSubject !== identity.sub);
    return { ok: true };
  }

  private removePlayerIfDuplicateSpectator(authSubject: string): void {
    // A spectator socket must not keep a stale player connection flag; no-op helper for clarity.
    void authSubject;
  }

  /* ------------------------------------------------------------------ message entry point */

  async handleMessage(connectionId: string, message: Record<string, unknown>): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;
    if (message.gameInstanceId !== this.gameInstanceId) {
      this.sendError(
        connectionId,
        "room_not_found",
        "The requested game instance does not match this room.",
      );
      return;
    }
    const type = typeof message.type === "string" ? message.type : "";

    if (type === "ping") {
      this.send(connectionId, {
        type: "pong",
        gameInstanceId: this.gameInstanceId,
        sentAt: message.sentAt,
      });
      return;
    }
    if (type === "pong") return;

    if (type === "auth_refresh") {
      const identity = await this.deps.verifyToken(String(message.authToken ?? ""));
      if (!identity) {
        this.sendAuthError(connectionId, "invalid_signature");
        return;
      }
      connection.authSubject = identity.sub;
      const remaining = identity.expiresAt
        ? Math.max(0, identity.expiresAt * 1_000 - this.deps.clock.now())
        : 0;
      this.send(connectionId, {
        type: "auth_session",
        gameInstanceId: this.gameInstanceId,
        tokenRemainingMs: remaining,
        ...(typeof message.clientRequestId === "string"
          ? { clientRequestId: message.clientRequestId }
          : {}),
      });
      return;
    }

    if (type === "join_shell" || type === "join_game" || type === "resume_game") {
      const identity = await this.deps.verifyToken(String(message.authToken ?? ""));
      if (!identity) {
        this.sendAuthError(connectionId, "invalid_signature");
        return;
      }
      const wasOnline = connection.playerId ? this.playerHasConnection(connection.playerId) : false;
      const bound = await this.bindConnection(connection, identity, message);
      if (!bound.ok) {
        this.sendError(connectionId, bound.code, bound.message, { retryable: false });
        return;
      }
      connection.joinedShell = true;
      if (type !== "join_shell") connection.joinedGame = true;
      this.sendShellSync(connection);
      this.sendSpectatorRoster();
      this.sendChatSync(connection);
      this.sendPresenceSnapshot(connection);
      if (connection.playerId && !wasOnline) {
        this.broadcastPlayerPresence(connection.playerId, "online", connectionId);
      }
      if (type === "resume_game") {
        const clientSequence =
          typeof message.clientSequence === "number" ? message.clientSequence : null;
        if (clientSequence !== null && clientSequence === this.sequence) {
          this.send(connectionId, {
            type: "authoritative_resume_ack",
            gameInstanceId: this.gameInstanceId,
            sequence: this.sequence,
          });
        } else {
          this.sendSnapshot(connection);
        }
      } else if (type === "join_game") {
        this.sendSnapshot(connection);
      }
      this.broadcastShellSync();
      return;
    }

    if (!connection.joinedShell && !connection.joinedGame) {
      this.sendError(
        connectionId,
        "connection_reauthorization_required",
        "Join the room before sending actions.",
        {
          retryable: false,
        },
      );
      return;
    }

    switch (type) {
      case "presence_update":
        this.handlePresenceUpdate(connection, message);
        return;
      case "action_intent":
        await this.handleActionIntent(connection, message);
        return;
      case "room_shell_action":
        await this.handleRoomShellAction(connection, message);
        return;
      case "chat_send":
        this.handleChatSend(connection, message);
        return;
      case "customization_refresh":
        this.send(connectionId, {
          type: "customization_refresh",
          gameInstanceId: this.gameInstanceId,
        });
        return;
      case "activity_history_request":
        this.send(connectionId, {
          type: "activity_history_page",
          gameInstanceId: this.gameInstanceId,
          requestId: message.requestId,
          entries: [],
          nextCursor: null,
        });
        return;
      case "spectator_view_grant_update":
        this.handleSpectatorGrant(connection, message);
        return;
      case "judge_call_create":
      case "judge_call_private_create":
        this.handleJudgeCallCreate(connection, message);
        return;
      case "judge_call_close":
        this.handleJudgeCallClose(connection, message);
        return;
      case "judge_feedback_submit":
        this.send(connectionId, {
          type: "judge_feedback_result",
          gameInstanceId: this.gameInstanceId,
          callId: message.callId,
          rating: message.rating,
          status: "recorded",
          retryable: false,
        });
        return;
      case "player_report_submit":
        this.send(connectionId, {
          type: "player_report_result",
          gameInstanceId: this.gameInstanceId,
          clientReportId: message.clientReportId,
          status: "submitted",
          retryable: false,
        });
        return;
      default:
        this.sendError(
          connectionId,
          "unsupported_message",
          "That realtime message is not handled here.",
          {
            retryable: false,
          },
        );
        return;
    }
  }

  /* ------------------------------------------------------------------ presence/chat/judge */

  private handlePresenceUpdate(
    connection: ConnectionState,
    message: Record<string, unknown>,
  ): void {
    const playerId = connection.playerId;
    if (!playerId || connection.viewerRole !== "player") return;
    const broadcast = (event: Record<string, unknown>) => {
      const payload = { type: "presence_event", gameInstanceId: this.gameInstanceId, event };
      for (const other of this.connectionsForRoom()) {
        if (other.id === connection.id) continue;
        this.send(other.id, payload);
      }
    };
    if ("hoveredCardId" in message || "hoveredAt" in message) {
      broadcast({
        type: "hover_state",
        playerId,
        ...(message.hoveredCardId !== undefined ? { hoveredCardId: message.hoveredCardId } : {}),
        ...(message.hoveredAt !== undefined ? { hoveredAt: message.hoveredAt } : {}),
      });
    }
    if ("pingedCardId" in message || "pingedAt" in message || "pingIntent" in message) {
      broadcast({
        type: "card_ping",
        playerId,
        ...(message.pingedCardId !== undefined ? { pingedCardId: message.pingedCardId } : {}),
        ...(message.pingedAt !== undefined ? { pingedAt: message.pingedAt } : {}),
        ...(message.pingIntent !== undefined ? { pingIntent: message.pingIntent } : {}),
      });
    }
    if ("emoteId" in message || "emoteAt" in message) {
      broadcast({
        type: "board_emote",
        playerId,
        ...(message.emoteId !== undefined ? { emoteId: message.emoteId } : {}),
        ...(message.emoteAt !== undefined ? { emoteAt: message.emoteAt } : {}),
      });
    }
    if ("chatTyping" in message) {
      broadcast({
        type: "chat_typing",
        playerId,
        typingTtlMs: message.chatTyping === true ? 5_000 : null,
      });
    }
  }

  private handleChatSend(connection: ConnectionState, message: Record<string, unknown>): void {
    if (connection.viewerRole !== "player" || !connection.playerId) {
      this.sendError(connection.id, "chat_unavailable", "Only seated players can send room chat.", {
        retryable: false,
      });
      return;
    }
    const text = typeof message.text === "string" ? message.text.trim() : "";
    if (text.length === 0) {
      this.sendError(connection.id, "chat_empty", "Chat messages cannot be empty.", {
        retryable: false,
      });
      return;
    }
    if (text.length > 2_000) {
      this.sendError(connection.id, "chat_too_long", "Chat messages are too long.", {
        retryable: false,
      });
      return;
    }
    const entry: ChatEntry = {
      id: newId("chat"),
      at: this.deps.clock.now(),
      authorId: connection.playerId,
      authorName: connection.displayName ?? undefined,
      text,
      ...(typeof message.clientEntryId === "string"
        ? { clientEntryId: message.clientEntryId }
        : {}),
      ...(typeof message.judgeCallId === "string" ? { judgeCallId: message.judgeCallId } : {}),
    };
    this.chatEntries.push(entry);
    if (this.chatEntries.length > 500) this.chatEntries.splice(0, this.chatEntries.length - 500);
    const payload = {
      type: "chat_append",
      gameInstanceId: this.gameInstanceId,
      entry,
    };
    for (const other of this.connectionsForRoom()) this.send(other.id, payload);
  }

  private handleJudgeCallCreate(
    connection: ConnectionState,
    message: Record<string, unknown>,
  ): void {
    if (connection.viewerRole !== "player" || !connection.playerId) {
      this.sendError(
        connection.id,
        "judge_call_unavailable",
        "Only seated players can call a judge.",
        {
          retryable: false,
        },
      );
      return;
    }
    const call: JudgeCallRecord = {
      id: newId("judge"),
      clientRequestId: String(message.clientRequestId ?? ""),
      requestedAt: this.deps.clock.now(),
      requestedByPlayerId: connection.playerId,
      requestedByPlayerName: connection.displayName ?? "Player",
      question: String(message.question ?? "").slice(0, 2_000),
      visibility: message.visibility === "private" ? "private" : "public",
      status: "open",
      delivery: "unavailable",
      answer: null,
    };
    this.judgeCalls.push(call);
    this.send(connection.id, {
      type: "judge_call_sync",
      gameInstanceId: this.gameInstanceId,
      judgeCall: call,
      judgeCalls: this.judgeCalls,
    });
  }

  private handleJudgeCallClose(
    connection: ConnectionState,
    message: Record<string, unknown>,
  ): void {
    const callId = typeof message.callId === "string" ? message.callId : "";
    const call = this.judgeCalls.find((candidate) => candidate.id === callId);
    if (call && connection.playerId === call.requestedByPlayerId) {
      call.status = "closed";
      call.closedAt = this.deps.clock.now();
    }
    this.send(connection.id, {
      type: "judge_call_sync",
      gameInstanceId: this.gameInstanceId,
      judgeCall: call ?? null,
      judgeCalls: this.judgeCalls,
    });
  }

  private handleSpectatorGrant(
    connection: ConnectionState,
    message: Record<string, unknown>,
  ): void {
    const playerId = typeof message.playerId === "string" ? message.playerId : "";
    if (!connection.playerId || !this.controlledIdsFor(connection).includes(playerId)) {
      this.sendError(
        connection.id,
        "seat_control_denied",
        "Only the granting player can change spectator visibility.",
        {
          retryable: false,
        },
      );
      return;
    }
    const granted = message.granted === true;
    const spectatorAuthSubject =
      typeof message.spectatorAuthSubject === "string" ? message.spectatorAuthSubject : null;
    const affected: Spectator[] = [];
    if (spectatorAuthSubject) {
      const spectator = this.spectatorForSubject(spectatorAuthSubject);
      if (!spectator) {
        this.sendError(
          connection.id,
          "spectator_not_found",
          "That spectator is not connected to this room.",
          {
            retryable: false,
          },
        );
        return;
      }
      const ids = new Set(spectator.grantedPrivatePlayerIds);
      if (granted) ids.add(playerId);
      else ids.delete(playerId);
      spectator.grantedPrivatePlayerIds = [...ids];
      spectator.updatedAt = this.deps.clock.now();
      affected.push(spectator);
    } else {
      const ids = new Set(this.globalGrantedPlayerIds);
      if (granted) ids.add(playerId);
      else ids.delete(playerId);
      this.globalGrantedPlayerIds = [...ids];
      for (const spectator of this.spectators) {
        const current = new Set(spectator.grantedPrivatePlayerIds);
        if (granted) current.add(playerId);
        else current.delete(playerId);
        spectator.grantedPrivatePlayerIds = [...current];
        spectator.updatedAt = this.deps.clock.now();
        affected.push(spectator);
      }
    }
    this.send(connection.id, {
      type: "spectator_view_grant_ack",
      gameInstanceId: this.gameInstanceId,
      playerId,
      audience: "signed_in_spectator",
      ...(spectatorAuthSubject ? { spectatorAuthSubject } : {}),
      granted,
      sequence: this.sequence,
      ...(typeof message.clientActionId === "string"
        ? { clientActionId: message.clientActionId }
        : {}),
    });
    this.sendSpectatorRoster();
    const affectedSubjects = new Set(affected.map((spectator) => spectator.authSubject));
    for (const other of this.connections.values()) {
      if (
        other.viewerRole === "spectator" &&
        other.authSubject &&
        affectedSubjects.has(other.authSubject) &&
        other.joinedGame
      ) {
        this.sendSnapshot(other);
      }
    }
  }

  /* ------------------------------------------------------------------ gameplay intents */

  private async handleActionIntent(
    connection: ConnectionState,
    message: Record<string, unknown>,
  ): Promise<void> {
    if (connection.viewerRole !== "player" || !connection.playerId) {
      this.sendError(
        connection.id,
        "seat_control_denied",
        "Only seated players can perform gameplay actions.",
        {
          retryable: false,
          ...(typeof message.clientActionId === "string"
            ? { clientActionId: message.clientActionId }
            : {}),
        },
      );
      return;
    }
    if (!connection.joinedGame) {
      this.sendError(
        connection.id,
        "gameplay_transport_unavailable",
        "Join the match room before sending gameplay actions.",
        {
          retryable: false,
          ...(typeof message.clientActionId === "string"
            ? { clientActionId: message.clientActionId }
            : {}),
        },
      );
      return;
    }
    const actorId = this.authorizeActor(
      connection,
      typeof message.actorPlayerId === "string" ? message.actorPlayerId : null,
    );
    if (!actorId) {
      this.sendError(
        connection.id,
        "seat_control_denied",
        "This connection cannot act for that player.",
        {
          retryable: false,
          ...(typeof message.clientActionId === "string"
            ? { clientActionId: message.clientActionId }
            : {}),
        },
      );
      return;
    }
    const clientActionId =
      typeof message.clientActionId === "string" ? message.clientActionId : undefined;
    const action = isRecord(message.action) ? message.action : null;
    if (!action || typeof action.type !== "string") {
      this.sendError(
        connection.id,
        "invalid_action_payload",
        "The gameplay action payload is malformed.",
        {
          retryable: false,
          ...(clientActionId ? { clientActionId } : {}),
        },
      );
      return;
    }
    if (this.room.phase === "lobby") {
      this.sendError(
        connection.id,
        "gameplay_transport_unavailable",
        "The match has not started yet.",
        {
          retryable: false,
          ...(clientActionId ? { clientActionId } : {}),
        },
      );
      return;
    }
    if (clientActionId && this.recentActionIds.includes(clientActionId)) {
      this.send(connection.id, {
        type: "gameplay_action_noop_ack",
        gameInstanceId: this.gameInstanceId,
        sequence: this.sequence,
        ...(clientActionId ? { clientActionId } : {}),
      });
      return;
    }
    const baseSequence = message.clientBaseSequence;
    if (!Number.isInteger(baseSequence)) {
      this.sendError(
        connection.id,
        "invalid_action_payload",
        "The gameplay action payload is malformed.",
        {
          retryable: false,
          ...(clientActionId ? { clientActionId } : {}),
        },
      );
      return;
    }
    if (baseSequence !== this.sequence) {
      this.sendError(
        connection.id,
        "stale_action_state",
        "The match state changed before this action was applied.",
        {
          retryable: true,
          mutationClass: "reject_retryable",
          authoritativeSequence: this.sequence,
          ...(clientActionId ? { clientActionId } : {}),
        },
      );
      return;
    }
    // The original board sends BO3 result/rematch actions through `room_shell_action`; some board
    // surfaces (and the game-over overlay) dispatch them as gameplay intents. Accept both, using
    // the authoritative room-shell implementation and replaying an `authoritative_snapshot` so the
    // gameplay client settles its pending intent.
    if (SERIES_ROOM_ACTIONS.has(action.type)) {
      await this.performSeriesActionIntent(connection, actorId, action, clientActionId);
      return;
    }
    await this.performGameAction(connection, actorId, action, clientActionId, baseSequence);
  }

  private async performSeriesActionIntent(
    connection: ConnectionState,
    actorId: string,
    action: Record<string, unknown>,
    clientActionId: string | undefined,
  ): Promise<void> {
    const previousSequence = this.sequence;
    const result = await this.applyRoomShellAction(actorId, action);
    if (!result.ok) {
      this.sendError(connection.id, result.code, result.message, {
        retryable: false,
        mutationClass: "reject_invalid",
        authoritativeSequence: this.sequence,
        ...(clientActionId ? { clientActionId } : {}),
      });
      return;
    }
    if (clientActionId) this.rememberAction(clientActionId);
    this.sessionSequence += 1;
    if (this.sequence === previousSequence) this.sequence += 1;
    const resetRuntime = action.type === "request_bo3_rematch" && result.snapshot === true;
    this.broadcastShellSync(resetRuntime);
    this.broadcastHistorySnapshot(connection.id, action, clientActionId);
  }

  private async performGameAction(
    connection: ConnectionState,
    actorId: string,
    action: Record<string, unknown>,
    clientActionId: string | undefined,
    baseSequence: number,
  ): Promise<void> {
    const previousRoom = this.room;
    const previousLog = this.gameplayLog;
    const pendingBefore = this.timeline.pending ?? previousRoom.rewindConfirmation;
    const previousTimelineCursor = this.timeline.cursor;
    const actionNow = this.deps.clock.now();
    const previousActionClock = this.materializeActionClock(previousRoom, actionNow);
    let result;
    try {
      result = await applyGameAction(previousRoom, actorId, action, {
        now: actionNow,
        rng: this.deps.clock.rng,
        mode: this.roomMode,
        timeline: this.timeline,
      });
    } catch (error) {
      this.sendError(
        connection.id,
        "runtime_persistence_failed",
        error instanceof Error ? error.message : "The action could not be applied.",
        {
          retryable: true,
          mutationClass: "reject_retryable",
          authoritativeSequence: this.sequence,
          ...(clientActionId ? { clientActionId } : {}),
        },
      );
      return;
    }
    if (!result.ok) {
      this.sendError(connection.id, result.errorCode ?? "gameplay_action_rejected", result.error, {
        retryable: false,
        mutationClass: "reject_invalid",
        authoritativeSequence: this.sequence,
        // Strict rooms (§5): `code` is the ReasonCode; the rule (and detail) travel separately.
        ...(result.rule ? { rule: result.rule } : {}),
        ...(result.detail ? { detail: result.detail } : {}),
        ...(clientActionId ? { clientActionId } : {}),
      });
      return;
    }
    const nextRoom = { ...result.state, roomCode: this.roomCode, updatedAt: this.deps.clock.now() };
    if (!runeMultisetsPreserved(previousRoom, nextRoom)) {
      this.sendError(
        connection.id,
        "runtime_persistence_failed",
        "That action would add or remove runes from a rune pool, so it was not applied.",
        {
          retryable: false,
          mutationClass: "reject_invalid",
          authoritativeSequence: this.sequence,
          ...(clientActionId ? { clientActionId } : {}),
        },
      );
      return;
    }
    const nextLog = [...previousLog, ...(result.log ?? [])];
    const nextActionClock = this.materializeActionClock(nextRoom, actionNow);
    const stateChanged =
      JSON.stringify(previousRoom) !== JSON.stringify(nextRoom) ||
      JSON.stringify(previousLog) !== JSON.stringify(nextLog);
    if (!stateChanged) {
      if (clientActionId) this.rememberAction(clientActionId);
      this.send(connection.id, {
        type: "gameplay_action_noop_ack",
        gameInstanceId: this.gameInstanceId,
        sequence: this.sequence,
        ...(clientActionId ? { clientActionId } : {}),
      });
      return;
    }
    const phaseChanged = this.sessionDoc.phase !== nextRoom.phase;
    this.room = nextRoom;
    this.gameplayLog = nextLog;
    if (result.timeline) this.timeline = result.timeline;
    const previousSequence = this.sequence;
    this.sequence += 1;
    if (clientActionId) this.rememberAction(clientActionId);
    this.syncSessionFromRoom();
    if (phaseChanged) {
      this.sessionSequence += 1;
      this.broadcastShellSync();
    }
    const actionType = String(action.type);
    const historyActionRequested =
      actionType === "rewind_last_action" ||
      actionType === "forward_last_rewind" ||
      (actionType === "respond_rewind_confirmation" && action.response === "approve");
    // A rewind that only opens a confirmation request does not move the cursor; that is a normal
    // room mutation (the confirmation message carries the request). Only an actual branch replay
    // is answered with `authoritative_snapshot`.
    const isHistoryNavigation =
      historyActionRequested && this.timeline.cursor !== previousTimelineCursor;
    if (isHistoryNavigation) {
      // Protocol v5: rewind/forward (and an approved confirmation) replay an authoritative
      // snapshot carrying the causing action, never a patch.
      this.broadcastHistorySnapshot(connection.id, action, clientActionId);
    } else {
      this.broadcastPatch(
        previousRoom,
        previousLog,
        this.room,
        this.gameplayLog,
        actionType,
        previousSequence,
        connection.id,
        clientActionId,
        previousActionClock,
        nextActionClock,
      );
    }
    const pendingAfter = this.timeline.pending;
    if ((pendingBefore?.requestId ?? null) !== (pendingAfter?.requestId ?? null)) {
      this.broadcastRewindConfirmation(pendingAfter ?? null);
    }
    // R4 bot-room: after an accepted human/bot-adjacent action, let the bot answer if it may act.
    await this.driveBotSeats();
  }

  private activePlayers(): RoomPlayer[] {
    return this.sessionDoc.players.filter((player) => !player.leftAt);
  }

  /** BO3 series winner: first player with two reported/detected game wins. */
  private seriesWinnerId(): string | null {
    const wins = this.sessionDoc.winsByPlayerId ?? {};
    for (const [playerId, count] of Object.entries(wins)) {
      if (Number.isFinite(count) && count >= 2) return playerId;
    }
    return null;
  }

  private markSeriesTermination(winnerId: string, reason: string): void {
    this.sessionDoc.matchTermination = {
      status: "completed",
      reason,
      endedAt: this.deps.clock.now(),
      winnerPlayerId: winnerId,
      winnerPlayerIds: [winnerId],
    };
    // `Room` carries the same session mirror (the original client projects the shell doc onto it).
    this.room.matchTermination = this.sessionDoc.matchTermination;
  }

  /** `MatchSeatSeed[]` for a fresh linked room: same ids, identities (auth subjects) and decks. */
  private linkedPlayers(): MatchRoomSeed["players"] {
    const active = this.sessionDoc.players
      .filter((player) => !player.leftAt)
      .slice()
      .sort((a, b) => a.seat - b.seat);
    const activeIds = new Set(active.map((player) => player.id));
    return active.map((player) => {
      const authSubject = this.authSubjectByPlayerId[player.id] ?? null;
      const controlled = authSubject
        ? (this.controlledByAuthSubject[authSubject] ?? []).filter((id) => activeIds.has(id))
        : [];
      return {
        playerId: player.id,
        name: player.name,
        seat: player.seat,
        authSubject,
        decklist: player.decklistRaw ?? deckForPlayer(player)?.raw ?? null,
        ...(typeof (player as unknown as Record<string, unknown>).sealedRegistration !== "undefined"
          ? {
              sealedRegistration: (player as unknown as Record<string, unknown>).sealedRegistration,
            }
          : {}),
        ...((player as unknown as Record<string, unknown>).isSoloOpponent
          ? { isSoloOpponent: true }
          : {}),
        ...(player.isBot ? { isBot: true } : {}),
        ...(controlled.length > 1 ? { controlledPlayerIds: controlled } : {}),
      };
    });
  }

  /**
   * Original linked-room allocation (`nextRoomCode` / `lobbyRoomCode`). Players keep their ids,
   * auth subjects and decks; the coordinator writes a brand-new room (fresh five-character code).
   */
  private async allocateLinkedRoom(overrides: Partial<MatchRoomSeed> = {}): Promise<string> {
    if (!this.deps.createLinkedRoom) throw Error("Linked room allocation is unavailable.");
    const seed: MatchRoomSeed = {
      roomCode: "",
      createdAt: this.deps.clock.now(),
      roomMode: this.seed.roomMode,
      gameVariant: this.seed.gameVariant,
      playMode: this.seed.playMode,
      deckRulesMode: this.seed.deckRulesMode,
      ...(this.seed.rulesMode ? { rulesMode: this.seed.rulesMode } : {}),
      matchFormat: this.seed.matchFormat,
      players: this.linkedPlayers(),
      autoStart: true,
      origin: this.seed.origin,
      ...(this.seed.testMode ? { testMode: true } : {}),
      ...(this.sessionDoc.teamIdByPlayerId
        ? { teamIdByPlayerId: { ...this.sessionDoc.teamIdByPlayerId } }
        : {}),
      ...overrides,
    };
    const created = await this.deps.createLinkedRoom(seed);
    const roomCode = created.roomCode.trim().toUpperCase();
    if (!roomCode) throw Error("The coordinator returned an empty room code.");
    return roomCode;
  }

  /** Battlefields locked in this game become unavailable for later games of the series. */
  private usedBattlefieldsForNextGame(): Record<string, string[]> {
    const used: Record<string, string[]> = {};
    for (const [playerId, battlefields] of Object.entries(
      this.sessionDoc.usedBattlefieldsByPlayerId ?? {},
    )) {
      used[playerId] = [...battlefields];
    }
    for (const player of this.room.players) {
      const battlefield = player.selectedBattlefield?.trim();
      if (!battlefield) continue;
      const list = new Set(used[player.id] ?? []);
      list.add(battlefield);
      used[player.id] = [...list];
    }
    return used;
  }

  private rememberAction(clientActionId: string): void {
    if (this.recentActionIds.includes(clientActionId)) return;
    this.recentActionIds.push(clientActionId);
    if (this.recentActionIds.length > 64)
      this.recentActionIds.splice(0, this.recentActionIds.length - 64);
  }

  private syncSessionFromRoom(): void {
    if (this.room.phase !== this.sessionDoc.phase) this.sessionDoc.phase = this.room.phase;
    if (this.room.gameNumber !== undefined) this.sessionDoc.gameNumber = this.room.gameNumber;
    if (this.room.winsByPlayerId) this.sessionDoc.winsByPlayerId = { ...this.room.winsByPlayerId };
    if (this.room.gameOutcome) {
      // `matchTermination` is the *series* lifecycle in the original session doc. In a BO3 a single
      // game win (code-reported or engine-detected) is not a completed series.
      const seriesWinner = this.seriesWinnerId();
      if (this.sessionDoc.matchFormat !== "bo3" || seriesWinner) {
        const winners = seriesWinner ? [seriesWinner] : [...this.room.gameOutcome.winnerPlayerIds];
        this.sessionDoc.matchTermination = {
          status: "completed",
          reason: this.room.gameOutcome.reason,
          endedAt: this.deps.clock.now(),
          ...(winners.length === 1 ? { winnerPlayerId: winners[0] } : {}),
          winnerPlayerIds: winners,
        };
      }
    }
    for (const sessionPlayer of this.sessionDoc.players) {
      const live = this.room.players.find((player) => player.id === sessionPlayer.id);
      if (!live) continue;
      if (live.leftAt !== sessionPlayer.leftAt) sessionPlayer.leftAt = live.leftAt;
      if (live.leftReason !== sessionPlayer.leftReason) sessionPlayer.leftReason = live.leftReason;
    }
    // Mirror the session-owned series metadata back onto the room object *before* a patch diff so
    // session-only updates also reach clients through `authoritative_patch_commit`. Replacing the
    // object (never mutating in place) keeps the caller's `previousRoom` snapshot intact.
    this.room = {
      ...this.room,
      ...(this.sessionDoc.winsByPlayerId
        ? { winsByPlayerId: { ...this.sessionDoc.winsByPlayerId } }
        : {}),
      ...(this.sessionDoc.matchTermination
        ? { matchTermination: { ...this.sessionDoc.matchTermination } }
        : {}),
    };
  }

  /* ------------------------------------------------------------------ room shell actions */

  private async handleRoomShellAction(
    connection: ConnectionState,
    message: Record<string, unknown>,
  ): Promise<void> {
    if (connection.viewerRole !== "player" || !connection.playerId) {
      this.sendError(
        connection.id,
        "seat_control_denied",
        "Only seated players can change room state.",
        {
          retryable: false,
        },
      );
      return;
    }
    const clientActionId =
      typeof message.clientActionId === "string" ? message.clientActionId : undefined;
    const actorId = this.authorizeActor(
      connection,
      typeof message.actorPlayerId === "string" ? message.actorPlayerId : null,
    );
    const rawAction = message.action;
    if (!actorId || !isRecord(rawAction) || typeof rawAction.type !== "string") {
      this.sendError(
        connection.id,
        "invalid_room_action",
        "The room action payload is malformed.",
        {
          retryable: false,
          ...(clientActionId ? { clientActionId } : {}),
        },
      );
      return;
    }
    const action = rawAction;
    const result = await this.applyRoomShellAction(actorId, action);
    if (!result.ok) {
      this.sendError(connection.id, result.code, result.message, {
        retryable: false,
        ...(clientActionId ? { clientActionId } : {}),
      });
      return;
    }
    this.sessionSequence += 1;
    this.send(connection.id, {
      type: "room_shell_action_ack",
      gameInstanceId: this.gameInstanceId,
      actionType: action.type,
      sequence: this.sessionSequence,
      ...(clientActionId ? { clientActionId } : {}),
    });
    this.broadcastShellSync();
    if (result.snapshot) this.broadcastSnapshot();
  }

  private async applyRoomShellAction(
    actorId: string,
    action: Record<string, unknown>,
  ): Promise<{ ok: true; snapshot?: boolean } | { ok: false; code: string; message: string }> {
    const type = action.type as string;
    const actor = this.sessionDoc.players.find((player) => player.id === actorId);
    if (!actor)
      return {
        ok: false,
        code: "player_not_registered",
        message: "This player is not registered in the room.",
      };
    const host = this.sessionDoc.players.find((player) => player.seat === 0 && !player.leftAt);
    const hostOnly = () => {
      if (host?.id !== actorId) {
        return {
          ok: false as const,
          code: "room_access_denied",
          message: "Only the room host can do that.",
        };
      }
      return null;
    };

    switch (type) {
      case "submit_deck": {
        const raw = typeof action.decklist === "string" ? action.decklist : "";
        if (raw.trim().length === 0)
          return { ok: false, code: "invalid_deck", message: "Paste a deck list first." };
        const parsed = parseDecklist(raw);
        actor.decklistRaw = raw;
        actor.deck = parsed;
        actor.submittedDeck = parsed;
        if (isRecord(action.constructedDeckRegistration)) {
          actor.constructedDeckRegistration =
            action.constructedDeckRegistration as unknown as RoomPlayer["constructedDeckRegistration"];
        }
        return { ok: true };
      }
      case "submit_sealed_draft": {
        if (typeof action.draftId === "string") {
          (actor as unknown as Record<string, unknown>).sealedDraftId = action.draftId;
        }
        if (isRecord(action.sealedRegistration)) {
          (actor as unknown as Record<string, unknown>).sealedRegistration =
            action.sealedRegistration;
        }
        return { ok: true };
      }
      case "add_solo_opponent": {
        if (this.roomMode === "multiplayer") {
          return {
            ok: false,
            code: "unsupported_action",
            message: "Solo opponents are only available in solo rooms.",
          };
        }
        if (host?.id !== actorId) {
          return {
            ok: false,
            code: "room_access_denied",
            message: "Only the room host can add the solo opponent.",
          };
        }
        const seat = this.freeSeat();
        if (seat === null)
          return { ok: false, code: "room_full", message: "There are no free seats in this room." };
        const hostDeck = deckForPlayer(actor);
        const opponentDecklist =
          typeof action.decklist === "string" && action.decklist.trim().length > 0
            ? action.decklist
            : (hostDeck?.raw ?? "");
        const opponent = this.addLobbyPlayer({
          playerId: newId("player"),
          name: "Opponent",
          authSubject: null,
          seat,
          decklist: opponentDecklist,
        });
        const subject = this.authSubjectByPlayerId[actor.id];
        if (subject) {
          const controlled = this.controlledByAuthSubject[subject] ?? [actor.id];
          controlled.push(opponent.id);
          this.controlledByAuthSubject[subject] = [...new Set(controlled)];
        }
        return { ok: true };
      }
      case "set_lobby_ready": {
        const ready = action.ready === true;
        const list = new Set(this.sessionDoc.lobbyReadyPlayerIds ?? []);
        if (ready) list.add(actor.id);
        else list.delete(actor.id);
        this.sessionDoc.lobbyReadyPlayerIds = [...list];
        return { ok: true };
      }
      case "switch_lobby_seat": {
        if (this.room.phase !== "lobby")
          return {
            ok: false,
            code: "invalid_phase",
            message: "Seats can only change in the lobby.",
          };
        const targetSeat = Number(action.targetSeat);
        if (
          !Number.isInteger(targetSeat) ||
          targetSeat < 0 ||
          targetSeat >= maxSeatsForVariant(this.seed.gameVariant)
        ) {
          return { ok: false, code: "invalid_seat", message: "Choose a valid seat." };
        }
        if (targetSeat === actor.seat) return { ok: true };
        const occupant = this.sessionDoc.players.find(
          (player) => player.seat === targetSeat && !player.leftAt,
        );
        actor.seat = targetSeat;
        if (occupant && occupant.id !== actor.id)
          occupant.seat =
            this.sessionDoc.players.find((p) => p.id === actor.id)?.seat ?? occupant.seat;
        this.sessionDoc.players = this.sessionDoc.players.slice().sort((a, b) => a.seat - b.seat);
        this.syncLobbyRoomPlayers();
        return { ok: true };
      }
      case "randomize_lobby_teams": {
        const denied = hostOnly();
        if (denied) return denied;
        if (this.seed.gameVariant !== "teams_2v2") {
          return {
            ok: false,
            code: "invalid_game_variant",
            message: "Teams can only be randomized in 2v2 rooms.",
          };
        }
        // Original `509396`/`randomizeLobbyTeams`: shuffle every seated player, then alternate teams.
        const ids = this.sessionDoc.players
          .filter((player) => !player.leftAt)
          .map((player) => player.id);
        for (let index = ids.length - 1; index > 0; index -= 1) {
          const swap = Math.floor(this.deps.clock.rng() * (index + 1));
          const a = ids[index];
          const b = ids[swap];
          if (a !== undefined && b !== undefined) {
            ids[index] = b;
            ids[swap] = a;
          }
        }
        const teams: Record<string, string> = {};
        ids.forEach((playerId, index) => {
          teams[playerId] = `team:${index % 2}`;
        });
        this.sessionDoc.teamIdByPlayerId = teams;
        this.room.teamIdByPlayerId = { ...teams };
        return { ok: true };
      }
      case "set_lobby_game_variant": {
        const denied = hostOnly();
        if (denied) return denied;
        if (this.room.phase !== "lobby")
          return {
            ok: false,
            code: "invalid_phase",
            message: "Game type can only be changed in the lobby.",
          };
        const variant = action.gameVariant;
        if (
          variant !== "duel" &&
          variant !== "free_for_all_3" &&
          variant !== "free_for_all_4" &&
          variant !== "teams_2v2"
        ) {
          return {
            ok: false,
            code: "invalid_game_variant",
            message: "Choose a supported game type.",
          };
        }
        this.seed.gameVariant = variant;
        this.sessionDoc.gameVariant = variant;
        this.room.gameVariant = variant;
        if (variant !== "duel") {
          this.sessionDoc.matchFormat = "bo1";
          this.room.matchFormat = "bo1";
        }
        return { ok: true };
      }
      case "set_lobby_play_mode": {
        const denied = hostOnly();
        if (denied) return denied;
        if (this.room.phase !== "lobby")
          return {
            ok: false,
            code: "invalid_phase",
            message: "Play mode can only be changed in the lobby.",
          };
        if (action.playMode !== "constructed" && action.playMode !== "sealed") {
          return { ok: false, code: "invalid_play_mode", message: "Choose a supported play mode." };
        }
        this.seed.playMode = action.playMode;
        this.sessionDoc.playMode = action.playMode;
        this.room.playMode = action.playMode;
        return { ok: true };
      }
      case "set_lobby_deck_rules": {
        const denied = hostOnly();
        if (denied) return denied;
        const mode = action.mode === "unrestricted" ? "unrestricted" : "standard";
        this.seed.deckRulesMode = mode;
        this.sessionDoc.deckRulesMode = mode;
        this.room.deckRulesMode = mode;
        return { ok: true };
      }
      case "set_lobby_rules_mode": {
        // Strict-rules toggle (R2-int): host only, lobby only. The engine owns the validation
        // (`set_lobby_rules_mode` in @rift/engine); the shell mirrors the accepted mode.
        const denied = hostOnly();
        if (denied) return denied;
        if (this.room.phase !== "lobby")
          return {
            ok: false,
            code: "invalid_phase",
            message: "Rules mode can only be changed in the lobby.",
          };
        // R4 bot-room: practice-vs-bot is defined as a strict room; the bot has no sandbox AI.
        if (botPlayerIds(this.room).length > 0 && action.mode !== "strict")
          return {
            ok: false,
            code: "invalid_rules_mode",
            message: "Practice vs Bot rooms always use strict rules.",
          };
        const result = await applyGameAction(this.room, actorId, action, {
          now: this.deps.clock.now(),
          rng: this.deps.clock.rng,
          mode: this.roomMode,
        });
        if (!result.ok)
          return {
            ok: false,
            code: result.errorCode ?? "invalid_rules_mode",
            message: result.error,
          };
        const strict = result.state.rulesMode === "strict";
        if (strict) {
          this.seed.rulesMode = "strict";
          this.sessionDoc.rulesMode = "strict";
          this.room = { ...this.room, rulesMode: "strict" };
        } else {
          delete this.seed.rulesMode;
          delete this.sessionDoc.rulesMode;
          const { rulesMode: _rulesMode, rules: _rules, ...rest } = this.room;
          this.room = rest as Room;
        }
        return { ok: true };
      }
      case "set_lobby_match_format": {
        const denied = hostOnly();
        if (denied) return denied;
        if (this.room.phase !== "lobby")
          return {
            ok: false,
            code: "invalid_phase",
            message: "Match format can only be changed in the lobby.",
          };
        if (action.matchFormat !== "bo1" && action.matchFormat !== "bo3") {
          return {
            ok: false,
            code: "invalid_match_format",
            message: "Choose a supported match format.",
          };
        }
        if (this.seed.gameVariant !== "duel") {
          return {
            ok: false,
            code: "invalid_match_format",
            message: "Multiplayer variants only support BO1.",
          };
        }
        this.seed.matchFormat = action.matchFormat;
        this.sessionDoc.matchFormat = action.matchFormat;
        this.room.matchFormat = action.matchFormat;
        return { ok: true };
      }
      case "start_lobby_match": {
        const denied = hostOnly();
        if (denied) return denied;
        const error = await this.startLobbyMatch();
        if (error) return { ok: false, code: "room_start_failed", message: error };
        return { ok: true, snapshot: true };
      }
      case "submit_sideboard":
      case "request_sideboard_skip":
      case "respond_sideboard_skip":
      case "select_battlefield":
      case "auto_start_test_setup":
      case "roll_initiative":
      case "choose_first_player":
      case "choose_single_player_turn_order":
      case "submit_mulligan": {
        // These are live-runtime setup actions; accept them over the shell transport too.
        const previousRoom = this.room;
        const previousLog = this.gameplayLog;
        const base = this.sequence;
        const result = await applyGameAction(previousRoom, actorId, action, {
          now: this.deps.clock.now(),
          rng: this.deps.clock.rng,
          mode: this.roomMode,
          timeline: this.timeline,
        });
        if (!result.ok)
          return {
            ok: false,
            code: result.errorCode ?? "gameplay_action_rejected",
            message: result.error,
          };
        this.room = { ...result.state, roomCode: this.roomCode, updatedAt: this.deps.clock.now() };
        if (result.timeline) this.timeline = result.timeline;
        this.gameplayLog = [...previousLog, ...(result.log ?? [])];
        this.sequence += 1;
        this.syncSessionFromRoom();
        this.broadcastPatch(
          previousRoom,
          previousLog,
          this.room,
          this.gameplayLog,
          String(action.type),
          base,
          "",
        );
        await this.driveBotSeats();
        return { ok: true, snapshot: true };
      }
      case "request_game_result_confirmation": {
        if (this.sessionDoc.matchFormat !== "bo3") {
          return {
            ok: false,
            code: "invalid_phase",
            message: "Game result confirmation is only available in BO3 matches.",
          };
        }
        if (this.sessionDoc.phase === "lobby" || this.sessionDoc.phase === "sideboarding") {
          return {
            ok: false,
            code: "invalid_phase",
            message: "The game has not produced a result yet.",
          };
        }
        if (this.sessionDoc.nextRoomCode || this.sessionDoc.returnLobbyRoomCode) {
          return {
            ok: false,
            code: "invalid_phase",
            message: "This room is already advancing.",
          };
        }
        this.sessionDoc.pendingGameResult = {
          requestedByPlayerId: actorId,
          winnerByReporterPlayerId: {},
        };
        this.room.pendingGameResult = {
          requestedByPlayerId: actorId,
          winnerByReporterPlayerId: {},
        };
        return { ok: true };
      }
      case "cancel_game_result_confirmation": {
        if (this.sessionDoc.matchFormat !== "bo3") {
          return {
            ok: false,
            code: "invalid_phase",
            message: "Game result confirmation is only available in BO3 matches.",
          };
        }
        delete this.sessionDoc.pendingGameResult;
        delete this.room.pendingGameResult;
        return { ok: true };
      }
      case "report_game_result": {
        if (this.sessionDoc.matchFormat !== "bo3") {
          return {
            ok: false,
            code: "invalid_phase",
            message: "Game results can only be reported in BO3 matches.",
          };
        }
        if (this.sessionDoc.nextRoomCode || this.sessionDoc.returnLobbyRoomCode) {
          return {
            ok: false,
            code: "invalid_phase",
            message: "This room is already advancing.",
          };
        }
        const winnerId = typeof action.winnerPlayerId === "string" ? action.winnerPlayerId : "";
        if (!this.sessionDoc.players.some((player) => player.id === winnerId)) {
          return {
            ok: false,
            code: "invalid_game_result",
            message: "Choose a player in this match.",
          };
        }
        const before = this.sessionDoc.pendingGameResult ?? { winnerByReporterPlayerId: {} };
        const pending: NonNullable<typeof this.sessionDoc.pendingGameResult> = {
          ...before,
          winnerByReporterPlayerId: {
            ...before.winnerByReporterPlayerId,
            [actorId]: winnerId,
          },
        };
        const reported = Object.values(pending.winnerByReporterPlayerId);
        const active = this.activePlayers();
        const resolved =
          reported.length >= active.length && reported.every((value) => value === reported[0]);
        if (!resolved) {
          this.sessionDoc.pendingGameResult = pending;
          this.room.pendingGameResult = {
            ...pending,
            winnerByReporterPlayerId: { ...pending.winnerByReporterPlayerId },
          };
          return { ok: true };
        }

        // Both reports agree. The original advances automatically: the winner is recorded, then
        // the next game is allocated as a fresh linked room (`nextRoomCode`) unless that win
        // completed the series. The overlay's "Advancing automatically." line is shown until the
        // shell sync carrying `nextRoomCode` arrives.
        const wins = { ...(this.sessionDoc.winsByPlayerId ?? {}) };
        wins[winnerId] = (wins[winnerId] ?? 0) + 1;
        const seriesComplete = (wins[winnerId] ?? 0) >= 2;
        const gameNumber = this.sessionDoc.gameNumber ?? 1;
        const usedBattlefields = seriesComplete ? undefined : this.usedBattlefieldsForNextGame();
        let nextRoomCode: string | undefined;
        if (!seriesComplete) {
          try {
            nextRoomCode = await this.allocateLinkedRoom({
              seriesId: this.sessionDoc.seriesId ?? this.roomCode,
              seriesStartedAt: this.sessionDoc.seriesStartedAt,
              gameNumber: gameNumber + 1,
              winsByPlayerId: wins,
              ...(usedBattlefields ? { usedBattlefieldsByPlayerId: usedBattlefields } : {}),
              previousRoomCode: this.roomCode,
            });
          } catch (error) {
            return {
              ok: false,
              code: "runtime_persistence_failed",
              message:
                error instanceof Error ? error.message : "Could not allocate the next game room.",
            };
          }
        }

        pending.resolvedWinnerPlayerId = winnerId;
        this.sessionDoc.pendingGameResult = pending;
        this.sessionDoc.winsByPlayerId = wins;
        this.sessionDoc.bo3CompletedGames = (this.sessionDoc.bo3CompletedGames ?? 0) + 1;
        if (usedBattlefields) this.sessionDoc.usedBattlefieldsByPlayerId = usedBattlefields;
        if (nextRoomCode) this.sessionDoc.nextRoomCode = nextRoomCode;
        this.room.pendingGameResult = {
          ...pending,
          winnerByReporterPlayerId: { ...pending.winnerByReporterPlayerId },
        };
        this.room.winsByPlayerId = { ...wins };
        if (nextRoomCode) this.room.nextRoomCode = nextRoomCode;
        this.room.gameOutcome = {
          winnerPlayerIds: [winnerId],
          reason: "score",
          decidedAtTurnNumber: Math.max(1, this.room.turnNumber ?? 1),
        };
        if (seriesComplete) {
          this.markSeriesTermination(winnerId, this.room.gameOutcome?.reason ?? "score");
        }
        // Report state (wins, resolved winner, termination, next room) is room-visible, like the
        // original session→room projection; push an authoritative snapshot so every client agrees.
        return { ok: true, snapshot: true };
      }
      case "request_bo3_rematch": {
        if (this.sessionDoc.matchFormat !== "bo3") {
          return {
            ok: false,
            code: "invalid_phase",
            message: "Rematches are only available in BO3 matches.",
          };
        }
        if (!this.seriesWinnerId() && this.sessionDoc.matchTermination?.status !== "completed") {
          return {
            ok: false,
            code: "invalid_phase",
            message: "A rematch is available after the series is complete.",
          };
        }
        if (this.sessionDoc.nextRoomCode) {
          return {
            ok: false,
            code: "invalid_phase",
            message: "The rematch is already starting.",
          };
        }
        const list = new Set(this.sessionDoc.rematchRequestedPlayerIds ?? []);
        list.add(actorId);
        const active = this.activePlayers();
        if (active.every((player) => list.has(player.id))) {
          // The original rematch opens a fresh room for a fresh series (`nextRoomCode`); both
          // players keep their ids, identities and decks. The completed room keeps its result and
          // exposes the new code so clients switch through the linked-room handoff.
          let nextRoomCode: string;
          try {
            nextRoomCode = await this.allocateLinkedRoom({
              seriesId: newId("series"),
              seriesStartedAt: this.deps.clock.now(),
              gameNumber: 1,
              winsByPlayerId: {},
              previousRoomCode: this.roomCode,
            });
          } catch (error) {
            return {
              ok: false,
              code: "runtime_persistence_failed",
              message:
                error instanceof Error ? error.message : "Could not allocate the rematch room.",
            };
          }
          this.sessionDoc.rematchRequestedPlayerIds = [];
          this.room.rematchRequestedPlayerIds = [];
          this.sessionDoc.nextRoomCode = nextRoomCode;
          this.room.nextRoomCode = nextRoomCode;
          this.sessionDoc.pendingGameResult = undefined;
          delete this.room.pendingGameResult;
          return { ok: true, snapshot: true };
        }
        this.sessionDoc.rematchRequestedPlayerIds = [...list];
        this.room.rematchRequestedPlayerIds = [...list];
        return { ok: true };
      }
      case "chat": {
        const text = typeof action.text === "string" ? action.text.trim() : "";
        if (text)
          this.handleChatSend(
            {
              id: "",
              viewerRole: "player",
              playerId: actorId,
              displayName: actor.name,
              joinedShell: true,
              joinedGame: true,
            },
            { text },
          );
        return { ok: true };
      }
      default:
        return {
          ok: false,
          code: "unsupported_action",
          message: "That room action is not supported.",
        };
    }
  }

  /* ------------------------------------------------------------------ game start/reset */

  private async startLobbyMatch(): Promise<string | null> {
    if (this.room.phase !== "lobby") return "The match has already started.";
    const active = this.sessionDoc.players
      .filter((player) => !player.leftAt)
      .sort((a, b) => a.seat - b.seat);
    const expected = maxSeatsForVariant(this.seed.gameVariant);
    if (active.length < expected) {
      return `Waiting for players (${active.length}/${expected}).`;
    }
    if (this.roomMode === "multiplayer") {
      const ready = new Set(this.sessionDoc.lobbyReadyPlayerIds ?? []);
      if (!active.every((player) => ready.has(player.id))) {
        return `Waiting for players to ready up (${active.filter((player) => ready.has(player.id)).length}/${active.length}).`;
      }
    }
    try {
      await this.initializeGame();
      this.sessionSequence += 1;
      this.broadcastSnapshot();
      await this.driveBotSeats();
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : "Could not start the match.";
    }
  }

  /**
   * R4 bot-room: the bot seat is not controlled by the host, so the human cannot complete its
   * battlefield pick / mulligan. Run the existing setup-only automation (auto_start_test_setup)
   * as the host; it picks battlefields, the first player and mulligans for both seats, then
   * `beginGame` initialises the strict layer.
   */
  private async applyBotAutoSetup(): Promise<void> {
    if (botPlayerIds(this.room).length === 0 || this.room.phase === "in_game") return;
    const hostId = this.sessionDoc.players
      .filter((player) => !player.leftAt)
      .slice()
      .sort((a, b) => a.seat - b.seat)[0]?.id;
    if (!hostId) return;
    const previousRoom = this.room;
    const previousLog = this.gameplayLog;
    this.materializeActionClock(previousRoom, this.deps.clock.now());
    try {
      const result = await applyGameAction(
        previousRoom,
        hostId,
        { type: "auto_start_test_setup" },
        {
          now: this.deps.clock.now(),
          rng: this.deps.clock.rng,
          mode: this.roomMode,
          timeline: this.timeline,
        },
      );
      if (!result.ok) {
        this.logBotIssue("auto setup", hostId, {
          code: result.errorCode ?? "rejected",
          rule: result.rule,
          detail: result.error,
        });
        return;
      }
      this.room = {
        ...result.state,
        roomCode: this.roomCode,
        updatedAt: this.deps.clock.now(),
      };
      this.gameplayLog = [...previousLog, ...(result.log ?? [])];
      if (result.timeline) this.timeline = result.timeline;
    } catch (error) {
      this.logBotIssue("auto setup", hostId, {
        code: "runtime_error",
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Drive every bot seat whose view says it may act, one authoritative action at a time, and
   * broadcast a normal per-viewer patch for each. Guards: 64 actions per wake, stop on game
   * over, rejection, no progress or when no bot has a legal intent. A rejected bot intent is
   * logged (room/bot/code/rule) and never sent to a client as an error frame.
   */
  private async driveBotSeats(): Promise<void> {
    const bots = botPlayerIds(this.room);
    if (bots.length === 0) return;
    for (let step = 0; step < BOT_ACTION_CAP; step += 1) {
      if (this.room.phase !== "in_game" || this.room.gameOutcome) return;
      let botId: string | null = null;
      let intent: ReturnType<typeof nextBotIntent> = null;
      for (const candidate of bots) {
        let next: ReturnType<typeof nextBotIntent> = null;
        try {
          next = nextBotIntent(this.room, candidate, this.deps.clock.rng);
        } catch (error) {
          this.logBotIssue("view", candidate, {
            code: "picker_error",
            detail: error instanceof Error ? error.message : String(error),
          });
          return;
        }
        if (next) {
          botId = candidate;
          intent = next;
          break;
        }
      }
      if (!botId || !intent) {
        // No legal intent while a bot's own view says it may act: report a stuck pick (never a
        // client error) and stop this wake.
        for (const candidate of bots) {
          const who = botMayAct(this.room, candidate);
          if (who && who.kind !== "none" && who.player === candidate) {
            this.logBotIssue("intent", candidate, { code: "no_legal_intent", detail: who.kind });
            break;
          }
        }
        return;
      }

      const previousRoom = this.room;
      const previousLog = this.gameplayLog;
      const actionNow = this.deps.clock.now();
      const previousActionClock = this.materializeActionClock(previousRoom, actionNow);
      const previousSequence = this.sequence;
      let result;
      try {
        result = await applyGameAction(previousRoom, botId, intent, {
          now: actionNow,
          rng: this.deps.clock.rng,
          mode: this.roomMode,
          timeline: this.timeline,
        });
      } catch (error) {
        this.logBotIssue("action", botId, {
          code: "runtime_error",
          intent: intent.type,
          detail: error instanceof Error ? error.message : String(error),
        });
        return;
      }
      if (!result.ok) {
        this.logBotIssue("action", botId, {
          code: result.errorCode ?? "rejected",
          rule: result.rule,
          intent: intent.type,
          detail: result.error,
        });
        return;
      }
      const nextRoom: Room = {
        ...result.state,
        roomCode: this.roomCode,
        updatedAt: this.deps.clock.now(),
      };
      if (!runeMultisetsPreserved(previousRoom, nextRoom)) {
        this.logBotIssue("action", botId, {
          code: "rune_multiset_changed",
          intent: intent.type,
        });
        return;
      }
      if (JSON.stringify(previousRoom) === JSON.stringify(nextRoom)) {
        this.logBotIssue("action", botId, { code: "no_progress", intent: intent.type });
        return;
      }
      const nextLog = [...previousLog, ...(result.log ?? [])];
      const phaseChanged = this.sessionDoc.phase !== nextRoom.phase;
      this.room = nextRoom;
      this.gameplayLog = nextLog;
      if (result.timeline) this.timeline = result.timeline;
      this.sequence += 1;
      this.syncSessionFromRoom();
      if (phaseChanged) {
        this.sessionSequence += 1;
        this.broadcastShellSync();
      }
      const nextActionClock = this.materializeActionClock(this.room, actionNow);
      this.broadcastPatch(
        previousRoom,
        previousLog,
        this.room,
        this.gameplayLog,
        String(intent.type),
        previousSequence,
        "",
        undefined,
        previousActionClock,
        nextActionClock,
      );
    }
    this.logBotIssue("action", bots[0] ?? "bot", { code: "action_cap", detail: `${BOT_ACTION_CAP}` });
  }

  private logBotIssue(
    stage: string,
    playerId: string,
    fields: { code: string; rule?: string; intent?: string; detail?: string },
  ): void {
    const parts = [
      `[bot-room ${this.roomCode}] ${stage} ${playerId}`,
      `code=${fields.code}`,
      fields.rule ? `rule=${fields.rule}` : null,
      fields.intent ? `intent=${fields.intent}` : null,
      fields.detail ? `detail=${fields.detail}` : null,
    ].filter(Boolean);
    console.error(parts.join(" "));
  }

  private async initializeGame(): Promise<void> {
    const active = this.sessionDoc.players
      .filter((player) => !player.leftAt)
      .sort((a, b) => a.seat - b.seat);
    const seats = active.map((player) => ({
      playerId: player.id,
      name: player.name,
      seat: player.seat,
      decklist: player.decklistRaw ?? deckForPlayer(player)?.raw ?? "",
      deck: deckForPlayer(player),
      ...(typeof (player as unknown as Record<string, unknown>).sealedRegistration !== "undefined"
        ? { sealedRegistration: (player as unknown as Record<string, unknown>).sealedRegistration }
        : {}),
      ...(player.isBot ? { isBot: true } : {}),
    }));
    const config: EngineSetupConfig = {
      roomCode: this.roomCode,
      createdAt: this.seed.createdAt,
      now: this.deps.clock.now(),
      roomMode: this.seed.roomMode,
      gameVariant: this.seed.gameVariant,
      playMode: this.seed.playMode,
      deckRulesMode: this.seed.deckRulesMode,
      matchFormat: this.seed.matchFormat,
      players: seats,
      seats,
      rng: this.deps.clock.rng,
      hostPlayerId: active[0]?.id,
      ...(this.sessionDoc.teamIdByPlayerId
        ? { teamIdByPlayerId: this.sessionDoc.teamIdByPlayerId }
        : {}),
      seriesStartedAt: this.sessionDoc.seriesStartedAt,
      gameNumber: this.sessionDoc.gameNumber,
      winsByPlayerId: this.sessionDoc.winsByPlayerId,
      ...(this.seed.testMode ? { testMode: true } : {}),
      ...(this.sessionDoc.singlePlayerTurnOrder
        ? { singlePlayerTurnOrder: this.sessionDoc.singlePlayerTurnOrder }
        : {}),
      ...(this.sessionDoc.usedBattlefieldsByPlayerId
        ? { usedBattlefieldsByPlayerId: this.sessionDoc.usedBattlefieldsByPlayerId }
        : {}),
      soloSetupPending: false,
    };
    const state = await createInitialGameState(config);
    // R4 bot-room: the engine setup contract has no bot flag; mirror it from the session doc so
    // the live room (and snapshots) keep the public marker.
    for (const player of state.players) {
      const seat = active.find((candidate) => candidate.id === player.id);
      if (seat?.isBot) player.isBot = true;
    }
    const room: Room = {
      ...state,
      roomCode: this.roomCode,
      gameVariant: state.gameVariant ?? this.seed.gameVariant,
      roomMode: state.roomMode ?? this.seed.roomMode,
      playMode: state.playMode ?? this.seed.playMode,
      matchFormat: state.matchFormat ?? this.seed.matchFormat,
      gameNumber: state.gameNumber ?? this.sessionDoc.gameNumber ?? 1,
      winsByPlayerId: state.winsByPlayerId ?? this.sessionDoc.winsByPlayerId ?? {},
      // Strict rooms (R2-int): the engine routes rules_* and runs @rift/rules once in_game.
      ...(this.seed.rulesMode === "strict" ? { rulesMode: "strict" as const } : {}),
    };
    this.room = room;
    this.gameplayLog = [];
    this.timeline = { version: 1, entries: [], cursor: 0, nextSeq: 0 };
    this.sequence = Math.max(1, this.sequence + 1);
    this.sessionDoc.phase = room.phase;
    this.sessionDoc.gameNumber = room.gameNumber;
    this.sessionDoc.winsByPlayerId = room.winsByPlayerId;
    this.sessionDoc.lobbyReadyPlayerIds = this.sessionDoc.lobbyReadyPlayerIds ?? [];
    // A fresh game starts without the previous game's/series' termination marker.
    delete this.sessionDoc.matchTermination;
    this.sessionSequence += 1;
    // R4 bot-room: automate the bot's setup and mirror the resulting phase into the shell doc.
    await this.applyBotAutoSetup();
    this.syncSessionFromRoom();
    // Practice-vs-bot is a single human seat. Once setup is done, the live room must take turns
    // between two seats (engine `single_player` keeps the same player's turn) and the board must
    // not grant the human control of the bot (`GameScreen` derives control from roomMode). The
    // session doc stays `single_player`, so the lobby still renders the practice room.
    if (this.room.phase === "in_game" && botPlayerIds(this.room).length > 0) {
      this.room = { ...this.room, roomMode: "multiplayer" };
    }
  }

  /* ------------------------------------------------------------------ HTTP API */

  async handleHttp(
    action: string,
    body: Record<string, unknown>,
    identity: Identity,
  ): Promise<CoreHttpResultAlias> {
    const requestedRoom = body.roomCode;
    if (requestedRoom !== undefined && normalizeRoomCode(requestedRoom) !== this.roomCode) {
      return httpError(409, "room_advanced", "The requested room does not match this match room.", {
        retryable: false,
      });
    }
    if (
      this.sessionDoc.nextRoomCode &&
      action !== "resolve_room_membership" &&
      action !== "leave_room"
    ) {
      return httpError(409, "room_advanced", "This match moved to a new room.", {
        retryable: false,
        continuationRoomCode: this.sessionDoc.nextRoomCode,
      });
    }
    switch (action) {
      case "join_room":
        return this.httpJoinRoom(body, identity);
      case "switch_to_spectator":
        return this.httpSwitchToSpectator(body, identity);
      case "take_seat":
        return this.httpTakeSeat(body, identity);
      case "resolve_room_membership":
        return this.httpResolveMembership(identity);
      case "leave_room":
        return this.httpLeaveRoom(body, identity);
      case "abandon_match":
        return this.httpAbandonMatch(body, identity);
      case "claim_disconnect_win":
        return this.httpClaimDisconnectWin(body, identity);
      case "return_to_lobby":
        return this.httpReturnToLobby(body, identity);
      case "create_next_game":
        return this.httpCreateNextGame(body, identity);
      case "room_series_action":
        return this.httpRoomSeriesAction(body, identity);
      case "social_target":
        return httpError(
          404,
          "social_target_unavailable",
          "Social targets are not available on this server.",
          {
            retryable: false,
          },
        );
      case "broadcast_deck": {
        const player = this.knownPlayerFor(identity);
        if (!player) {
          return httpError(
            404,
            "room_membership_changed",
            "This player is not registered in the room.",
            {
              retryable: false,
            },
          );
        }
        const decks = (this.room.broadcastDecksByPlayerId ??= {});
        decks[player.id] = {
          ...(typeof body.decklist === "string" ? { decklistRaw: body.decklist } : {}),
          ...(isRecord(body.deck) ? { deck: body.deck } : {}),
          ...(typeof body.broadcastView === "boolean" ? { broadcastView: body.broadcastView } : {}),
        };
        this.sessionSequence += 1;
        this.broadcastShellSync();
        this.broadcastSnapshot();
        return httpOk({ roomCode: this.roomCode });
      }
      default:
        return httpError(400, "unsupported_action", "This room API action is not supported.", {
          retryable: false,
        });
    }
  }

  private knownPlayerFor(identity: Identity): RoomPlayer | undefined {
    const id = this.playerIdForSubject(identity.sub);
    return id ? this.sessionDoc.players.find((player) => player.id === id) : undefined;
  }

  private httpJoinRoom(body: Record<string, unknown>, identity: Identity): CoreHttpResultAlias {
    const playerName = sanitizePlayerName(body.playerName, identity.name);
    const wantsSpectator = body.viewerRole === "spectator";
    if (wantsSpectator) {
      const spectator = this.upsertSpectator(identity, playerName);
      return httpOk({
        roomCode: this.roomCode,
        role: "spectator",
        spectatorName: spectator.displayName,
      });
    }
    const existing = this.knownPlayerFor(identity);
    if (existing && !existing.leftAt) {
      return httpOk({
        roomCode: this.roomCode,
        role: "player",
        playerId: existing.id,
        playerName: existing.name,
      });
    }
    if (this.room.phase !== "lobby") {
      return httpError(
        403,
        "room_access_denied",
        "This match is already in progress. Join as a spectator instead.",
        {
          retryable: false,
        },
      );
    }
    if (this.roomMode !== "multiplayer") {
      return httpError(403, "room_access_denied", "This solo room is controlled by its host.", {
        retryable: false,
      });
    }
    if (existing?.leftAt) {
      existing.leftAt = undefined;
      existing.leftReason = undefined;
      this.sessionDoc.lobbyReadyPlayerIds = (this.sessionDoc.lobbyReadyPlayerIds ?? []).filter(
        (id) => id !== existing.id,
      );
      this.syncLobbyRoomPlayers();
      this.sessionSequence += 1;
      this.broadcastShellSync();
      return httpOk({
        roomCode: this.roomCode,
        role: "player",
        playerId: existing.id,
        playerName: existing.name,
      });
    }
    const seat = this.freeSeat();
    if (seat === null) {
      return httpError(409, "room_full", "This room is full.", { retryable: false });
    }
    const player = this.addLobbyPlayer({
      playerId: identity.sub,
      name: playerName,
      authSubject: identity.sub,
      seat,
      decklist: typeof body.decklist === "string" ? body.decklist : null,
      constructedDeckRegistration: body.constructedDeckRegistration,
      sealedRegistration: body.sealedRegistration,
    });
    this.sessionSequence += 1;
    this.broadcastShellSync();
    return httpOk({
      roomCode: this.roomCode,
      role: "player",
      playerId: player.id,
      playerName: player.name,
    });
  }

  private httpSwitchToSpectator(
    body: Record<string, unknown>,
    identity: Identity,
  ): CoreHttpResultAlias {
    const player =
      (typeof body.playerId === "string"
        ? this.sessionDoc.players.find((candidate) => candidate.id === body.playerId)
        : undefined) ?? this.knownPlayerFor(identity);
    if (!player) {
      return httpError(404, "room_membership_changed", "This seat is no longer in the room.", {
        retryable: false,
      });
    }
    player.leftAt = this.deps.clock.now();
    player.leftReason = "manual";
    this.sessionDoc.lobbyReadyPlayerIds = (this.sessionDoc.lobbyReadyPlayerIds ?? []).filter(
      (id) => id !== player.id,
    );
    const spectator = this.upsertSpectator(identity, player.name);
    this.spectators = this.spectators.filter(
      (candidate) => candidate.authSubject !== identity.sub || candidate === spectator,
    );
    for (const connection of this.connections.values()) {
      if (connection.playerId === player.id) {
        connection.viewerRole = "spectator";
        connection.playerId = null;
        connection.spectatorName = spectator.displayName;
      }
    }
    this.syncLobbyRoomPlayers();
    this.sessionSequence += 1;
    this.broadcastShellSync();
    this.sendSpectatorRoster();
    return httpOk({ roomCode: this.roomCode, spectatorName: spectator.displayName });
  }

  private httpTakeSeat(body: Record<string, unknown>, identity: Identity): CoreHttpResultAlias {
    const spectator = this.upsertSpectator(
      identity,
      sanitizePlayerName(body.playerName, identity.name),
    );
    const preferredPlayerId =
      typeof body.preferredPlayerId === "string" ? body.preferredPlayerId : null;
    let player = preferredPlayerId
      ? this.sessionDoc.players.find(
          (candidate) =>
            candidate.id === preferredPlayerId &&
            (!this.authSubjectByPlayerId[candidate.id] ||
              this.authSubjectByPlayerId[candidate.id] === identity.sub),
        )
      : undefined;
    if (player) {
      player.leftAt = undefined;
      player.leftReason = undefined;
      this.authSubjectByPlayerId[player.id] = identity.sub;
      const controlled = (this.controlledByAuthSubject[identity.sub] ??= []);
      if (!controlled.includes(player.id)) controlled.push(player.id);
    } else {
      const existingLeft = this.sessionDoc.players.find(
        (candidate) =>
          candidate.leftAt !== undefined &&
          this.authSubjectByPlayerId[candidate.id] === identity.sub,
      );
      if (existingLeft) {
        existingLeft.leftAt = undefined;
        existingLeft.leftReason = undefined;
        player = existingLeft;
      }
    }
    if (!player) {
      const seat =
        Number.isInteger(body.seatIndex) &&
        Number(body.seatIndex) >= 0 &&
        Number(body.seatIndex) < maxSeatsForVariant(this.seed.gameVariant) &&
        !this.sessionDoc.players.some(
          (candidate) => candidate.seat === Number(body.seatIndex) && !candidate.leftAt,
        )
          ? Number(body.seatIndex)
          : this.freeSeat();
      if (seat === null) {
        return httpError(409, "room_full", "There are no free seats in this room.", {
          retryable: false,
        });
      }
      player = this.addLobbyPlayer({
        playerId: identity.sub,
        name: spectator.displayName,
        authSubject: identity.sub,
        seat,
        decklist: typeof body.decklist === "string" ? body.decklist : null,
        sealedRegistration: body.sealedRegistration,
      });
    }
    this.spectators = this.spectators.filter((candidate) => candidate.authSubject !== identity.sub);
    this.sessionSequence += 1;
    this.broadcastShellSync();
    this.sendSpectatorRoster();
    return httpOk({
      roomCode: this.roomCode,
      playerId: player.id,
      playerName: player.name,
      role: "player",
    });
  }

  private httpResolveMembership(identity: Identity): CoreHttpResultAlias {
    const player = this.knownPlayerFor(identity);
    const redirectedRoomCode = this.sessionDoc.nextRoomCode?.trim();
    if (redirectedRoomCode) {
      // The original returns the linked room and `redirectedFromRoomCode` so a restoring client
      // follows the advanced room chain (`35qz5rkx7yexy.js:21930-21965`).
      if (player && !player.leftAt) {
        return httpOk({
          roomCode: redirectedRoomCode,
          role: "player",
          playerId: player.id,
          playerName: player.name,
          playerIds: this.sessionDoc.players
            .filter((candidate) => !candidate.leftAt)
            .map((candidate) => candidate.id),
          redirectedFromRoomCode: this.roomCode,
        });
      }
      const redirectedSpectator = this.spectatorForSubject(identity.sub);
      if (redirectedSpectator) {
        return httpOk({
          roomCode: redirectedRoomCode,
          role: "spectator",
          spectatorName: redirectedSpectator.displayName,
          playerIds: this.sessionDoc.players
            .filter((candidate) => !candidate.leftAt)
            .map((candidate) => candidate.id),
          redirectedFromRoomCode: this.roomCode,
        });
      }
    }
    if (player && !player.leftAt) {
      return httpOk({
        roomCode: this.roomCode,
        role: "player",
        playerId: player.id,
        playerName: player.name,
        playerIds: this.sessionDoc.players
          .filter((candidate) => !candidate.leftAt)
          .map((candidate) => candidate.id),
      });
    }
    const spectator = this.spectatorForSubject(identity.sub);
    if (spectator) {
      return httpOk({
        roomCode: this.roomCode,
        role: "spectator",
        spectatorName: spectator.displayName,
        playerIds: this.sessionDoc.players
          .filter((candidate) => !candidate.leftAt)
          .map((candidate) => candidate.id),
      });
    }
    return httpOk({ roomCode: this.roomCode, role: "absent" });
  }

  private httpLeaveRoom(body: Record<string, unknown>, identity: Identity): CoreHttpResultAlias {
    if (body.viewerRole === "spectator") {
      this.spectators = this.spectators.filter(
        (spectator) => spectator.authSubject !== identity.sub,
      );
      this.sendSpectatorRoster();
      return httpOk({ seatKept: false });
    }
    const player = this.knownPlayerFor(identity);
    if (!player) {
      const spectator = this.spectatorForSubject(identity.sub);
      if (spectator) {
        this.spectators = this.spectators.filter(
          (candidate) => candidate.authSubject !== identity.sub,
        );
        this.sendSpectatorRoster();
      }
      return httpOk({ seatKept: false });
    }
    if (body.keepMatchSeat === true) return httpOk({ seatKept: true });
    player.leftAt = this.deps.clock.now();
    player.leftReason = "manual";
    this.sessionDoc.lobbyReadyPlayerIds = (this.sessionDoc.lobbyReadyPlayerIds ?? []).filter(
      (id) => id !== player.id,
    );
    const live = this.room.players.find((candidate) => candidate.id === player.id);
    if (live) {
      live.leftAt = player.leftAt;
      live.leftReason = "manual";
    }
    if (this.room.phase !== "lobby") {
      const remaining = this.sessionDoc.players.filter((candidate) => !candidate.leftAt);
      if (remaining.length === 1 && remaining[0]) {
        this.room.gameOutcome = {
          winnerPlayerIds: [remaining[0].id],
          reason: "concession",
          decidedAtTurnNumber: this.room.turnNumber ?? 1,
        };
        this.sessionDoc.matchTermination = {
          status: "completed",
          reason: "concession",
          endedAt: this.deps.clock.now(),
          winnerPlayerIds: [remaining[0].id],
        };
      }
    }
    this.syncLobbyRoomPlayers();
    this.sessionSequence += 1;
    this.broadcastShellSync();
    this.broadcastSnapshot();
    return httpOk({ seatKept: false });
  }

  private httpAbandonMatch(body: Record<string, unknown>, identity: Identity): CoreHttpResultAlias {
    const player = this.knownPlayerFor(identity);
    const actorId = typeof body.playerId === "string" ? body.playerId : player?.id;
    if (!player || !actorId) {
      return httpError(
        404,
        "room_membership_changed",
        "This player is not registered in the room.",
        {
          retryable: false,
        },
      );
    }
    const opponents = this.sessionDoc.players.filter(
      (candidate) => !candidate.leftAt && candidate.id !== actorId,
    );
    this.sessionDoc.matchTermination = {
      status: "aborted",
      reason: "concession",
      endedAt: this.deps.clock.now(),
      winnerPlayerIds: opponents.map((candidate) => candidate.id),
    };
    if (this.room.phase !== "lobby") {
      this.room.gameOutcome = {
        winnerPlayerIds: opponents.map((candidate) => candidate.id),
        reason: "concession",
        decidedAtTurnNumber: this.room.turnNumber ?? 1,
      };
    }
    this.sessionSequence += 1;
    this.broadcastShellSync();
    this.broadcastSnapshot();
    return httpOk({ roomCode: this.roomCode });
  }

  private httpClaimDisconnectWin(
    body: Record<string, unknown>,
    identity: Identity,
  ): CoreHttpResultAlias {
    const player = this.knownPlayerFor(identity);
    if (!player) {
      return httpError(
        404,
        "room_membership_changed",
        "This player is not registered in the room.",
        {
          retryable: false,
        },
      );
    }
    if (this.room.phase === "lobby") {
      return httpError(409, "claim_not_available", "There is no active match to claim.", {
        retryable: false,
      });
    }
    const opponents = this.sessionDoc.players.filter(
      (candidate) => !candidate.leftAt && candidate.id !== player.id,
    );
    const disconnected = opponents.filter((candidate) => !this.playerHasConnection(candidate.id));
    if (disconnected.length === 0) {
      return httpError(409, "claim_not_available", "Your opponent is still connected.", {
        retryable: false,
      });
    }
    this.room.gameOutcome = {
      winnerPlayerIds: [player.id],
      reason: "concession",
      decidedAtTurnNumber: this.room.turnNumber ?? 1,
    };
    this.sessionDoc.matchTermination = {
      status: "completed",
      reason: "disconnect",
      endedAt: this.deps.clock.now(),
      winnerPlayerIds: [player.id],
    };
    this.sessionSequence += 1;
    this.broadcastShellSync();
    this.broadcastSnapshot();
    return httpOk({ roomCode: this.roomCode, winnerPlayerId: player.id });
  }

  private async httpReturnToLobby(
    body: Record<string, unknown>,
    identity: Identity,
  ): Promise<CoreHttpResultAlias> {
    const player = this.knownPlayerFor(identity);
    if (!player) {
      return httpError(
        404,
        "room_membership_changed",
        "This player is not registered in the room.",
        {
          retryable: false,
        },
      );
    }
    if (this.room.phase === "lobby") {
      return httpOk({ roomCode: this.roomCode, lobbyRoomCode: this.roomCode });
    }
    // First return allocates a fresh lobby room through the coordinator and moves both players
    // (ids/identities/decks). Later returns from the same completed room follow the same linked
    // code so both players land in one lobby (original `returnLobbyRoomCode` semantics).
    let lobbyRoomCode = this.sessionDoc.returnLobbyRoomCode?.trim() || "";
    if (!lobbyRoomCode) {
      try {
        lobbyRoomCode = await this.allocateLinkedRoom({
          autoStart: false,
          seriesId: newId("series"),
          seriesStartedAt: this.deps.clock.now(),
          gameNumber: 1,
          winsByPlayerId: {},
          previousRoomCode: this.roomCode,
        });
      } catch (error) {
        return httpError(
          500,
          "runtime_persistence_failed",
          error instanceof Error ? error.message : "Could not allocate the lobby room.",
          { retryable: true },
        );
      }
      this.sessionDoc.returnLobbyRoomCode = lobbyRoomCode;
      this.room.returnLobbyRoomCode = lobbyRoomCode;
    }
    const returnedAt = this.deps.clock.now();
    player.leftAt = returnedAt;
    player.leftReason = "returned_to_lobby";
    const live = this.room.players.find((candidate) => candidate.id === player.id);
    if (live) {
      live.leftAt = returnedAt;
      live.leftReason = "returned_to_lobby";
    }
    this.sessionSequence += 1;
    this.broadcastShellSync();
    this.broadcastSnapshot();
    return httpOk({ roomCode: this.roomCode, lobbyRoomCode });
  }

  private async httpCreateNextGame(
    body: Record<string, unknown>,
    identity: Identity,
  ): Promise<CoreHttpResultAlias> {
    const player = this.knownPlayerFor(identity);
    if (!player) {
      return httpError(
        404,
        "room_membership_changed",
        "This player is not registered in the room.",
        {
          retryable: false,
        },
      );
    }
    if (this.sessionDoc.returnLobbyRoomCode) {
      return httpError(409, "invalid_phase", "This match is returning to the lobby.", {
        retryable: false,
      });
    }
    if (this.sessionDoc.nextRoomCode) {
      return httpError(409, "room_advanced", "The next game is already starting.", {
        retryable: false,
        continuationRoomCode: this.sessionDoc.nextRoomCode,
      });
    }
    if (this.sessionDoc.matchFormat === "bo1") {
      // Original BO1 "Next Game" copy: "Create a fresh board while keeping this match room open."
      // No winner reports / series bookkeeping exist in BO1, so the room resets its board in place.
      const gameResolved =
        this.room.gameOutcome !== undefined ||
        this.sessionDoc.matchTermination?.status === "completed";
      if (!gameResolved) {
        return httpError(
          409,
          "game_result_required",
          "Finish this game before starting the next one.",
          { retryable: false },
        );
      }
      try {
        this.sessionDoc.seriesId = newId("series");
        this.sessionDoc.seriesStartedAt = this.deps.clock.now();
        this.sessionDoc.gameNumber = 1;
        this.sessionDoc.winsByPlayerId = {};
        this.sessionDoc.bo3CompletedGames = 0;
        this.sessionDoc.pendingGameResult = undefined;
        this.sessionDoc.rematchRequestedPlayerIds = [];
        this.sessionDoc.usedBattlefieldsByPlayerId = undefined;
        delete this.sessionDoc.matchTermination;
        delete this.sessionDoc.nextRoomCode;
        delete this.sessionDoc.returnLobbyRoomCode;
        await this.initializeGame();
        this.broadcastShellSync(true);
        this.broadcastSnapshot();
        await this.driveBotSeats();
        return httpOk({ roomCode: this.roomCode, phase: this.sessionDoc.phase });
      } catch (error) {
        return httpError(
          500,
          "runtime_persistence_failed",
          error instanceof Error ? error.message : "Could not create the next game.",
          { retryable: true },
        );
      }
    }
    if (this.seriesWinnerId() || (this.sessionDoc.gameNumber ?? 1) >= 3) {
      return httpError(409, "series_complete", "The series is already complete.", {
        retryable: false,
      });
    }
    const gameResolved =
      typeof this.sessionDoc.pendingGameResult?.resolvedWinnerPlayerId === "string";
    if (!gameResolved) {
      return httpError(
        409,
        "game_result_required",
        "Confirm this game's winner before starting the next game.",
        { retryable: false },
      );
    }
    try {
      // A series game is a fresh linked room; battlefields used in this game are unavailable in
      // later games of the same series.
      const used = this.usedBattlefieldsForNextGame();
      const gameNumber = (this.sessionDoc.gameNumber ?? 1) + 1;
      const nextRoomCode = await this.allocateLinkedRoom({
        seriesId: this.sessionDoc.seriesId ?? this.roomCode,
        seriesStartedAt: this.sessionDoc.seriesStartedAt,
        gameNumber,
        winsByPlayerId: { ...(this.sessionDoc.winsByPlayerId ?? {}) },
        usedBattlefieldsByPlayerId: used,
        previousRoomCode: this.roomCode,
      });
      this.sessionDoc.usedBattlefieldsByPlayerId = used;
      this.sessionDoc.gameNumber = gameNumber;
      this.sessionDoc.pendingGameResult = undefined;
      this.sessionDoc.rematchRequestedPlayerIds = [];
      this.sessionDoc.nextRoomCode = nextRoomCode;
      this.room.nextRoomCode = nextRoomCode;
      this.broadcastShellSync();
      this.broadcastSnapshot();
      return httpOk({
        roomCode: this.roomCode,
        nextRoomCode,
        phase: "sideboarding",
      });
    } catch (error) {
      return httpError(
        500,
        "runtime_persistence_failed",
        error instanceof Error ? error.message : "Could not create the next game.",
        {
          retryable: true,
        },
      );
    }
  }

  private async httpRoomSeriesAction(
    body: Record<string, unknown>,
    identity: Identity,
  ): Promise<CoreHttpResultAlias> {
    const action = isRecord(body.action)
      ? body.action
      : typeof body.actionType === "string"
        ? { ...body, type: body.actionType }
        : body;
    if (typeof action.type !== "string") {
      return httpError(400, "invalid_room_request", "A room series action is required.", {
        retryable: false,
      });
    }
    const player = this.knownPlayerFor(identity);
    if (!player) {
      return httpError(
        404,
        "room_membership_changed",
        "This player is not registered in the room.",
        {
          retryable: false,
        },
      );
    }
    const result = await this.applyRoomShellAction(player.id, action);
    if (!result.ok) return httpError(409, result.code, result.message, { retryable: false });
    this.sessionSequence += 1;
    this.broadcastShellSync();
    if (result.snapshot) this.broadcastSnapshot();
    return httpOk({ roomCode: this.roomCode });
  }

  /** Header/nav helper for tests. */
  static createRoomCode(): string {
    return generateRoomCode();
  }

  /** Chat/unit-test hook: number of live connections. */
  connectionCount(): number {
    return this.connections.size;
  }

  connection(connectionId: string): ConnectionState | undefined {
    return this.connections.get(connectionId);
  }
}

/** The deck sections a player submitted (used by tests). */
export type { DeckSections, CardInstance, ChainEntry, GameplayLogEntry, MatchFormat, PlayMode };
