import { describe, expect, it, vi } from "vitest";
import type { GameplayLogEntry, PlayerBoard, Room } from "@rift/protocol";
import {
  ACTIVITY_HISTORY_SEATED_CODE,
  CLOSE_CODE_JOIN_UNANSWERED,
  CLOSE_CODE_LIVENESS_TIMEOUT,
  GAMEPLAY_ACTION_OUTCOME_UNKNOWN_ERROR,
  INITIAL_MATCH_RUNTIME_STATE,
  MatchRuntime,
  REALTIME_CONNECTION_LOST_MESSAGE,
  createLivenessProbe,
  decideAuthoritativeApplication,
  decideServerErrorOutcome,
  hydrateActionClock,
  isActiveGameplayPhase,
  mergeRoomShellMetadata,
  parseRealtimeMessage,
  pruneJudgeFeedback,
  type AuthoritativeWireMessage,
  type RuntimeSocket,
} from "../matchRuntime";
import {
  INITIAL_MATCHMAKING_STATE,
  MatchmakingClient,
  isMatchmakingSearchId,
  filterExtensions,
} from "../matchmaking";
import { matchmakingQueueRoom } from "../roomApi";
import { resetToken } from "../patch";

function board(extra: Partial<PlayerBoard> = {}): PlayerBoard {
  return {
    score: 0,
    floatingEnergy: 0,
    floatingPower: 0,
    deck: [],
    hand: [],
    handRevealToOpponent: false,
    base: [],
    trash: [],
    banished: [],
    battlefieldA: [],
    battlefieldB: [],
    battlefieldToken: [],
    champion: [],
    legend: [],
    runeDeck: [],
    runeArea: [],
    deckPeek: { cardIds: [], revealedCardIds: [] },
    ...extra,
  };
}

function room(): Room {
  return {
    roomCode: "AB12CD",
    createdAt: 0,
    updatedAt: 0,
    phase: "in_game",
    players: [
      { id: "p1", seat: 0, name: "p1", joinedAt: 0, board: board() },
      { id: "p2", seat: 1, name: "p2", joinedAt: 0, board: board() },
    ],
    log: [],
    chainEntries: [],
    chainResolveVotes: [],
  };
}

describe("parseRealtimeMessage (495270.N)", () => {
  it("parses valid frames and rejects garbage", () => {
    expect(parseRealtimeMessage('{"type":"pong","gameInstanceId":"gi","sentAt":1}')).toEqual({
      type: "pong",
      gameInstanceId: "gi",
      sentAt: 1,
    });
    expect(parseRealtimeMessage("not json")).toBeNull();
    expect(parseRealtimeMessage('{"noType":true}')).toBeNull();
    expect(parseRealtimeMessage(1234)).toBeNull();
  });

  it("maps auth failure reasons to realtime codes (or strips them)", () => {
    const expired = parseRealtimeMessage(
      JSON.stringify({
        type: "error",
        gameInstanceId: "gi",
        code: "auth_token_rejected",
        message: "nope",
        authReason: "expired_token",
        authRecovery: "refresh_token",
        retryable: true,
      }),
    );
    expect(expired).toMatchObject({ authReason: "expired_token", authRecovery: "refresh_token" });

    const mismatched = parseRealtimeMessage(
      JSON.stringify({
        type: "error",
        gameInstanceId: "gi",
        code: "something_else",
        message: "nope",
        authReason: "expired_token",
        authRecovery: "refresh_token",
      }),
    );
    expect(mismatched).not.toBeNull();
    expect(mismatched).not.toHaveProperty("authReason");
    expect(mismatched).not.toHaveProperty("authRecovery");
  });

  it("drops an invalid authoritativeSequence", () => {
    const parsed = parseRealtimeMessage(
      JSON.stringify({
        type: "error",
        gameInstanceId: "gi",
        code: "stale_action_state",
        message: "stale",
        authoritativeSequence: -1,
      }),
    );
    expect(parsed).not.toBeNull();
    expect(parsed).not.toHaveProperty("authoritativeSequence");
  });
});

describe("decideAuthoritativeApplication", () => {
  const message = (overrides: Partial<AuthoritativeWireMessage>): AuthoritativeWireMessage => ({
    type: "authoritative_patch_commit",
    gameInstanceId: "gi",
    sequence: 2,
    baseSequence: 1,
    action: { type: "end_turn" },
    patch: { operations: [{ op: "set_room_fields", fields: { turnNumber: 2 } }] },
    ...overrides,
  });

  it("accepts a snapshot with an equal or higher sequence and ignores older ones", () => {
    const snapshot = {
      type: "authoritative_snapshot",
      gameInstanceId: "gi",
      sequence: 5,
      snapshot: room(),
      gameplayLog: [],
    } as unknown as AuthoritativeWireMessage;
    expect(
      decideAuthoritativeApplication({
        message: snapshot,
        sequence: null,
        room: null,
        logEntries: [],
        resyncRequested: false,
      }).kind,
    ).toBe("snapshot");
    expect(
      decideAuthoritativeApplication({
        message: snapshot,
        sequence: 5,
        room: room(),
        logEntries: [],
        resyncRequested: false,
      }).kind,
    ).toBe("snapshot");
    expect(
      decideAuthoritativeApplication({
        message: snapshot,
        sequence: 9,
        room: room(),
        logEntries: [],
        resyncRequested: false,
      }).kind,
    ).toBe("ignored");
  });

  it("applies a patch when baseSequence+1 matches", () => {
    const decision = decideAuthoritativeApplication({
      message: message({}),
      sequence: 1,
      room: room(),
      logEntries: [],
      resyncRequested: false,
    });
    expect(decision.kind).toBe("patch");
    if (decision.kind !== "patch") return;
    expect(decision.state.sequence).toBe(2);
    expect(decision.state.room.turnNumber).toBe(2);
  });

  it("resyncs on sequence gaps", () => {
    expect(
      decideAuthoritativeApplication({
        message: message({ baseSequence: 0 }),
        sequence: 1,
        room: room(),
        logEntries: [],
        resyncRequested: false,
      }),
    ).toMatchObject({ kind: "resync", reason: "sequence_gap" });
    expect(
      decideAuthoritativeApplication({
        message: message({ sequence: 4 }),
        sequence: 1,
        room: room(),
        logEntries: [],
        resyncRequested: false,
      }),
    ).toMatchObject({ kind: "resync", reason: "sequence_gap" });
  });

  it("acknowledges but ignores replayed patches (sequence <= current)", () => {
    expect(
      decideAuthoritativeApplication({
        message: message({ sequence: 1 }),
        sequence: 3,
        room: room(),
        logEntries: [],
        resyncRequested: false,
      }),
    ).toEqual({ kind: "ignored", acknowledge: true });
  });

  it("treats a matching noop ack as a noop and a gap as a resync", () => {
    const noop = {
      type: "gameplay_action_noop_ack",
      gameInstanceId: "gi",
      sequence: 3,
    } as unknown as AuthoritativeWireMessage;
    expect(
      decideAuthoritativeApplication({
        message: noop,
        sequence: 3,
        room: room(),
        logEntries: [],
        resyncRequested: false,
      }).kind,
    ).toBe("noop");
    expect(
      decideAuthoritativeApplication({
        message: noop,
        sequence: 4,
        room: room(),
        logEntries: [],
        resyncRequested: false,
      }),
    ).toMatchObject({
      kind: "resync",
      reason: "sequence_gap",
    });
  });

  it("rejects rune-count-changing patches", () => {
    const before = room();
    const after = room();
    after.players[0]!.board!.runeDeck = [
      { id: "r1", name: "r1", source: "rune", exhausted: false, createdAt: 0 },
    ];
    const decision = decideAuthoritativeApplication({
      message: {
        type: "authoritative_patch_commit",
        gameInstanceId: "gi",
        sequence: 2,
        baseSequence: 1,
        action: { type: "rune_batch" },
        patch: {
          operations: [
            {
              op: "zone_insert",
              playerId: "p1",
              zone: "runeDeck",
              index: 0,
              cards: [{ id: "r1", name: "r1", source: "rune", exhausted: false, createdAt: 0 }],
            },
          ],
        },
      } as unknown as AuthoritativeWireMessage,
      sequence: 1,
      room: before,
      logEntries: [],
      resyncRequested: false,
    });
    expect(decision).toMatchObject({ kind: "resync", reason: "rune_count_changed" });
    expect(before.players[0]!.board!.runeDeck).toHaveLength(0);
  });

  it("resyncs on invalid patches", () => {
    const decision = decideAuthoritativeApplication({
      message: message({ patch: { operations: [{ op: "bogus" } as never] } }),
      sequence: 1,
      room: room(),
      logEntries: [],
      resyncRequested: false,
    });
    expect(decision).toMatchObject({ kind: "resync", reason: "invalid_patch" });
  });
});

describe("decideServerErrorOutcome (1w8d…:3141)", () => {
  it("keeps a superseded seat terminal", () => {
    const outcome = decideServerErrorOutcome({
      code: "control_superseded",
      message: "seat resumed",
      clientActionId: null,
      roomPhase: "in_game",
      hasAuthoritativeSnapshot: true,
      canRetryStartupRecovery: false,
    });
    expect(outcome.nextSessionPhase).toBe("superseded");
    expect(outcome.userMessage).toBe("This seat was resumed from another tab or device.");
    expect(outcome.shouldRequestResync).toBe(false);
  });

  it("requests a resync when the server asks for one and we have no snapshot", () => {
    const outcome = decideServerErrorOutcome({
      code: "runtime_persistence_failed",
      message: "boom",
      mutationClass: "resync_required",
      clientActionId: "act-1",
      roomPhase: "in_game",
      hasAuthoritativeSnapshot: false,
      canRetryStartupRecovery: false,
    });
    expect(outcome.shouldRequestResync).toBe(true);
    expect(outcome.nextSessionPhase).toBe("resyncing");
  });

  it("retries the bootstrap during startup", () => {
    const outcome = decideServerErrorOutcome({
      code: "bootstrap_failed",
      message: "nope",
      retryable: true,
      clientActionId: null,
      roomPhase: "in_game",
      hasAuthoritativeSnapshot: false,
      canRetryStartupRecovery: true,
    });
    expect(outcome.willRetryBootstrap).toBe(true);
    expect(outcome.userMessage).toBeNull();
  });
});

describe("helpers", () => {
  it("knows active gameplay phases", () => {
    expect(isActiveGameplayPhase("in_game")).toBe(true);
    expect(isActiveGameplayPhase("mulligan")).toBe(true);
    expect(isActiveGameplayPhase("lobby")).toBe(false);
    expect(isActiveGameplayPhase(null)).toBe(false);
  });

  it("hydrates an action clock with receivedAt", () => {
    const clock = hydrateActionClock(
      {
        scopeKey: "s",
        totals: { p1: 1 },
        activeTargets: [{ playerId: "p1", reason: "turn" }],
        runningSince: null,
        serverNow: 0,
      },
      1234,
    );
    expect(clock?.receivedAt).toBe(1234);
    expect(clock?.totals).toEqual({ p1: 1 });
    expect(hydrateActionClock(null, 1)).toBeNull();
  });

  it("prunes judge feedback for non-answered calls", () => {
    const feedback = new Map([
      [
        "a",
        { callId: "a", rating: "helpful" as const, status: "recorded" as const, retryable: false },
      ],
      [
        "b",
        { callId: "b", rating: "helpful" as const, status: "pending" as const, retryable: false },
      ],
    ]);
    const pruned = pruneJudgeFeedback(feedback, [{ id: "a", status: "answered", requestedAt: 0 }]);
    expect([...pruned.keys()]).toEqual(["a"]);
    expect(pruneJudgeFeedback(feedback, [])).not.toBe(feedback);
  });

  it("has an idle initial state", () => {
    expect(INITIAL_MATCH_RUNTIME_STATE.connectionState).toBe("idle");
    expect(INITIAL_MATCH_RUNTIME_STATE.sessionPhase).toBe("disconnected");
  });

  it("merges room-shell series metadata onto the authoritative room", () => {
    const base = room();
    const merged = mergeRoomShellMetadata(base, {
      roomCode: "AB12CD",
      createdAt: 0,
      phase: "in_game",
      players: base.players,
      log: [],
      seriesId: "series_2",
      gameNumber: 2,
      winsByPlayerId: { p1: 1, p2: 0 },
      pendingGameResult: {
        requestedByPlayerId: "p1",
        winnerByReporterPlayerId: { p1: "p1" },
        resolvedWinnerPlayerId: "p1",
      },
      rematchRequestedPlayerIds: ["p1"],
      nextRoomCode: "V30BY",
      returnLobbyRoomCode: "PZUSU",
      previousRoomCode: "AB12CD",
      matchTermination: {
        status: "completed",
        reason: "score",
        endedAt: 5,
        winnerPlayerId: "p1",
        winnerPlayerIds: ["p1"],
      },
    });
    expect(merged).toMatchObject({
      winsByPlayerId: { p1: 1, p2: 0 },
      pendingGameResult: { resolvedWinnerPlayerId: "p1" },
      rematchRequestedPlayerIds: ["p1"],
      nextRoomCode: "V30BY",
      returnLobbyRoomCode: "PZUSU",
      previousRoomCode: "AB12CD",
      seriesId: "series_2",
      gameNumber: 2,
      matchTermination: { winnerPlayerId: "p1", winnerPlayerIds: ["p1"] },
    });
    expect(base.nextRoomCode).toBeUndefined();
  });

  it("builds reset tokens for history navigation", () => {
    expect(
      resetToken({
        action: { type: "forward_last_rewind" },
        gameInstanceId: "gi",
        sequence: 9,
        token: "t",
      }).kind,
    ).toBe("forward");
  });
});

describe("createLivenessProbe (114032.f)", () => {
  it("sends pings when idle and closes when the pong never arrives", () => {
    vi.useFakeTimers();
    try {
      const sent: string[] = [];
      const onDead = vi.fn();
      const probe = createLivenessProbe({
        probeId: "gi",
        send: (serialized) => sent.push(serialized),
        isCurrent: () => true,
        onDead,
      });
      vi.advanceTimersByTime(20_000);
      expect(sent).toHaveLength(1);
      expect(JSON.parse(sent[0]!)).toMatchObject({ type: "ping", gameInstanceId: "gi" });
      vi.advanceTimersByTime(8_000);
      expect(onDead).toHaveBeenCalledTimes(1);
      probe.dispose();
    } finally {
      vi.useRealTimers();
    }
  });

  it("accepts a matching pong and reports the round trip", () => {
    vi.useFakeTimers();
    try {
      const sent: string[] = [];
      const onRoundTrip = vi.fn();
      const onDead = vi.fn();
      const probe = createLivenessProbe({
        probeId: "gi",
        send: (serialized) => sent.push(serialized),
        isCurrent: () => true,
        onDead,
        onRoundTrip,
      });
      vi.advanceTimersByTime(20_000);
      const ping = JSON.parse(sent[0]!) as { sentAt: number };
      vi.advanceTimersByTime(100);
      probe.acceptPong({ probeId: "gi", sentAt: ping.sentAt });
      expect(onRoundTrip).toHaveBeenCalledWith(100);
      // the probe re-arms after the idle interval; keep answering to stay alive
      vi.advanceTimersByTime(20_000);
      expect(sent).toHaveLength(2);
      const second = JSON.parse(sent[1]!) as { sentAt: number };
      vi.advanceTimersByTime(100);
      probe.acceptPong({ probeId: "gi", sentAt: second.sentAt });
      expect(onRoundTrip).toHaveBeenCalledTimes(2);
      expect(onDead).not.toHaveBeenCalled();
      probe.dispose();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("MatchmakingClient", () => {
  class FakeSocket {
    readyState = 1;
    sent: string[] = [];
    listeners = new Map<string, Array<(event: unknown) => void>>();
    send(data: string) {
      this.sent.push(data);
    }
    close() {
      this.readyState = 3;
    }
    reconnect() {
      this.readyState = 1;
    }
    addEventListener(type: string, listener: (event: unknown) => void) {
      const list = this.listeners.get(type) ?? [];
      list.push(listener);
      this.listeners.set(type, list);
    }
    removeEventListener(type: string, listener: (event: unknown) => void) {
      this.listeners.set(
        type,
        (this.listeners.get(type) ?? []).filter((candidate) => candidate !== listener),
      );
    }
    emit(type: string, event: unknown) {
      for (const listener of this.listeners.get(type) ?? []) listener(event);
    }
  }

  it("computes the queue room name exactly like the original", () => {
    expect(
      matchmakingQueueRoom({
        playMode: "constructed",
        matchmakingPool: "standard",
        matchFormat: "bo1",
      }),
    ).toBe("enam-v2-constructed-all-bo1");
    expect(
      matchmakingQueueRoom({
        playMode: "constructed",
        matchmakingPool: "standard",
        matchFormat: "bo1",
        gameVariant: "teams_2v2",
      }),
    ).toBe("enam-v2-constructed-all-multiplayer");
    expect(
      matchmakingQueueRoom({
        playMode: "sealed",
        matchmakingPool: "vendetta-prerift-v1",
        matchFormat: "bo1",
      }),
    ).toBe("enam-v2-sealed-vendetta-prerift-v1-bo1");
  });

  it("validates search ids and filters extensions", () => {
    expect(isMatchmakingSearchId("abcdefgh")).toBe(true);
    expect(isMatchmakingSearchId("short")).toBe(false);
    expect(filterExtensions(["pools", "nope", "tables"])).toEqual(["pools", "tables"]);
    expect(filterExtensions("pools")).toEqual([]);
  });

  it("walks connecting → searching and reports a match", async () => {
    const sockets: FakeSocket[] = [];
    const matched: Array<{ roomCode: string }> = [];
    const client = new MatchmakingClient({
      storage: null,
      socketFactory: () => {
        const socket = new FakeSocket();
        sockets.push(socket);
        return socket;
      },
      authTokenProvider: async () => "token",
      onMatched: (result) => matched.push(result),
    });
    const attempt = {
      searchId: "searchid-12345678",
      initiatingUserId: "user-1",
      playerName: "Kai",
      playMode: "constructed" as const,
      decklist: "Main Deck: 1 Kai",
      matchmakingPool: "standard",
      matchFormat: "bo1" as const,
      extensions: ["pools" as const],
    };
    const promise = client.search(attempt);
    const socket = sockets[0]!;
    socket.emit("open", {});
    await promise;
    expect(client.store.getSnapshot().status.status).toBe("connecting");
    const start = JSON.parse(socket.sent[0]!) as Record<string, unknown>;
    expect(start).toMatchObject({
      type: "start",
      searchId: attempt.searchId,
      playerName: "Kai",
      playMode: "constructed",
      matchmakingPool: "standard",
      matchFormat: "bo1",
      authToken: "token",
    });
    socket.emit("message", {
      data: JSON.stringify({
        type: "searching",
        searchId: attempt.searchId,
        expiresAt: 1,
        widenAt: 2,
        searchScope: "specific",
      }),
    });
    expect(client.store.getSnapshot().status.status).toBe("searching");
    socket.emit("message", {
      data: JSON.stringify({
        type: "matched",
        roomCode: "AB12CD",
        playerId: "p1",
        playerName: "Kai",
        playMode: "constructed",
      }),
    });
    expect(client.store.getSnapshot().status).toEqual({
      status: "matched",
      roomCode: "AB12CD",
      playerId: "p1",
      playerName: "Kai",
    });
    expect(matched).toHaveLength(1);
    client.dispose();
    expect(INITIAL_MATCHMAKING_STATE.status).toEqual({ status: "idle" });
  });

  it("records a conflict recovery payload", async () => {
    const sockets: FakeSocket[] = [];
    const client = new MatchmakingClient({
      storage: null,
      socketFactory: () => {
        const socket = new FakeSocket();
        sockets.push(socket);
        return socket;
      },
      authTokenProvider: async () => "token",
    });
    const promise = client.search({
      searchId: "searchid-12345678",
      initiatingUserId: "user-1",
      playerName: "Kai",
      playMode: "constructed",
      decklist: "x",
      matchmakingPool: "standard",
      matchFormat: "bo1",
    });
    sockets[0]!.emit("open", {});
    await promise;
    sockets[0]!.emit("message", {
      data: JSON.stringify({
        type: "error",
        code: "matchmaking_search_conflict",
        message: "already searching",
        activeSearchId: "othersearchid99",
        activeSearchExpiresAt: 999,
      }),
    });
    expect(client.store.getSnapshot().status).toEqual({ status: "conflict", expiresAt: 999 });
    client.dispose();
  });
});

describe("MatchRuntime state machine (offline)", () => {
  it("starts, sends join_shell, and reports superseded on close 4001", async () => {
    const sockets: FakeSocket[] = [];
    class FakeSocket implements RuntimeSocket {
      readyState = 1;
      sent: string[] = [];
      onopen: ((event: Event) => void) | null = null;
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      onclose: ((event: CloseEvent) => void) | null = null;
      send(data: string) {
        this.sent.push(data);
      }
      close(code?: number, reason?: string) {
        this.readyState = 3;
        this.onclose?.({ code: code ?? 1000, reason: reason ?? "", wasClean: false } as CloseEvent);
      }
    }
    const runtime = new MatchRuntime({
      session: {
        roomCode: "AB12CD",
        playerId: "p1",
        playerName: "Kai",
        viewerRole: "player",
        playMode: "constructed",
        deckRulesMode: "standard",
        lastKnownPhase: "in_game",
      },
      realtimeSession: { gameInstanceId: "gi-1" },
      authTokenProvider: async () => "token",
      socketFactory: () => {
        const socket = new FakeSocket();
        sockets.push(socket);
        return socket;
      },
    });
    runtime.start();
    const socket = sockets[0]!;
    expect(runtime.store.getSnapshot().connectionState).toBe("connecting");
    socket.onopen?.({} as Event);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(runtime.store.getSnapshot().connectionState).toBe("open");
    const join = JSON.parse(socket.sent[0]!) as Record<string, unknown>;
    expect(join).toMatchObject({
      type: "join_game",
      gameInstanceId: "gi-1",
      roomCode: "AB12CD",
      playerId: "p1",
      authToken: "token",
    });
    socket.close(4001, "superseded");
    expect(runtime.store.getSnapshot().sessionPhase).toBe("superseded");
    runtime.dispose();
    expect(runtime.store.getSnapshot().connectionState).toBe("idle");
  });

  it("uses the join-unanswered close code", () => {
    expect(CLOSE_CODE_JOIN_UNANSWERED).toBe(4010);
    expect(CLOSE_CODE_LIVENESS_TIMEOUT).toBe(4009);
    expect(ACTIVITY_HISTORY_SEATED_CODE).toBe("activity_history_seated");
    expect(GAMEPLAY_ACTION_OUTCOME_UNKNOWN_ERROR).toBe("GameplayActionOutcomeUnknownError");
    expect(REALTIME_CONNECTION_LOST_MESSAGE).toBe("Realtime room connection lost. Reconnecting...");
  });
});
