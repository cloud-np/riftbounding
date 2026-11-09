/**
 * R4 bot-room: a `single_player` strict room whose second seat is server-driven.
 *
 * The human's `rules_end_turn` must hand the turn to the bot, the server must drive the bot
 * through its own turn and return the turn to the human, and no bot rejection may reach a
 * client as an error frame.
 */
import { describe, expect, it } from "vitest";
import type { Room, RoomSessionDoc } from "@rift/protocol";

import { CoordinatorCore } from "../src/core/CoordinatorCore";
import type { MatchRoomSeed } from "../src/core/types";
import type { CoreTransport, Identity } from "../src/core/types";
import { MatchRoomCore } from "../src/core/MatchRoomCore";
import { botPlayerIds, botRedactedView } from "../src/core/bot-driver";
import { strictWhoMayAct } from "@rift/engine";

type Sent = { connectionId: string; message: Record<string, unknown> };

class FakeTransport implements CoreTransport {
  sent: Sent[] = [];
  send(connectionId: string, message: Record<string, unknown>): void {
    this.sent.push({ connectionId, message });
  }
  close(): void {}
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

function botSeed(overrides: Partial<MatchRoomSeed> = {}): MatchRoomSeed {
  return {
    roomCode: "BOT123",
    createdAt: 1_000,
    roomMode: "single_player",
    gameVariant: "duel",
    playMode: "constructed",
    deckRulesMode: "unrestricted",
    matchFormat: "bo1",
    rulesMode: "strict",
    players: [
      {
        playerId: "alice",
        name: "Alice",
        seat: 0,
        authSubject: "alice",
        decklist: DECK,
        controlledPlayerIds: ["alice"],
      },
      {
        playerId: "bot",
        name: "Practice Bot",
        seat: 1,
        authSubject: null,
        decklist: DECK,
        isSoloOpponent: true,
        isBot: true,
      },
    ],
    ...overrides,
  };
}

async function botRoom() {
  const transport = new FakeTransport();
  const clock = makeClock();
  const core = await MatchRoomCore.create(botSeed(), {
    transport,
    clock,
    verifyToken: async (token) => identities[token] ?? null,
  });
  core.addConnection("conn-alice");
  await core.handleMessage("conn-alice", {
    type: "join_shell",
    gameInstanceId: "BOT123",
    roomCode: "BOT123",
    authToken: "alice-token",
  });
  return { core, transport };
}

async function startBotMatch(core: MatchRoomCore): Promise<void> {
  await core.handleMessage("conn-alice", {
    type: "room_shell_action",
    gameInstanceId: "BOT123",
    action: { type: "start_lobby_match" },
    clientActionId: "start-bot",
  });
  await core.handleMessage("conn-alice", {
    type: "join_game",
    gameInstanceId: "BOT123",
    roomCode: "BOT123",
    authToken: "alice-token",
  });
}

async function humanAction(
  core: MatchRoomCore,
  action: Record<string, unknown>,
  clientActionId: string,
): Promise<void> {
  await core.handleMessage("conn-alice", {
    type: "action_intent",
    gameInstanceId: "BOT123",
    action,
    actorPlayerId: "alice",
    clientActionId,
    clientBaseSequence: core.sequence,
  });
}

/**
 * While the bot's turn is running, the bot can open a chain and pass priority to the human
 * (normal strict timing). The test human answers those windows with Pass until the bot ends
 * its turn; this is exactly what a real opponent does.
 */
async function passHumanWindowsOnBotTurn(core: MatchRoomCore, maxWindows = 32): Promise<void> {
  for (let window = 0; window < maxWindows; window += 1) {
    if (core.room.rules?.turn.player !== "bot" || core.room.gameOutcome) return;
    const who = strictWhoMayAct(core.room);
    if (!who || who.kind === "none" || who.player !== "alice") return;
    await humanAction(core, { type: "rules_pass" }, `pass-bot-window-${window}`);
  }
}

describe("CoordinatorCore practice-vs-bot rooms (R4 bot-room)", () => {
  it("creates a strict single_player room with a non-controlled bot seat", async () => {
    const seeds: MatchRoomSeed[] = [];
    const core = new CoordinatorCore({
      clock: { now: () => 1_000, rng: () => 0.5 },
      createMatchRoom: async (seed) => {
        seeds.push(structuredClone(seed));
        return { roomCode: "BOT999", phase: "lobby" };
      },
    });
    const response = await core.createRoom(
      {
        action: "create_room",
        operationId: "operation:bot-room",
        playerName: "Alice",
        playMode: "constructed",
        matchFormat: "bo1",
        roomMode: "single_player",
        gameVariant: "duel",
        opponent: "bot",
        decklist: DECK,
      },
      { sub: "alice", name: "Alice", expiresAt: null },
    );
    expect(response.status).toBe(200);
    expect(response.body.controlledPlayerIds).toEqual(["alice"]);
    const seed = seeds[0]!;
    expect(seed.rulesMode).toBe("strict");
    expect(seed.roomMode).toBe("single_player");
    expect(seed.players[1]).toMatchObject({
      name: "Practice Bot",
      isBot: true,
      isSoloOpponent: true,
    });
    // The host must not control the bot seat, or its hand would be visible/actionable.
    expect(seed.players[1]?.controlledPlayerIds).toBeUndefined();
    expect(seed.players[0]?.controlledPlayerIds).toEqual(["alice"]);
  });
});

describe("MatchRoomCore practice-vs-bot rooms (R4 bot-room)", () => {
  it("keeps the room strict (the bot has no sandbox mode)", async () => {
    const { core, transport } = await botRoom();
    await core.handleMessage("conn-alice", {
      type: "room_shell_action",
      gameInstanceId: "BOT123",
      action: { type: "set_lobby_rules_mode", mode: "sandbox" },
      clientActionId: "sandbox-attempt",
    });
    expect(transport.latest("conn-alice", "error")?.code).toBe("invalid_rules_mode");
    expect(core.room.rulesMode).toBe("strict");
  });

  it("auto-runs setup, marks the bot seat and returns control after one bot turn", async () => {
    const { core, transport } = await botRoom();
    expect(core.room.players.find((player) => player.id === "bot")?.isBot).toBe(true);
    expect(core.controlledByAuthSubject.alice).toEqual(["alice"]);
    expect(botPlayerIds(core.room)).toEqual(["bot"]);

    await startBotMatch(core);

    expect(core.room.phase).toBe("in_game");
    expect(core.room.rulesMode).toBe("strict");
    expect(core.room.rules).toBeTruthy();
    expect(core.sessionDoc.phase).toBe("in_game");
    // The live room alternates turns between the two seats; the session stays "practice".
    expect(core.sessionDoc.roomMode).toBe("single_player");
    expect(core.room.roomMode).toBe("multiplayer");
    expect(core.room.activeTurnPlayerId).toBe("alice");
    // The engine's setup contract drops unknown seat fields; the live room keeps the marker.
    expect(core.room.players.find((player) => player.id === "bot")?.isBot).toBe(true);
    expect(
      (transport.latest("conn-alice", "authoritative_snapshot")?.snapshot as Room).phase,
    ).toBe("in_game");

    const turnBefore = core.room.rules!.turn.number;
    const patchesBefore = transport.messagesFor("conn-alice", "authoritative_patch_commit").length;
    const errorsBefore = transport.messagesFor("conn-alice", "error").length;

    await humanAction(core, { type: "rules_end_turn" }, "end-turn-human");
    // The bot may play cards and hand priority back to the human mid-chain; answer those
    // windows with Pass until the bot finishes its turn.
    await passHumanWindowsOnBotTurn(core);

    // human ends -> bot takes at least one action -> the turn comes back to the human.
    expect(core.room.rules!.turn.player).toBe("alice");
    expect(core.room.rules!.turn.number).toBeGreaterThan(turnBefore);
    const newPatches = transport
      .messagesFor("conn-alice", "authoritative_patch_commit")
      .slice(patchesBefore);
    expect(newPatches[0]?.clientActionId).toBe("end-turn-human");
    const botPatches = newPatches.filter(
      (frame) =>
        frame.clientActionId === undefined &&
        String((frame.action as { type?: string } | undefined)?.type ?? "").startsWith("rules_"),
    );
    expect(botPatches.length).toBeGreaterThan(0);
    // A rejected bot intent is logged server-side, never sent to the human as an error frame.
    expect(transport.messagesFor("conn-alice", "error").length).toBe(errorsBefore);
  });

  it("redacts each side's hand from the other seat's view", async () => {
    const { core, transport } = await botRoom();
    await startBotMatch(core);

    const humanView = transport.latest("conn-alice", "authoritative_snapshot")?.snapshot as Room;
    const humanSeat = humanView.players.find((player) => player.id === "alice")!;
    const botSeat = humanView.players.find((player) => player.id === "bot")!;
    expect(humanSeat.board?.hand.length).toBeGreaterThan(0);
    expect(humanSeat.board?.hand[0]?.id.startsWith("__hidden_zone__")).toBe(false);
    expect(botSeat.board?.hand.length).toBeGreaterThan(0);
    expect(botSeat.board?.hand.every((card) => card.id.startsWith("__hidden_zone__"))).toBe(true);
    expect(botSeat.isBot).toBe(true);

    const botView = botRedactedView(core.room, "bot");
    const botOwn = botView.players.find((player) => player.id === "bot")!;
    const humanOpponent = botView.players.find((player) => player.id === "alice")!;
    expect(botOwn.board?.hand.length).toBeGreaterThan(0);
    expect(botOwn.board?.hand.every((card) => !card.id.startsWith("__hidden_zone__"))).toBe(true);
    expect(humanOpponent.board?.hand.length).toBeGreaterThan(0);
    expect(
      humanOpponent.board?.hand.every((card) => card.id.startsWith("__hidden_zone__")),
    ).toBe(true);
  });

  it("keeps the bot out of the human's controlled seats in the session doc", async () => {
    const { core } = await botRoom();
    const doc: RoomSessionDoc = core.sessionDoc;
    expect(doc.players.find((player) => player.id === "bot")?.isBot).toBe(true);
    const controlled = core.controlledByAuthSubject.alice ?? [];
    expect(controlled).toEqual(["alice"]);
    expect(controlled).not.toContain("bot");
  });
});
