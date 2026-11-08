import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import type { DeckSections, Room } from "@rift/protocol";
import { applyGameAction, createInitialGameState, createInitialTimeline } from "../src";

const ROOT = path.resolve(__dirname, "../../..");
const DECKS = path.join(ROOT, ".recon/oracle/fixtures/decks.json");
const FIXTURE = path.join(ROOT, ".recon/oracle/fixtures/duel-in-game-t1-main.json");

interface DecksFile {
  deckA: { raw: string; sections: DeckSections };
  deckB: { raw: string; sections: DeckSections };
}
const decks = fs.existsSync(DECKS) ? (JSON.parse(fs.readFileSync(DECKS, "utf8")) as DecksFile) : null;

let seed = 424242;
function rng(): number {
  seed = (1664525 * seed + 0x3c6ef35f) >>> 0;
  return seed / 0x100000000;
}
function apply(room: Room, actor: string, action: Record<string, unknown> & { type: string }, now = 1000): Room {
  const result = applyGameAction(room, actor, action, { now, rng, mode: "multiplayer" });
  if (!result.ok) throw new Error(`${action.type}: ${result.error}`);
  return result.state;
}
function fixture(): Room {
  return JSON.parse(fs.readFileSync(FIXTURE, "utf8")) as Room;
}

describe.skipIf(!decks || !fs.existsSync(FIXTURE))("lobby actions", () => {
  it("registers decks and starts the match", () => {
    let room = createInitialGameState({
      roomCode: "LOBBY1",
      createdAt: 1,
      phase: "lobby",
      players: [
        { id: "p1", name: "Alice" },
        { id: "p2", name: "Bob" },
      ],
      shuffleDecks: false,
    });
    expect(room.players.every((player) => !player.board)).toBe(true);
    room = apply(room, "p1", { type: "set_lobby_ready", ready: true });
    room = apply(room, "p2", { type: "set_lobby_ready", ready: true });
    expect(room.lobbyReadyPlayerIds).toEqual(["p1", "p2"]);
    room = apply(room, "p1", { type: "submit_deck", decklist: decks!.deckA.raw });
    room = apply(room, "p2", { type: "submit_deck", decklist: decks!.deckB.raw });
    expect(room.players[0]!.deck).toBeTruthy();
    room = apply(room, "p1", { type: "start_lobby_match" });
    expect(room.phase).toBe("battlefield_pick");
    expect(room.players[0]!.board?.deck.length).toBeGreaterThan(0);
  });

  it("switches seats, modes and teams", () => {
    let room = createInitialGameState({
      roomCode: "LOBBY2",
      createdAt: 1,
      phase: "lobby",
      gameVariant: "teams_2v2",
      players: [
        { id: "p1", name: "A" },
        { id: "p2", name: "B" },
        { id: "p3", name: "C" },
        { id: "p4", name: "D" },
      ],
    });
    room = apply(room, "p1", { type: "switch_lobby_seat", targetSeat: 2 });
    expect(room.players.find((player) => player.id === "p1")?.seat).toBe(2);
    room = apply(room, "p1", { type: "set_lobby_play_mode", playMode: "sealed" });
    expect(room.playMode).toBe("sealed");
    expect(room.deckRulesMode).toBe("standard");
    room = apply(room, "p1", { type: "set_lobby_deck_rules", mode: "unrestricted" });
    expect(room.deckRulesMode).toBe("unrestricted");
    room = apply(room, "p1", { type: "set_lobby_match_format", matchFormat: "bo3" });
    expect(room.matchFormat).toBe("bo3");
    room = apply(room, "p1", { type: "randomize_lobby_teams" });
    expect(Object.keys(room.teamIdByPlayerId ?? {})).toHaveLength(4);
  });
});

describe.skipIf(!fs.existsSync(FIXTURE))("turn cleanup", () => {
  it("clears floating resources for all players on end_turn", () => {
    let room = fixture();
    room.players[0]!.board!.floatingEnergy = 3;
    room.players[1]!.board!.floatingPower = 2;
    const result = applyGameAction(room, "p1", {
      type: "end_turn",
      observed: { turnNumber: room.turnNumber, activePlayerId: room.activeTurnPlayerId, activeStep: room.activeTurnStep },
    }, { now: 2000, rng, mode: "multiplayer" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    room = result.state;
    expect(room.players.every((player) => !player.board || (player.board.floatingEnergy === 0 && player.board.floatingPower === 0))).toBe(true);
  });

  it("consumes a queued Time Warp extra turn before advancing", () => {
    let room = fixture();
    room.players[0]!.board!.floatingEnergy = 2;
    room.chainEntries = [{
      id: "chain_timewarp",
      card: {
        id: "timewarp",
        name: "Time Warp",
        source: "mainDeck",
        exhausted: false,
        createdAt: room.createdAt,
        ownerPlayerId: "p1",
        cardCode: "OGN-122",
        type: "Spell",
      },
      addedAt: room.createdAt,
      fromZone: "hand",
      sourceCardId: "timewarp",
      byPlayerId: "p1",
      byPlayerName: "Alice",
    }];
    room = apply(room, "p1", { type: "set_extra_turn", entryId: "chain_timewarp", enabled: true });
    expect(room.pendingExtraTurns).toHaveLength(1);
    const result = applyGameAction(room, "p1", {
      type: "end_turn",
      observed: { turnNumber: room.turnNumber, activePlayerId: room.activeTurnPlayerId, activeStep: room.activeTurnStep },
    }, { now: 3000, rng, mode: "multiplayer" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    room = result.state;
    expect(room.activeTurnPlayerId).toBe("p1");
    expect(room.extraTurnResumePlayerId).toBe("p2");
    expect(room.turnNumber).toBe(2);
    const next = applyGameAction(room, "p1", {
      type: "end_turn",
      observed: { turnNumber: room.turnNumber, activePlayerId: room.activeTurnPlayerId, activeStep: room.activeTurnStep },
    }, { now: 4000, rng, mode: "multiplayer" });
    expect(next.ok).toBe(true);
    if (!next.ok) return;
    expect(next.state.activeTurnPlayerId).toBe("p2");
  });
});

describe.skipIf(!fs.existsSync(FIXTURE))("rewind / forward", () => {
  it("survives a JSON round-trip of the explicit timeline (Durable Object persistence)", () => {
    let room = fixture();
    let timeline = createInitialTimeline();
    const tracked = (
      state: Room,
      actor: string,
      action: Record<string, unknown> & { type: string },
      now: number,
    ) => {
      const result = applyGameAction(state, actor, action, {
        now,
        rng,
        mode: "multiplayer",
        timeline,
      });
      if (!result.ok) throw new Error(`${action.type}: ${result.error}`);
      timeline = JSON.parse(JSON.stringify(result.timeline)) as typeof timeline;
      return result.state;
    };
    room = tracked(room, "p1", { type: "draw_cards", count: 1 }, 10);
    room = tracked(room, "p1", { type: "draw_rune" }, 20);
    const beforeRewind = JSON.parse(JSON.stringify(room)) as Room;
    // Simulate DO eviction/restart between every action: the state and timeline are plain JSON.
    room = tracked(room, "p1", { type: "rewind_last_action" }, 30);
    expect(room.log.at(-1)?.text).toBe("Rewound to before their last action.");
    expect(room.forwardablePlayerIds).toEqual(["p1"]);
    expect(timeline.forward?.actorId).toBe("p1");
    room = tracked(room, "p1", { type: "forward_last_rewind" }, 40);
    expect(room.log.at(-1)?.text).toBe("Used Forward to restore the previous timeline.");
    expect(room.players[0]!.board!.runeArea).toHaveLength(
      beforeRewind.players[0]!.board!.runeArea.length,
    );
  });

  it("rewinds before the actor's last meaningful action and forwards back", () => {
    let room = fixture();
    let timeline = createInitialTimeline();
    const tracked = (
      state: Room,
      actor: string,
      action: Record<string, unknown> & { type: string },
      now: number,
    ) => {
      const result = applyGameAction(state, actor, action, {
        now,
        rng,
        mode: "multiplayer",
        timeline,
      });
      if (!result.ok) throw new Error(`${action.type}: ${result.error}`);
      timeline = result.timeline!;
      return result.state;
    };
    room = tracked(room, "p1", { type: "draw_cards", count: 1 }, 10);
    const afterDraw = JSON.parse(JSON.stringify(room)) as Room;
    room = tracked(room, "p1", { type: "draw_rune" }, 20);
    const afterRune = JSON.parse(JSON.stringify(room)) as Room;
    room = tracked(room, "p1", { type: "rewind_last_action" }, 30);
    expect(room.players[0]!.board!.runeArea).toHaveLength(afterDraw.players[0]!.board!.runeArea.length);
    expect(room.log.at(-1)?.text).toBe("Rewound to before their last action.");
    expect(room.forwardablePlayerIds).toEqual(["p1"]);
    room = tracked(room, "p1", { type: "forward_last_rewind" }, 40);
    expect(room.players[0]!.board!.runeArea).toHaveLength(afterRune.players[0]!.board!.runeArea.length);
    expect(room.log.at(-1)?.text).toBe("Used Forward to restore the previous timeline.");
  });

  it("requires opponent approval when they acted after the rewind target", () => {
    let room = fixture();
    let timeline = createInitialTimeline();
    const tracked = (
      state: Room,
      actor: string,
      action: Record<string, unknown> & { type: string },
      now: number,
    ) => {
      const result = applyGameAction(state, actor, action, {
        now,
        rng,
        mode: "multiplayer",
        timeline,
      });
      if (!result.ok) throw new Error(`${action.type}: ${result.error}`);
      timeline = result.timeline!;
      return result.state;
    };
    room = tracked(room, "p1", { type: "draw_cards", count: 1 }, 10);
    room = tracked(room, "p2", { type: "draw_cards", count: 1 }, 20);
    room = tracked(room, "p1", { type: "rewind_last_action" }, 30);
    expect(room.rewindConfirmation?.requesterPlayerId).toBe("p1");
    expect(room.rewindConfirmation?.opponentMeaningfulActionCount).toBe(1);
    expect(timeline.pending?.requestId).toBe(room.rewindConfirmation!.requestId);
    const requestId = room.rewindConfirmation!.requestId;
    room = tracked(
      room,
      "p2",
      { type: "respond_rewind_confirmation", requestId, response: "decline" },
      40,
    );
    expect(room.rewindConfirmation).toBeUndefined();
    expect(timeline.pending).toBeUndefined();
  });
});
