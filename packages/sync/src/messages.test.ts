import { describe, expect, it } from "vitest";
import {
  AUTH_FAILURE_REASONS,
  AUTH_RECOVERY_VALUES,
  MESSAGE_TYPES,
  isActionClock,
  isValidRealtimeMessage,
  makeEnvelope,
  mapAuthErrorEnvelope,
  parseRealtimeMessage,
} from "./messages";

const id = "game_instance_1";

function parse(message: unknown): Record<string, unknown> | null {
  return parseRealtimeMessage(JSON.stringify(message));
}

describe("MESSAGE_TYPES", () => {
  it("matches the client's accepted type set", () => {
    expect(MESSAGE_TYPES.size).toBe(36);
    expect(MESSAGE_TYPES.has("authoritative_patch_commit")).toBe(true);
    expect(MESSAGE_TYPES.has("party_state")).toBe(false);
    expect(AUTH_FAILURE_REASONS.size).toBe(14);
    expect(AUTH_RECOVERY_VALUES.size).toBe(3);
  });
});

describe("parseRealtimeMessage", () => {
  it("rejects invalid JSON, non-strings and unknown types", () => {
    expect(parseRealtimeMessage("{")).toBeNull();
    expect(parseRealtimeMessage(42)).toBeNull();
    expect(parse({ type: "not_a_type", gameInstanceId: id })).toBeNull();
  });

  it("accepts join frames and enforces optional field types", () => {
    expect(
      parse({ type: "join_shell", gameInstanceId: id, roomCode: "ABC123", authToken: "t" }),
    ).not.toBeNull();
    expect(
      parse({
        type: "join_game",
        gameInstanceId: id,
        playerId: "p1",
        roomCode: "ABC123",
        authToken: "t",
        viewerRole: "spectator",
        broadcastView: true,
      }),
    ).not.toBeNull();
    expect(
      parse({
        type: "join_game",
        gameInstanceId: id,
        playerId: 1,
        roomCode: "ABC123",
        authToken: "t",
      }),
    ).toBeNull();
    expect(
      parse({
        type: "join_game",
        gameInstanceId: id,
        roomCode: "ABC123",
        authToken: "t",
        viewerRole: "judge",
      }),
    ).toBeNull();
  });

  it("accepts resume_game with optional sequence and unsettled action", () => {
    expect(
      parse({
        type: "resume_game",
        gameInstanceId: id,
        playerId: "p1",
        authToken: "t",
        clientSequence: 4,
        unsettledAction: { clientActionId: "a", actorPlayerId: "p1" },
      }),
    ).not.toBeNull();
    expect(
      parse({
        type: "resume_game",
        gameInstanceId: id,
        authToken: "t",
        clientSequence: -1,
      }),
    ).toBeNull();
    expect(
      parse({
        type: "resume_game",
        gameInstanceId: id,
        authToken: "t",
        unsettledAction: { clientActionId: "a" },
      }),
    ).toBeNull();
  });

  it("validates ping/pong and the strict auth frames", () => {
    expect(parse({ type: "ping", gameInstanceId: id, sentAt: 123 })).not.toBeNull();
    expect(parse({ type: "ping", gameInstanceId: id, sentAt: Number.NaN })).toBeNull();
    expect(
      parse({ type: "authoritative_resume_ack", gameInstanceId: id, sequence: 2 }),
    ).not.toBeNull();
    expect(
      parse({ type: "authoritative_resume_ack", gameInstanceId: id, sequence: -2 }),
    ).toBeNull();
    expect(
      parse({ type: "auth_refresh", gameInstanceId: id, clientRequestId: "req", authToken: "tok" }),
    ).not.toBeNull();
    expect(
      parse({
        type: "auth_refresh",
        gameInstanceId: id,
        clientRequestId: "req",
        authToken: "tok",
        extra: 1,
      }),
    ).toBeNull();
    expect(
      parse({ type: "auth_session", gameInstanceId: id, tokenRemainingMs: 1000 }),
    ).not.toBeNull();
    expect(parse({ type: "auth_session", gameInstanceId: id, tokenRemainingMs: -1 })).toBeNull();
  });

  it("validates activity history, chat and presence", () => {
    expect(
      parse({ type: "activity_history_request", gameInstanceId: id, requestId: "r", before: null }),
    ).not.toBeNull();
    expect(
      parse({ type: "activity_history_request", gameInstanceId: id, requestId: "r", before: 0 }),
    ).toBeNull();
    expect(parse({ type: "chat_sync", gameInstanceId: id, chatEntries: [] })).not.toBeNull();
    expect(
      parse({
        type: "chat_sync",
        gameInstanceId: id,
        chatEntries: [],
        chatAccess: { canSend: false, authorId: null },
      }),
    ).not.toBeNull();
    expect(
      parse({
        type: "chat_sync",
        gameInstanceId: id,
        chatEntries: [],
        chatAccess: { canSend: true, authorId: null },
      }),
    ).toBeNull();
    expect(
      parse({
        type: "presence_update",
        gameInstanceId: id,
        hoveredCardId: "c1",
        hoveredAt: 5,
        emoteId: "poro_wave",
        emoteAt: 6,
      }),
    ).not.toBeNull();
    expect(
      parse({
        type: "presence_update",
        gameInstanceId: id,
        emoteId: "thumbs_up",
      }),
    ).not.toBeNull();
    expect(
      parse({
        type: "presence_update",
        gameInstanceId: id,
        emoteId: "not_an_emote",
      }),
    ).toBeNull();
    expect(
      parse({
        type: "presence_update",
        gameInstanceId: id,
        pingIntent: "something",
      }),
    ).toBeNull();
  });

  it("validates action intents and patch commits", () => {
    expect(
      parse({
        type: "action_intent",
        gameInstanceId: id,
        action: { type: "end_turn" },
        clientBaseSequence: 0,
      }),
    ).not.toBeNull();
    expect(
      parse({ type: "action_intent", gameInstanceId: id, action: { type: "end_turn" } }),
    ).toBeNull();
    expect(
      parse({
        type: "authoritative_patch_commit",
        gameInstanceId: id,
        baseSequence: 1,
        sequence: 2,
        action: { type: "end_turn" },
        patch: { operations: [] },
      }),
    ).not.toBeNull();
    expect(
      parse({
        type: "authoritative_patch_commit",
        gameInstanceId: id,
        baseSequence: 1,
        sequence: 2,
        action: { type: "end_turn" },
        patch: { operations: "nope" },
      }),
    ).toBeNull();
    expect(
      parse({
        type: "authoritative_patch_commit",
        gameInstanceId: id,
        baseSequence: 1,
        sequence: 2,
        action: { type: "end_turn" },
        patch: { operations: [] },
        actionClock: {
          scopeKey: "s",
          totals: {},
          activeTargets: [],
          runningSince: null,
          serverNow: 1,
        },
      }),
    ).not.toBeNull();
  });

  it("validates error frames, sanitizes invalid sequences and strips unmapped auth fields", () => {
    expect(parse({ type: "error", gameInstanceId: id, code: "x", message: "y" })).not.toBeNull();
    expect(
      parse({
        type: "error",
        gameInstanceId: id,
        code: "x",
        message: "y",
        authoritativeSequence: -1,
      }),
    ).not.toBeNull();
    const stripped = parse({
      type: "error",
      gameInstanceId: id,
      code: "auth_token_rejected",
      message: "no",
      authReason: "missing",
      authRecovery: "reauthenticate",
      retryable: true,
    });
    expect(stripped).not.toBeNull();
    expect("authReason" in (stripped ?? {})).toBe(false);
    expect("authRecovery" in (stripped ?? {})).toBe(false);
    expect(
      parse({ type: "error", gameInstanceId: id, code: "x", message: "y", authReason: "nope" }),
    ).not.toBeNull();
    const invalidReason = parse({
      type: "error",
      gameInstanceId: id,
      code: "x",
      message: "y",
      authReason: "nope",
    });
    expect("authReason" in (invalidReason ?? {})).toBe(false);
  });

  it("[R474] keeps a strict rejection's rule and detail on error frames (R2-int, §5)", () => {
    const frame = {
      type: "error",
      gameInstanceId: id,
      code: "not_your_priority",
      message: "not_your_priority: rule 312",
      rule: "312",
      detail: "p2 has priority",
      mutationClass: "reject_invalid",
    };
    expect(parse(frame)).toEqual(frame);
    expect(parse({ ...frame, rule: 312 })).toBeNull();
    expect(parse({ ...frame, detail: { text: "x" } })).toBeNull();
  });

  it("validates spectator roster, rewinds and reports", () => {
    expect(
      parse({
        type: "spectator_roster_sync",
        gameInstanceId: id,
        spectators: [
          {
            authSubject: "s",
            displayName: "Spectator",
            joinedAt: 1,
            updatedAt: 2,
            grantedPrivatePlayerIds: [],
          },
        ],
      }),
    ).not.toBeNull();
    expect(
      parse({
        type: "rewind_confirmation_state",
        gameInstanceId: id,
        confirmation: {
          requestId: "req_123",
          requesterPlayerId: "p1",
          approverPlayerId: "p2",
          opponentMeaningfulActionCount: 1,
          requestedAt: 10,
          expiresAt: 20,
        },
      }),
    ).not.toBeNull();
    expect(
      parse({
        type: "player_report_result",
        gameInstanceId: id,
        clientReportId: "r",
        status: "submitted",
      }),
    ).not.toBeNull();
    expect(
      parse({
        type: "player_report_submit",
        gameInstanceId: id,
        clientReportId: "r",
        reportedPlayerId: "p2",
        reason: "other",
      }),
    ).not.toBeNull();
    expect(
      parse({
        type: "player_report_submit",
        gameInstanceId: id,
        clientReportId: "r",
        reportedPlayerId: "p2",
        reason: "not_a_reason",
      }),
    ).toBeNull();
  });
});

describe("helpers", () => {
  it("builds envelopes", () => {
    expect(makeEnvelope("ping", id, { sentAt: 1 })).toEqual({
      type: "ping",
      gameInstanceId: id,
      sentAt: 1,
    });
  });

  it("isValidRealtimeMessage narrows and isActionClock validates", () => {
    expect(isValidRealtimeMessage({ type: "pong", gameInstanceId: id, sentAt: 1 })).toBe(true);
    expect(
      isActionClock({
        scopeKey: "s",
        totals: {},
        activeTargets: [],
        runningSince: null,
        serverNow: 0,
      }),
    ).toBe(true);
    expect(isActionClock({ scopeKey: "s" })).toBe(false);
  });

  it("accepts already-mapped auth errors unchanged", () => {
    const mapped = {
      type: "error",
      gameInstanceId: id,
      code: "auth_required",
      message: "missing",
      authReason: "missing",
      authRecovery: "reauthenticate",
      retryable: false,
    };
    expect(mapAuthErrorEnvelope(mapped)).toBe(mapped);
  });
});
