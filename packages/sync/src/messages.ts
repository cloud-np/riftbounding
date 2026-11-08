/**
 * Realtime wire protocol — validators and envelope helpers.
 *
 * Exact port of the client's message parser/validator (`.recon/pretty/playapp/2i0ajg8a836h8.js`,
 * module 495270). The client accepts a server frame only when `parseRealtimeMessage` returns a
 * non-null value, so the server must emit exactly the shapes validated here.
 */

/** `l` in 2i0ajg8a836h8.js: every message type the client understands. */
export const MESSAGE_TYPES: ReadonlySet<string> = new Set([
  "join_shell",
  "join_game",
  "resume_game",
  "auth_refresh",
  "auth_session",
  "activity_history_request",
  "activity_history_page",
  "chat_send",
  "chat_sync",
  "chat_append",
  "judge_call_create",
  "judge_call_private_create",
  "judge_call_close",
  "judge_call_sync",
  "judge_feedback_submit",
  "judge_feedback_result",
  "player_report_submit",
  "player_report_result",
  "room_shell_sync",
  "room_shell_action",
  "room_shell_action_ack",
  "customization_refresh",
  "spectator_roster_sync",
  "presence_update",
  "action_intent",
  "gameplay_action_noop_ack",
  "rewind_confirmation_state",
  "spectator_view_grant_update",
  "spectator_view_grant_ack",
  "authoritative_snapshot",
  "authoritative_patch_commit",
  "authoritative_resume_ack",
  "presence_event",
  "ping",
  "pong",
  "error",
]);

/** Client → server message types (used by the party loop to reject server-origin frames). */
export const CLIENT_MESSAGE_TYPES: ReadonlySet<string> = new Set([
  "join_shell",
  "join_game",
  "resume_game",
  "auth_refresh",
  "activity_history_request",
  "chat_send",
  "judge_call_create",
  "judge_call_private_create",
  "judge_call_close",
  "judge_feedback_submit",
  "player_report_submit",
  "room_shell_action",
  "presence_update",
  "action_intent",
  "spectator_view_grant_update",
  "ping",
  "pong",
  "customization_refresh",
]);

/** `u` in 2i0ajg8a836h8.js. */
export const AUTH_RECOVERY_VALUES: ReadonlySet<string> = new Set([
  "retry_verification",
  "refresh_token",
  "reauthenticate",
]);

/** `f` in 2i0ajg8a836h8.js. */
export const AUTH_FAILURE_REASONS: ReadonlySet<string> = new Set([
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

/** Emote ids accepted by the `presence_update` validator (`t.i` of module 593673 = poro set). */
export const PRESENCE_EMOTE_IDS: ReadonlySet<string> = new Set([
  "poro_wave",
  "poro_heart",
  "poro_laugh",
  "poro_thinking",
  "poro_sad",
  "poro_party",
]);

/** Full board-emote catalogue (module 593673 `r`). */
export const EMOTE_IDS: ReadonlySet<string> = new Set([
  "thumbs_up",
  "heart",
  "laugh",
  "wow",
  "cry",
  "angry",
  "wave",
  "clap",
  "thinking",
  "surprised",
  "sad",
  "party",
  "sob",
  "skull",
  "scream",
  "good_luck",
  "thanks",
  "good_game",
  "poro_wave",
  "poro_heart",
  "poro_laugh",
  "poro_thinking",
  "poro_sad",
  "poro_party",
]);

export const PLAYER_REPORT_TARGET_KINDS = [
  "player",
  "spectator",
  "chat_author",
  "judge_answer",
] as const;
export const PLAYER_REPORT_REASONS = [
  "harassment_abuse",
  "cheating_exploiting",
  "stalling_disruption",
  "inappropriate_identity",
  "other",
] as const;
export const JUDGE_FEEDBACK_RATINGS = ["helpful", "unclear"] as const;

/** Constants exported by module 495270. */
export const MATCH_PARTY = "match";
export const COORDINATOR_PARTY = "coordinator";
export const MATCHMAKING_PARTY = "matchmaking";
export const ACTIVITY_HISTORY_SEATED = "activity_history_seated";
export const CONTROL_SUPERSEDED = "control_superseded";
export const STALE_ACTION_STATE = "stale_action_state";
export const CLOSE_CODE_CONTROL_SUPERSEDED = 4007;
export const CLOSE_CODE_ROOM_RETRY = 4008;
export const CLOSE_CODE_LIVENESS = 4009;
export const CLOSE_CODE_JOIN_UNANSWERED = 4010;
export const CLOSE_CODE_SOCIAL_TERMINAL = 4014;

/* ------------------------------------------------------------------ primitives */

export type RealtimeMessage = Record<string, unknown>;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasString(record: Record<string, unknown>, key: string): boolean {
  return typeof record[key] === "string";
}

function optionalString(record: Record<string, unknown>, key: string): boolean {
  return !(key in record) || typeof record[key] === "string";
}

function optionalStringOrNull(record: Record<string, unknown>, key: string): boolean {
  return !(key in record) || record[key] === null || typeof record[key] === "string";
}

function optionalNumberOrNull(record: Record<string, unknown>, key: string): boolean {
  return !(key in record) || record[key] === null || typeof record[key] === "number";
}

function optionalWith(
  record: Record<string, unknown>,
  key: string,
  predicate: (value: unknown) => boolean,
): boolean {
  return !(key in record) || predicate(record[key]);
}

function onlyKeys(record: Record<string, unknown>, keys: readonly string[]): boolean {
  const allowed = new Set(keys);
  return Object.keys(record).every((key) => allowed.has(key));
}

function boundedString(record: Record<string, unknown>, key: string, max: number): boolean {
  const value = record[key];
  return (
    typeof value === "string" && value.length > 0 && value.length <= max && value.trim() === value
  );
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isViewerRole(value: unknown): boolean {
  return value === "player" || value === "spectator";
}

function isMutationClass(value: unknown): boolean {
  return value === "reject_invalid" || value === "reject_retryable" || value === "resync_required";
}

function isAudience(value: unknown): boolean {
  return value === "signed_in_spectator";
}

function isFeedbackRating(value: unknown): boolean {
  return value === "helpful" || value === "unclear";
}

function isPingIntent(value: unknown): boolean {
  return value === "general" || value === "trigger_ability" || value === "discard_target";
}

function isJudgeVisibility(value: unknown): boolean {
  return value === "public" || value === "private";
}

function isDeliveryRejectionReason(value: unknown): boolean {
  return (
    value === "spam" ||
    value === "off_topic" ||
    value === "unintelligible" ||
    value === "severe_abuse"
  );
}

function isPlayerReportReason(value: unknown): boolean {
  return PLAYER_REPORT_REASONS.some((reason) => reason === value);
}

function isTargetKind(value: unknown): boolean {
  return PLAYER_REPORT_TARGET_KINDS.some((kind) => kind === value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isSafeNonNegativeInt(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

/* ------------------------------------------------------------------ nested validators */

/** `y` — judge call. */
export function isJudgeCall(value: unknown): boolean {
  if (
    !isRecord(value) ||
    !hasString(value, "id") ||
    !hasString(value, "clientRequestId") ||
    [value.parentCallId, value.correctsAnswerId, value.correctedByAnswerId].some(
      (field) =>
        field !== undefined &&
        (typeof field !== "string" || !/^[A-Za-z0-9_-]{8,80}$/u.test(field) || field === value.id),
    ) ||
    (value.correctsAnswerId !== undefined && value.parentCallId === undefined) ||
    !isSafeNonNegativeInt(value.requestedAt) ||
    !hasString(value, "requestedByPlayerId") ||
    !hasString(value, "requestedByPlayerName") ||
    !hasString(value, "question") ||
    !isJudgeVisibility(value.visibility) ||
    (value.status !== "open" &&
      value.status !== "answered" &&
      value.status !== "closed" &&
      value.status !== "expired") ||
    (value.delivery !== "pending" &&
      value.delivery !== "posted" &&
      value.delivery !== "unavailable" &&
      value.delivery !== "failed") ||
    (Object.hasOwn(value, "deliveryFailureCode") &&
      value.deliveryFailureCode !== "content_rejected" &&
      value.deliveryFailureCode !== "account_banned") ||
    (Object.hasOwn(value, "deliveryRejectionReason") &&
      !isDeliveryRejectionReason(value.deliveryRejectionReason)) ||
    (Object.hasOwn(value, "deliveryPendingReason") &&
      value.deliveryPendingReason !== "review_unavailable") ||
    (Object.hasOwn(value, "expiresAt") &&
      (!isSafeNonNegativeInt(value.expiresAt) ||
        (value.expiresAt as number) < (value.requestedAt as number))) ||
    (Object.hasOwn(value, "closedAt") &&
      (!isSafeNonNegativeInt(value.closedAt) ||
        (value.closedAt as number) < (value.requestedAt as number))) ||
    (Object.hasOwn(value, "discordThreadUrl") &&
      !(
        typeof value.discordThreadUrl === "string" &&
        /^https:\/\/discord\.com\/channels\/\d{1,24}\/\d{1,24}$/u.test(value.discordThreadUrl)
      ))
  ) {
    return false;
  }
  if (value.status !== "answered") return value.answer === null;
  const answer = value.answer;
  return (
    isRecord(answer) &&
    isSafeNonNegativeInt(answer.answeredAt) &&
    hasString(answer, "text") &&
    (answer.translation === undefined ||
      (isRecord(answer.translation) &&
        typeof answer.translation.language === "string" &&
        answer.translation.language.length <= 35 &&
        /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/u.test(answer.translation.language) &&
        typeof answer.translation.text === "string" &&
        answer.translation.text.trim().length > 0 &&
        answer.translation.text.length <= 2_000)) &&
    hasString(answer, "judgeDisplayName") &&
    typeof answer.verifiedJudge === "boolean" &&
    (answer.judgeApprovedAt === undefined || isSafeNonNegativeInt(answer.judgeApprovedAt)) &&
    (answer.contributionLevel === "responder" ||
      answer.contributionLevel === "regular" ||
      answer.contributionLevel === "veteran" ||
      answer.contributionLevel === "champion" ||
      answer.contributionLevel === "pillar") &&
    (answer.communityHelperRank === undefined ||
      answer.communityHelperRank === "champion" ||
      answer.communityHelperRank === "pillar") &&
    isSafeNonNegativeInt(answer.answeredCount)
  );
}

/** `O` — spectator roster entry. */
export function isSpectator(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasString(value, "authSubject") &&
    hasString(value, "displayName") &&
    typeof value.joinedAt === "number" &&
    typeof value.updatedAt === "number" &&
    stringArray(value.grantedPrivatePlayerIds)
  );
}

/** Action clock payload validator (`S` of module 229172). */
export function isActionClock(value: unknown): boolean {
  return (
    !!value &&
    isRecord(value) &&
    typeof value.scopeKey === "string" &&
    value.totals !== undefined &&
    typeof value.totals === "object" &&
    value.totals !== null &&
    Array.isArray(value.activeTargets) &&
    (value.runningSince === null || typeof value.runningSince === "number") &&
    typeof value.serverNow === "number"
  );
}

/** `chatAccess` validator. */
export function isChatAccess(value: unknown): boolean {
  if (
    !isRecord(value) ||
    typeof value.canSend !== "boolean" ||
    (value.judgeChannels !== undefined &&
      (!Array.isArray(value.judgeChannels) ||
        value.judgeChannels.length > 32 ||
        !value.judgeChannels.every(
          (channel) =>
            isRecord(channel) &&
            boundedString(channel, "callId", 160) &&
            isJudgeVisibility(channel.visibility) &&
            typeof channel.canSend === "boolean",
        )))
  ) {
    return false;
  }
  const hasAuthor =
    typeof value.authorId === "string" &&
    value.authorId.trim().length > 0 &&
    value.authorId.length <= 160;
  return (value.canSend && hasAuthor) || (!value.canSend && value.authorId === null);
}

/** `rewind_confirmation_state.confirmation` validator. */
export function isRewindConfirmation(value: unknown): boolean {
  if (
    !isRecord(value) ||
    typeof value.requestId !== "string" ||
    !/^[A-Za-z0-9_-]{1,160}$/u.test(value.requestId) ||
    !hasString(value, "requesterPlayerId") ||
    !hasString(value, "approverPlayerId")
  ) {
    return false;
  }
  const count = value.opponentMeaningfulActionCount;
  if (value.approverPlayerIds !== undefined) {
    if (
      !Array.isArray(value.approverPlayerIds) ||
      value.approverPlayerIds.length === 0 ||
      value.approverPlayerIds.length > 3 ||
      value.approverPlayerIds.some(
        (id) => typeof id !== "string" || id.length === 0 || id === value.requesterPlayerId,
      ) ||
      new Set(value.approverPlayerIds).size !== value.approverPlayerIds.length ||
      !value.approverPlayerIds.includes(value.approverPlayerId)
    ) {
      return false;
    }
  }
  const requestedAt = value.requestedAt;
  const expiresAt = value.expiresAt;
  return (
    typeof count === "number" &&
    Number.isSafeInteger(count) &&
    count > 0 &&
    isSafeNonNegativeInt(requestedAt) &&
    typeof expiresAt === "number" &&
    Number.isSafeInteger(expiresAt) &&
    expiresAt > requestedAt
  );
}

/** `presence_event.event` validator. */
export function isPresenceEvent(value: unknown): boolean {
  if (!isRecord(value) || typeof value.type !== "string") return false;
  switch (value.type) {
    case "presence_snapshot":
      return hasString(value, "playerId") && stringArray(value.connectedPlayerIds);
    case "player_presence":
      return (
        hasString(value, "playerId") &&
        (value.state === "online" || value.state === "offline") &&
        stringArray(value.connectedPlayerIds)
      );
    case "hover_state":
      return (
        hasString(value, "playerId") &&
        optionalStringOrNull(value, "hoveredCardId") &&
        optionalNumberOrNull(value, "hoveredAt")
      );
    case "card_ping":
      return (
        hasString(value, "playerId") &&
        optionalStringOrNull(value, "pingedCardId") &&
        optionalNumberOrNull(value, "pingedAt") &&
        (!("pingIntent" in value) || value.pingIntent === null || isPingIntent(value.pingIntent))
      );
    case "board_emote":
      return (
        hasString(value, "playerId") &&
        (!("emoteId" in value) ||
          value.emoteId === null ||
          EMOTE_IDS.has(value.emoteId as string)) &&
        optionalNumberOrNull(value, "emoteAt")
      );
    case "chat_typing":
      return (
        hasString(value, "playerId") &&
        "typingTtlMs" in value &&
        (value.typingTtlMs === null || typeof value.typingTtlMs === "number")
      );
    default:
      return false;
  }
}

/* ------------------------------------------------------------------ message validator */

/** `e` of module 495270 (the big switch). */
export function isValidRealtimeMessage(value: unknown): value is RealtimeMessage {
  if (!isRecord(value) || typeof value.type !== "string" || !MESSAGE_TYPES.has(value.type)) {
    return false;
  }
  switch (value.type) {
    case "join_shell":
    case "join_game":
      return (
        hasString(value, "gameInstanceId") &&
        optionalString(value, "playerId") &&
        hasString(value, "roomCode") &&
        hasString(value, "authToken") &&
        optionalWith(value, "viewerRole", isViewerRole) &&
        (!Object.hasOwn(value, "broadcastView") || typeof value.broadcastView === "boolean")
      );
    case "resume_game":
      return (
        hasString(value, "gameInstanceId") &&
        optionalString(value, "playerId") &&
        hasString(value, "authToken") &&
        optionalWith(value, "viewerRole", isViewerRole) &&
        (!Object.hasOwn(value, "broadcastView") || typeof value.broadcastView === "boolean") &&
        (!Object.hasOwn(value, "clientSequence") || isSafeNonNegativeInt(value.clientSequence)) &&
        (!Object.hasOwn(value, "unsettledAction") ||
          (isRecord(value.unsettledAction) &&
            hasString(value.unsettledAction, "clientActionId") &&
            hasString(value.unsettledAction, "actorPlayerId")))
      );
    case "ping":
    case "pong":
      return hasString(value, "gameInstanceId") && isFiniteNumber(value.sentAt);
    case "authoritative_resume_ack":
      return hasString(value, "gameInstanceId") && isSafeNonNegativeInt(value.sequence);
    case "auth_refresh":
      return (
        onlyKeys(value, ["type", "gameInstanceId", "clientRequestId", "authToken"]) &&
        boundedString(value, "gameInstanceId", 160) &&
        boundedString(value, "clientRequestId", 160) &&
        boundedString(value, "authToken", 16_384)
      );
    case "auth_session":
      return (
        onlyKeys(value, ["type", "gameInstanceId", "tokenRemainingMs", "clientRequestId"]) &&
        boundedString(value, "gameInstanceId", 160) &&
        isSafeNonNegativeInt(value.tokenRemainingMs) &&
        (!Object.hasOwn(value, "clientRequestId") || boundedString(value, "clientRequestId", 160))
      );
    case "customization_refresh":
      return (
        hasString(value, "gameInstanceId") &&
        Object.keys(value).every((key) => key === "type" || key === "gameInstanceId")
      );
    case "activity_history_request":
      return (
        onlyKeys(value, ["type", "gameInstanceId", "requestId", "before"]) &&
        boundedString(value, "gameInstanceId", 160) &&
        boundedString(value, "requestId", 160) &&
        (value.before === null ||
          (typeof value.before === "number" &&
            Number.isSafeInteger(value.before) &&
            value.before > 0))
      );
    case "activity_history_page":
      return (
        hasString(value, "gameInstanceId") &&
        boundedString(value, "requestId", 160) &&
        Array.isArray(value.entries) &&
        value.entries.length <= 50 &&
        (value.nextCursor === null ||
          (typeof value.nextCursor === "number" &&
            Number.isSafeInteger(value.nextCursor) &&
            value.nextCursor > 0))
      );
    case "chat_send":
      return (
        hasString(value, "gameInstanceId") &&
        hasString(value, "text") &&
        optionalString(value, "clientEntryId") &&
        (!Object.hasOwn(value, "judgeCallId") || boundedString(value, "judgeCallId", 160))
      );
    case "chat_sync":
      return (
        hasString(value, "gameInstanceId") &&
        Array.isArray(value.chatEntries) &&
        (!Object.hasOwn(value, "chatAccess") || isChatAccess(value.chatAccess))
      );
    case "chat_append":
      return hasString(value, "gameInstanceId") && "entry" in value;
    case "judge_call_create":
      return (
        hasString(value, "gameInstanceId") &&
        hasString(value, "clientRequestId") &&
        hasString(value, "question")
      );
    case "judge_call_private_create":
      return (
        onlyKeys(value, ["type", "gameInstanceId", "clientRequestId", "question", "visibility"]) &&
        boundedString(value, "gameInstanceId", 160) &&
        boundedString(value, "clientRequestId", 160) &&
        hasString(value, "question") &&
        value.visibility === "private"
      );
    case "judge_call_close":
      return (
        onlyKeys(value, ["type", "gameInstanceId", "callId"]) &&
        boundedString(value, "gameInstanceId", 160) &&
        boundedString(value, "callId", 160)
      );
    case "judge_call_sync":
      return (
        hasString(value, "gameInstanceId") &&
        "judgeCall" in value &&
        (value.judgeCall === null || isJudgeCall(value.judgeCall)) &&
        Array.isArray(value.judgeCalls) &&
        value.judgeCalls.length <= 16 &&
        value.judgeCalls.every(isJudgeCall) &&
        (!Object.hasOwn(value, "cooldownRemainingMs") ||
          isSafeNonNegativeInt(value.cooldownRemainingMs))
      );
    case "judge_feedback_submit":
      return (
        onlyKeys(value, ["type", "gameInstanceId", "callId", "rating"]) &&
        boundedString(value, "gameInstanceId", 160) &&
        boundedString(value, "callId", 160) &&
        isFeedbackRating(value.rating)
      );
    case "judge_feedback_result":
      return (
        onlyKeys(value, ["type", "gameInstanceId", "callId", "rating", "status", "retryable"]) &&
        boundedString(value, "gameInstanceId", 160) &&
        boundedString(value, "callId", 160) &&
        isFeedbackRating(value.rating) &&
        (value.status === "recorded" ||
          value.status === "duplicate" ||
          value.status === "failed") &&
        typeof value.retryable === "boolean" &&
        (value.status === "failed" || value.retryable === false)
      );
    case "player_report_submit":
      return (
        hasString(value, "gameInstanceId") &&
        hasString(value, "clientReportId") &&
        hasString(value, "reportedPlayerId") &&
        (value.targetKind === undefined || isTargetKind(value.targetKind)) &&
        optionalString(value, "messageId") &&
        (value.targetKind !== "chat_author" || hasString(value, "messageId")) &&
        isPlayerReportReason(value.reason) &&
        optionalString(value, "comment")
      );
    case "player_report_result":
      return (
        hasString(value, "gameInstanceId") &&
        hasString(value, "clientReportId") &&
        (value.status === "submitted" ||
          value.status === "duplicate" ||
          value.status === "throttled" ||
          value.status === "failed") &&
        optionalString(value, "message") &&
        (!Object.hasOwn(value, "retryable") || typeof value.retryable === "boolean")
      );
    case "room_shell_sync":
      return (
        hasString(value, "gameInstanceId") &&
        "sessionDoc" in value &&
        (value.sessionDoc === null || isRecord(value.sessionDoc)) &&
        typeof value.sequence === "number" &&
        (!Object.hasOwn(value, "gameplayRuntimeReset") || value.gameplayRuntimeReset === true)
      );
    case "room_shell_action":
      return (
        hasString(value, "gameInstanceId") &&
        "action" in value &&
        optionalString(value, "actorPlayerId") &&
        optionalString(value, "clientActionId")
      );
    case "room_shell_action_ack":
      return (
        hasString(value, "gameInstanceId") &&
        hasString(value, "actionType") &&
        typeof value.sequence === "number" &&
        optionalString(value, "clientActionId")
      );
    case "spectator_roster_sync":
      return (
        hasString(value, "gameInstanceId") &&
        Array.isArray(value.spectators) &&
        value.spectators.every(isSpectator)
      );
    case "presence_update":
      return (
        hasString(value, "gameInstanceId") &&
        optionalStringOrNull(value, "hoveredCardId") &&
        optionalNumberOrNull(value, "hoveredAt") &&
        optionalStringOrNull(value, "pingedCardId") &&
        optionalNumberOrNull(value, "pingedAt") &&
        (!("pingIntent" in value) || value.pingIntent === null || isPingIntent(value.pingIntent)) &&
        (!("emoteId" in value) ||
          value.emoteId === null ||
          (typeof value.emoteId === "string" && EMOTE_IDS.has(value.emoteId))) &&
        optionalNumberOrNull(value, "emoteAt") &&
        (!("chatTyping" in value) || typeof value.chatTyping === "boolean")
      );
    case "action_intent":
      return (
        hasString(value, "gameInstanceId") &&
        "action" in value &&
        optionalString(value, "actorPlayerId") &&
        optionalString(value, "clientActionId") &&
        typeof value.clientBaseSequence === "number"
      );
    case "gameplay_action_noop_ack":
      return (
        hasString(value, "gameInstanceId") &&
        typeof value.sequence === "number" &&
        optionalString(value, "clientActionId")
      );
    case "rewind_confirmation_state":
      return (
        hasString(value, "gameInstanceId") &&
        (value.confirmation === null || isRewindConfirmation(value.confirmation))
      );
    case "spectator_view_grant_update":
      return (
        hasString(value, "gameInstanceId") &&
        hasString(value, "playerId") &&
        isAudience(value.audience) &&
        optionalString(value, "spectatorAuthSubject") &&
        typeof value.granted === "boolean" &&
        optionalString(value, "clientActionId")
      );
    case "spectator_view_grant_ack":
      return (
        hasString(value, "gameInstanceId") &&
        hasString(value, "playerId") &&
        isAudience(value.audience) &&
        optionalString(value, "spectatorAuthSubject") &&
        typeof value.granted === "boolean" &&
        typeof value.sequence === "number" &&
        optionalString(value, "clientActionId")
      );
    case "authoritative_snapshot":
      return (
        hasString(value, "gameInstanceId") &&
        typeof value.sequence === "number" &&
        "snapshot" in value &&
        Array.isArray(value.gameplayLog) &&
        (!("action" in value) ||
          (isRecord(value.action) && typeof value.action.type === "string")) &&
        optionalString(value, "clientActionId") &&
        (!("actionClock" in value) || isActionClock(value.actionClock))
      );
    case "authoritative_patch_commit":
      return (
        hasString(value, "gameInstanceId") &&
        typeof value.baseSequence === "number" &&
        typeof value.sequence === "number" &&
        isRecord(value.action) &&
        typeof value.action.type === "string" &&
        isRecord(value.patch) &&
        Array.isArray(value.patch.operations) &&
        optionalString(value, "clientActionId") &&
        (!("actionClock" in value) || isActionClock(value.actionClock))
      );
    case "presence_event":
      return hasString(value, "gameInstanceId") && isPresenceEvent(value.event);
    case "error":
      return (
        hasString(value, "code") &&
        hasString(value, "message") &&
        optionalWith(value, "mutationClass", isMutationClass) &&
        optionalString(value, "clientActionId") &&
        (!Object.hasOwn(value, "requestId") || boundedString(value, "requestId", 160)) &&
        (!("authoritativeSequence" in value) ||
          isSafeNonNegativeInt(value.authoritativeSequence)) &&
        (!("retryable" in value) || typeof value.retryable === "boolean") &&
        (!("retryAfterMs" in value) || isSafeNonNegativeInt(value.retryAfterMs)) &&
        optionalWith(
          value,
          "authReason",
          (reason) => typeof reason === "string" && AUTH_FAILURE_REASONS.has(reason),
        ) &&
        optionalWith(
          value,
          "authRecovery",
          (recovery) => typeof recovery === "string" && AUTH_RECOVERY_VALUES.has(recovery),
        )
      );
    default:
      return false;
  }
}

/* ------------------------------------------------------------------ parser */

/**
 * Drop an invalid `authoritativeSequence` from an error frame (client sanitizer 1).
 * The server can just avoid emitting invalid values; this keeps parse-side parity.
 */
function sanitizeAuthoritativeSequence(value: unknown): unknown {
  if (
    !isRecord(value) ||
    value.type !== "error" ||
    !("authoritativeSequence" in value) ||
    isSafeNonNegativeInt(value.authoritativeSequence)
  ) {
    return value;
  }
  const next = { ...value };
  delete next.authoritativeSequence;
  return next;
}

interface AuthErrorMapping {
  authRecovery: string;
  realtimeCode: string;
  realtimeRetryable: boolean;
}

/** `f`/`u` → client error enrichment (module 495270). */
export function mapAuthErrorEnvelope(
  message: RealtimeMessage,
): (RealtimeMessage & AuthErrorMapping) | RealtimeMessage {
  if (message.type !== "error") return message;
  const hasReason = "authReason" in message;
  const hasRecovery = "authRecovery" in message;
  if (!hasReason && !hasRecovery) return message;
  const authReason = message.authReason;
  const authRecovery = message.authRecovery;
  if (
    hasReason &&
    hasRecovery &&
    typeof authReason === "string" &&
    AUTH_FAILURE_REASONS.has(authReason) &&
    typeof authRecovery === "string" &&
    AUTH_RECOVERY_VALUES.has(authRecovery)
  ) {
    let mapping: AuthErrorMapping;
    if (authReason === "missing") {
      mapping = {
        authRecovery: "reauthenticate",
        realtimeCode: "auth_required",
        realtimeRetryable: false,
      };
    } else if (
      authReason === "not_configured" ||
      authReason === "verification_failed" ||
      authReason === "unknown_key" ||
      authReason === "token_provider_unavailable" ||
      authReason === "token_provider_timeout"
    ) {
      mapping = {
        authRecovery: "retry_verification",
        realtimeCode: "auth_service_unavailable",
        realtimeRetryable: true,
      };
    } else if (authReason === "expired_token" || authReason === "token_not_active") {
      mapping = {
        authRecovery: "refresh_token",
        realtimeCode: "auth_token_rejected",
        realtimeRetryable: true,
      };
    } else {
      mapping = {
        authRecovery: "reauthenticate",
        realtimeCode: "auth_token_rejected",
        realtimeRetryable: false,
      };
    }
    if (
      mapping.authRecovery === authRecovery &&
      mapping.realtimeCode === message.code &&
      mapping.realtimeRetryable === (message.retryable === true)
    ) {
      return message;
    }
  }
  const { authReason: _reason, authRecovery: _recovery, ...rest } = message;
  return rest;
}

/**
 * `N(e)` in 2i0ajg8a836h8.js — parse a raw websocket text frame. Returns `null` for anything the
 * client would drop (invalid JSON or a frame that fails the per-type validator).
 */
export function parseRealtimeMessage(raw: unknown): RealtimeMessage | null {
  if (typeof raw !== "string") return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    const withSequence = sanitizeAuthoritativeSequence(parsed);
    const sanitized = isRecord(withSequence) ? mapAuthErrorEnvelope(withSequence) : withSequence;
    return isValidRealtimeMessage(sanitized) ? sanitized : null;
  } catch {
    return null;
  }
}

/** Alias matching the client module export (`N`). */
export const decodeRealtimeMessage = parseRealtimeMessage;

/** Serialize an outgoing frame. */
export function encodeRealtimeMessage(message: RealtimeMessage): string {
  return JSON.stringify(message);
}

/** Build a wire envelope with `type` + `gameInstanceId` plus extra fields. */
export function makeEnvelope<T extends string, F extends Record<string, unknown>>(
  type: T,
  gameInstanceId: string,
  fields: F = {} as F,
): { type: T; gameInstanceId: string } & F {
  return { type, gameInstanceId, ...fields };
}
