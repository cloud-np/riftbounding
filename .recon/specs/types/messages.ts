/**
 * Riftbound simulator — realtime protocol messages (PartyKit websocket) + room HTTP API.
 *
 * Sources:
 *  - .recon/pretty/playapp/2i0ajg8a836h8.js:1-780   (MESSAGE_TYPES set + per-type payload validators)
 *  - .recon/pretty/playapp/1w8d13szpogkp.js         (runtime message handling, patch engine, action send)
 *  - .recon/pretty/playapp/35qz5rkx7yexy.js         (HTTP room API, lobby/matchmaking)
 *
 * Framing: JSON text frames over wss://realtime.riftatlas-workers.com (PartySocket). All messages carry
 * `gameInstanceId` (room-scoped instance id), most carry `sequence`. Server authority:
 *   authoritative_snapshot (full state) → authoritative_patch_commit (diff, baseSequence+1) →
 *   gameplay_action_noop_ack / error. Client sends action_intent with clientBaseSequence.
 */

import type {
  ActionClock, GameplayLogEntry, RealtimeState, Room, RoomPhase, RoomSessionDoc, Spectator, ViewerRole,
} from "./game-state";

/* ------------------------------------------------------------- framing */

export interface WireEnvelope { gameInstanceId: string; [k: string]: unknown; }

/* ------------------------------------------------------------- client → server */

export interface JoinShellMessage extends WireEnvelope {
  type: "join_shell";
  playerId?: string;
  roomCode: string;
  authToken: string;
  viewerRole?: ViewerRole;
  broadcastView?: boolean;
}
export interface JoinGameMessage extends WireEnvelope {
  type: "join_game";
  playerId?: string;
  roomCode: string;
  authToken: string;
  viewerRole?: ViewerRole;
  broadcastView?: boolean;
}
export interface ResumeGameMessage extends WireEnvelope {
  type: "resume_game";
  playerId?: string;
  authToken: string;
  viewerRole?: ViewerRole;
  broadcastView?: boolean;
  clientSequence?: number;
  unsettledAction?: { clientActionId: string; actorPlayerId: string };
}
export interface PingMessage extends WireEnvelope { type: "ping"; sentAt: number; }
export interface PongMessage extends WireEnvelope { type: "pong"; sentAt: number; }
export interface AuthRefreshMessage extends WireEnvelope { type: "auth_refresh"; clientRequestId: string; authToken: string; }
export interface CustomizationRefreshMessage extends WireEnvelope { type: "customization_refresh"; }
export interface ActivityHistoryRequestMessage extends WireEnvelope {
  type: "activity_history_request";
  requestId: string;
  before: number | null;                 // cursor (ms timestamp)
}
export interface ChatSendMessage extends WireEnvelope { type: "chat_send"; text: string; clientEntryId?: string; judgeCallId?: string; }
export interface JudgeCallCreateMessage extends WireEnvelope { type: "judge_call_create"; clientRequestId: string; question: string; }
export interface JudgeCallPrivateCreateMessage extends WireEnvelope { type: "judge_call_private_create"; clientRequestId: string; question: string; visibility: "private"; }
export interface JudgeCallCloseMessage extends WireEnvelope { type: "judge_call_close"; callId: string; }
export interface JudgeFeedbackSubmitMessage extends WireEnvelope { type: "judge_feedback_submit"; callId: string; rating: "helpful" | "unclear"; }
export interface PlayerReportSubmitMessage extends WireEnvelope {
  type: "player_report_submit";
  clientReportId: string;
  reportedPlayerId: string;
  targetKind?: "player" | "spectator" | "chat_author" | "judge_answer";
  messageId?: string;
  reason: "harassment_abuse" | "cheating_exploiting" | "stalling_disruption" | "inappropriate_identity" | "other";
  comment?: string;
}
export interface PresenceUpdateMessage extends WireEnvelope {
  type: "presence_update";
  hoveredCardId?: string | null;
  hoveredAt?: number | null;
  pingedCardId?: string | null;
  pingedAt?: number | null;
  pingIntent?: null | "general" | "trigger_ability" | "discard_target";
  emoteId?: null | EmoteId;
  emoteAt?: number | null;
  chatTyping?: boolean;
}
export interface RoomShellActionMessage extends WireEnvelope {
  type: "room_shell_action";
  action: unknown;                       // RoomShellAction (actions.ts)
  actorPlayerId?: string;
  clientActionId?: string;
}
export interface ActionIntentMessage extends WireEnvelope {
  type: "action_intent";
  action: unknown;                       // GameplayAction (actions.ts)
  actorPlayerId?: string;
  clientActionId?: string;
  clientBaseSequence: number;
}
export interface SpectatorViewGrantUpdateMessage extends WireEnvelope {
  type: "spectator_view_grant_update";
  playerId: string;
  audience: "signed_in_spectator";
  spectatorAuthSubject?: string;
  granted: boolean;
  clientActionId?: string;
}

/* ------------------------------------------------------------- server → client */

export interface AuthSessionMessage extends WireEnvelope { type: "auth_session"; tokenRemainingMs: number; clientRequestId?: string; }
export interface ActivityHistoryPageMessage extends WireEnvelope {
  type: "activity_history_page";
  requestId: string;
  entries: unknown[];                    // ≤50
  nextCursor: number | null;
}
export interface ChatSyncMessage extends WireEnvelope {
  type: "chat_sync";
  chatEntries: unknown[];
  chatAccess?: { canSend: boolean; authorId: string | null; judgeChannels?: Array<{ callId: string; visibility: "public" | "private"; canSend: boolean }> };
}
export interface ChatAppendMessage extends WireEnvelope { type: "chat_append"; entry: { id?: string; at?: number; text?: string; authorId?: string; clientEntryId?: string; [k: string]: unknown }; }
export interface JudgeCallSyncMessage extends WireEnvelope { type: "judge_call_sync"; judgeCall: unknown | null; judgeCalls: unknown[]; cooldownRemainingMs?: number; }
export interface JudgeFeedbackResultMessage extends WireEnvelope { type: "judge_feedback_result"; callId: string; rating: "helpful" | "unclear"; status: "recorded" | "duplicate" | "failed"; retryable: boolean; }
export interface PlayerReportResultMessage extends WireEnvelope { type: "player_report_result"; clientReportId: string; status: "submitted" | "duplicate" | "throttled" | "failed"; message?: string; retryable?: boolean; }
export interface RoomShellSyncMessage extends WireEnvelope {
  type: "room_shell_sync";
  sessionDoc: RoomSessionDoc | null;
  sequence: number;
  gameplayRuntimeReset?: true;            // full gameplay runtime reset required
}
export interface RoomShellActionAckMessage extends WireEnvelope { type: "room_shell_action_ack"; actionType: string; sequence: number; clientActionId?: string; }
export interface SpectatorRosterSyncMessage extends WireEnvelope { type: "spectator_roster_sync"; spectators: Spectator[]; }
export interface GameplayActionNoopAckMessage extends WireEnvelope { type: "gameplay_action_noop_ack"; sequence: number; clientActionId?: string; }
export interface AuthoritativeResumeAckMessage extends WireEnvelope { type: "authoritative_resume_ack"; sequence: number; }
export interface RewindConfirmationStateMessage extends WireEnvelope {
  type: "rewind_confirmation_state";
  confirmation: null | {
    requestId: string;
    requesterPlayerId: string;
    approverPlayerId: string;
    approverPlayerIds?: string[];
    opponentMeaningfulActionCount: number;
    requestedAt: number;
    expiresAt: number;
  };
}
export interface SpectatorViewGrantAckMessage extends WireEnvelope {
  type: "spectator_view_grant_ack";
  playerId: string;
  audience: "signed_in_spectator";
  spectatorAuthSubject?: string;
  granted: boolean;
  sequence: number;
  clientActionId?: string;
}

/** Full authoritative state. `snapshot` is the Room; `gameplayLog` is the match log (≤2000). */
export interface AuthoritativeSnapshotMessage extends WireEnvelope {
  type: "authoritative_snapshot";
  sequence: number;
  snapshot: Room;
  gameplayLog: GameplayLogEntry[];
  action?: { type: string };             // the action that caused this snapshot (rewind/forward classification)
  clientActionId?: string;
  actionClock?: RawActionClock;
}

/** Incremental diff from `baseSequence` → `sequence`. Operations are applied atomically. */
export interface AuthoritativePatchCommitMessage extends WireEnvelope {
  type: "authoritative_patch_commit";
  baseSequence: number;
  sequence: number;
  action: { type: string };
  patch: RuntimePatch;
  clientActionId?: string;
  actionClock?: RawActionClock;
}

/** Raw patch payload; client hydrates `receivedAt` into ActionClock. */
export type RawActionClock = Omit<ActionClock, "receivedAt">;

/**
 * Runtime patch operations (1w8d13szpogkp.js:2560-2800). Any op that would violate rune conservation
 * (runeDeck ∪ runeArea multisets change) is rejected client-side → resync.
 */
export type RuntimePatchOperation =
  | { op: "set_room_fields"; fields: Record<string, unknown> }
  | { op: "unset_room_fields"; fields: string[] }
  | { op: "chain_insert"; index: number; entries: unknown[] }
  | { op: "chain_remove"; entryIds: string[] }
  | { op: "chain_replace"; entries: unknown[] }
  | { op: "set_session_fields"; fields: Record<string, unknown> }
  | { op: "unset_session_fields"; fields: string[] }
  | { op: "set_player_fields"; playerId: string; fields: Record<string, unknown> }
  | { op: "unset_player_fields"; playerId: string; fields: string[] }
  | { op: "set_board_fields"; playerId: string; fields: Record<string, unknown> }
  | { op: "unset_board_fields"; playerId: string; fields: string[] }
  | { op: "zone_insert"; playerId: string; zone: string; index: number; cards: unknown[] }
  | { op: "zone_remove"; playerId: string; zone: string; cardIds: string[] }
  | { op: "zone_move"; from: { playerId: string; zone: string }; to: { playerId: string; zone: string; index: number }; cardId: string; card?: unknown }
  | { op: "zone_reorder"; playerId: string; zone: string; cardIds: string[] }
  | { op: "zone_replace"; playerId: string; zone: string; cards: unknown[] }
  | { op: "patch_card_fields"; playerId: string; zone: string; cardId: string; fields: Record<string, unknown> }
  | { op: "unset_card_fields"; playerId: string; zone: string; cardId: string; fields: string[] }
  | { op: "log_insert"; index: number; entries: GameplayLogEntry[] }
  | { op: "log_remove"; entryIds: string[] }
  | { op: "log_replace"; entries: GameplayLogEntry[] }
  | { op: "set_action_clock"; actionClock: RawActionClock }
  | { op: "clear_action_clock" };

export interface RuntimePatch {
  operations: RuntimePatchOperation[];
}

/* ------------------------------------------------------------- presence */

export type PresenceEvent =
  | { type: "presence_snapshot"; playerId: string; connectedPlayerIds: string[] }
  | { type: "player_presence"; playerId: string; state: "online" | "offline"; connectedPlayerIds: string[] }
  | { type: "hover_state"; playerId: string; hoveredCardId?: string | null; hoveredAt?: number | null }
  | { type: "card_ping"; playerId: string; pingedCardId?: string | null; pingedAt?: number | null; pingIntent?: null | "general" | "trigger_ability" | "discard_target" }
  | { type: "board_emote"; playerId: string; emoteId?: null | EmoteId; emoteAt?: number | null }
  | { type: "chat_typing"; playerId: string; typingTtlMs: number | null };

export interface PresenceEventMessage extends WireEnvelope { type: "presence_event"; event: PresenceEvent; }

/* ------------------------------------------------------------- errors */

export type ErrorCode =
  | "stale_action_state"            // 4008 (2i0ajg8a836h8.js:277) — action base sequence stale
  | "match"                         // 4007
  | "control_superseded"            // seat resumed elsewhere
  | "room_not_found"
  | "bootstrap_required" | "bootstrap_failed" | "runtime_restore_failed"
  | "runtime_persistence_failed"
  | "forward_unavailable"
  | "auto_pay_unavailable"
  | "gameplay_action_pending"
  | (string & {});

export interface ServerErrorMessage extends WireEnvelope {
  type: "error";
  code: ErrorCode;
  message: string;
  mutationClass?: "reject_invalid" | "reject_retryable" | "resync_required";
  clientActionId?: string;
  requestId?: string;
  authoritativeSequence?: number;
  retryable?: boolean;
  retryAfterMs?: number;
  authReason?: AuthFailureReason;
  authRecovery?: "retry_verification" | "refresh_token" | "reauthenticate";
}
export type AuthFailureReason =
  | "missing" | "not_configured" | "malformed_token" | "unsupported_token" | "invalid_claims"
  | "invalid_authorized_party" | "pending_session" | "expired_token" | "token_not_active"
  | "unknown_key" | "invalid_signature" | "verification_failed"
  | "token_provider_unavailable" | "token_provider_timeout";

/* ------------------------------------------------------------- emote ids (3-2i4k6s343ud.js module 593673) */

export type EmoteId =
  | "thumbs_up" | "heart" | "laugh" | "wow" | "cry" | "angry" | "wave" | "clap"
  | "thinking" | "surprised" | "sad" | (string & {});

/* ------------------------------------------------------------- unions + classifier */

export type ClientToServerMessage =
  | JoinShellMessage | JoinGameMessage | ResumeGameMessage | PingMessage | PongMessage
  | AuthRefreshMessage | CustomizationRefreshMessage | ActivityHistoryRequestMessage
  | ChatSendMessage | JudgeCallCreateMessage | JudgeCallPrivateCreateMessage | JudgeCallCloseMessage
  | JudgeFeedbackSubmitMessage | PlayerReportSubmitMessage | PresenceUpdateMessage
  | RoomShellActionMessage | ActionIntentMessage | SpectatorViewGrantUpdateMessage;

export type ServerToClientMessage =
  | AuthSessionMessage | ActivityHistoryPageMessage | ChatSyncMessage | ChatAppendMessage
  | JudgeCallSyncMessage | JudgeFeedbackResultMessage | PlayerReportResultMessage
  | RoomShellSyncMessage | RoomShellActionAckMessage | SpectatorRosterSyncMessage
  | GameplayActionNoopAckMessage | AuthoritativeResumeAckMessage | RewindConfirmationStateMessage
  | SpectatorViewGrantAckMessage | AuthoritativeSnapshotMessage | AuthoritativePatchCommitMessage
  | PresenceEventMessage | ServerErrorMessage | PongMessage;

/* ------------------------------------------------------------- room HTTP API */

export interface RoomApiError { ok?: false; error?: string; message?: string; retryable?: boolean; authRecovery?: string; continuationRoomCode?: string; }

/** POST text/plain JSON to `${PARTYKIT_HTTP}${path}` (35qz5rkx7yexy.js:21750). */
export interface CreateRoomResponse { operationId: string; roomCode: string; playerId: string; controlledPlayerIds?: string[]; phase?: RoomPhase; }
export interface JoinRoomResponse { roomCode: string; role: "player" | "spectator"; playerId?: string | null; spectatorName?: string | null; }
export interface TakeSeatResponse { roomCode: string; playerId: string | null; }
export interface ResolveRoomMembershipResponse {
  roomCode: string; role: "absent" | "player" | "spectator";
  playerId?: string | null; playerName?: string | null; spectatorName?: string | null;
  playerIds?: string[]; redirectedFromRoomCode?: string;
}
export interface LeaveRoomResponse { seatKept?: boolean; }
export interface ReturnToLobbyResponse { roomCode: string; lobbyRoomCode: string; }
export interface MatchmakingCancelResponse {
  ok: true; searchId: string;
  status: "matched" | "cancelled" | "expired";
  roomCode?: string; playerId?: string; playerName?: string;
  playMode?: "constructed" | "sealed"; matchmakingPool?: string; matchFormat?: "bo1" | "bo3";
}
export interface MatchmakingSearchRequest {
  searchId: string;                      // /^[A-Za-z0-9:_-]{8,128}$/
  initiatingUserId: string;
  playerName: string;
  playMode: "constructed" | "sealed";
  decklist?: string;                     // constructed
  constructedDeckRegistration?: unknown;
  sealedRegistration?: unknown;
  matchmakingPool: "standard" | "origins" | "vendettaPreRift" | "radiancePreRift" | "unleashedPreRift" | (string & {});
  matchFormat: "bo1" | "bo3";            // gameVariant != duel ⇒ bo1 only
  gameVariant?: string;                  // omitted for duel
  extensions?: Array<"pools" | "tables">;
  party?: { id: string; round: number };
}

/** Helpers mirrored from the client (1w8d13szpogkp.js). */
export interface RuntimeHelpers {
  /** apply a RuntimePatch onto {room,sequence,gameplayLogEntries}; throws on malformed ops */
  applyPatch(state: { room: Room; sequence: number; gameplayLogEntries: GameplayLogEntry[] }, patch: RuntimePatch): typeof state;
  /** rune conservation check (618260): multiset of ids in runeDeck ∪ runeArea must be preserved */
  runeCountsPreserved(previous: Room, next: Room): boolean;
  /** is this message a runtime reset (rewind/forward or fresh snapshot)? */
  isResetAction(action?: { type: string }): boolean;
}

export type { RealtimeState };
