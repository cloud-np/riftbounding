/**
 * Match runtime — the live realtime gameplay client.
 *
 * Faithful port of `.recon/pretty/playapp/1w8d13szpogkp.js` (module 432014 / 618260 / 797897 /
 * 118154), the original `useRealtimeGameplayRuntime` hook, reshaped as a framework-light class:
 *
 *  - PartySocket to `party "match"`, room = `gameInstanceId`, query `{playerId, roomCode}`,
 *    `maxRetries: 0`, `connectionTimeout: 10000` (module 111243 `b`)
 *  - `join_shell` / `join_game` / `resume_game` flow, join-answer timeout 20s → `close(4010,
 *    "Realtime join was not answered")`
 *  - liveness probe: `ping` when idle 20s, 8s timeout → `close(4009, "Realtime liveness probe
 *    timed out")`
 *  - authoritative sequencing: snapshot / patch commit (`baseSequence+1`) / noop ack / resync,
 *    rune-count rejection → resync, rewind/forward reset tokens
 *  - single in-flight gameplay action with `clientActionId` + `clientBaseSequence`, 5s ack timeout
 *    (+2 resends) → `GameplayActionOutcomeUnknownError` + resync; shell actions 8s ack timeout
 *  - optimistic intents applied through the @rift/engine adapter with rollback on authoritative
 *    reconciliation
 *  - close-code handling 4001/4004/4005/4007/4008/4009/4010/4014 and reconnection backoff
 *    `min(15000, 1000·2^(n-1)) + floor(250·random)`; stalled detection after 3 failures / 15s
 *  - presence publishing (hover/ping/emote/typing) throttled to 750ms, `presence_update`
 *  - chat, spectator roster, spectator grants, rewind confirmation, action clock hydration
 */

import type {
  ActionClock,
  AuthoritativePatchCommitMessage,
  AuthoritativeSnapshotMessage,
  ClientToServerMessage,
  EmoteId,
  GameplayAction,
  GameplayLogEntry,
  Room,
  RoomSessionDoc,
  RawActionClock,
  RoomShellAction,
  RuntimePatch,
  Spectator,
  ViewerRole,
  WireEnvelope,
} from "@rift/protocol";
import { OPTIMISTIC_ACTIONS } from "@rift/protocol";
import { getAuthToken } from "./auth";
import { REALTIME_MESSAGES, realtimeHost } from "./config";
import { applyGameActionOptimistic, type EngineActionContext } from "./adapters/engine";
import {
  applyRuntimePatch,
  cooldownUntil,
  isHistoryNavigationAction,
  resetToken,
  runeCountsPreserved,
  runePoolCounts,
  RUNE_COUNT_CHANGED_MESSAGE,
  type AuthoritativeReset,
} from "./adapters/sync";
import { createPresenceStore, type PresenceStore } from "./presence";
import { createMatchSocket } from "./socket";
import { createStore, type ExternalStore } from "./store";

/* ------------------------------------------------------------------ errors (module 618260/797897) */

export const GAMEPLAY_ACTION_PENDING_ERROR = "GameplayActionPendingError";
export const GAMEPLAY_ACTION_STALE_STATE_ERROR = "GameplayActionStaleStateError";
export const GAMEPLAY_TRANSPORT_UNAVAILABLE_ERROR = "GameplayTransportUnavailableError";
export const GAMEPLAY_ACTION_OUTCOME_UNKNOWN_ERROR = "GameplayActionOutcomeUnknownError";
export const GAMEPLAY_FORWARD_UNAVAILABLE_ERROR = "GameplayForwardUnavailableError";
export const AUTO_PAY_UNAVAILABLE_ERROR = "auto_pay_unavailable";
export const AUTO_PAY_UNAVAILABLE_MESSAGE =
  "Auto-pay could not complete because the card or available resources changed. No resources were spent.";

export class AutoPayUnavailableError extends Error {
  constructor() {
    super(AUTO_PAY_UNAVAILABLE_MESSAGE);
    this.name = "AutoPayUnavailableError";
  }
}

export function gameplayActionPendingError(): Error {
  const error = new Error("Gameplay action already pending.");
  error.name = GAMEPLAY_ACTION_PENDING_ERROR;
  return error;
}

export function isGameplayActionPendingError(error: unknown): boolean {
  return error instanceof Error && error.name === GAMEPLAY_ACTION_PENDING_ERROR;
}

export function isGameplayActionOutcomeUnknownError(error: unknown): boolean {
  return error instanceof Error && error.name === GAMEPLAY_ACTION_OUTCOME_UNKNOWN_ERROR;
}

export interface StaleStateError extends Error {
  retryReady?: boolean;
}

export function gameplayStaleStateError(input: {
  message: string;
  retryReady?: boolean;
}): StaleStateError {
  const error = new Error(input.message) as StaleStateError;
  error.name = GAMEPLAY_ACTION_STALE_STATE_ERROR;
  if (input.retryReady !== undefined) error.retryReady = input.retryReady;
  return error;
}

export function isGameplayStaleStateError(error: unknown): error is StaleStateError {
  return (
    error instanceof Error &&
    error.name === GAMEPLAY_ACTION_STALE_STATE_ERROR &&
    typeof (error as StaleStateError).retryReady === "boolean"
  );
}

export function gameplayTransportUnavailableError(
  message: string = REALTIME_MESSAGES.connectionLost,
): Error {
  const error = new Error(message);
  error.name = GAMEPLAY_TRANSPORT_UNAVAILABLE_ERROR;
  return error;
}

export function isGameplayTransportUnavailableError(error: unknown): boolean {
  return error instanceof Error && error.name === GAMEPLAY_TRANSPORT_UNAVAILABLE_ERROR;
}

export function gameplayOutcomeUnknownError(message: string): Error {
  const error = new Error(message);
  error.name = GAMEPLAY_ACTION_OUTCOME_UNKNOWN_ERROR;
  return error;
}

export function gameplayForwardUnavailableError(message: string): Error {
  const error = new Error(message);
  error.name = GAMEPLAY_FORWARD_UNAVAILABLE_ERROR;
  return error;
}

export function isGameplayForwardUnavailableError(error: unknown): boolean {
  return error instanceof Error && error.name === GAMEPLAY_FORWARD_UNAVAILABLE_ERROR;
}

/** Strict rooms (R2-int, §5): a `rules_*` rejection carrying its ReasonCode and rule. */
export const RULES_REJECTION_ERROR = "RulesRejectionError";

export interface RulesRejectionError extends Error {
  code: string;
  rule: string;
  detail?: string;
}

/** Error for a rejected gameplay intent; strict frames (`rule` present) keep code/rule/detail. */
export function gameplayRejectionError(
  text: string,
  code: string,
  frame: Record<string, unknown>,
): Error {
  const error = new Error(text);
  if (typeof frame.rule !== "string") return error;
  error.name = RULES_REJECTION_ERROR;
  return Object.assign(error, {
    code,
    rule: frame.rule,
    ...(typeof frame.detail === "string" ? { detail: frame.detail } : {}),
  });
}

export function isRulesRejectionError(error: unknown): error is RulesRejectionError {
  return (
    error instanceof Error &&
    error.name === RULES_REJECTION_ERROR &&
    typeof (error as RulesRejectionError).code === "string" &&
    typeof (error as RulesRejectionError).rule === "string"
  );
}

/* ------------------------------------------------------------------ protocol constants */

/** `495270.g` — party close code for "match superseded" (also used by the server). */
export const CLOSE_CODE_MATCH_SUPERSEDED = 4007;
/** `495270.y` — close code counted in the close-streak retry budget. */
export const CLOSE_CODE_RETRY_COUNTED = 4008;
export const CLOSE_CODE_LIVENESS_TIMEOUT = 4009;
export const CLOSE_CODE_JOIN_UNANSWERED = 4010;
export const CLOSE_CODE_SOCIAL_TERMINAL = 4014;
export const CLOSE_CODE_SUPERSEDED_ALT = 4001;
export const CLOSE_CODE_REAUTHORIZE = 4005;
export const CLOSE_CODE_STARTUP_RECOVERY = 4004;

export const STALE_ACTION_STATE_CODE = "stale_action_state";
export const CONTROL_SUPERSEDED_CODE = "control_superseded";
export const ACTIVITY_HISTORY_SEATED_CODE = "activity_history_seated";
export const MATCH_CODE = "match";

/** `o.g` / `o.n` user-facing transport messages. */
export const REALTIME_CONNECTION_FAILED_MESSAGE = REALTIME_MESSAGES.connectionFailed;
export const REALTIME_CONNECTION_LOST_MESSAGE = REALTIME_MESSAGES.connectionLost;

export const STARTUP_RECOVERY_EXHAUSTED_MESSAGE =
  "The live realtime match runtime could not be started automatically after several retries. Retry the connection.";
export const ROOM_UNAVAILABLE_MESSAGE =
  "This room is unavailable: the server can no longer load it. Return to the lobby to start a new game.";
export const AUTH_TOKEN_REFRESH_UNAVAILABLE_MESSAGE =
  "Sign-in token refresh is temporarily unavailable. Your room is safe.";
export const AUTH_TOKEN_MISSING_MESSAGE =
  "A sign-in token is temporarily unavailable. Your room is safe.";
export const SEAT_SUPERSEDED_MESSAGE = "This seat was resumed from another tab or device.";
export const RESYNCING_MESSAGE = "Realtime match state is resyncing. Please wait a moment.";
export const BOOTSTRAP_STARTING_MESSAGE =
  "The live realtime match runtime is still starting. Please wait a moment.";
export const RUNTIME_NOT_ACTIVE_MESSAGE = "The live realtime match runtime is not active.";
export const GAMEPLAY_NOT_READY_MESSAGE = "Gameplay transport is not ready.";
export const MAX_STARTUP_RECONNECT_ATTEMPTS = 5;
export const JOIN_ANSWER_TIMEOUT_MS = 20_000;
export const HEARTBEAT_IDLE_MS = 20_000;
export const HEARTBEAT_TIMEOUT_MS = 8_000;
export const PRESENCE_THROTTLE_MS = 750;
export const SHELL_ACTION_ACK_TIMEOUT_MS = 8_000;
export const GAMEPLAY_ACTION_ACK_TIMEOUT_MS = 5_000;
export const GAMEPLAY_ACTION_MAX_RESENDS = 2;
export const SHELL_ACTION_TIMEOUT_MESSAGE = "The realtime room did not acknowledge the action.";
export const SPECTATOR_GRANT_TIMEOUT_MESSAGE =
  "The realtime room did not acknowledge spectator visibility.";
export const ACTIVITY_HISTORY_TIMEOUT_MS = 10_000;
export const ACTIVITY_HISTORY_REQUEST_TIMEOUT_MESSAGE = "Activity history request timed out.";
export const CHAT_ENTRY_LIMIT = 60;
export const RECOVERED_ACTION_ID_LIMIT = 8;

const AUTH_RECOVERY_MESSAGES: Record<string, string> = {
  refresh_token:
    "Your sign-in token could not be refreshed automatically. Retry the connection or sign in again.",
  retry_verification:
    "Sign-in verification is still unavailable. Your room is safe; retry when the connection recovers.",
};

const GAMEPLAY_BOOTSTRAP_UNAVAILABLE_MESSAGE =
  "The live realtime match runtime is no longer available. This can happen after a deploy or room restart, and the active game cannot be resumed automatically.";

/* ------------------------------------------------------------------ state */

export type ConnectionState = "idle" | "connecting" | "open" | "closed" | "error";
export type SessionPhase =
  | "disconnected"
  | "connecting_shell"
  | "joining_gameplay"
  | "resyncing"
  | "live"
  | "bootstrap_required"
  | "superseded";
export type MutationPhase = "idle" | "pending";
export type ConnectionRecovery = "none" | "retry" | "unavailable";

export interface ChatAccess {
  canSend: boolean;
  authorId: string | null;
  judgeChannels?: Array<{ callId: string; visibility: "public" | "private"; canSend: boolean }>;
}

export interface JudgeCall {
  id: string;
  status: "open" | "answered" | "closed" | "expired" | (string & {});
  requestedByPlayerId?: string;
  requestedAt: number;
  [k: string]: unknown;
}

export interface JudgeFeedbackEntry {
  callId: string;
  rating: "helpful" | "unclear";
  status: "pending" | "recorded" | "duplicate" | "failed";
  retryable: boolean;
}

export interface AuthoritativeHistoryNavigation {
  kind: "rewind" | "forward";
  gameInstanceId: string;
  sequence: number;
  token: string;
  burstToken: string;
  count: number;
}

export interface RewindConfirmation {
  requestId: string;
  requesterPlayerId: string;
  approverPlayerId: string;
  approverPlayerIds?: string[];
  opponentMeaningfulActionCount: number;
  requestedAt: number;
  expiresAt: number;
}

export interface PendingIntent {
  clientActionId: string;
  actorPlayerId: string;
  action: GameplayAction;
  clientBaseSequence: number;
  branchEpoch: number;
  /** optimistic room after applying this intent (undefined when the engine refused) */
  optimisticRoom?: Room;
}

/**
 * Room-shell metadata visible to the board.
 *
 * The original merges these session-doc fields on top of the authoritative room
 * (`35qz5rkx7yexy.js:26880-27230`, 27160-27200) so the game-over overlay can render the live BO3
 * score, both reports and the linked-room handoff without waiting for a snapshot.
 */
export interface MatchMetadata {
  roomCode: string;
  gameNumber: number;
  seriesId?: string;
  winsByPlayerId: Record<string, number>;
  pendingGameResult?: Room["pendingGameResult"];
  rematchRequestedPlayerIds: string[];
  nextRoomCode?: string;
  returnLobbyRoomCode?: string;
  matchTermination?: Room["matchTermination"];
}

export function mergeRoomShellMetadata(
  room: Room,
  sessionDoc: RoomSessionDoc | null | undefined,
): Room {
  if (!sessionDoc) return room;
  const next: Room = { ...room };
  if (sessionDoc.winsByPlayerId) next.winsByPlayerId = { ...sessionDoc.winsByPlayerId };
  if (sessionDoc.pendingGameResult) {
    next.pendingGameResult = {
      ...sessionDoc.pendingGameResult,
      winnerByReporterPlayerId: { ...sessionDoc.pendingGameResult.winnerByReporterPlayerId },
    };
  } else {
    delete next.pendingGameResult;
  }
  if (sessionDoc.rematchRequestedPlayerIds) {
    next.rematchRequestedPlayerIds = [...sessionDoc.rematchRequestedPlayerIds];
  } else {
    delete next.rematchRequestedPlayerIds;
  }
  if (sessionDoc.nextRoomCode) next.nextRoomCode = sessionDoc.nextRoomCode;
  else delete next.nextRoomCode;
  if (sessionDoc.returnLobbyRoomCode) {
    next.returnLobbyRoomCode = sessionDoc.returnLobbyRoomCode;
  } else {
    delete next.returnLobbyRoomCode;
  }
  if (sessionDoc.previousRoomCode) next.previousRoomCode = sessionDoc.previousRoomCode;
  else delete next.previousRoomCode;
  if (sessionDoc.seriesId) next.seriesId = sessionDoc.seriesId;
  if (sessionDoc.gameNumber !== undefined) next.gameNumber = sessionDoc.gameNumber;
  if (sessionDoc.matchTermination) {
    next.matchTermination = {
      ...sessionDoc.matchTermination,
      ...(sessionDoc.matchTermination.winnerPlayerIds
        ? { winnerPlayerIds: [...sessionDoc.matchTermination.winnerPlayerIds] }
        : {}),
    };
  } else {
    delete next.matchTermination;
  }
  return next;
}

export interface MatchRuntimeState {
  connectionState: ConnectionState;
  sessionPhase: SessionPhase;
  mutationPhase: MutationPhase;
  connectedPlayerIds: string[];
  hasPresenceSnapshot: boolean;
  presenceStatusByPlayerId: Record<string, { online: boolean; lastDisconnected: number | null }>;
  chatEntries: Array<Record<string, unknown>>;
  chatAccess: ChatAccess | null;
  judgeCall: JudgeCall | null;
  judgeCalls: JudgeCall[];
  judgeCallCooldownUntil: number | null;
  judgeFeedbackByCallId: Map<string, JudgeFeedbackEntry>;
  spectatorRoster: Spectator[];
  roomShellSessionDoc: RoomSessionDoc | null;
  roomShellSequence: number | null;
  authoritativeProjectedRoom: Room | null;
  authoritativeSequence: number | null;
  /** optimistic projection (authoritative + pending intent); `null` when there is no pending intent */
  optimisticRoom: Room | null;
  pendingIntent: PendingIntent | null;
  actionClockSnapshot: ActionClock | null;
  lastAuthoritativeReset: AuthoritativeReset | null;
  lastAuthoritativeHistoryNavigation: AuthoritativeHistoryNavigation | null;
  rewindConfirmation: RewindConfirmation | null;
  matchLogEntries: GameplayLogEntry[];
  lastError: string | null;
  connectionStalled: boolean;
  authFailureReason: string | null;
  authRecovery: "reauthenticate" | "refresh_token" | "retry_verification" | null;
  authoritativeSyncVersion: number;
  recoveredCommittedClientActionIds: ReadonlySet<string>;
  unsettledClientActionId: string | null;
  connectionRecovery: ConnectionRecovery;
  gameplayReady: boolean;
  gameplayTransportReady: boolean;
  gameplayMutationBlocked: boolean;
  gameplayActionPending: boolean;
}

export const INITIAL_MATCH_RUNTIME_STATE: MatchRuntimeState = {
  connectionState: "idle",
  sessionPhase: "disconnected",
  mutationPhase: "idle",
  connectedPlayerIds: [],
  hasPresenceSnapshot: false,
  presenceStatusByPlayerId: {},
  chatEntries: [],
  chatAccess: null,
  judgeCall: null,
  judgeCalls: [],
  judgeCallCooldownUntil: null,
  judgeFeedbackByCallId: new Map(),
  spectatorRoster: [],
  roomShellSessionDoc: null,
  roomShellSequence: null,
  authoritativeProjectedRoom: null,
  authoritativeSequence: null,
  optimisticRoom: null,
  pendingIntent: null,
  actionClockSnapshot: null,
  lastAuthoritativeReset: null,
  lastAuthoritativeHistoryNavigation: null,
  rewindConfirmation: null,
  matchLogEntries: [],
  lastError: null,
  connectionStalled: false,
  authFailureReason: null,
  authRecovery: null,
  authoritativeSyncVersion: 0,
  recoveredCommittedClientActionIds: new Set(),
  unsettledClientActionId: null,
  connectionRecovery: "none",
  gameplayReady: false,
  gameplayTransportReady: false,
  gameplayMutationBlocked: true,
  gameplayActionPending: false,
};

/* ------------------------------------------------------------------ session / socket seams */

export interface MatchSession {
  roomCode: string;
  playerId: string;
  playerName: string;
  viewerRole: ViewerRole;
  spectatorName?: string;
  playMode: "constructed" | "sealed";
  deckRulesMode: "standard" | "unrestricted";
  lastKnownPhase?: RoomSessionDoc["phase"];
  activePlayerId?: string;
  controlledPlayerIds?: string[];
}

export interface RealtimeSession {
  gameInstanceId: string;
}

export interface RuntimeSocket {
  readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onopen: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onclose: ((event: CloseEvent) => void) | null;
}

export interface MatchRuntimeOptions {
  session: MatchSession;
  realtimeSession: RealtimeSession;
  viewerRole?: ViewerRole;
  broadcastView?: boolean;
  gameplayEnabled?: boolean;
  authSuspended?: boolean;
  authTokenProvider?: (options?: { skipCache?: boolean }) => Promise<string | null>;
  socketFactory?: (options: {
    room: string;
    id: string;
    query: Record<string, string>;
  }) => RuntimeSocket;
  engineMode?: EngineActionContext["mode"];
  now?: () => number;
  random?: () => number;
  onRoomMembershipInvalidated?: (input: {
    roomCode: string;
    viewerRole: ViewerRole;
    playerId: string;
    [k: string]: unknown;
  }) => Promise<void> | void;
  onAccountBanned?: () => void;
  onReset?: (reset: AuthoritativeReset | null) => void;
  onMatchLog?: (entries: GameplayLogEntry[]) => void;
  onRoomShellSync?: (doc: RoomSessionDoc | null, sequence: number) => void;
  onAuthoritativeRoom?: (room: Room, sequence: number) => void;
  onPresenceEvent?: (event: unknown) => void;
}

export type MatchRuntimeStore = ExternalStore<MatchRuntimeState> & {
  getState: () => MatchRuntimeState;
};

interface PendingActionRequest {
  clientActionId: string;
  requestKind: "shell" | "gameplay";
  resolve: () => void;
  reject: (error: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
  onCommit?: (commit: { before: Room; after: Room } | undefined) => void;
  onNoop?: () => void;
  clientBaseSequence?: number;
  authoritativeBranchEpoch?: number;
  serializedIntent?: string;
  resendCount?: number;
}

interface UnsettledAction {
  clientActionId: string;
  actorPlayerId: string;
  onCommit?: (commit: { before: Room; after: Room } | undefined) => void;
}

function uuid(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `act-${Math.random().toString(36).slice(2, 10)}`;
}

function actionId(prefix = ""): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? `${prefix}${crypto.randomUUID()}`
    : `${prefix}act-${Math.random().toString(36).slice(2, 10)}`;
}

const AUTH_RECOVERY_SET: ReadonlySet<string> = new Set([
  "connection_reauthorization_required",
  "player_not_registered",
  "seat_control_denied",
  "spectator_session_denied",
]);

const ACTIVE_GAMEPLAY_PHASES: ReadonlySet<string> = new Set([
  "sideboarding",
  "battlefield_pick",
  "initiative_roll",
  "first_player_choice",
  "mulligan",
  "in_game",
]);

export function isActiveGameplayPhase(phase: string | null | undefined): boolean {
  return typeof phase === "string" && ACTIVE_GAMEPLAY_PHASES.has(phase);
}

export interface ParsedRealtimeMessage extends WireEnvelope {
  type: string;
  [k: string]: unknown;
}

/** Loose authoritative frame (snapshot / patch commit / noop ack) used by the decision helper. */
export interface AuthoritativeWireMessage extends ParsedRealtimeMessage {
  sequence: number;
  baseSequence?: number;
  action?: { type: string };
  clientActionId?: string;
  snapshot?: Room;
  gameplayLog?: GameplayLogEntry[];
  patch?: RuntimePatch;
  actionClock?: RawActionClock;
}

/** `495270.N` — parse + normalise one server frame; invalid frames return null. */
export function parseRealtimeMessage(data: unknown): ParsedRealtimeMessage | null {
  if (typeof data !== "string") return null;
  try {
    const parsed = JSON.parse(data) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const message = parsed as ParsedRealtimeMessage;
    if (typeof message.type !== "string") return null;
    if (message.type === "error") {
      const hasReason = "authReason" in message;
      const hasRecovery = "authRecovery" in message;
      if (hasReason || hasRecovery) {
        const reason = message.authReason;
        const recovery = message.authRecovery;
        const reasonSet = new Set([
          "missing",
          "not_configured",
          "malformed_token",
          "unsupported_token",
          "invalid_claims",
          "invalid_authorized_party",
          "pending_session",
          "expired_token",
          "token_not_active",
          "unknown_key",
          "invalid_signature",
          "verification_failed",
          "token_provider_unavailable",
          "token_provider_timeout",
        ]);
        const recoverySet = new Set(["retry_verification", "refresh_token", "reauthenticate"]);
        if (
          hasReason &&
          hasRecovery &&
          typeof reason === "string" &&
          reasonSet.has(reason) &&
          typeof recovery === "string" &&
          recoverySet.has(recovery)
        ) {
          const mapped =
            reason === "missing"
              ? {
                  authRecovery: "reauthenticate",
                  realtimeCode: "auth_required",
                  realtimeRetryable: false,
                }
              : reason === "not_configured" ||
                  reason === "verification_failed" ||
                  reason === "unknown_key" ||
                  reason === "token_provider_unavailable" ||
                  reason === "token_provider_timeout"
                ? {
                    authRecovery: "retry_verification",
                    realtimeCode: "auth_service_unavailable",
                    realtimeRetryable: true,
                  }
                : reason === "expired_token" || reason === "token_not_active"
                  ? {
                      authRecovery: "refresh_token",
                      realtimeCode: "auth_token_rejected",
                      realtimeRetryable: true,
                    }
                  : {
                      authRecovery: "reauthenticate",
                      realtimeCode: "auth_token_rejected",
                      realtimeRetryable: false,
                    };
          if (
            mapped.authRecovery === recovery &&
            mapped.realtimeCode === message.code &&
            mapped.realtimeRetryable === (message.retryable === true)
          ) {
            return message;
          }
        }
        const { authReason: _reason, authRecovery: _recovery, ...rest } = message;
        return rest as ParsedRealtimeMessage;
      }
      if ("authoritativeSequence" in message) {
        const sequence = message.authoritativeSequence;
        if (!(typeof sequence === "number" && Number.isSafeInteger(sequence) && sequence >= 0)) {
          const { authoritativeSequence: _sequence, ...rest } = message;
          return rest as ParsedRealtimeMessage;
        }
      }
    }
    return message;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ liveness probe (module 114032) */

export interface LivenessProbe {
  acceptPong: (pong: { probeId: string; sentAt: number }) => void;
  dispose: () => void;
  markInbound: () => void;
  probe: () => void;
  wake: () => void;
}

/** `114032.f` — the original liveness probe helper, ported verbatim. */
export function createLivenessProbe(options: {
  probeId: string;
  send: (serialized: string) => void;
  isCurrent: () => boolean;
  onDead: () => void;
  onRoundTrip?: (ms: number) => void;
  now?: () => number;
  idleIntervalMs?: number;
  timeoutMs?: number;
  serializeProbe?: (input: { probeId: string; sentAt: number }) => string;
}): LivenessProbe {
  const now = options.now ?? (() => Date.now());
  const idleIntervalMs = options.idleIntervalMs ?? HEARTBEAT_IDLE_MS;
  const timeoutMs = options.timeoutMs ?? HEARTBEAT_TIMEOUT_MS;
  const serializeProbe =
    options.serializeProbe ??
    ((input) =>
      JSON.stringify({ type: "ping", gameInstanceId: input.probeId, sentAt: input.sentAt }));
  let disposed = false;
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  let timeoutTimer: ReturnType<typeof setTimeout> | null = null;
  let deadline: number | null = null;
  let awaitingPong = false;
  let lastSentAt: number | null = null;

  const clearIdle = () => {
    if (idleTimer !== null) clearTimeout(idleTimer);
    idleTimer = null;
  };
  const clearTimeoutTimer = () => {
    if (timeoutTimer !== null) clearTimeout(timeoutTimer);
    timeoutTimer = null;
    deadline = null;
  };
  const dispose = () => {
    disposed = true;
    clearIdle();
    clearTimeoutTimer();
    lastSentAt = null;
  };
  const onDead = () => {
    if (disposed) return;
    const current = options.isCurrent();
    dispose();
    if (current) options.onDead();
  };
  const scheduleIdle = () => {
    clearIdle();
    if (disposed) return;
    idleTimer = setTimeout(probe, idleIntervalMs);
  };
  const acceptPongAfterTimeout = (graceMs: number): boolean => {
    if (disposed || awaitingPong || deadline === null) return false;
    if (now() - deadline < graceMs) return false;
    awaitingPong = true;
    clearTimeoutTimer();
    probe();
    return true;
  };
  function probe(): void {
    if (disposed) return;
    clearIdle();
    if (timeoutTimer !== null) return;
    if (!options.isCurrent()) {
      scheduleIdle();
      return;
    }
    const sentAt = now();
    try {
      options.send(serializeProbe({ probeId: options.probeId, sentAt }));
    } catch {
      onDead();
      return;
    }
    lastSentAt = sentAt;
    deadline = now() + timeoutMs;
    timeoutTimer = setTimeout(() => {
      if (!acceptPongAfterTimeout(1000)) onDead();
    }, timeoutMs);
  }
  const markInbound = () => {
    if (disposed) return;
    clearTimeoutTimer();
    awaitingPong = false;
    scheduleIdle();
  };

  scheduleIdle();
  return {
    acceptPong: (pong) => {
      if (disposed || pong.probeId !== options.probeId) return;
      markInbound();
      if (lastSentAt !== null && pong.sentAt === lastSentAt) {
        options.onRoundTrip?.(Math.max(0, now() - lastSentAt));
        lastSentAt = null;
      }
    },
    dispose,
    markInbound,
    probe,
    wake: () => {
      if (disposed || !options.isCurrent()) return;
      if (!acceptPongAfterTimeout(0)) probe();
    },
  };
}

/* ------------------------------------------------------------------ runtime */

interface MatchRuntimeInternals {
  socket: RuntimeSocket | null;
  socketId: string | null;
  joinedShell: boolean;
  joinedGameplay: boolean;
  joinedGameplayOnce: boolean;
  /** current join mode (`tW.current`): "none" | "shell" | "gameplay" */
  currentJoinMode: "none" | "shell" | "gameplay";
  lastReceivedSequence: number | null;
  branchEpoch: number;
  /** commit log: sequence → {before, after} (≤64 entries) */
  commits: Map<number, { before: Room; after: Room }>;
  pendingRequest: PendingActionRequest | null;
  unsettledAction: UnsettledAction | null;
  recoveredActionIds: Set<string>;
  historyNavigation: AuthoritativeHistoryNavigation | null;
  probe: LivenessProbe | null;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  reconnectAttempts: number;
  reconnectStreak: { failures: number; firstAt: number } | null;
  stalled: boolean;
  startupAttempts: number;
  startupRetry: boolean;
  authRetryExhausted: boolean;
  skipCacheToken: boolean;
  closeStreak: { closes: number; firstAt: number } | null;
  terminal: boolean;
  roleChangeInFlight: boolean;
  joinTimer: ReturnType<typeof setTimeout> | null;
  joinKind: "shell" | "gameplay" | "resync" | null;
  /** whether the current socket ever reached OPEN (original `eb`) */
  everOpened: boolean;
  superseded: boolean;
  /** skip `resume_game` on the next join (original `tT.current` after a runtime reset) */
  skipResume: boolean;
  /** membership/role no longer valid → do not reconnect (original `eq.current = identity`) */
  membershipInvalidated: boolean;
  /** a join/resume was sent and no authoritative state has arrived yet (`eW.current`) */
  awaitingAuthoritative: boolean;
  reportRequest: {
    clientReportId: string;
    resolve: () => void;
    reject: (error: Error) => void;
  } | null;
  presenceQueue: Record<string, unknown>;
  presenceLastSentAt: number;
  presenceTimer: ReturnType<typeof setTimeout> | null;
  typingTimers: Map<string, ReturnType<typeof setTimeout>>;
  activityRequests: Map<
    string,
    {
      resolve: (value: unknown) => void;
      reject: (error: Error) => void;
      timeout: ReturnType<typeof setTimeout>;
    }
  >;
  disposed: boolean;
  phaseHintRejectedFor: string | null;
  pendingJoinRole: "shell" | "gameplay" | null;
}

export class MatchRuntime {
  readonly store: MatchRuntimeStore;
  /** live presence (hover/ping/emote/typing) — the original returns `presenceStore` from the hook */
  readonly presence: PresenceStore = createPresenceStore();
  private readonly options: MatchRuntimeOptions;
  private readonly now: () => number;
  private readonly random: () => number;
  private internals: MatchRuntimeInternals;
  private lastShellPhase: RoomSessionDoc["phase"] | null = null;
  private phaseHint: RoomSessionDoc["phase"] | null = null;
  /** Serializes shell actions so a fast second click is never dropped by the in-flight guard. */
  private shellActionQueue: Promise<void> = Promise.resolve();
  private readonly setState: (updater: (state: MatchRuntimeState) => MatchRuntimeState) => void;

  constructor(options: MatchRuntimeOptions) {
    this.options = options;
    this.now = options.now ?? (() => Date.now());
    this.random = options.random ?? Math.random;
    const store = createStore<MatchRuntimeState>(INITIAL_MATCH_RUNTIME_STATE);
    this.store = { ...store, getState: store.getSnapshot };
    this.setState = (updater) => {
      const next = updater(store.getSnapshot());
      store.setSnapshot(this.withDerivedState(next));
    };
    this.internals = {
      socket: null,
      socketId: null,
      joinedShell: false,
      joinedGameplay: false,
      joinedGameplayOnce: false,
      currentJoinMode: "none",
      lastReceivedSequence: null,
      branchEpoch: 0,
      commits: new Map(),
      pendingRequest: null,
      unsettledAction: null,
      recoveredActionIds: new Set(),
      historyNavigation: null,
      probe: null,
      reconnectTimer: null,
      reconnectAttempts: 0,
      reconnectStreak: null,
      stalled: false,
      startupAttempts: 0,
      startupRetry: false,
      authRetryExhausted: false,
      skipCacheToken: false,
      closeStreak: null,
      terminal: false,
      roleChangeInFlight: false,
      joinTimer: null,
      joinKind: null,
      everOpened: false,
      superseded: false,
      skipResume: false,
      membershipInvalidated: false,
      awaitingAuthoritative: false,
      reportRequest: null,
      presenceQueue: {},
      presenceLastSentAt: 0,
      presenceTimer: null,
      typingTimers: new Map(),
      activityRequests: new Map(),
      disposed: false,
      phaseHintRejectedFor: null,
      pendingJoinRole: null,
    };
    this.phaseHint = options.session.lastKnownPhase ?? null;
  }

  /** Recompute the derived readiness flags exactly like the original hook's return values. */
  private withDerivedState(state: MatchRuntimeState): MatchRuntimeState {
    const internals = this.internals;
    const activePhase = isActiveGameplayPhase(this.lastShellPhase);
    const gameplayReady = activePhase && state.authoritativeProjectedRoom !== null;
    const gameplayTransportReady =
      state.connectionState === "open" &&
      activePhase &&
      state.sessionPhase === "live" &&
      state.authoritativeProjectedRoom !== null &&
      internals.joinedGameplay;
    const gameplayMutationBlocked =
      state.sessionPhase !== "live" || state.mutationPhase === "pending";
    if (
      state.gameplayReady === gameplayReady &&
      state.gameplayTransportReady === gameplayTransportReady &&
      state.gameplayMutationBlocked === gameplayMutationBlocked
    ) {
      return state;
    }
    return { ...state, gameplayReady, gameplayTransportReady, gameplayMutationBlocked };
  }

  /* ---------------------------------------------------------------- lifecycle */

  start(): void {
    if (this.internals.disposed) return;
    this.connect();
  }

  dispose(): void {
    const internals = this.internals;
    internals.disposed = true;
    this.disposeSocket();
    this.clearTimers();
    this.rejectPendingRequest(REALTIME_MESSAGES.connectionLost);
    this.rejectActivityRequests("The realtime room session ended.");
    this.presence.dispatch({ type: "clear" });
    this.setState(() => ({ ...INITIAL_MATCH_RUNTIME_STATE }));
  }

  private clearTimers(): void {
    const internals = this.internals;
    if (internals.reconnectTimer !== null) clearTimeout(internals.reconnectTimer);
    internals.reconnectTimer = null;
    if (internals.joinTimer !== null) clearTimeout(internals.joinTimer);
    internals.joinTimer = null;
    if (internals.presenceTimer !== null) clearTimeout(internals.presenceTimer);
    internals.presenceTimer = null;
    for (const timer of internals.typingTimers.values()) clearTimeout(timer);
    internals.typingTimers.clear();
  }

  private disposeSocket(): void {
    const internals = this.internals;
    internals.probe?.dispose();
    internals.probe = null;
    const socket = internals.socket;
    if (!socket) return;
    socket.onopen = null;
    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null;
    internals.socket = null;
    try {
      socket.close();
    } catch {
      /* ignore */
    }
  }

  private connect(): void {
    const internals = this.internals;
    if (internals.disposed) return;
    const { realtimeSession, session } = this.options;
    if (internals.socket) return;
    const id = internals.socketId ?? uuid();
    internals.socketId = id;
    this.setState((state) => ({
      ...state,
      connectionState: "connecting",
      sessionPhase: "connecting_shell",
      ...(internals.stalled ? {} : { lastError: null }),
    }));
    const factory =
      this.options.socketFactory ??
      ((opts: { room: string; id: string; query: Record<string, string> }) =>
        createMatchSocket({
          host: realtimeHost(),
          room: opts.room,
          id: opts.id,
          query: opts.query,
        }) as unknown as RuntimeSocket);
    const socket = factory({
      room: realtimeSession.gameInstanceId,
      id,
      query: { playerId: session.playerId, roomCode: session.roomCode },
    });
    internals.socket = socket;
    const rawSend = socket.send.bind(socket);
    socket.send = (data: string) => {
      if (typeof data !== "string") {
        rawSend(data as unknown as string);
        return;
      }
      try {
        const parsed = JSON.parse(data) as { gameInstanceId?: unknown };
        if (
          typeof parsed?.gameInstanceId === "string" &&
          parsed.gameInstanceId !== realtimeSession.gameInstanceId
        ) {
          return;
        }
      } catch {
        /* not JSON — pass through */
      }
      rawSend(data);
    };
    const probe = createLivenessProbe({
      probeId: realtimeSession.gameInstanceId,
      now: this.now,
      send: (serialized) => rawSend(serialized),
      isCurrent: () => internals.socket === socket && socket.readyState === 1,
      onRoundTrip: () => undefined,
      onDead: () => {
        if (internals.socket === socket && socket.readyState === 1) {
          socket.close(CLOSE_CODE_LIVENESS_TIMEOUT, "Realtime liveness probe timed out");
        }
      },
    });
    internals.probe = probe;

    socket.onopen = () => {
      if (internals.socket !== socket) return;
      if (internals.reconnectTimer !== null) clearTimeout(internals.reconnectTimer);
      internals.reconnectTimer = null;
      internals.everOpened = true;
      this.setState((state) => ({
        ...state,
        connectionState: "open",
        ...(internals.stalled ? {} : { lastError: null }),
      }));
      const hintOnly =
        !internals.joinedGameplayOnce &&
        this.lastShellPhase === null &&
        this.internals.phaseHintRejectedFor !== realtimeSession.gameInstanceId &&
        isActiveGameplayPhase(this.phaseHint);
      const shouldJoinGameplay = internals.joinedGameplayOnce || hintOnly;
      internals.pendingJoinRole = shouldJoinGameplay ? "gameplay" : "shell";
      void this.sendJoin(shouldJoinGameplay ? "gameplay" : "shell");
    };
    socket.onmessage = (event: MessageEvent) => this.handleMessage(socket, event);
    socket.onerror = () => {
      if (internals.socket !== socket) return;
      this.setState((state) => ({ ...state, connectionState: "error" }));
    };
    socket.onclose = (event: CloseEvent) => this.handleClose(socket, event);
  }

  private armJoinTimer(socket: RuntimeSocket, kind: "shell" | "gameplay" | "resync"): void {
    const internals = this.internals;
    if (internals.joinTimer !== null) clearTimeout(internals.joinTimer);
    const timer = setTimeout(() => {
      if (internals.joinTimer !== timer) return;
      internals.joinTimer = null;
      if (internals.socket === socket && socket.readyState === 1) {
        socket.close(CLOSE_CODE_JOIN_UNANSWERED, "Realtime join was not answered");
      }
    }, JOIN_ANSWER_TIMEOUT_MS);
    internals.joinTimer = timer;
    internals.joinKind = kind;
  }

  private clearJoinTimer(): void {
    if (this.internals.joinTimer !== null) clearTimeout(this.internals.joinTimer);
    this.internals.joinTimer = null;
    this.internals.joinKind = null;
  }

  /* ---------------------------------------------------------------- auth token queue */

  private async fetchToken(skipCache = false): Promise<string | null> {
    const provider = this.options.authTokenProvider ?? getAuthToken;
    const internals = this.internals;
    const socket = internals.socket;
    const guard = () =>
      socket !== null &&
      internals.socket === socket &&
      socket.readyState === 1 &&
      !this.options.authSuspended;
    if (!guard()) return null;
    const skip = skipCache || internals.skipCacheToken;
    let token: string | null;
    try {
      token = await provider(skip ? { skipCache: true } : undefined);
    } catch (error) {
      if (!guard()) return null;
      internals.skipCacheToken = true;
      const code = (error as { code?: string }).code;
      const attemptsLeft = internals.startupAttempts < MAX_STARTUP_RECONNECT_ATTEMPTS;
      this.setState((state) => ({
        ...state,
        authFailureReason:
          code === "auth_token_provider_timeout"
            ? "token_provider_timeout"
            : "token_provider_unavailable",
        authRecovery: "retry_verification",
        lastError: AUTH_TOKEN_REFRESH_UNAVAILABLE_MESSAGE,
        sessionPhase: "bootstrap_required",
      }));
      void attemptsLeft;
      return null;
    }
    if (!guard()) return null;
    if (!token) {
      internals.skipCacheToken = true;
      this.setState((state) => ({
        ...state,
        authFailureReason: "token_provider_unavailable",
        authRecovery: "retry_verification",
        lastError: AUTH_TOKEN_MISSING_MESSAGE,
        sessionPhase: "bootstrap_required",
      }));
      return null;
    }
    internals.skipCacheToken = false;
    return token;
  }

  private async sendJoin(kind: "shell" | "gameplay"): Promise<boolean> {
    const internals = this.internals;
    const socket = internals.socket;
    if (!socket) return false;
    const { session, realtimeSession, viewerRole, broadcastView } = this.options;
    const token = await this.fetchToken();
    if (!token || internals.socket !== socket) {
      this.closeSocketIfOpen(socket);
      return false;
    }
    const message = this.buildJoinMessage(kind, token);
    let sent = false;
    try {
      socket.send(JSON.stringify(message));
      sent = true;
    } catch {
      sent = false;
    }
    if (!sent) {
      this.closeSocketIfOpen(socket);
      return false;
    }
    if (kind === "gameplay" && (message as { type?: string }).type !== "resume_game") {
      internals.lastReceivedSequence = null;
      internals.skipResume = false;
    }
    internals.currentJoinMode = kind;
    internals.awaitingAuthoritative = true;
    this.armJoinTimer(socket, kind);
    void session;
    void realtimeSession;
    void viewerRole;
    void broadcastView;
    return true;
  }

  private buildJoinMessage(kind: "shell" | "gameplay", authToken: string): Record<string, unknown> {
    const internals = this.internals;
    const { session, realtimeSession, viewerRole = "player", broadcastView } = this.options;
    const base: Record<string, unknown> = {
      gameInstanceId: realtimeSession.gameInstanceId,
      ...(session.playerId ? { playerId: session.playerId } : {}),
      roomCode: session.roomCode,
      authToken,
      viewerRole,
      ...(broadcastView ? { broadcastView: true } : {}),
    };
    if (kind === "gameplay") {
      const resuming =
        !internals.superseded &&
        !internals.skipResume &&
        internals.joinedGameplay &&
        typeof internals.lastReceivedSequence === "number";
      if (resuming) {
        return {
          type: "resume_game",
          ...base,
          ...(typeof internals.lastReceivedSequence === "number"
            ? { clientSequence: internals.lastReceivedSequence }
            : {}),
          ...(internals.unsettledAction
            ? {
                unsettledAction: {
                  clientActionId: internals.unsettledAction.clientActionId,
                  actorPlayerId: internals.unsettledAction.actorPlayerId,
                },
              }
            : {}),
        };
      }
      return { type: "join_game", ...base };
    }
    return { type: "join_shell", ...base };
  }

  private async resync(): Promise<boolean> {
    const internals = this.internals;
    if (!this.canResync() || internals.superseded) return false;
    const socket = internals.socket;
    if (!socket || socket.readyState !== 1 || !this.options.session.playerId) return false;
    internals.awaitingAuthoritative = true;
    internals.currentJoinMode = "gameplay";
    this.setState((state) => ({ ...state, sessionPhase: "resyncing" }));
    const token = await this.fetchToken().catch(() => null);
    if (internals.socket !== socket) return false;
    if (!token) {
      this.closeSocketIfOpen(socket);
      return false;
    }
    try {
      socket.send(
        JSON.stringify({
          type: "resume_game",
          gameInstanceId: this.options.realtimeSession.gameInstanceId,
          playerId: this.options.session.playerId,
          roomCode: this.options.session.roomCode,
          authToken: token,
          viewerRole: this.options.viewerRole ?? "player",
          ...(this.options.broadcastView ? { broadcastView: true } : {}),
          ...(internals.unsettledAction
            ? {
                unsettledAction: {
                  clientActionId: internals.unsettledAction.clientActionId,
                  actorPlayerId: internals.unsettledAction.actorPlayerId,
                },
              }
            : {}),
        }),
      );
    } catch {
      internals.awaitingAuthoritative = false;
      this.closeSocketIfOpen(socket);
      return false;
    }
    this.armJoinTimer(socket, "resync");
    return true;
  }

  /** `rW` — inbound message marks the gameplay runtime usable and clears transient errors. */
  private markRuntimeLive(): void {
    const internals = this.internals;
    internals.joinedGameplay = true;
    internals.awaitingAuthoritative = false;
    internals.reconnectAttempts = 0;
    if (this.store.getSnapshot().lastError !== null) {
      this.setState((state) => ({ ...state, lastError: null }));
    }
  }

  private canResync(): boolean {
    const internals = this.internals;
    return (
      !!internals.socket &&
      internals.socket.readyState === 1 &&
      !!this.options.session.playerId &&
      !!this.options.realtimeSession.gameInstanceId &&
      internals.joinedGameplay
    );
  }

  private closeSocketIfOpen(socket: RuntimeSocket | null): void {
    if (socket && socket.readyState === 1) {
      try {
        socket.close();
      } catch {
        /* ignore */
      }
    }
  }

  /* ---------------------------------------------------------------- message handling */

  private handleMessage(socket: RuntimeSocket, event: MessageEvent): void {
    const internals = this.internals;
    if (internals.socket !== socket) return;
    if (typeof event.data !== "string") return;
    internals.probe?.markInbound();
    if (this.options.authSuspended) return;
    const message = parseRealtimeMessage(event.data);
    if (!message) return;
    const realtimeSession = this.options.realtimeSession;
    const gameInstanceId = message.gameInstanceId;

    switch (message.type) {
      case "pong":
        internals.probe?.acceptPong({
          probeId: String(gameInstanceId ?? ""),
          sentAt: Number(message.sentAt ?? 0),
        });
        return;
      case "auth_session":
        return;
      case "authoritative_resume_ack": {
        if (gameInstanceId !== realtimeSession.gameInstanceId) return;
        internals.joinedGameplay = true;
        if (internals.lastReceivedSequence !== message.sequence) {
          this.requestResync("resume_sequence_mismatch");
          return;
        }
        this.clearJoinTimer();
        this.setState((state) => ({
          ...state,
          sessionPhase: "live",
          authFailureReason: null,
          authRecovery: null,
          authoritativeSyncVersion: state.authoritativeSyncVersion + 1,
        }));
        this.publishPresenceNow();
        return;
      }
      case "presence_event": {
        this.markRuntimeLive();
        this.handlePresenceEvent(message);
        return;
      }
      case "activity_history_page": {
        if (gameInstanceId !== realtimeSession.gameInstanceId) return;
        const request = internals.activityRequests.get(String(message.requestId));
        if (!request) return;
        clearTimeout(request.timeout);
        internals.activityRequests.delete(String(message.requestId));
        request.resolve(message);
        return;
      }
      case "chat_sync":
        this.markRuntimeLive();
        this.setState((state) => ({
          ...state,
          chatEntries: (message.chatEntries as Array<Record<string, unknown>>) ?? [],
          chatAccess: (message.chatAccess as ChatAccess | undefined) ?? null,
        }));
        return;
      case "chat_append": {
        this.markRuntimeLive();
        const entry = message.entry as Record<string, unknown> | undefined;
        if (!entry) return;
        this.setState((state) => {
          if (state.chatEntries.some((candidate) => candidate.id === entry.id)) return state;
          return { ...state, chatEntries: [...state.chatEntries, entry].slice(-CHAT_ENTRY_LIMIT) };
        });
        return;
      }
      case "judge_call_sync": {
        this.markRuntimeLive();
        const calls = (message.judgeCalls as JudgeCall[]) ?? [];
        const deduped = Array.from(new Map(calls.map((call) => [call.id, call])).values()).sort(
          (a, b) => a.requestedAt - b.requestedAt || a.id.localeCompare(b.id),
        );
        this.setState((state) => ({
          ...state,
          judgeCall: (message.judgeCall as JudgeCall | null) ?? null,
          judgeCalls: deduped,
          judgeFeedbackByCallId: pruneJudgeFeedback(state.judgeFeedbackByCallId, deduped),
        }));
        const until = cooldownUntil(message.cooldownRemainingMs, this.now());
        if (until !== null) {
          this.setState((state) =>
            state.judgeCallCooldownUntil !== null && state.judgeCallCooldownUntil >= until
              ? state
              : { ...state, judgeCallCooldownUntil: until },
          );
        }
        return;
      }
      case "judge_feedback_result": {
        this.markRuntimeLive();
        const result = message as unknown as {
          callId: string;
          rating: "helpful" | "unclear";
          status: JudgeFeedbackEntry["status"];
          retryable: boolean;
        };
        this.setState((state) => ({
          ...state,
          judgeFeedbackByCallId: applyJudgeFeedbackResult(state.judgeFeedbackByCallId, result),
        }));
        return;
      }
      case "spectator_roster_sync":
        this.markRuntimeLive();
        this.setState((state) => ({
          ...state,
          spectatorRoster: (message.spectators as Spectator[]) ?? [],
        }));
        return;
      case "rewind_confirmation_state":
        this.markRuntimeLive();
        this.setState((state) => ({
          ...state,
          rewindConfirmation: (message.confirmation as RewindConfirmation | null) ?? null,
        }));
        return;
      case "room_shell_sync": {
        this.markRuntimeLive();
        if (
          internals.joinKind !== "shell" &&
          isActiveGameplayPhase((message.sessionDoc as RoomSessionDoc | null)?.phase)
        ) {
          this.clearJoinTimer();
        }
        const sessionDoc = (message.sessionDoc as RoomSessionDoc | null) ?? null;
        if (message.gameplayRuntimeReset) {
          internals.commits.clear();
          internals.joinedGameplay = false;
          internals.joinedGameplayOnce = false;
          internals.skipResume = true;
          internals.currentJoinMode = "shell";
          internals.lastReceivedSequence = null;
          internals.historyNavigation = null;
          internals.branchEpoch += 1;
          this.rejectPendingRequest("The match returned to the lobby before the action completed.");
          this.setUnsettledAction(null);
          this.presence.dispatch({ type: "clear" });
          this.setState((state) => ({
            ...state,
            sessionPhase: "connecting_shell",
            mutationPhase: "idle",
            authoritativeProjectedRoom: null,
            authoritativeSequence: null,
            optimisticRoom: null,
            pendingIntent: null,
            actionClockSnapshot: null,
            lastAuthoritativeReset: resetToken({
              gameInstanceId: String(message.gameInstanceId ?? ""),
              sequence: Number(message.sequence ?? 0),
              token: `${message.gameInstanceId}:runtime-reset:${message.sequence}:${internals.branchEpoch}`,
            }),
            lastAuthoritativeHistoryNavigation: null,
            rewindConfirmation: null,
            matchLogEntries: [],
          }));
        }
        this.lastShellPhase = sessionDoc?.phase ?? null;
        this.phaseHint = sessionDoc?.phase ?? this.phaseHint;
        this.setState((state) => ({
          ...state,
          roomShellSessionDoc: sessionDoc,
          roomShellSequence: Number(message.sequence ?? 0),
          // Paper the shell doc's live series metadata over the authoritative room, exactly like
          // the original projection merge. This makes the first BO3 report visible immediately
          // (before any snapshot) and keeps wins/termination/next-room current.
          ...(state.authoritativeProjectedRoom && sessionDoc
            ? {
                authoritativeProjectedRoom: mergeRoomShellMetadata(
                  state.authoritativeProjectedRoom,
                  sessionDoc,
                ),
              }
            : {}),
          ...(isActiveGameplayPhase(sessionDoc?.phase)
            ? {}
            : { authoritativeSyncVersion: state.authoritativeSyncVersion + 1 }),
        }));
        this.options.onRoomShellSync?.(sessionDoc, Number(message.sequence ?? 0));
        if (isActiveGameplayPhase(sessionDoc?.phase) && internals.currentJoinMode !== "gameplay") {
          void this.sendJoin("gameplay");
        }
        return;
      }
      case "room_shell_action_ack": {
        this.markRuntimeLive();
        if (typeof message.clientActionId === "string") {
          this.settlePendingAction(String(message.clientActionId), undefined, { noop: false });
        }
        return;
      }
      case "spectator_view_grant_ack": {
        this.markRuntimeLive();
        if (typeof message.clientActionId === "string") {
          this.settlePendingAction(String(message.clientActionId), undefined, { noop: false });
        }
        return;
      }
      case "player_report_result": {
        this.markRuntimeLive();
        const request = internals.reportRequest;
        if (!request || request.clientReportId !== String(message.clientReportId ?? "")) return;
        internals.reportRequest = null;
        const status = message.status;
        if (status === "submitted" || status === "duplicate") {
          request.resolve();
        } else {
          request.reject(
            new Error(
              String(
                message.message ??
                  (status === "throttled"
                    ? "You have submitted too many reports recently."
                    : "Could not submit the report."),
              ),
            ),
          );
        }
        return;
      }
      case "gameplay_action_noop_ack":
      case "authoritative_snapshot":
      case "authoritative_patch_commit":
        this.handleAuthoritative(message as AuthoritativeWireMessage);
        return;
      case "error":
        this.handleServerError(message);
        return;
      default:
        return;
    }
  }

  private handlePresenceEvent(message: ParsedRealtimeMessage): void {
    const event = message.event as Record<string, unknown> | undefined;
    if (!event || typeof event.type !== "string") return;
    this.options.onPresenceEvent?.(event);
    if (event.type === "presence_snapshot" && Array.isArray(event.connectedPlayerIds)) {
      this.publishPresenceNow();
    }
    if ("connectedPlayerIds" in event && Array.isArray(event.connectedPlayerIds)) {
      const ids = Array.from(new Set(event.connectedPlayerIds as string[])).sort();
      this.setState((state) => ({
        ...state,
        hasPresenceSnapshot: true,
        connectedPlayerIds: ids,
        presenceStatusByPlayerId: mergePresence(state.presenceStatusByPlayerId, ids),
      }));
    }
    if (event.type === "hover_state" && typeof event.playerId === "string") {
      this.presence.dispatch({
        type: "hover_state",
        playerId: event.playerId,
        hoveredCardId: typeof event.hoveredCardId === "string" ? event.hoveredCardId : null,
      });
    }
    if (event.type === "card_ping" && typeof event.playerId === "string") {
      const cardId = event.pingedCardId;
      const pingedAt = event.pingedAt;
      const intent = event.pingIntent;
      this.presence.dispatch({
        type: "card_ping",
        playerId: event.playerId,
        cardPing:
          typeof cardId === "string" &&
          typeof pingedAt === "number" &&
          (intent === "general" || intent === "trigger_ability" || intent === "discard_target")
            ? { cardId, pingedAt, receivedAt: this.now(), intent }
            : null,
      });
    }
    if (event.type === "board_emote" && typeof event.playerId === "string") {
      const emoteId = event.emoteId;
      const emoteAt = event.emoteAt;
      this.presence.dispatch({
        type: "board_emote",
        playerId: event.playerId,
        boardEmote:
          typeof emoteId === "string" && typeof emoteAt === "number" ? { emoteId, emoteAt } : null,
      });
    }
    if (
      event.type === "player_presence" &&
      event.state === "offline" &&
      typeof event.playerId === "string"
    ) {
      const playerId = event.playerId;
      this.clearTyping(playerId);
      this.presence.dispatch({ type: "player_offline", playerId });
      this.setState((state) => ({
        ...state,
        presenceStatusByPlayerId: {
          ...state.presenceStatusByPlayerId,
          [playerId]: { online: false, lastDisconnected: this.now() },
        },
      }));
    }
    if (
      event.type === "player_presence" &&
      event.state === "online" &&
      typeof event.playerId === "string"
    ) {
      this.setState((state) => ({
        ...state,
        presenceStatusByPlayerId: {
          ...state.presenceStatusByPlayerId,
          [event.playerId as string]: { online: true, lastDisconnected: null },
        },
      }));
    }
    if (event.type === "chat_typing" && typeof event.playerId === "string") {
      const ttl = event.typingTtlMs;
      this.applyChatTyping(event.playerId, typeof ttl === "number" ? ttl : null);
    }
  }

  /* ---------------------------------------------------------------- authoritative sequencing */

  private handleAuthoritative(message: AuthoritativeWireMessage): void {
    const internals = this.internals;
    const previousRoom =
      internals.lastReceivedSequence !== null
        ? this.store.getSnapshot().authoritativeProjectedRoom
        : null;
    const decision = decideAuthoritativeApplication({
      message,
      sequence: internals.lastReceivedSequence,
      room: previousRoom,
      logEntries: this.store.getSnapshot().matchLogEntries,
      resyncRequested: internals.awaitingAuthoritative,
    });

    if (decision.kind === "ignored") {
      if (decision.acknowledge && message.clientActionId) {
        this.recoverCommittedAction(
          String(message.clientActionId),
          this.commitsFor(message.sequence),
        );
      }
      return;
    }
    if (decision.kind === "resync") {
      if (
        decision.reason === "rune_count_changed" &&
        message.type === "authoritative_patch_commit"
      ) {
        console.warn("[realtime] rejected rune-count-changing authoritative patch", {
          gameInstanceId: message.gameInstanceId,
          actionType: (message.action as { type: string } | undefined)?.type,
          clientActionId: message.clientActionId ?? null,
          baseSequence: message.baseSequence,
          sequence: message.sequence,
          previousRuneCounts: decision.previousRuneCounts,
          nextRuneCounts: decision.nextRuneCounts,
        });
      }
      this.requestResync(decision.reason);
      return;
    }

    try {
      internals.reconnectAttempts = 0;
      this.clearStalled();
      this.clearJoinTimer();
      if (decision.kind === "noop") {
        internals.awaitingAuthoritative = false;
        if (message.clientActionId) {
          this.clearUnsettledAction(String(message.clientActionId));
          this.settlePendingAction(String(message.clientActionId), undefined, { noop: true });
        }
        return;
      }

      const isSnapshot = decision.kind === "snapshot";
      const action = (
        decision.kind === "snapshot" || decision.kind === "patch"
          ? decision.message.action
          : undefined
      ) as { type: string; [key: string]: unknown } | undefined;
      const isHistoryNavigation = isHistoryNavigationAction(action) !== null;
      const sameSequenceSnapshot =
        isSnapshot && previousRoom !== null && internals.lastReceivedSequence === message.sequence;
      if ((isSnapshot && !sameSequenceSnapshot) || isHistoryNavigation) {
        internals.commits.clear();
      } else if (!isSnapshot && previousRoom) {
        internals.commits.set(message.sequence, {
          before: previousRoom,
          after: decision.state.room,
        });
        while (internals.commits.size > 64) {
          const first = internals.commits.keys().next().value;
          if (first === undefined) break;
          internals.commits.delete(first);
        }
      }
      if (isSnapshot) {
        internals.awaitingAuthoritative = false;
        internals.joinedGameplay = true;
        this.publishPresenceNow();
      }

      const logChanged =
        this.store.getSnapshot().matchLogEntries !== decision.state.gameplayLogEntries;
      internals.lastReceivedSequence = decision.state.sequence;
      this.setState((state) => ({
        ...state,
        authoritativeProjectedRoom: decision.state.room,
        authoritativeSequence: decision.state.sequence,
        actionClockSnapshot: hydrateActionClock(decision.state.actionClock, this.now()),
        optimisticRoom: state.pendingIntent?.optimisticRoom ?? null,
        sessionPhase: "live",
        ...(isSnapshot ? { authoritativeSyncVersion: state.authoritativeSyncVersion + 1 } : {}),
      }));
      if (logChanged) this.options.onMatchLog?.(decision.state.gameplayLogEntries);
      this.options.onAuthoritativeRoom?.(decision.state.room, decision.state.sequence);

      if ((isSnapshot && !sameSequenceSnapshot) || isHistoryNavigation) {
        internals.branchEpoch += 1;
        const reset = resetToken({
          action,
          gameInstanceId: String(message.gameInstanceId ?? ""),
          sequence: decision.state.sequence,
          token: `${message.gameInstanceId}:${decision.state.sequence}:${internals.branchEpoch}`,
        });
        internals.historyNavigation = isHistoryNavigation
          ? advanceHistoryNavigation(
              internals.historyNavigation,
              reset as AuthoritativeReset & { kind: "rewind" | "forward" },
            )
          : internals.historyNavigation?.gameInstanceId === reset.gameInstanceId
            ? internals.historyNavigation
            : null;
        this.setState((state) => ({
          ...state,
          lastAuthoritativeReset: reset,
          lastAuthoritativeHistoryNavigation: internals.historyNavigation,
        }));
        this.options.onReset?.(reset);
      }
      if (message.clientActionId) {
        this.recoverCommittedAction(
          String(message.clientActionId),
          isSnapshot || isHistoryNavigation || !previousRoom
            ? undefined
            : { before: previousRoom, after: decision.state.room },
        );
      }
    } catch {
      this.requestResync("apply_failed");
    }
  }

  private commitsFor(sequence: unknown): { before: Room; after: Room } | undefined {
    if (typeof sequence !== "number") return undefined;
    return this.internals.commits.get(sequence);
  }

  private recoverCommittedAction(
    clientActionId: string,
    commit: { before: Room; after: Room } | undefined,
  ): void {
    const internals = this.internals;
    const unsettled = this.clearUnsettledAction(clientActionId);
    if (!this.settlePendingAction(clientActionId, commit, { noop: false }) && unsettled) {
      internals.recoveredActionIds = new Set(
        [...internals.recoveredActionIds, clientActionId].slice(-RECOVERED_ACTION_ID_LIMIT),
      );
      this.setState((state) => ({
        ...state,
        recoveredCommittedClientActionIds: internals.recoveredActionIds,
      }));
      if (commit) unsettled.onCommit?.(commit);
    }
  }

  private setUnsettledAction(action: UnsettledAction | null): void {
    this.internals.unsettledAction = action;
    this.setState((state) =>
      state.unsettledClientActionId === (action?.clientActionId ?? null)
        ? state
        : { ...state, unsettledClientActionId: action?.clientActionId ?? null },
    );
  }

  private clearUnsettledAction(clientActionId: string): UnsettledAction | null {
    const internals = this.internals;
    const current = internals.unsettledAction;
    if (current?.clientActionId !== clientActionId) return null;
    this.setUnsettledAction(null);
    return current;
  }

  private settlePendingAction(
    clientActionId: string,
    commit: { before: Room; after: Room } | undefined,
    options: { noop: boolean },
  ): boolean {
    const request = this.internals.pendingRequest;
    if (!request || request.clientActionId !== clientActionId) return false;
    clearTimeout(request.timeoutId);
    this.internals.pendingRequest = null;
    this.setState((state) => ({
      ...state,
      mutationPhase: "idle",
      pendingIntent: null,
      optimisticRoom: null,
      gameplayActionPending: false,
    }));
    if (options.noop) request.onNoop?.();
    try {
      if (commit) request.onCommit?.(commit);
    } catch (error) {
      request.reject(
        gameplayOutcomeUnknownError(
          "Realtime state changed unexpectedly. Resyncing the live match.",
        ),
      );
      throw error;
    }
    request.resolve();
    return true;
  }

  private rejectPendingRequest(message: string | Error): void {
    const request = this.internals.pendingRequest;
    if (!request) return;
    this.internals.pendingRequest = null;
    clearTimeout(request.timeoutId);
    this.setState((state) => ({
      ...state,
      mutationPhase: "idle",
      pendingIntent: null,
      optimisticRoom: null,
      gameplayActionPending: false,
    }));
    request.reject(
      request.requestKind === "gameplay"
        ? typeof message === "string"
          ? gameplayOutcomeUnknownError(message)
          : message
        : typeof message === "string"
          ? new Error(message)
          : message,
    );
  }

  private requestResync(reason: string): void {
    const internals = this.internals;
    this.setState((state) => ({
      ...state,
      sessionPhase: "resyncing",
      ...(reason === "rune_count_changed" ? { lastError: RUNE_COUNT_CHANGED_MESSAGE } : {}),
    }));
    if (internals.joinedGameplay) {
      void this.resync();
    } else {
      internals.lastReceivedSequence = null;
      this.internals.joinedGameplayOnce = false;
      this.closeSocketIfOpen(internals.socket);
    }
  }

  /* ---------------------------------------------------------------- server errors */

  private handleServerError(message: ParsedRealtimeMessage): void {
    const internals = this.internals;
    const code = String(message.code ?? "");
    const text = String(message.message ?? "");

    // activity history request errors resolve the pending promise
    if (typeof message.requestId === "string") {
      const request = internals.activityRequests.get(message.requestId);
      if (request) {
        clearTimeout(request.timeout);
        internals.activityRequests.delete(message.requestId);
        request.reject(
          code === ACTIVITY_HISTORY_SEATED_CODE
            ? gameplayOutcomeUnknownError(text)
            : new Error(text),
        );
        return;
      }
    }

    if (code === "room_not_found" && message.retryable === false) {
      this.internals.membershipInvalidated = true;
      this.internals.terminal = true;
      this.setState((state) => ({
        ...state,
        connectionState: "error",
        sessionPhase: "disconnected",
        lastError: text,
      }));
      void this.options.onRoomMembershipInvalidated?.({
        roomCode: this.options.session.roomCode,
        viewerRole: this.options.viewerRole ?? "player",
        playerId: this.options.session.playerId,
      });
      this.disposeSocket();
      return;
    }

    if (AUTH_RECOVERY_SET.has(code)) {
      void this.options.onRoomMembershipInvalidated?.({
        roomCode: this.options.session.roomCode,
        viewerRole: this.options.viewerRole ?? "player",
        playerId: this.options.session.playerId,
      });
      this.closeSocketIfOpen(internals.socket);
      return;
    }

    const pending = internals.pendingRequest;
    const clientActionId =
      typeof message.clientActionId === "string" ? message.clientActionId : null;

    const kind = clientActionId
      ? clientActionId.startsWith("spectator-grant:")
        ? "spectator_grant"
        : clientActionId === pending?.clientActionId
          ? "gameplay"
          : "unknown_action"
      : "connection";

    if (code === STALE_ACTION_STATE_CODE) {
      const request = internals.pendingRequest;
      const authoritativeSequence = message.authoritativeSequence;
      const retryReady =
        typeof authoritativeSequence === "number" &&
        typeof internals.lastReceivedSequence === "number" &&
        request?.requestKind === "gameplay" &&
        request.authoritativeBranchEpoch === internals.branchEpoch &&
        (request.clientBaseSequence ?? 0) < authoritativeSequence &&
        internals.lastReceivedSequence === authoritativeSequence;
      if (kind !== "gameplay" || !request || request.requestKind !== "gameplay") return;
      this.setState((state) => ({
        ...state,
        sessionPhase: retryReady ? "live" : "resyncing",
        lastError: null,
      }));
      if (!retryReady) this.requestResync("stale_action_state");
      clearTimeout(request.timeoutId);
      internals.pendingRequest = null;
      this.setState((state) => ({
        ...state,
        mutationPhase: "idle",
        pendingIntent: null,
        optimisticRoom: null,
        gameplayActionPending: false,
      }));
      request.reject(gameplayStaleStateError({ message: text, retryReady }));
      return;
    }

    if (code === CONTROL_SUPERSEDED_CODE) {
      internals.superseded = true;
    }

    if (
      code === "runtime_persistence_failed" &&
      message.mutationClass === "reject_retryable" &&
      message.retryable === true &&
      kind === "gameplay" &&
      pending?.requestKind === "gameplay"
    ) {
      this.rejectPendingRequest(text);
      return;
    }

    if (code === "account_banned" && !this.options.authSuspended) {
      this.options.onAccountBanned?.();
    }

    if (message.authRecovery === "retry_verification" || message.authRecovery === "refresh_token") {
      internals.skipCacheToken = true;
    }
    if (message.authRecovery) {
      this.setState((state) => ({
        ...state,
        authFailureReason: typeof message.authReason === "string" ? message.authReason : null,
        authRecovery: message.authRecovery as MatchRuntimeState["authRecovery"],
      }));
    }

    const canRetryStartupRecovery =
      this.startupRetryAllowed() ||
      (message.authRecovery !== undefined &&
        message.authRecovery !== "reauthenticate" &&
        internals.startupAttempts < MAX_STARTUP_RECONNECT_ATTEMPTS) ||
      (code === "bootstrap_failed" &&
        message.retryable === true &&
        this.lastShellPhase === null &&
        internals.lastReceivedSequence === null &&
        internals.startupAttempts < MAX_STARTUP_RECONNECT_ATTEMPTS);

    const outcome = decideServerErrorOutcome({
      code,
      message: text,
      authRecovery: message.authRecovery,
      mutationClass: message.mutationClass,
      retryable: message.retryable,
      clientActionId,
      roomPhase: this.lastShellPhase,
      hasAuthoritativeSnapshot: internals.lastReceivedSequence !== null,
      canRetryStartupRecovery,
    });

    if (
      code === "runtime_restore_failed" ||
      ((code === "bootstrap_required" || code === "bootstrap_failed") &&
        !outcome.willRetryBootstrap)
    ) {
      internals.membershipInvalidated = true;
      this.setState((state) => ({ ...state, connectionState: "error" }));
    }

    this.setState((state) => ({
      ...state,
      sessionPhase: outcome.nextSessionPhase as SessionPhase,
      lastError: outcome.userMessage,
    }));

    const cooldown =
      code === "judge_call_rate_limited" ? cooldownUntil(message.retryAfterMs, this.now()) : null;
    if (cooldown !== null) {
      this.setState((state) => ({ ...state, judgeCallCooldownUntil: cooldown }));
    }

    let resyncRequested = false;
    if (clientActionId && pending && pending.clientActionId === clientActionId) {
      clearTimeout(pending.timeoutId);
      this.internals.pendingRequest = null;
      if (outcome.shouldRequestResync) {
        this.requestResync("server_error");
        resyncRequested = true;
      }
      this.setState((state) => ({
        ...state,
        mutationPhase: "idle",
        pendingIntent: null,
        optimisticRoom: null,
        gameplayActionPending: false,
      }));
      pending.reject(
        code === AUTO_PAY_UNAVAILABLE_ERROR
          ? new AutoPayUnavailableError()
          : code === "forward_unavailable"
            ? gameplayForwardUnavailableError(text)
            : gameplayRejectionError(outcome.userMessage ?? text, code, message),
      );
    }
    if (outcome.shouldRequestResync && !resyncRequested) this.requestResync("server_error");

    if (outcome.willRetryBootstrap) {
      internals.startupRetry = true;
      const socket = internals.socket;
      if (socket && socket.readyState === 1) {
        this.closeSocketIfOpen(socket);
      } else {
        this.scheduleReconnect({ startup: true });
      }
    }
    if (
      kind === "connection" &&
      internals.socket &&
      internals.joinKind !== "resync" &&
      !message.authRecovery &&
      !outcome.willRetryBootstrap &&
      !outcome.shouldReconcileRoomMembership &&
      code !== "runtime_restore_failed" &&
      code !== "bootstrap_required" &&
      code !== "bootstrap_failed" &&
      message.retryable === true &&
      internals.socket.readyState === 1
    ) {
      this.clearJoinTimer();
      this.closeSocketIfOpen(internals.socket);
    }
  }

  private startupRetryAllowed(): boolean {
    const internals = this.internals;
    return (
      isActiveGameplayPhase(this.lastShellPhase) &&
      internals.startupAttempts < MAX_STARTUP_RECONNECT_ATTEMPTS &&
      !internals.terminal
    );
  }

  /* ---------------------------------------------------------------- close handling */

  private handleClose(socket: RuntimeSocket, event: CloseEvent): void {
    const internals = this.internals;
    if (internals.socket !== socket) return;
    internals.probe?.dispose();
    internals.probe = null;
    if (internals.joinTimer !== null) clearTimeout(internals.joinTimer);
    internals.joinTimer = null;
    internals.socket = null;

    const code = event.code;
    if (code === CLOSE_CODE_MATCH_SUPERSEDED) internals.skipCacheToken = true;
    if (
      code === CLOSE_CODE_STARTUP_RECOVERY ||
      (code === CLOSE_CODE_MATCH_SUPERSEDED &&
        (this.options.viewerRole === "spectator" || this.options.broadcastView))
    ) {
      internals.startupRetry = true;
    }
    const superseded = internals.superseded || code === CLOSE_CODE_SUPERSEDED_ALT;
    const reauthorize = code === CLOSE_CODE_REAUTHORIZE;
    const lostDuringGameplayAction =
      code === CLOSE_CODE_LIVENESS_TIMEOUT || internals.pendingRequest?.requestKind === "gameplay";

    internals.awaitingAuthoritative = false;
    internals.joinedGameplay = false;
    internals.currentJoinMode = "none";

    if (superseded) {
      this.setState((state) => ({ ...state, sessionPhase: "superseded" }));
    }
    this.presence.dispatch({ type: "clear" });
    this.setState((state) => ({
      ...state,
      connectionState: "closed",
      sessionPhase: superseded
        ? "superseded"
        : state.sessionPhase === "superseded"
          ? "superseded"
          : "disconnected",
      connectedPlayerIds: [],
      hasPresenceSnapshot: false,
      presenceStatusByPlayerId: {},
      chatAccess: null,
      spectatorRoster: [],
      lastAuthoritativeHistoryNavigation: null,
      rewindConfirmation: null,
      mutationPhase: "idle",
      judgeFeedbackByCallId: new Map(
        [...state.judgeFeedbackByCallId].map(([id, feedback]) => [
          id,
          feedback.status === "pending"
            ? { ...feedback, status: "failed" as const, retryable: true }
            : feedback,
        ]),
      ),
    }));

    if (internals.roleChangeInFlight || (reauthorize && this.options.onRoomMembershipInvalidated)) {
      this.rejectPendingRequest("The room role changed before the action completed.");
      return;
    }
    if (internals.authRetryExhausted) {
      this.rejectPendingRequest(
        "The sign-in token provider did not recover before the retry limit.",
      );
      return;
    }
    if (superseded) {
      this.rejectPendingRequest("The realtime room connection closed before the action completed.");
      return;
    }
    if (code === CLOSE_CODE_SOCIAL_TERMINAL) {
      // 4014 is terminal (task B11): no reconnect, surface the error.
      this.setState((state) => ({
        ...state,
        connectionState: "error",
        sessionPhase: "disconnected",
        lastError: ROOM_UNAVAILABLE_MESSAGE,
      }));
      this.rejectPendingRequest(ROOM_UNAVAILABLE_MESSAGE);
      return;
    }

    const streakInfo =
      code === CLOSE_CODE_RETRY_COUNTED
        ? (() => {
            const streak = {
              closes: (internals.closeStreak?.closes ?? 0) + 1,
              firstAt: internals.closeStreak?.firstAt ?? this.now(),
            };
            const retryBudgetExhausted =
              this.store.getSnapshot().connectionRecovery === "unavailable" ||
              internals.startupAttempts >= MAX_STARTUP_RECONNECT_ATTEMPTS;
            const terminal =
              streak.closes >= 3 && (retryBudgetExhausted || this.now() - streak.firstAt >= 30_000);
            return { streak, terminal };
          })()
        : null;
    internals.closeStreak = streakInfo?.streak ?? null;
    if (streakInfo?.terminal) {
      internals.membershipInvalidated = true;
      this.setState((state) => ({
        ...state,
        connectionState: "error",
        sessionPhase: "disconnected",
        lastError: ROOM_UNAVAILABLE_MESSAGE,
      }));
      this.rejectPendingRequest(ROOM_UNAVAILABLE_MESSAGE);
      return;
    }

    const shouldReconnect = internals.startupRetry || this.startupRetryAllowed();
    if (shouldReconnect) {
      internals.startupRetry = false;
      if (!internals.stalled) this.setState((state) => ({ ...state, lastError: null }));
      if (!internals.terminal) this.scheduleReconnect({ startup: true });
    } else {
      this.setState((state) => ({
        ...state,
        lastError: lostDuringGameplayAction
          ? null
          : internals.everOpened
            ? REALTIME_MESSAGES.connectionLost
            : REALTIME_MESSAGES.connectionFailed,
      }));
      this.rejectPendingRequest(
        lostDuringGameplayAction
          ? gameplayOutcomeUnknownError(REALTIME_MESSAGES.connectionLost)
          : REALTIME_MESSAGES.connectionLost,
      );
      if (!internals.terminal && this.store.getSnapshot().connectionRecovery !== "unavailable") {
        this.scheduleReconnect({ startup: false });
      }
    }
  }

  private scheduleReconnect(options: { startup: boolean }): void {
    const internals = this.internals;
    if (internals.disposed || internals.terminal || internals.reconnectTimer !== null) return;
    if (internals.membershipInvalidated && !options.startup) return;
    let delay = 1000;
    if (options.startup) {
      internals.startupAttempts += 1;
    } else {
      delay =
        internals.reconnectAttempts <= 0
          ? 0
          : Math.min(15_000, 1000 * 2 ** (internals.reconnectAttempts - 1));
      delay += Math.floor(250 * this.random());
      internals.reconnectAttempts += 1;
    }
    const streak = {
      failures: (internals.reconnectStreak?.failures ?? 0) + 1,
      firstAt: internals.reconnectStreak?.firstAt ?? this.now(),
    };
    internals.reconnectStreak = streak;
    if (streak.failures >= 3 && this.now() - streak.firstAt >= 15_000 && !internals.stalled) {
      internals.stalled = true;
      this.setState((state) => ({
        ...state,
        connectionStalled: true,
        connectionRecovery: "unavailable",
      }));
    }
    const timer = setTimeout(() => {
      if (internals.reconnectTimer !== timer) return;
      internals.reconnectTimer = null;
      if (internals.disposed) return;
      this.setState((state) => ({ ...state, connectionRecovery: "retry" }));
      this.connect();
    }, delay);
    internals.reconnectTimer = timer;
  }

  private clearStalled(): void {
    const internals = this.internals;
    internals.reconnectStreak = null;
    if (internals.stalled) {
      internals.stalled = false;
      this.setState((state) => ({ ...state, connectionStalled: false }));
    }
  }

  /** `retryConnection` — full teardown + reconnect (the UI's "Retry" affordance). */
  retryConnection(): void {
    const internals = this.internals;
    if (internals.disposed) return;
    internals.membershipInvalidated = false;
    internals.terminal = false;
    internals.reconnectAttempts = 0;
    internals.startupAttempts = 0;
    internals.startupRetry = false;
    internals.authRetryExhausted = false;
    internals.superseded = false;
    internals.closeStreak = null;
    internals.joinedGameplayOnce = false;
    internals.joinedGameplay = false;
    internals.lastReceivedSequence = null;
    internals.historyNavigation = null;
    if (internals.reconnectTimer !== null) clearTimeout(internals.reconnectTimer);
    internals.reconnectTimer = null;
    this.clearStalled();
    this.setState((state) => ({
      ...state,
      connectionState: "connecting",
      sessionPhase: "connecting_shell",
      lastError: null,
      connectionRecovery: "none",
    }));
    this.disposeSocket();
    this.connect();
  }

  /** `reconnectNow` — reconnect when the backoff timer is pending. */
  reconnectNow(): void {
    const internals = this.internals;
    if (internals.reconnectTimer === null || internals.membershipInvalidated) return;
    clearTimeout(internals.reconnectTimer);
    internals.reconnectTimer = null;
    internals.reconnectAttempts = 0;
    this.connect();
  }

  /* ---------------------------------------------------------------- presence */

  private queuePresence(fields: Record<string, unknown>): void {
    this.internals.presenceQueue = { ...this.internals.presenceQueue, ...fields };
  }

  private flushPresence(immediate: boolean): void {
    const internals = this.internals;
    const socket = internals.socket;
    if (
      !socket ||
      socket.readyState !== 1 ||
      this.options.authSuspended ||
      this.options.broadcastView
    )
      return;
    const queue = internals.presenceQueue;
    const hasAny = [
      "hoveredCardId",
      "hoveredAt",
      "pingedCardId",
      "pingedAt",
      "pingIntent",
      "emoteId",
      "emoteAt",
      "chatTyping",
    ].some((key) => Object.hasOwn(queue, key));
    if (!hasAny) return;
    if (internals.presenceTimer !== null) {
      clearTimeout(internals.presenceTimer);
      internals.presenceTimer = null;
    }
    try {
      socket.send(
        JSON.stringify({
          type: "presence_update",
          gameInstanceId: this.options.realtimeSession.gameInstanceId,
          ...queue,
        }),
      );
    } catch {
      return;
    }
    internals.presenceQueue = {};
    internals.presenceLastSentAt = this.now();
  }

  private publishPresenceNow(): void {
    this.flushPresence(true);
  }

  publishHoverCardId(cardId: string | null): void {
    const internals = this.internals;
    if (this.options.authSuspended) return;
    this.queuePresence({ hoveredCardId: cardId, hoveredAt: cardId ? this.now() : null });
    this.schedulePresence();
  }

  publishCardPing(
    cardId: string,
    pingedAt: number,
    intent: "general" | "trigger_ability" | "discard_target",
  ): void {
    if (this.options.authSuspended || !cardId) return;
    this.queuePresence({ pingedCardId: cardId, pingedAt, pingIntent: intent });
    this.schedulePresence(true);
  }

  publishBoardEmote(emoteId: EmoteId, emoteAt: number): void {
    if (this.options.authSuspended) return;
    this.queuePresence({ emoteId, emoteAt });
    this.schedulePresence(true);
  }

  publishChatTyping(isTyping: boolean): void {
    if (this.options.authSuspended) return;
    this.queuePresence({ chatTyping: isTyping });
    this.schedulePresence(!isTyping);
  }

  private schedulePresence(immediate = false): void {
    const internals = this.internals;
    if (this.options.broadcastView) return;
    if (immediate) {
      this.flushPresence(true);
      return;
    }
    const wait = Math.max(0, PRESENCE_THROTTLE_MS - (this.now() - internals.presenceLastSentAt));
    if (wait === 0) {
      this.flushPresence(false);
      return;
    }
    if (internals.presenceTimer !== null) return;
    const timer = setTimeout(() => {
      if (internals.presenceTimer !== timer) return;
      internals.presenceTimer = null;
      this.flushPresence(false);
    }, wait);
    internals.presenceTimer = timer;
  }

  private applyChatTyping(playerId: string, ttlMs: number | null): void {
    const internals = this.internals;
    const existing = internals.typingTimers.get(playerId);
    if (existing !== undefined) clearTimeout(existing);
    internals.typingTimers.delete(playerId);
    this.presence.dispatch({
      type: "chat_typing",
      playerId,
      isTyping: typeof ttlMs === "number" && ttlMs > 0,
    });
    this.options.onPresenceEvent?.({ type: "chat_typing", playerId, typingTtlMs: ttlMs });
    if (typeof ttlMs !== "number" || ttlMs <= 0) return;
    const timer = setTimeout(() => {
      internals.typingTimers.delete(playerId);
      this.presence.dispatch({ type: "chat_typing", playerId, isTyping: false });
      this.options.onPresenceEvent?.({ type: "chat_typing", playerId, typingTtlMs: null });
    }, ttlMs);
    internals.typingTimers.set(playerId, timer);
  }

  private clearTyping(playerId: string): void {
    const internals = this.internals;
    const timer = internals.typingTimers.get(playerId);
    if (timer !== undefined) clearTimeout(timer);
    internals.typingTimers.delete(playerId);
  }

  /* ---------------------------------------------------------------- outbound actions */

  /** `sendShellAction` — room_shell_action with 8s ack timeout, serialized per runtime. */
  sendShellAction(
    action: RoomShellAction | { type: string; [k: string]: unknown },
    actorPlayerId?: string,
  ): Promise<void> {
    const next = this.shellActionQueue.then(
      () => this.sendShellActionNow(action, actorPlayerId),
      () => this.sendShellActionNow(action, actorPlayerId),
    );
    this.shellActionQueue = next.catch(() => undefined);
    return next;
  }

  private async waitForShellSocket(timeoutMs = 10_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (this.internals.socket?.readyState === 1 && this.options.session.playerId) return;
      await new Promise<void>((resolve) => setTimeout(resolve, 60));
    }
  }

  private async sendShellActionNow(
    action: RoomShellAction | { type: string; [k: string]: unknown },
    actorPlayerId?: string,
  ): Promise<void> {
    if (this.options.authSuspended) {
      throw gameplayTransportUnavailableError("Room controls are paused while sign-in recovers.");
    }
    // The lobby can show a ready/Start state from the last shell sync while the
    // socket is between reconnects. Give the reconnect a moment instead of
    // dropping the click (a real user would otherwise have to click twice).
    await this.waitForShellSocket();
    const socket = this.internals.socket;
    if (!socket || socket.readyState !== 1 || !this.options.session.playerId) {
      throw new Error(REALTIME_MESSAGES.connectionLost);
    }
    if (this.internals.pendingRequest) throw gameplayActionPendingError();
    const clientActionId = actionId();
    await new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        if (this.internals.pendingRequest?.clientActionId === clientActionId) {
          this.internals.pendingRequest = null;
          this.setState((state) => ({ ...state, mutationPhase: "idle" }));
          reject(new Error(SHELL_ACTION_TIMEOUT_MESSAGE));
        }
      }, SHELL_ACTION_ACK_TIMEOUT_MS);
      this.internals.pendingRequest = {
        clientActionId,
        requestKind: "shell",
        resolve,
        reject,
        timeoutId,
      };
      this.setState((state) => ({ ...state, mutationPhase: "pending" }));
      try {
        socket.send(
          JSON.stringify({
            type: "room_shell_action",
            gameInstanceId: this.options.realtimeSession.gameInstanceId,
            action,
            actorPlayerId,
            clientActionId,
          }),
        );
      } catch (error) {
        if (this.internals.pendingRequest?.clientActionId === clientActionId) {
          this.internals.pendingRequest = null;
          clearTimeout(timeoutId);
          this.setState((state) => ({ ...state, mutationPhase: "idle" }));
        }
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  /**
   * `sendGameplayAction` — optimistic intent + authoritative reconciliation.
   * Returns `"committed" | "noop"` like the original.
   */
  async sendGameplayAction(
    action: GameplayAction,
    actorPlayerId?: string,
    options: {
      clientActionId?: string;
      onSent?: () => void;
      onCommit?: (commit: { before: Room; after: Room } | undefined) => void;
    } = {},
  ): Promise<"committed" | "noop"> {
    const internals = this.internals;
    const state = this.store.getSnapshot();
    if (
      options.clientActionId !== undefined &&
      internals.recoveredActionIds.has(options.clientActionId)
    ) {
      return "committed";
    }
    if (this.options.authSuspended) {
      throw gameplayTransportUnavailableError(
        "Gameplay controls are paused while sign-in recovers.",
      );
    }
    const socket = internals.socket;
    const branchEpochAtSend = internals.branchEpoch;
    const baseSequence = internals.lastReceivedSequence;
    if (
      !this.gameplayTransportReady() ||
      !socket ||
      socket.readyState !== 1 ||
      baseSequence === null
    ) {
      throw gameplayTransportUnavailableError(this.gameplayNotReadyMessage());
    }
    if (internals.pendingRequest) throw gameplayActionPendingError();
    const clientActionId = options.clientActionId ?? actionId();
    const actor = actorPlayerId ?? this.options.session.playerId;

    // optimistic apply (original: `cY` with `cV` set + engine mirror)
    let optimisticRoom: Room | undefined;
    const authoritative = state.authoritativeProjectedRoom;
    if (authoritative && OPTIMISTIC_ACTIONS.has(action.type) && authoritative.phase === "in_game") {
      const result = applyGameActionOptimistic(authoritative, actor, action, {
        now: this.now(),
        rng: this.random,
        mode: this.options.engineMode ?? "multiplayer",
      });
      if (result.ok) optimisticRoom = result.state;
    }
    const intent: PendingIntent = {
      clientActionId,
      actorPlayerId: actor,
      action,
      clientBaseSequence: baseSequence,
      branchEpoch: branchEpochAtSend,
      ...(optimisticRoom ? { optimisticRoom } : {}),
    };

    let outcome: "committed" | "noop" = "committed";
    const serialized = JSON.stringify({
      type: "action_intent",
      gameInstanceId: this.options.realtimeSession.gameInstanceId,
      action,
      actorPlayerId: actor,
      clientActionId,
      clientBaseSequence: baseSequence,
    });

    await new Promise<void>((resolve, reject) => {
      const armTimeout = (): ReturnType<typeof setTimeout> =>
        setTimeout(() => {
          const request = internals.pendingRequest;
          if (request?.requestKind !== "gameplay" || request.clientActionId !== clientActionId)
            return;
          const socketOpen = internals.socket === socket && socket.readyState === 1;
          const resendCount = request.resendCount ?? 0;
          if (socketOpen && resendCount < GAMEPLAY_ACTION_MAX_RESENDS && request.serializedIntent) {
            try {
              socket.send(request.serializedIntent);
              request.resendCount = resendCount + 1;
              request.timeoutId = armTimeout();
              return;
            } catch {
              /* fall through to failure */
            }
          }
          this.internals.pendingRequest = null;
          this.setState((s) => ({
            ...s,
            mutationPhase: "idle",
            pendingIntent: null,
            optimisticRoom: null,
            gameplayActionPending: false,
          }));
          reject(gameplayOutcomeUnknownError("The realtime room did not acknowledge the action."));
          this.requestResync("ack_timeout");
        }, GAMEPLAY_ACTION_ACK_TIMEOUT_MS);

      const timeoutId = armTimeout();
      options.onSent?.();
      if (
        internals.unsettledAction &&
        internals.unsettledAction.clientActionId !== clientActionId
      ) {
        this.setUnsettledAction(null);
      }
      this.internals.pendingRequest = {
        clientActionId,
        requestKind: "gameplay",
        resolve,
        reject: (error: Error) => {
          if (isGameplayActionOutcomeUnknownError(error)) {
            this.setUnsettledAction({
              clientActionId,
              actorPlayerId: actor,
              ...(options.onCommit ? { onCommit: options.onCommit } : {}),
            });
          }
          reject(error);
        },
        timeoutId,
        clientBaseSequence: baseSequence,
        authoritativeBranchEpoch: branchEpochAtSend,
        serializedIntent: serialized,
        resendCount: 0,
        ...(options.onCommit ? { onCommit: options.onCommit } : {}),
        onNoop: () => {
          outcome = "noop";
        },
      };
      this.setState((s) => ({
        ...s,
        mutationPhase: "pending",
        gameplayActionPending: true,
        pendingIntent: intent,
        optimisticRoom: optimisticRoom ?? null,
      }));
      try {
        socket.send(serialized);
      } catch (error) {
        if (this.internals.pendingRequest?.clientActionId === clientActionId) {
          this.internals.pendingRequest = null;
          clearTimeout(timeoutId);
          this.setState((s) => ({
            ...s,
            mutationPhase: "idle",
            pendingIntent: null,
            optimisticRoom: null,
            gameplayActionPending: false,
          }));
        }
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
    return outcome;
  }

  private gameplayTransportReady(): boolean {
    const state = this.store.getSnapshot();
    return (
      state.connectionState === "open" &&
      isActiveGameplayPhase(this.lastShellPhase) &&
      state.sessionPhase === "live" &&
      state.authoritativeProjectedRoom !== null
    );
  }

  private gameplayNotReadyMessage(): string {
    const state = this.store.getSnapshot();
    if (!isActiveGameplayPhase(this.lastShellPhase)) return RUNTIME_NOT_ACTIVE_MESSAGE;
    if (state.sessionPhase === "resyncing") return RESYNCING_MESSAGE;
    if (state.sessionPhase === "bootstrap_required") return BOOTSTRAP_STARTING_MESSAGE;
    if (state.sessionPhase === "superseded") return SEAT_SUPERSEDED_MESSAGE;
    if (state.authoritativeProjectedRoom === null) return BOOTSTRAP_STARTING_MESSAGE;
    if (state.connectionState !== "open") return REALTIME_MESSAGES.connectionLost;
    return GAMEPLAY_NOT_READY_MESSAGE;
  }

  /** `sendChatMessage` — room chat. */
  sendChatMessage(text: string, clientEntryId?: string, judgeCallId?: string): boolean {
    if (this.options.authSuspended) return false;
    const trimmed = text.replace(/\s+/gu, " ").trim();
    if (!trimmed) return false;
    const socket = this.internals.socket;
    if (!socket || socket.readyState !== 1) return false;
    try {
      socket.send(
        JSON.stringify({
          type: "chat_send",
          gameInstanceId: this.options.realtimeSession.gameInstanceId,
          text: trimmed,
          ...(clientEntryId ? { clientEntryId } : {}),
          ...(judgeCallId ? { judgeCallId } : {}),
        }),
      );
      return true;
    } catch {
      return false;
    }
  }

  requestCustomizationRefresh(): boolean {
    const socket = this.internals.socket;
    if (!socket || socket.readyState !== 1 || this.options.broadcastView) return false;
    try {
      socket.send(
        JSON.stringify({
          type: "customization_refresh",
          gameInstanceId: this.options.realtimeSession.gameInstanceId,
        }),
      );
      return true;
    } catch {
      return false;
    }
  }

  /** `sendSpectatorGrantUpdate` — player grants a spectator access to their hidden info. */
  async sendSpectatorGrantUpdate(input: {
    playerId: string;
    audience: "signed_in_spectator";
    spectatorAuthSubject?: string;
    granted: boolean;
  }): Promise<void> {
    const socket = this.internals.socket;
    if (!socket || socket.readyState !== 1) throw new Error(REALTIME_MESSAGES.connectionLost);
    if ((this.options.viewerRole ?? "player") !== "player") {
      throw new Error("Only players can change spectator visibility.");
    }
    if (this.internals.pendingRequest) throw gameplayActionPendingError();
    const clientActionId = actionId("spectator-grant:");
    await new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        if (this.internals.pendingRequest?.clientActionId === clientActionId) {
          this.internals.pendingRequest = null;
          this.setState((state) => ({ ...state, mutationPhase: "idle" }));
          reject(new Error(SPECTATOR_GRANT_TIMEOUT_MESSAGE));
        }
      }, SHELL_ACTION_ACK_TIMEOUT_MS);
      this.internals.pendingRequest = {
        clientActionId,
        requestKind: "shell",
        resolve,
        reject,
        timeoutId,
      };
      this.setState((state) => ({ ...state, mutationPhase: "pending" }));
      try {
        socket.send(
          JSON.stringify({
            type: "spectator_view_grant_update",
            gameInstanceId: this.options.realtimeSession.gameInstanceId,
            playerId: input.playerId,
            audience: input.audience,
            spectatorAuthSubject: input.spectatorAuthSubject,
            granted: input.granted,
            clientActionId,
          }),
        );
      } catch (error) {
        if (this.internals.pendingRequest?.clientActionId === clientActionId) {
          this.internals.pendingRequest = null;
          clearTimeout(timeoutId);
          this.setState((state) => ({ ...state, mutationPhase: "idle" }));
        }
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  /** `loadActivityHistory` — `activity_history_request` with a 10s timeout. */
  loadActivityHistory(before: number | null): Promise<unknown> {
    const socket = this.internals.socket;
    if (!socket || socket.readyState !== 1) {
      return Promise.reject(new Error("Activity history is not connected."));
    }
    const requestId = actionId("activity-history:");
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.internals.activityRequests.delete(requestId);
        reject(new Error(ACTIVITY_HISTORY_REQUEST_TIMEOUT_MESSAGE));
      }, ACTIVITY_HISTORY_TIMEOUT_MS);
      this.internals.activityRequests.set(requestId, { resolve, reject, timeout });
      try {
        socket.send(
          JSON.stringify({
            type: "activity_history_request",
            gameInstanceId: this.options.realtimeSession.gameInstanceId,
            requestId,
            before,
          }),
        );
      } catch {
        clearTimeout(timeout);
        this.internals.activityRequests.delete(requestId);
        reject(new Error("Activity history is not connected."));
      }
    });
  }

  /** `submitPlayerReport` — 10s ack timeout. */
  async submitPlayerReport(input: {
    reportedPlayerId: string;
    targetKind?: "player" | "spectator" | "chat_author" | "judge_answer";
    messageId?: string;
    reason:
      | "harassment_abuse"
      | "cheating_exploiting"
      | "stalling_disruption"
      | "inappropriate_identity"
      | "other";
    comment?: string;
  }): Promise<void> {
    if (this.options.authSuspended) {
      throw new Error("Player reports are paused while sign-in recovers.");
    }
    const socket = this.internals.socket;
    if (!socket || socket.readyState !== 1) {
      throw new Error("Realtime room connection lost. Reconnecting...");
    }
    if (this.options.broadcastView) throw new Error("Reports are unavailable in broadcast view.");
    const clientReportId = actionId();
    await new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error("The realtime room did not acknowledge the report."));
      }, ACTIVITY_HISTORY_TIMEOUT_MS);
      const settle = (fn: () => void) => {
        clearTimeout(timeoutId);
        fn();
      };
      this.internals.reportRequest = {
        clientReportId,
        resolve: () => settle(resolve),
        reject: (error) => settle(() => reject(error)),
      };
      try {
        socket.send(
          JSON.stringify({
            type: "player_report_submit",
            gameInstanceId: this.options.realtimeSession.gameInstanceId,
            clientReportId,
            reportedPlayerId: input.reportedPlayerId,
            ...(input.targetKind ? { targetKind: input.targetKind } : {}),
            ...(input.messageId ? { messageId: input.messageId } : {}),
            reason: input.reason,
            ...(input.comment ? { comment: input.comment } : {}),
          }),
        );
      } catch (error) {
        this.internals.reportRequest = null;
        reject(error instanceof Error ? error : new Error("Could not send the report."));
      }
    });
  }

  private rejectActivityRequests(message: string): void {
    for (const request of this.internals.activityRequests.values()) {
      clearTimeout(request.timeout);
      request.reject(new Error(message));
    }
    this.internals.activityRequests.clear();
  }

  /** Diagnostics mirroring the original metrics counters (module 118154). */
  metrics(): Record<string, unknown> {
    const internals = this.internals;
    return {
      reconnects: internals.reconnectAttempts,
      startupReconnectAttempts: internals.startupAttempts,
      closeStreak: internals.closeStreak?.closes ?? 0,
      lastReceivedSequence: internals.lastReceivedSequence,
      pendingAction: internals.pendingRequest?.requestKind ?? null,
    };
  }
}

/* ------------------------------------------------------------------ helpers */

interface AuthoritativeDecisionInput {
  message: AuthoritativeWireMessage;
  sequence: number | null;
  room: Room | null;
  logEntries: GameplayLogEntry[];
  resyncRequested: boolean;
}

type AuthoritativeDecision =
  | { kind: "ignored"; acknowledge: boolean }
  | { kind: "noop" }
  | {
      kind: "snapshot";
      message: AuthoritativeSnapshotMessage;
      state: {
        room: Room;
        sequence: number;
        gameplayLogEntries: GameplayLogEntry[];
        actionClock?: unknown;
      };
    }
  | {
      kind: "patch";
      message: AuthoritativePatchCommitMessage;
      state: {
        room: Room;
        sequence: number;
        gameplayLogEntries: GameplayLogEntry[];
        actionClock?: unknown;
      };
    }
  | {
      kind: "resync";
      reason: string;
      previousRuneCounts?: Record<string, number | null>;
      nextRuneCounts?: Record<string, number | null>;
    };

/** `1w8d13szpogkp.js:2553-2840` — snapshot/patch/noop decision + atomic patch apply. */
export function decideAuthoritativeApplication(
  input: AuthoritativeDecisionInput,
): AuthoritativeDecision {
  const { message, sequence, room, logEntries, resyncRequested } = input;
  if (message.type === "authoritative_snapshot") {
    const snapshot = message as unknown as AuthoritativeSnapshotMessage;
    if (sequence === null || snapshot.sequence >= sequence || resyncRequested) {
      return {
        kind: "snapshot",
        message: snapshot,
        state: {
          room: snapshot.snapshot,
          sequence: snapshot.sequence,
          gameplayLogEntries: snapshot.gameplayLog ?? [],
          ...(snapshot.actionClock ? { actionClock: snapshot.actionClock } : {}),
        },
      };
    }
    return { kind: "ignored", acknowledge: false };
  }
  if (message.type === "gameplay_action_noop_ack") {
    return sequence !== null && message.sequence === sequence
      ? { kind: "noop" }
      : { kind: "resync", reason: "sequence_gap" };
  }
  const patchMessage = message as unknown as AuthoritativePatchCommitMessage;
  if (sequence !== null && patchMessage.sequence <= sequence)
    return { kind: "ignored", acknowledge: true };
  if (
    sequence === null ||
    patchMessage.baseSequence !== sequence ||
    patchMessage.sequence !== sequence + 1 ||
    room === null ||
    !patchMessage.patch
  ) {
    return { kind: "resync", reason: "sequence_gap" };
  }
  try {
    const next = applyRuntimePatch(
      { room, sequence, gameplayLogEntries: logEntries },
      patchMessage.patch,
    );
    if (!runeCountsPreserved(room, next.room)) {
      return {
        kind: "resync",
        reason: "rune_count_changed",
        previousRuneCounts: runePoolCounts(room),
        nextRuneCounts: runePoolCounts(next.room),
      };
    }
    return {
      kind: "patch",
      message: patchMessage,
      state: {
        room: next.room,
        sequence: patchMessage.sequence,
        gameplayLogEntries: next.gameplayLogEntries,
        ...((next.actionClock ?? patchMessage.actionClock)
          ? { actionClock: next.actionClock ?? patchMessage.actionClock }
          : {}),
      },
    };
  } catch {
    return { kind: "resync", reason: "invalid_patch" };
  }
}

/** `229172.u` — hydrate an action clock snapshot with `receivedAt`. */
export function hydrateActionClock(clock: unknown, now: number): ActionClock | null {
  if (!clock || typeof clock !== "object") return null;
  const source = clock as ActionClock;
  return {
    ...source,
    totals: { ...source.totals },
    activeTargets: source.activeTargets.map((target) => ({ ...target })),
    receivedAt: Math.max(0, Math.trunc(now)),
  };
}

function mergePresence(
  current: Record<string, { online: boolean; lastDisconnected: number | null }>,
  connectedPlayerIds: string[],
): Record<string, { online: boolean; lastDisconnected: number | null }> {
  const connected = new Set(connectedPlayerIds);
  const next: Record<string, { online: boolean; lastDisconnected: number | null }> = {};
  for (const [playerId, status] of Object.entries(current)) {
    if (connected.has(playerId)) {
      next[playerId] = { online: true, lastDisconnected: null };
      continue;
    }
    next[playerId] = { online: false, lastDisconnected: status.lastDisconnected };
  }
  for (const playerId of connectedPlayerIds)
    next[playerId] = { online: true, lastDisconnected: null };
  return next;
}

/** `U()` — drop judge feedback for calls that are no longer answered. */
export function pruneJudgeFeedback(
  feedback: Map<string, JudgeFeedbackEntry>,
  calls: JudgeCall[],
): Map<string, JudgeFeedbackEntry> {
  if (feedback.size === 0) return feedback;
  const answered = new Set(
    calls.filter((call) => call.status === "answered").map((call) => call.id),
  );
  let changed = false;
  const next = new Map<string, JudgeFeedbackEntry>();
  for (const [callId, entry] of feedback) {
    if (answered.has(callId)) next.set(callId, entry);
    else changed = true;
  }
  return changed ? next : feedback;
}

function applyJudgeFeedbackResult(
  feedback: Map<string, JudgeFeedbackEntry>,
  result: {
    callId: string;
    rating: "helpful" | "unclear";
    status: JudgeFeedbackEntry["status"];
    retryable: boolean;
  },
): Map<string, JudgeFeedbackEntry> {
  const current = feedback.get(result.callId);
  if (
    current?.status === "recorded" ||
    current?.status === "duplicate" ||
    (!(result.status === "recorded" && !result.retryable) &&
      (current?.status !== "pending" || current.rating !== result.rating))
  ) {
    return feedback;
  }
  const next = new Map(feedback);
  next.set(result.callId, {
    callId: result.callId,
    rating: result.rating,
    status: result.status,
    retryable: result.retryable,
  });
  return next;
}

function advanceHistoryNavigation(
  current: AuthoritativeHistoryNavigation | null,
  commit: AuthoritativeReset & { kind: "rewind" | "forward" },
): AuthoritativeHistoryNavigation {
  const continuous =
    current?.kind === commit.kind &&
    commit.gameInstanceId === current.gameInstanceId &&
    commit.sequence === current.sequence + 1;
  return {
    ...commit,
    burstToken: continuous ? current.burstToken : commit.token,
    count: continuous ? current.count + 1 : 1,
  };
}

/** `1w8d13szpogkp.js:3141-3224` — server error → session phase + recovery decision. */
export function decideServerErrorOutcome(input: {
  code: string;
  message: string;
  authRecovery?: unknown;
  mutationClass?: unknown;
  retryable?: unknown;
  clientActionId: string | null;
  roomPhase: RoomSessionDoc["phase"] | null;
  hasAuthoritativeSnapshot: boolean;
  canRetryStartupRecovery: boolean;
}): {
  nextSessionPhase: string;
  shouldRetryBootstrap: boolean;
  willRetryBootstrap: boolean;
  shouldReconcileRoomMembership: boolean;
  shouldRequestResync: boolean;
  userMessage: string | null;
} {
  const { code, message } = input;
  if (code === "runtime_restore_failed") {
    return {
      nextSessionPhase: "bootstrap_required",
      shouldRetryBootstrap: false,
      willRetryBootstrap: false,
      shouldReconcileRoomMembership: false,
      shouldRequestResync: false,
      userMessage: message,
    };
  }
  const shouldRetryBootstrap =
    input.authRecovery === "refresh_token" ||
    input.authRecovery === "retry_verification" ||
    (!input.hasAuthoritativeSnapshot &&
      (code === "bootstrap_required" ||
        code === "bootstrap_failed" ||
        (isActiveGameplayPhase(input.roomPhase) && input.retryable === true)));
  const willRetryBootstrap = shouldRetryBootstrap && input.canRetryStartupRecovery;
  const shouldReconcileRoomMembership = code === "bootstrap_required" && !willRetryBootstrap;
  const resyncRequired = input.mutationClass === "resync_required";
  const hasSnapshot = input.hasAuthoritativeSnapshot;
  const shouldRequestResync = resyncRequired
    ? !hasSnapshot
    : code !== CONTROL_SUPERSEDED_CODE &&
      code !== "bootstrap_required" &&
      code !== "forward_unavailable" &&
      input.mutationClass !== "reject_invalid" &&
      input.mutationClass !== "reject_retryable" &&
      (code === "internal_error" || !!input.clientActionId);
  const nextSessionPhase =
    code === CONTROL_SUPERSEDED_CODE
      ? "superseded"
      : input.authRecovery || shouldRetryBootstrap || code === "bootstrap_required"
        ? "bootstrap_required"
        : resyncRequired && !hasSnapshot
          ? "resyncing"
          : "live";
  let userMessage: string | null;
  if (code === CONTROL_SUPERSEDED_CODE) {
    userMessage = SEAT_SUPERSEDED_MESSAGE;
  } else if (input.authRecovery) {
    userMessage = willRetryBootstrap
      ? null
      : input.authRecovery === "refresh_token"
        ? AUTH_RECOVERY_MESSAGES.refresh_token!
        : input.authRecovery === "retry_verification"
          ? AUTH_RECOVERY_MESSAGES.retry_verification!
          : message;
  } else if (code === "bootstrap_required") {
    userMessage =
      input.roomPhase === "in_game" && hasSnapshot
        ? GAMEPLAY_BOOTSTRAP_UNAVAILABLE_MESSAGE
        : willRetryBootstrap
          ? null
          : STARTUP_RECOVERY_EXHAUSTED_MESSAGE;
  } else if (code === "bootstrap_failed" && shouldRetryBootstrap) {
    userMessage = willRetryBootstrap
      ? null
      : isActiveGameplayPhase(input.roomPhase)
        ? STARTUP_RECOVERY_EXHAUSTED_MESSAGE
        : message;
  } else if (code === "forward_unavailable") {
    userMessage = null;
  } else if (
    input.mutationClass === "reject_invalid" ||
    input.mutationClass === "reject_retryable"
  ) {
    // Rejected gameplay (strict rules, illegal action, stale-ish retryable rejection) is normal
    // game feedback: the pending action promise carries the message to the dismissible toast.
    // Never promote it to `lastError`, which drives the blocking Retry/Return banner.
    userMessage = null;
  } else {
    userMessage = message;
  }
  return {
    nextSessionPhase,
    shouldRetryBootstrap,
    willRetryBootstrap,
    shouldReconcileRoomMembership,
    shouldRequestResync,
    userMessage,
  };
}

/** `618260`-adjacent export used by tests. */
