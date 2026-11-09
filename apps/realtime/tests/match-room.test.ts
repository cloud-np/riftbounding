import { describe, expect, it } from "vitest";
import type { Room, Spectator } from "@rift/protocol";
import { parseRealtimeMessage } from "@rift/sync";
import { MatchRoomCore } from "../src/core/MatchRoomCore";
import {
  DO_STORAGE_VALUE_LIMIT_BYTES,
  TIMELINE_META_KEY,
  TimelinePersistence,
} from "../src/core/TimelinePersistence";
import type { MatchRoomSeed } from "../src/core/types";
import type { Identity } from "../src/core/types";
import type { CoreTransport } from "../src/core/types";
import { FakeTimelineStorage } from "./helpers/timeline-storage";

type Sent = { connectionId: string; message: Record<string, unknown> };

class FakeTransport implements CoreTransport {
  sent: Sent[] = [];
  closed: Array<{ connectionId: string; code: number; reason: string }> = [];
  send(connectionId: string, message: Record<string, unknown>): void {
    this.sent.push({ connectionId, message });
  }
  close(connectionId: string, code: number, reason: string): void {
    this.closed.push({ connectionId, code, reason });
  }
  messagesFor(connectionId: string, type?: string): Record<string, unknown>[] {
    return this.sent
      .filter((entry) => entry.connectionId === connectionId)
      .map((entry) => entry.message)
      .filter((message) => !type || message.type === type);
  }
  latest(connectionId: string, type: string): Record<string, unknown> | undefined {
    return this.messagesFor(connectionId, type).at(-1);
  }
}

const identities: Record<string, Identity> = {
  "alice-token": { sub: "alice", name: "Alice", expiresAt: null },
  "bob-token": { sub: "bob", name: "Bob", expiresAt: null },
  "carol-token": { sub: "carol", name: "Carol", expiresAt: null },
};

function makeClock() {
  let now = 1_000;
  let state = 0x1234_5678;
  return {
    now: () => ++now,
    rng: () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
    },
    get value() {
      return now;
    },
  };
}

const DECK = `Legend:
1 Ahri, Nine-Tailed Fox
Champion:
1 Ahri, Nine-Tailed Fox
MainDeck:
4 Spirit Scout
4 Feral Instinct
4 Runeblade
4 Mystic Shot
Battlefields:
2 Training Grounds
1 Mountain Pass
Runes:
4 Fury Rune
4 Calm Rune
Sideboard:
1 Back to Back`;

function makeSeed(overrides: Partial<MatchRoomSeed> = {}): MatchRoomSeed {
  return {
    roomCode: "ABC123",
    createdAt: 1_000,
    roomMode: "multiplayer",
    gameVariant: "duel",
    playMode: "constructed",
    deckRulesMode: "standard",
    matchFormat: "bo1",
    players: [
      {
        playerId: "alice",
        name: "Alice",
        seat: 0,
        authSubject: "alice",
        decklist: DECK,
      },
      {
        playerId: "bob",
        name: "Bob",
        seat: 1,
        authSubject: "bob",
        decklist: DECK,
      },
    ],
    ...overrides,
  };
}

async function setup() {
  const transport = new FakeTransport();
  const clock = makeClock();
  const core = await MatchRoomCore.create(makeSeed(), {
    transport,
    clock,
    verifyToken: async (token) => identities[token] ?? null,
  });
  core.addConnection("conn-alice");
  core.addConnection("conn-bob");
  await core.handleMessage("conn-alice", {
    type: "join_shell",
    gameInstanceId: "ABC123",
    roomCode: "ABC123",
    authToken: "alice-token",
  });
  await core.handleMessage("conn-bob", {
    type: "join_shell",
    gameInstanceId: "ABC123",
    roomCode: "ABC123",
    authToken: "bob-token",
  });
  return { core, transport, clock };
}

async function readyUp(core: MatchRoomCore) {
  await core.handleMessage("conn-alice", {
    type: "room_shell_action",
    gameInstanceId: "ABC123",
    action: { type: "set_lobby_ready", ready: true },
    clientActionId: "ready-a",
  });
  await core.handleMessage("conn-bob", {
    type: "room_shell_action",
    gameInstanceId: "ABC123",
    action: { type: "set_lobby_ready", ready: true },
    clientActionId: "ready-b",
  });
}

async function startAndJoin(core: MatchRoomCore, transport: FakeTransport) {
  await readyUp(core);
  await core.handleMessage("conn-alice", {
    type: "room_shell_action",
    gameInstanceId: "ABC123",
    action: { type: "start_lobby_match" },
    clientActionId: "start-1",
  });
  await core.handleMessage("conn-alice", {
    type: "join_game",
    gameInstanceId: "ABC123",
    roomCode: "ABC123",
    authToken: "alice-token",
  });
  await core.handleMessage("conn-bob", {
    type: "join_game",
    gameInstanceId: "ABC123",
    roomCode: "ABC123",
    authToken: "bob-token",
  });
  return transport.latest("conn-alice", "authoritative_snapshot")?.snapshot as Room;
}

async function action(
  core: MatchRoomCore,
  connectionId: string,
  type: string,
  fields: Record<string, unknown> = {},
  clientActionId = `act-${Math.random().toString(36).slice(2, 10)}`,
) {
  await core.handleMessage(connectionId, {
    type: "action_intent",
    gameInstanceId: "ABC123",
    action: { type, ...fields },
    actorPlayerId: connectionId === "conn-alice" ? "alice" : "bob",
    clientActionId,
    clientBaseSequence: core.sequence,
  });
  return clientActionId;
}

async function driveSetup(core: MatchRoomCore, transport: FakeTransport) {
  await action(core, "conn-alice", "select_battlefield", { battlefield: "Training Grounds" });
  await action(core, "conn-bob", "select_battlefield", { battlefield: "Mountain Pass" });
  expect(core.room.phase).toBe("initiative_roll");
  for (let round = 0; round < 10 && core.room.phase === "initiative_roll"; round += 1) {
    for (const [connectionId, playerId] of [
      ["conn-alice", "alice"],
      ["conn-bob", "bob"],
    ] as const) {
      if (
        core.room.initiativeRolls?.[playerId] === undefined &&
        core.room.phase === "initiative_roll"
      ) {
        await action(core, connectionId, "roll_initiative");
      }
    }
  }
  expect(core.room.phase).toBe("first_player_choice");
  const chooser = core.room.firstPlayerChooserId;
  expect(chooser).toBeTruthy();
  await action(core, chooser === "bob" ? "conn-bob" : "conn-alice", "choose_first_player", {
    firstPlayerId: "alice",
  });
  expect(core.room.phase).toBe("mulligan");
  await action(core, "conn-alice", "submit_mulligan", { cardIds: [] });
  await action(core, "conn-bob", "submit_mulligan", { cardIds: [] });
  expect(core.room.phase).toBe("in_game");
  expect(core.room.activeTurnPlayerId).toBe("alice");
  expect(core.room.activeTurnStep).toBe("main");
  return transport.latest("conn-alice", "authoritative_patch_commit");
}

describe("MatchRoomCore", () => {
  it("creates a lobby, syncs the shell per viewer and redacts opponent hands", async () => {
    const { core, transport } = await setup();
    const aliceSync = transport.latest("conn-alice", "room_shell_sync");
    expect(aliceSync).toBeTruthy();
    expect((aliceSync?.sessionDoc as { viewer: unknown }).viewer).toEqual({
      role: "player",
      playerId: "alice",
    });
    const bobSync = transport.latest("conn-bob", "room_shell_sync");
    expect((bobSync?.sessionDoc as { viewer: { playerId: string } }).viewer.playerId).toBe("bob");

    await startAndJoin(core, transport);
    await driveSetup(core, transport);
    // Force fresh snapshots after the opening hands were dealt.
    await core.handleMessage("conn-alice", {
      type: "resume_game",
      gameInstanceId: "ABC123",
      playerId: "alice",
      authToken: "alice-token",
      clientSequence: 0,
    });
    await core.handleMessage("conn-bob", {
      type: "resume_game",
      gameInstanceId: "ABC123",
      playerId: "bob",
      authToken: "bob-token",
      clientSequence: 0,
    });
    const aliceSnapshot = transport.latest("conn-alice", "authoritative_snapshot")
      ?.snapshot as Room;
    const bob = aliceSnapshot.players.find((player) => player.id === "bob")!;
    expect(bob.board?.hand.length).toBeGreaterThanOrEqual(4);
    expect(bob.board?.hand[0]?.name).toBe("");
    expect(bob.board?.hand[0]?.id.startsWith("__hidden_zone__")).toBe(true);
    const bobSnapshot = transport.latest("conn-bob", "authoritative_snapshot")?.snapshot as Room;
    const bobOwn = bobSnapshot.players.find((player) => player.id === "bob")!;
    expect(bobOwn.board?.hand[0]?.name).not.toBe("");
    expect(bobOwn.board?.hand[0]?.id.startsWith("__hidden_zone__")).toBe(false);
  });

  it("projects the action clock with the active turn target", async () => {
    const { core, transport } = await setup();
    await startAndJoin(core, transport);
    await driveSetup(core, transport);
    await core.handleMessage("conn-alice", {
      type: "resume_game",
      gameInstanceId: "ABC123",
      playerId: "alice",
      authToken: "alice-token",
      clientSequence: 0,
    });
    const snapshot = transport.latest("conn-alice", "authoritative_snapshot") as
      Record<string, unknown> | undefined;
    const clock = snapshot?.actionClock as
      | {
          scopeKey: string;
          totals: Record<string, number>;
          activeTargets: Array<{ playerId: string }>;
        }
      | undefined;
    expect(clock?.scopeKey).toBe("ABC123:1");
    expect(clock?.totals).toHaveProperty("alice");
    expect(clock?.activeTargets.map((target) => target.playerId)).toEqual(["alice"]);

    await action(core, "conn-alice", "end_turn", {
      observed: {
        turnNumber: core.room.turnNumber,
        activePlayerId: core.room.activeTurnPlayerId,
        activeStep: core.room.activeTurnStep,
      },
    });
    const patch = transport.latest("conn-alice", "authoritative_patch_commit") as
      { patch?: { operations?: Array<{ op: string }> } } | undefined;
    expect(patch?.patch?.operations?.some((operation) => operation.op === "set_action_clock")).toBe(
      true,
    );
  });

  it("drives setup to in_game and emits per-viewer patches", async () => {
    const { core, transport } = await setup();
    await startAndJoin(core, transport);
    const patch = await driveSetup(core, transport);
    expect(patch).toBeTruthy();
    expect(typeof patch?.baseSequence).toBe("number");
    expect(typeof patch?.sequence).toBe("number");
    expect((patch?.sequence as number) - (patch?.baseSequence as number)).toBe(1);
    expect((patch?.action as { type: string }).type).toBe("submit_mulligan");

    const sequence = core.sequence;
    const clientActionId = await action(core, "conn-alice", "end_turn", {
      observed: {
        turnNumber: core.room.turnNumber,
        activePlayerId: core.room.activeTurnPlayerId,
        activeStep: core.room.activeTurnStep,
      },
    });
    const alicePatch = transport.latest("conn-alice", "authoritative_patch_commit");
    expect(alicePatch?.clientActionId).toBe(clientActionId);
    expect(alicePatch?.baseSequence).toBe(sequence);
    expect(core.sequence).toBe(sequence + 1);
    expect(core.room.activeTurnPlayerId).toBe("bob");

    const before = core.sequence;
    await action(core, "conn-bob", "adjust_score", { delta: 2 });
    const bobPatch = transport.latest("conn-bob", "authoritative_patch_commit");
    expect(bobPatch?.sequence).toBe(before + 1);
    expect(bobPatch?.patch).toBeTruthy();
    expect(core.room.players.find((player) => player.id === "bob")?.board?.score).toBe(2);
  });

  it("awards the remaining player the game when a seat leaves", async () => {
    const { core, transport } = await setup();
    await startAndJoin(core, transport);
    await driveSetup(core, transport);
    const result = await core.handleHttp(
      "leave_room",
      { roomCode: "ABC123", playerId: "alice" },
      identities["alice-token"]!,
    );
    expect(result.status).toBe(200);
    expect(core.room.gameOutcome?.winnerPlayerIds).toEqual(["bob"]);
    expect(core.room.gameOutcome?.reason).toBe("concession");
    const guestSnapshot = transport.latest("conn-bob", "authoritative_snapshot")?.snapshot as Room;
    expect(guestSnapshot.gameOutcome?.winnerPlayerIds).toEqual(["bob"]);
  });

  it("claims a disconnect win through the HTTP room action", async () => {
    const { core, transport } = await setup();
    await startAndJoin(core, transport);
    await driveSetup(core, transport);
    core.removeConnection("conn-bob");
    const result = await core.handleHttp(
      "claim_disconnect_win",
      { roomCode: "ABC123" },
      identities["alice-token"]!,
    );
    expect(result.status).toBe(200);
    expect(core.room.gameOutcome?.winnerPlayerIds).toEqual(["alice"]);
    expect(core.room.gameOutcome?.reason).toBe("concession");
  });

  it("rejects stale action bases and deduplicates client action ids", async () => {
    const { core, transport } = await setup();
    await startAndJoin(core, transport);
    await driveSetup(core, transport);

    await core.handleMessage("conn-alice", {
      type: "action_intent",
      gameInstanceId: "ABC123",
      action: { type: "adjust_score", delta: 1 },
      actorPlayerId: "alice",
      clientActionId: "stale-1",
      clientBaseSequence: -1,
    });
    const stale = transport.latest("conn-alice", "error");
    expect(stale?.code).toBe("stale_action_state");
    expect(stale?.authoritativeSequence).toBe(core.sequence);

    const clientActionId = "dedupe-1";
    await core.handleMessage("conn-alice", {
      type: "action_intent",
      gameInstanceId: "ABC123",
      action: { type: "adjust_score", delta: 1 },
      actorPlayerId: "alice",
      clientActionId,
      clientBaseSequence: core.sequence,
    });
    const afterFirst = core.sequence;
    transport.sent = [];
    await core.handleMessage("conn-alice", {
      type: "action_intent",
      gameInstanceId: "ABC123",
      action: { type: "adjust_score", delta: 1 },
      actorPlayerId: "alice",
      clientActionId,
      clientBaseSequence: afterFirst,
    });
    expect(transport.latest("conn-alice", "gameplay_action_noop_ack")?.clientActionId).toBe(
      clientActionId,
    );
    expect(core.sequence).toBe(afterFirst);
  });

  it("supersedes the previous connection for the same seat (4007 / control_superseded)", async () => {
    const { core, transport } = await setup();
    await startAndJoin(core, transport);
    core.addConnection("conn-alice-2");
    await core.handleMessage("conn-alice-2", {
      type: "join_game",
      gameInstanceId: "ABC123",
      roomCode: "ABC123",
      authToken: "alice-token",
    });
    expect(
      transport.closed.some((entry) => entry.connectionId === "conn-alice" && entry.code === 4007),
    ).toBe(true);
    expect(
      transport
        .messagesFor("conn-alice", "error")
        .some((message) => message.code === "control_superseded"),
    ).toBe(true);
  });

  it("resumes with an ack when the client sequence is current, otherwise a snapshot", async () => {
    const { core, transport } = await setup();
    await startAndJoin(core, transport);
    transport.sent = [];
    await core.handleMessage("conn-alice", {
      type: "resume_game",
      gameInstanceId: "ABC123",
      playerId: "alice",
      authToken: "alice-token",
      clientSequence: core.sequence,
    });
    expect(transport.latest("conn-alice", "authoritative_resume_ack")?.sequence).toBe(
      core.sequence,
    );
    transport.sent = [];
    await core.handleMessage("conn-alice", {
      type: "resume_game",
      gameInstanceId: "ABC123",
      playerId: "alice",
      authToken: "alice-token",
      clientSequence: core.sequence - 5,
    });
    expect(transport.latest("conn-alice", "authoritative_snapshot")).toBeTruthy();
  });

  it("stores constructedDeckRegistration from room creation and HTTP joins", async () => {
    const registration = {
      decklistRaw: DECK,
      matchmakingPool: "standard",
      savedDeckId: "deck_atlas",
      savedDeckName: "Atlas Standard",
      savedDeckRevision: 4,
      savedDeckLegalityVersion: "standard-2026-10-24",
      savedDeckStatus: "ready",
      savedDeckOwnerUserId: "alice",
      deckRulesMode: "standard",
      matchFormat: "bo1",
    };
    const transport = new FakeTransport();
    const clock = makeClock();
    const core = await MatchRoomCore.create(
      makeSeed({
        players: [
          {
            playerId: "alice",
            name: "Alice",
            seat: 0,
            authSubject: "alice",
            decklist: DECK,
            constructedDeckRegistration: registration,
          },
        ],
      }),
      { transport, clock, verifyToken: async (token) => identities[token] ?? null },
    );
    expect(core.sessionDoc.players[0]?.constructedDeckRegistration).toEqual(registration);

    const joined = await core.handleHttp(
      "join_room",
      {
        action: "join_room",
        roomCode: "ABC123",
        playerName: "Bob",
        decklist: DECK,
        constructedDeckRegistration: { ...registration, savedDeckOwnerUserId: "bob" },
      },
      identities["bob-token"]!,
    );
    expect(joined.status).toBe(200);
    expect(
      core.sessionDoc.players.find((player) => player.id === "bob")?.constructedDeckRegistration,
    ).toMatchObject({ savedDeckId: "deck_atlas", savedDeckOwnerUserId: "bob" });

    core.addConnection("conn-alice");
    await core.handleMessage("conn-alice", {
      type: "join_shell",
      gameInstanceId: "ABC123",
      roomCode: "ABC123",
      authToken: "alice-token",
    });
    await core.handleMessage("conn-alice", {
      type: "room_shell_action",
      gameInstanceId: "ABC123",
      action: {
        type: "submit_deck",
        decklist: DECK,
        constructedDeckRegistration: { ...registration, savedDeckRevision: 5 },
      },
      clientActionId: "submit-registration",
    });
    expect(core.sessionDoc.players.find((player) => player.id === "alice")).toMatchObject({
      constructedDeckRegistration: { savedDeckRevision: 5 },
    });
  });

  it("handles HTTP join/resolve/leave and spectator switch", async () => {
    const transport = new FakeTransport();
    const clock = makeClock();
    const core = await MatchRoomCore.create(
      makeSeed({
        players: [
          { playerId: "alice", name: "Alice", seat: 0, authSubject: "alice", decklist: DECK },
        ],
      }),
      { transport, clock, verifyToken: async (token) => identities[token] ?? null },
    );
    const joined = await core.handleHttp(
      "join_room",
      { action: "join_room", roomCode: "ABC123", playerName: "Bob" },
      identities["bob-token"]!,
    );
    expect(joined.status).toBe(200);
    expect(joined.body.role).toBe("player");
    expect(joined.body.playerId).toBe("bob");

    const membership = await core.handleHttp(
      "resolve_room_membership",
      { action: "resolve_room_membership", roomCode: "ABC123" },
      identities["bob-token"]!,
    );
    expect(membership.body.role).toBe("player");
    expect(membership.body.playerIds).toEqual(["alice", "bob"]);

    const spectator = await core.handleHttp(
      "switch_to_spectator",
      { action: "switch_to_spectator", roomCode: "ABC123", playerId: "bob" },
      identities["bob-token"]!,
    );
    expect(spectator.status).toBe(200);
    expect(typeof spectator.body.spectatorName).toBe("string");
    const resolved = await core.handleHttp(
      "resolve_room_membership",
      { action: "resolve_room_membership", roomCode: "ABC123" },
      identities["bob-token"]!,
    );
    expect(resolved.body.role).toBe("spectator");

    const taken = await core.handleHttp(
      "take_seat",
      { action: "take_seat", roomCode: "ABC123", playerName: "Bob" },
      identities["bob-token"]!,
    );
    expect(taken.body.role).toBe("player");
    expect(taken.body.playerId).toBe("bob");
  });

  it("redacts for spectators, applies view grants and routes chat", async () => {
    const { core, transport } = await setup();
    await startAndJoin(core, transport);
    await driveSetup(core, transport);
    core.addConnection("conn-carol");
    await core.handleMessage("conn-carol", {
      type: "join_game",
      gameInstanceId: "ABC123",
      roomCode: "ABC123",
      authToken: "carol-token",
      viewerRole: "spectator",
    });
    const spectatorSnapshot = transport.latest("conn-carol", "authoritative_snapshot")
      ?.snapshot as Room;
    const aliceSeenByCarol = spectatorSnapshot.players.find((player) => player.id === "alice")!;
    expect(aliceSeenByCarol.board?.hand[0]?.id.startsWith("__hidden_zone__")).toBe(true);
    expect(transport.latest("conn-carol", "spectator_roster_sync")?.spectators).toHaveLength(1);

    // Spectators cannot chat; seated players can.
    transport.sent = [];
    await core.handleMessage("conn-carol", {
      type: "chat_send",
      gameInstanceId: "ABC123",
      text: "hello",
    });
    expect(transport.latest("conn-carol", "error")?.code).toBe("chat_unavailable");
    await core.handleMessage("conn-alice", {
      type: "chat_send",
      gameInstanceId: "ABC123",
      text: "hello table",
      clientEntryId: "chat-1",
    });
    const chat = transport.latest("conn-carol", "chat_append")?.entry as {
      text: string;
      authorId: string;
    };
    expect(chat.text).toBe("hello table");
    expect(chat.authorId).toBe("alice");

    // Alice grants her hand to all signed-in spectators; Carol gets a fresh snapshot.
    transport.sent = [];
    await core.handleMessage("conn-alice", {
      type: "spectator_view_grant_update",
      gameInstanceId: "ABC123",
      playerId: "alice",
      audience: "signed_in_spectator",
      granted: true,
      clientActionId: "grant-1",
    });
    expect(transport.latest("conn-alice", "spectator_view_grant_ack")?.granted).toBe(true);
    const roster = transport.latest("conn-carol", "spectator_roster_sync")
      ?.spectators as Spectator[];
    expect(roster[0]?.grantedPrivatePlayerIds).toContain("alice");
    const grantedSnapshot = transport.latest("conn-carol", "authoritative_snapshot")
      ?.snapshot as Room;
    const aliceSeenAgain = grantedSnapshot.players.find((player) => player.id === "alice")!;
    expect(aliceSeenAgain.board?.hand[0]?.id.startsWith("__hidden_zone__")).toBe(false);

    // ping/pong keeps the liveness probe alive.
    transport.sent = [];
    await core.handleMessage("conn-alice", {
      type: "ping",
      gameInstanceId: "ABC123",
      sentAt: 123,
    });
    expect(transport.latest("conn-alice", "pong")?.sentAt).toBe(123);
  });

  it("only emits frames the client parser accepts", async () => {
    const { core, transport } = await setup();
    await startAndJoin(core, transport);
    await driveSetup(core, transport);
    await core.handleMessage("conn-alice", { type: "ping", gameInstanceId: "ABC123", sentAt: 1 });
    await core.handleMessage("conn-alice", {
      type: "chat_send",
      gameInstanceId: "ABC123",
      text: "hi",
    });
    await core.handleMessage("conn-alice", {
      type: "spectator_view_grant_update",
      gameInstanceId: "ABC123",
      playerId: "alice",
      audience: "signed_in_spectator",
      granted: true,
      clientActionId: "grant-parser",
    });
    await core.handleMessage("conn-alice", {
      type: "activity_history_request",
      gameInstanceId: "ABC123",
      requestId: "hist-1",
      before: null,
    });
    await core.handleMessage("conn-alice", {
      type: "customization_refresh",
      gameInstanceId: "ABC123",
    });
    await core.handleMessage("conn-alice", {
      type: "judge_call_create",
      gameInstanceId: "ABC123",
      clientRequestId: "judge-1",
      question: "Can I do that?",
    });
    await core.handleMessage("conn-alice", {
      type: "player_report_submit",
      gameInstanceId: "ABC123",
      clientReportId: "report-1",
      reportedPlayerId: "bob",
      reason: "other",
    });
    const rejected: string[] = [];
    for (const entry of transport.sent) {
      const raw = JSON.stringify(entry.message);
      if (!parseRealtimeMessage(raw)) rejected.push(raw.slice(0, 160));
    }
    expect(rejected).toEqual([]);
  });

  it("persists and restores sequence + room state + rewind timeline", async () => {
    const { core, transport } = await setup();
    await startAndJoin(core, transport);
    await driveSetup(core, transport);
    await action(core, "conn-alice", "adjust_score", { delta: 1 });
    expect(core.timeline.entries.length).toBeGreaterThan(0);
    const latestSnapshot = transport.latest("conn-alice", "authoritative_snapshot")?.snapshot as
      Room | undefined;
    if (latestSnapshot) expect("timeline" in latestSnapshot).toBe(false);
    const serialized = core.toSerialized();
    const restored = MatchRoomCore.fromSerialized(serialized, {
      transport,
      clock: makeClock(),
      verifyToken: async (token) => identities[token] ?? null,
    });
    expect(restored.sequence).toBe(core.sequence);
    expect(restored.room.phase).toBe("in_game");
    expect(restored.room.players.length).toBe(2);
    expect(restored.timeline).toEqual(core.timeline);
    // The restored timeline is usable: the actor can rewind their last meaningful action.
    restored.addConnection("conn-alice");
    await restored.handleMessage("conn-alice", {
      type: "join_game",
      gameInstanceId: "ABC123",
      roomCode: "ABC123",
      authToken: "alice-token",
    });
    await restored.handleMessage("conn-alice", {
      type: "action_intent",
      gameInstanceId: "ABC123",
      action: { type: "rewind_last_action" },
      actorPlayerId: "alice",
      clientActionId: "rewind-after-restore",
      clientBaseSequence: restored.sequence,
    });
    expect(restored.room.log.at(-1)?.text).toBe("Rewound to before their last action.");
    expect(restored.timeline.forward?.actorId).toBe("alice");
  });

  it("answers rewind/forward with authoritative_snapshot carrying the causing action", async () => {
    const { core, transport } = await setup();
    await startAndJoin(core, transport);
    await driveSetup(core, transport);
    await action(core, "conn-alice", "adjust_score", { delta: 1 });
    transport.sent = [];
    await action(core, "conn-alice", "rewind_last_action", {}, "rewind-live");

    const snapshot = transport.latest("conn-alice", "authoritative_snapshot");
    expect(snapshot?.action).toMatchObject({ type: "rewind_last_action" });
    expect(snapshot?.clientActionId).toBe("rewind-live");
    expect(snapshot?.sequence).toBe(core.sequence);
    // Protocol v5: rewind is a full snapshot, never a patch.
    expect(transport.latest("conn-alice", "authoritative_patch_commit")).toBeUndefined();
    expect((snapshot?.snapshot as Room).log.at(-1)?.text).toBe(
      "Rewound to before their last action.",
    );

    transport.sent = [];
    await action(core, "conn-alice", "forward_last_rewind", {}, "forward-live");
    const forward = transport.latest("conn-alice", "authoritative_snapshot");
    expect(forward?.action).toMatchObject({ type: "forward_last_rewind" });
    expect(forward?.clientActionId).toBe("forward-live");
    expect((forward?.snapshot as Room).log.at(-1)?.text).toBe(
      "Used Forward to restore the previous timeline.",
    );
  });

  it("asks for approval and replays the approved rewind as a snapshot", async () => {
    const { core, transport } = await setup();
    await startAndJoin(core, transport);
    await driveSetup(core, transport);
    await action(core, "conn-alice", "adjust_score", { delta: 1 });
    await action(core, "conn-bob", "adjust_score", { delta: 2 });
    transport.sent = [];

    await action(core, "conn-alice", "rewind_last_action", {}, "rewind-approval");
    const confirmation = transport.latest("conn-bob", "rewind_confirmation_state")?.confirmation as
      { requestId: string; requesterPlayerId: string; approverPlayerIds?: string[] } | undefined;
    expect(confirmation?.requesterPlayerId).toBe("alice");
    expect(confirmation?.approverPlayerIds).toContain("bob");
    expect(core.room.rewindConfirmation?.requestId).toBe(confirmation?.requestId);
    // The request itself is a normal room mutation (patch), not a rewind snapshot.
    expect(
      (transport.latest("conn-alice", "authoritative_patch_commit")?.action as { type?: string })
        ?.type,
    ).toBe("rewind_last_action");

    transport.sent = [];
    await action(
      core,
      "conn-bob",
      "respond_rewind_confirmation",
      { requestId: confirmation!.requestId, response: "approve" },
      "approve-rewind",
    );
    const snapshot = transport.latest("conn-alice", "authoritative_snapshot");
    expect(snapshot?.action).toMatchObject({
      type: "respond_rewind_confirmation",
      response: "approve",
    });
    expect(snapshot?.clientActionId).toBeUndefined();
    expect(transport.latest("conn-bob", "authoritative_snapshot")?.clientActionId).toBe(
      "approve-rewind",
    );
    const room = snapshot?.snapshot as Room;
    expect(room.players.find((player) => player.id === "bob")?.board?.score).toBe(0);
    expect(room.players.find((player) => player.id === "alice")?.board?.score).toBe(0);
    expect(room.rewindConfirmation).toBeUndefined();
    expect(
      (transport.latest("conn-alice", "rewind_confirmation_state")?.confirmation ??
        null) as unknown,
    ).toBeNull();
    expect(core.timeline.forward?.actorId).toBe("alice");
  });

  it("stores a 1,000+ action timeline under the Durable Object limits", async () => {
    const { core, transport } = await setup();
    await startAndJoin(core, transport);
    await driveSetup(core, transport);
    for (let index = 0; index < 1_050; index += 1) {
      await action(core, "conn-alice", "adjust_score", { delta: index % 2 === 0 ? 1 : -1 });
    }
    expect(core.timeline.entries.length).toBeGreaterThanOrEqual(1_050);

    const storage = new FakeTimelineStorage(DO_STORAGE_VALUE_LIMIT_BYTES);
    const { persistence } = await TimelinePersistence.load(storage);
    await persistence.save(core.timeline);
    expect(storage.maxValueBytes).toBeLessThan(DO_STORAGE_VALUE_LIMIT_BYTES);
    expect(storage.totalBytes()).toBeLessThan(10 * 1024 * 1024 * 1024);
    expect(storage.values.has(TIMELINE_META_KEY)).toBe(true);
    // The room value no longer carries the timeline, so it stays small.
    expect(JSON.stringify(core.toPersistedState()).length).toBeLessThan(2 * 1024 * 1024);

    const restored = await TimelinePersistence.load(storage);
    expect(restored.timeline?.entries.length).toBeGreaterThanOrEqual(1_050);
    expect(restored.timeline?.entries.at(-1)?.seq).toBe(core.timeline.entries.at(-1)?.seq);
  }, 60_000);

  it("auto-advances a BO3 series into fresh linked rooms, completes the series and allocates a fresh rematch", async () => {
    const transport = new FakeTransport();
    const clock = makeClock();
    const linkedSeeds: MatchRoomSeed[] = [];
    let linkedCounter = 0;
    const createLinkedRoom = async (seed: MatchRoomSeed) => {
      linkedSeeds.push(structuredClone(seed));
      linkedCounter += 1;
      return { roomCode: `NEXT${linkedCounter}` };
    };
    const core = await MatchRoomCore.create(makeSeed({ matchFormat: "bo3" }), {
      transport,
      clock,
      verifyToken: async (token) => identities[token] ?? null,
      createLinkedRoom,
    });
    core.addConnection("conn-alice");
    core.addConnection("conn-bob");
    for (const [connection, token] of [
      ["conn-alice", "alice-token"],
      ["conn-bob", "bob-token"],
    ] as const) {
      await core.handleMessage(connection, {
        type: "join_shell",
        gameInstanceId: "ABC123",
        roomCode: "ABC123",
        authToken: token,
      });
    }
    await startAndJoin(core, transport);
    await driveSetup(core, transport);

    const shellFor =
      (target: MatchRoomCore, roomCode: string) =>
      async (connection: string, action: Record<string, unknown>) =>
        target.handleMessage(connection, {
          type: "room_shell_action",
          gameInstanceId: roomCode,
          action,
          clientActionId: `shell-${Math.random().toString(36).slice(2, 8)}`,
        });
    // The board's game-over overlay dispatches these as gameplay intents; the server accepts both
    // transports (the original shell action and this additive gameplay route).
    const gameIntentFor =
      (target: MatchRoomCore, roomCode: string) =>
      async (connection: string, action: Record<string, unknown>) =>
        target.handleMessage(connection, {
          type: "action_intent",
          gameInstanceId: roomCode,
          action,
          actorPlayerId: connection.endsWith("alice") ? "alice" : "bob",
          clientActionId: `intent-${Math.random().toString(36).slice(2, 8)}`,
          clientBaseSequence: target.sequence,
        });
    const shell = shellFor(core, "ABC123");
    const gameIntent = gameIntentFor(core, "ABC123");
    const report = async (
      target: MatchRoomCore,
      roomCode: string,
      winnerPlayerId: string,
      connections: { alice: string; bob: string } = {
        alice: "conn-alice",
        bob: "conn-bob",
      },
    ) => {
      const intent = gameIntentFor(target, roomCode);
      await intent(connections.alice, { type: "request_game_result_confirmation" });
      await intent(connections.alice, { type: "report_game_result", winnerPlayerId });
      await intent(connections.bob, { type: "report_game_result", winnerPlayerId });
    };

    const selectedBattlefield = core.room.players.find(
      (player) => player.id === "alice",
    )?.selectedBattlefield;
    expect(selectedBattlefield).toBeTruthy();
    await report(core, "ABC123", "alice");

    // Both reports agree: wins recorded, resolved marker set, fresh game-2 room allocated
    // immediately ("Advancing automatically.") instead of reusing this DO.
    expect(core.sessionDoc.winsByPlayerId).toEqual({ alice: 1 });
    expect(core.sessionDoc.matchTermination).toBeUndefined();
    expect(core.sessionDoc.nextRoomCode).toBe("NEXT1");
    expect(core.sessionDoc.pendingGameResult).toMatchObject({
      resolvedWinnerPlayerId: "alice",
      winnerByReporterPlayerId: { alice: "alice", bob: "alice" },
    });
    const snapshot = transport.latest("conn-bob", "authoritative_snapshot") as
      { snapshot?: Room } | undefined;
    expect(snapshot?.snapshot).toMatchObject({
      nextRoomCode: "NEXT1",
      winsByPlayerId: { alice: 1 },
      pendingGameResult: { resolvedWinnerPlayerId: "alice" },
    });
    expect(linkedSeeds).toHaveLength(1);
    expect(linkedSeeds[0]).toMatchObject({
      matchFormat: "bo3",
      gameNumber: 2,
      seriesId: core.sessionDoc.seriesId,
      winsByPlayerId: { alice: 1 },
      previousRoomCode: "ABC123",
      autoStart: true,
    });
    expect(linkedSeeds[0]?.players).toHaveLength(2);
    expect(linkedSeeds[0]?.players.map((player) => player.playerId)).toEqual(["alice", "bob"]);
    expect(linkedSeeds[0]?.players.every((player) => player.authSubject)).toBe(true);
    expect(
      linkedSeeds[0]?.players.every((player) => player.decklist?.includes("Spirit Scout")),
    ).toBe(true);
    expect(linkedSeeds[0]?.usedBattlefieldsByPlayerId?.alice).toContain(selectedBattlefield);
    const redirected = await core.handleHttp(
      "resolve_room_membership",
      { action: "resolve_room_membership", roomCode: "ABC123" },
      identities["alice-token"]!,
    );
    expect(redirected.body).toMatchObject({
      ok: true,
      roomCode: "NEXT1",
      role: "player",
      playerId: "alice",
      redirectedFromRoomCode: "ABC123",
    });

    // Game 2 runs in the new room (the original client follows `nextRoomCode`).
    const gameTwo = await MatchRoomCore.create(
      { ...linkedSeeds[0]!, roomCode: "NEXT1" },
      {
        transport,
        clock,
        verifyToken: async (token) => identities[token] ?? null,
        createLinkedRoom,
      },
    );
    expect(gameTwo.room.phase).toBe("sideboarding");
    gameTwo.addConnection("g2-alice");
    gameTwo.addConnection("g2-bob");
    for (const [connection, token] of [
      ["g2-alice", "alice-token"],
      ["g2-bob", "bob-token"],
    ] as const) {
      await gameTwo.handleMessage(connection, {
        type: "join_shell",
        gameInstanceId: "NEXT1",
        roomCode: "NEXT1",
        authToken: token,
      });
      await gameTwo.handleMessage(connection, {
        type: "join_game",
        gameInstanceId: "NEXT1",
        roomCode: "NEXT1",
        authToken: token,
      });
    }
    await shellFor(gameTwo, "NEXT1")("g2-alice", { type: "auto_start_test_setup" });
    expect(gameTwo.room.phase).toBe("in_game");
    await report(gameTwo, "NEXT1", "alice", { alice: "g2-alice", bob: "g2-bob" });
    expect(gameTwo.sessionDoc.winsByPlayerId).toEqual({ alice: 2 });
    expect(gameTwo.sessionDoc.nextRoomCode).toBeUndefined();
    expect(gameTwo.sessionDoc.matchTermination).toMatchObject({
      status: "completed",
      winnerPlayerId: "alice",
      winnerPlayerIds: ["alice"],
      reason: "score",
    });
    expect(gameTwo.room.matchTermination).toMatchObject({
      status: "completed",
      winnerPlayerId: "alice",
    });

    // Rematch: both requests allocate a fresh game-1 room for a fresh series.
    const previousSeriesId = gameTwo.sessionDoc.seriesId;
    await gameIntentFor(gameTwo, "NEXT1")("g2-alice", { type: "request_bo3_rematch" });
    expect(gameTwo.sessionDoc.rematchRequestedPlayerIds).toEqual(["alice"]);
    await gameIntentFor(gameTwo, "NEXT1")("g2-bob", { type: "request_bo3_rematch" });
    expect(gameTwo.sessionDoc.nextRoomCode).toBe("NEXT2");
    expect(gameTwo.sessionDoc.rematchRequestedPlayerIds).toEqual([]);
    expect(linkedSeeds[1]).toMatchObject({
      gameNumber: 1,
      winsByPlayerId: {},
      previousRoomCode: "NEXT1",
      autoStart: true,
    });
    expect(linkedSeeds[1]?.seriesId).not.toBe(previousSeriesId);
    expect(linkedSeeds[1]?.players.map((player) => player.playerId)).toEqual(["alice", "bob"]);
    expect(linkedSeeds[1]?.players.every((player) => player.authSubject)).toBe(true);
  });

  it("BO1 create_next_game creates a fresh board in the same room (original Next Game)", async () => {
    const transport = new FakeTransport();
    const clock = makeClock();
    const linkedSeeds: MatchRoomSeed[] = [];
    const core = await MatchRoomCore.create(makeSeed(), {
      transport,
      clock,
      verifyToken: async (token) => identities[token] ?? null,
      createLinkedRoom: async (seed) => {
        linkedSeeds.push(structuredClone(seed));
        return { roomCode: "LINK1" };
      },
    });
    core.addConnection("conn-alice");
    core.addConnection("conn-bob");
    for (const [connection, token] of [
      ["conn-alice", "alice-token"],
      ["conn-bob", "bob-token"],
    ] as const) {
      await core.handleMessage(connection, {
        type: "join_shell",
        gameInstanceId: "ABC123",
        roomCode: "ABC123",
        authToken: token,
      });
    }
    await startAndJoin(core, transport);
    await driveSetup(core, transport);
    const previousSeriesId = core.sessionDoc.seriesId;

    const tooEarly = await core.handleHttp(
      "create_next_game",
      { action: "create_next_game", roomCode: "ABC123" },
      identities["alice-token"]!,
    );
    expect(tooEarly.status).toBe(409);
    expect(tooEarly.body.error).toBe("game_result_required");

    await action(core, "conn-alice", "adjust_score", { delta: 8 });
    expect(core.room.gameOutcome).toMatchObject({ winnerPlayerIds: ["alice"], reason: "score" });
    expect(core.sessionDoc.matchTermination).toMatchObject({
      status: "completed",
      winnerPlayerId: "alice",
      winnerPlayerIds: ["alice"],
    });
    // Session-owned series metadata is mirrored before the patch diff, so an engine action that
    // ends the game reaches clients through authoritative_patch_commit as well as snapshots.
    const finishPatch = transport.latest("conn-bob", "authoritative_patch_commit") as
      { patch?: { operations?: Array<Record<string, unknown>> } } | undefined;
    const roomFieldOps =
      finishPatch?.patch?.operations?.filter((operation) => operation.op === "set_room_fields") ??
      [];
    const finishedFields = Object.assign(
      {},
      ...roomFieldOps.map((operation) => operation.fields as Record<string, unknown>),
    );
    expect(finishedFields).toMatchObject({
      matchTermination: { status: "completed", winnerPlayerId: "alice" },
    });
    const next = await core.handleHttp(
      "create_next_game",
      { action: "create_next_game", roomCode: "ABC123" },
      identities["alice-token"]!,
    );
    expect(next.status).toBe(200);
    expect(next.body.roomCode).toBe("ABC123");
    expect(core.room.phase).toBe("battlefield_pick");
    expect(core.sessionDoc.phase).toBe("battlefield_pick");
    expect(core.room.gameOutcome).toBeUndefined();
    expect(core.sessionDoc.matchTermination).toBeUndefined();
    expect(core.sessionDoc.winsByPlayerId).toEqual({});
    expect(core.sessionDoc.gameNumber).toBe(1);
    expect(core.sessionDoc.seriesId).not.toBe(previousSeriesId);
    expect(core.timeline.entries).toHaveLength(0);
    // BO1 "Next Game" keeps the match room open (i18n `nextGameDescription`), so the coordinator
    // is not involved and no `nextRoomCode` is produced.
    expect(linkedSeeds).toHaveLength(0);
    expect(core.sessionDoc.nextRoomCode).toBeUndefined();
  });

  it("return_to_lobby allocates one fresh lobby room and moves both players", async () => {
    const transport = new FakeTransport();
    const clock = makeClock();
    const linkedSeeds: MatchRoomSeed[] = [];
    const core = await MatchRoomCore.create(makeSeed({ matchFormat: "bo3" }), {
      transport,
      clock,
      verifyToken: async (token) => identities[token] ?? null,
      createLinkedRoom: async (seed) => {
        linkedSeeds.push(structuredClone(seed));
        return { roomCode: "LOBBY1" };
      },
    });
    core.addConnection("conn-alice");
    core.addConnection("conn-bob");
    for (const [connection, token] of [
      ["conn-alice", "alice-token"],
      ["conn-bob", "bob-token"],
    ] as const) {
      await core.handleMessage(connection, {
        type: "join_shell",
        gameInstanceId: "ABC123",
        roomCode: "ABC123",
        authToken: token,
      });
    }
    await startAndJoin(core, transport);
    await driveSetup(core, transport);

    const first = await core.handleHttp(
      "return_to_lobby",
      { action: "return_to_lobby", roomCode: "ABC123" },
      identities["alice-token"]!,
    );
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ ok: true, roomCode: "ABC123", lobbyRoomCode: "LOBBY1" });
    expect(linkedSeeds).toHaveLength(1);
    expect(linkedSeeds[0]).toMatchObject({
      autoStart: false,
      gameNumber: 1,
      winsByPlayerId: {},
      previousRoomCode: "ABC123",
      matchFormat: "bo3",
    });
    expect(linkedSeeds[0]?.players.map((player) => player.playerId)).toEqual(["alice", "bob"]);
    expect(linkedSeeds[0]?.players.every((player) => player.authSubject)).toBe(true);
    expect(
      linkedSeeds[0]?.players.every((player) => player.decklist?.includes("Spirit Scout")),
    ).toBe(true);
    expect(core.sessionDoc.returnLobbyRoomCode).toBe("LOBBY1");
    expect(core.sessionDoc.players.find((player) => player.id === "alice")).toMatchObject({
      leftReason: "returned_to_lobby",
    });
    const snapshot = transport.latest("conn-bob", "authoritative_snapshot") as
      { snapshot?: Room } | undefined;
    expect(snapshot?.snapshot?.returnLobbyRoomCode).toBe("LOBBY1");
    expect(snapshot?.snapshot?.players.find((player) => player.id === "alice")?.leftReason).toBe(
      "returned_to_lobby",
    );

    // The opponent's "To Lobby" follows the same fresh lobby code instead of allocating another.
    const second = await core.handleHttp(
      "return_to_lobby",
      { action: "return_to_lobby", roomCode: "ABC123" },
      identities["bob-token"]!,
    );
    expect(second.status).toBe(200);
    expect(second.body.lobbyRoomCode).toBe("LOBBY1");
    expect(linkedSeeds).toHaveLength(1);
    expect(core.sessionDoc.players.find((player) => player.id === "bob")).toMatchObject({
      leftReason: "returned_to_lobby",
    });
  });

  it("rejects rematch before the BO3 series is complete and next game without a result", async () => {
    const transport = new FakeTransport();
    const clock = makeClock();
    const core = await MatchRoomCore.create(makeSeed({ matchFormat: "bo3" }), {
      transport,
      clock,
      verifyToken: async (token) => identities[token] ?? null,
    });
    core.addConnection("conn-alice");
    await core.handleMessage("conn-alice", {
      type: "join_shell",
      gameInstanceId: "ABC123",
      roomCode: "ABC123",
      authToken: "alice-token",
    });
    const rematch = await core.handleHttp(
      "room_series_action",
      { action: "room_series_action", actionType: "request_bo3_rematch" },
      identities["alice-token"]!,
    );
    expect(rematch.status).toBe(409);
    expect(rematch.body.error).toBe("invalid_phase");
    const next = await core.handleHttp(
      "create_next_game",
      { action: "create_next_game", roomCode: "ABC123" },
      identities["alice-token"]!,
    );
    expect(next.status).toBe(409);
    expect(next.body.error).toBe("game_result_required");
  });
});

/* ------------------------------------------------------------------ strict rooms (R2-int) */

async function shell(core: MatchRoomCore, connectionId: string, action: Record<string, unknown>) {
  await core.handleMessage(connectionId, {
    type: "room_shell_action",
    gameInstanceId: "ABC123",
    action,
    clientActionId: `shell-${Math.random().toString(36).slice(2, 10)}`,
  });
}

/** Lobby → strict toggle → setup → in_game, through the real engine. */
async function strictMatch() {
  const ctx = await setup();
  await shell(ctx.core, "conn-alice", { type: "set_lobby_rules_mode", mode: "strict" });
  await startAndJoin(ctx.core, ctx.transport);
  await driveSetup(ctx.core, ctx.transport);
  expect(ctx.core.room.rulesMode).toBe("strict");
  expect(ctx.core.room.rules).toBeTruthy();
  return ctx;
}

function latestError(transport: FakeTransport, connectionId: string) {
  return transport.latest(connectionId, "error") as Record<string, unknown> | undefined;
}

describe("MatchRoomCore strict rooms (R2-int)", () => {
  it("lets only the host toggle set_lobby_rules_mode in the lobby and mirrors it on the shell", async () => {
    const { core, transport } = await setup();
    await shell(core, "conn-bob", { type: "set_lobby_rules_mode", mode: "strict" });
    expect(latestError(transport, "conn-bob")?.code).toBe("room_access_denied");
    expect(core.room.rulesMode).toBeUndefined();

    await shell(core, "conn-alice", { type: "set_lobby_rules_mode", mode: "chaos" });
    expect(latestError(transport, "conn-alice")?.code).toBe("invalid_rules_mode");

    await shell(core, "conn-alice", { type: "set_lobby_rules_mode", mode: "strict" });
    expect(transport.latest("conn-alice", "room_shell_action_ack")?.actionType).toBe(
      "set_lobby_rules_mode",
    );
    const sync = transport.latest("conn-bob", "room_shell_sync");
    expect((sync?.sessionDoc as { rulesMode?: string }).rulesMode).toBe("strict");
    expect(core.room.rulesMode).toBe("strict");

    await shell(core, "conn-alice", { type: "set_lobby_rules_mode", mode: "sandbox" });
    expect(core.room.rulesMode).toBeUndefined();
    expect(
      (transport.latest("conn-bob", "room_shell_sync")?.sessionDoc as { rulesMode?: string })
        .rulesMode,
    ).toBeUndefined();
  });

  it("routes rules_* intents to the engine and starts @rift/rules once in_game", async () => {
    const { core, transport } = await strictMatch();
    expect(core.room.rules?.turn.player).toBe("alice");
    const sequence = core.sequence;
    const id = await action(core, "conn-alice", "rules_end_turn");
    const patch = transport.latest("conn-alice", "authoritative_patch_commit");
    expect(patch?.clientActionId).toBe(id);
    expect((patch?.action as { type: string }).type).toBe("rules_end_turn");
    expect(core.sequence).toBe(sequence + 1);
    expect(core.room.rules?.turn.player).toBe("bob");
  });

  it("[R312][R410] returns a rejection's reason code and rule to the sender only", async () => {
    const { core, transport } = await strictMatch();
    const bobErrors = transport.messagesFor("conn-bob", "error").length;
    const aliceErrors = transport.messagesFor("conn-alice", "error").length;
    const id = await action(core, "conn-bob", "rules_end_turn");
    const error = latestError(transport, "conn-bob");
    expect(transport.messagesFor("conn-bob", "error").length).toBe(bobErrors + 1);
    expect(transport.messagesFor("conn-alice", "error").length).toBe(aliceErrors);
    expect(error).toMatchObject({ clientActionId: id, mutationClass: "reject_invalid" });
    expect(typeof error?.code).toBe("string");
    expect(typeof error?.rule).toBe("string");
    expect(String(error?.message)).toContain(`rule ${String(error?.rule)}`);
    // The frame passes the client parser with the extra fields.
    expect(parseRealtimeMessage(JSON.stringify(error))).toMatchObject({ rule: error?.rule });
  });

  it("rejects rewind in a strict multiplayer room", async () => {
    const { core, transport } = await strictMatch();
    await action(core, "conn-alice", "rewind_last_action");
    expect(latestError(transport, "conn-alice")?.code).toBe("strict_mode_action");
  });

  it("[R650][R651.1] rules_concede ends the game for the conceding player's opponent", async () => {
    const { core } = await strictMatch();
    await action(core, "conn-bob", "rules_concede");
    expect(core.room.gameOutcome).toMatchObject({
      winnerPlayerIds: ["alice"],
      reason: "concession",
    });
    expect(core.sessionDoc.matchTermination?.winnerPlayerId).toBe("alice");
  });

  it("[R128.4] redacts the strict rules state per viewer in snapshots and patches", async () => {
    const { core, transport } = await strictMatch();
    const aliceHand = core.room.players.find((player) => player.id === "alice")!.board!.hand;
    expect(aliceHand.length).toBeGreaterThan(0);
    const secret = aliceHand[0]!.id;
    // Alice is mid-resolution, choosing among her own hand cards (411.2).
    core.room = {
      ...core.room,
      rules: {
        ...core.room.rules!,
        prompt: {
          id: "prompt_secret",
          kind: "choose-card",
          playerId: "alice",
          options: aliceHand.map((card) => ({ id: card.id, cardId: card.id, label: card.name })),
          data: { reason: "effects.resume", continuation: { env: { vars: { looked: [secret] } } } },
        },
      },
    };
    for (const [connectionId, playerId] of [
      ["conn-alice", "alice"],
      ["conn-bob", "bob"],
    ] as const) {
      await core.handleMessage(connectionId, {
        type: "resume_game",
        gameInstanceId: "ABC123",
        playerId,
        authToken: `${playerId}-token`,
        clientSequence: 0,
      });
    }
    const bobRoom = transport.latest("conn-bob", "authoritative_snapshot")?.snapshot as Room;
    expect(bobRoom.rules?.prompt).toEqual({
      id: "prompt_secret",
      kind: "choose-card",
      playerId: "alice",
      data: { reason: "effects.resume" },
    });
    expect(JSON.stringify(bobRoom.rules)).not.toContain(secret);
    const aliceRoom = transport.latest("conn-alice", "authoritative_snapshot")?.snapshot as Room;
    expect(aliceRoom.rules?.prompt?.options?.[0]?.cardId).toBe(secret);

    // The prompt closes in the next authoritative change; Bob's patch never carries it.
    await action(core, "conn-alice", "rules_end_turn");
    for (const frame of transport.messagesFor("conn-bob", "authoritative_patch_commit")) {
      expect(JSON.stringify(frame)).not.toContain(secret);
    }
  });

  it("sandbox rooms reject rules_* intents and keep the sandbox flow", async () => {
    const { core, transport } = await setup();
    await startAndJoin(core, transport);
    await driveSetup(core, transport);
    await action(core, "conn-alice", "rules_end_turn");
    expect(latestError(transport, "conn-alice")?.code).toBe("strict_mode_action");
    expect(core.room.rules).toBeUndefined();
  });
});
