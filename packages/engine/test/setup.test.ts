import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import type { DeckSections, Room } from "@rift/protocol";
import { applyGameAction, createInitialGameState } from "../src";

const ROOT = path.resolve(__dirname, "../../..");
const DECKS = path.join(ROOT, ".recon/oracle/fixtures/decks.json");

interface DecksFile {
  deckA: { raw: string; sections: DeckSections };
  deckB: { raw: string; sections: DeckSections };
}

const decks = fs.existsSync(DECKS) ? (JSON.parse(fs.readFileSync(DECKS, "utf8")) as DecksFile) : null;

let seed = 12345;
function rng(): number {
  seed = (1664525 * seed + 0x3c6ef35f) >>> 0;
  return seed / 0x100000000;
}

function ctx(now: number) {
  return { now, rng, mode: "multiplayer" as const };
}

function apply(room: Room, actor: string, action: Record<string, unknown> & { type: string }, now = 1000): Room {
  const result = applyGameAction(room, actor, action, ctx(now));
  if (!result.ok) throw new Error(`${action.type}: ${result.error}`);
  return result.state;
}

function twoPlayerRoom(overrides: Partial<Parameters<typeof createInitialGameState>[0]> = {}): Room {
  if (!decks) throw new Error("fixtures missing");
  return createInitialGameState({
    roomCode: "SETUP1",
    createdAt: 1_760_000_000_000,
    phase: "battlefield_pick",
    shuffleDecks: false,
    players: [
      {
        id: "p1",
        name: "Alice",
        submittedDeck: { sections: decks.deckA.sections, raw: decks.deckA.raw },
        decklistRaw: decks.deckA.raw,
      },
      {
        id: "p2",
        name: "Bob",
        submittedDeck: { sections: decks.deckB.sections, raw: decks.deckB.raw },
        decklistRaw: decks.deckB.raw,
      },
    ],
    ...overrides,
  });
}

function lockBattlefields(room: Room): Room {
  for (const player of room.players) {
    if (!room.players.some((candidate) => candidate.id === player.id)) continue;
    room = apply(room, player.id, { type: "select_battlefield", random: true });
  }
  return room;
}

describe.skipIf(!decks)("setup flow", () => {
  it("runs battlefield pick → initiative → first player → mulligan → in_game", () => {
    let room = twoPlayerRoom();
    expect(room.phase).toBe("battlefield_pick");

    room = apply(room, "p1", { type: "select_battlefield", random: true });
    expect(room.phase).toBe("battlefield_pick");
    room = apply(room, "p2", { type: "select_battlefield", random: true });
    expect(room.phase).toBe("initiative_roll");
    expect(room.initiativeRound).toBe(1);

    room = apply(room, "p1", { type: "roll_initiative" });
    expect(room.initiativeRolls?.p1).toBeGreaterThanOrEqual(1);
    room = apply(room, "p2", { type: "roll_initiative" });
    expect(room.phase).toBe("first_player_choice");
    const chooser = room.firstPlayerChooserId!;
    expect(["p1", "p2"]).toContain(chooser);

    room = apply(room, chooser, { type: "choose_first_player", firstPlayerId: "p1" });
    expect(room.phase).toBe("mulligan");
    expect(room.players[0]!.board!.hand).toHaveLength(4);
    expect(room.players[1]!.board!.hand).toHaveLength(4);

    const recycled = room.players[0]!.board!.hand[0]!;
    room = apply(room, "p1", { type: "submit_mulligan", cardIds: [recycled.id] });
    expect(room.players[0]!.board!.hand).toHaveLength(4);
    expect(room.mulliganPlaybackByPlayerId?.p1?.redrawCount).toBe(1);
    room = apply(room, "p2", { type: "submit_mulligan", cardIds: [] });

    expect(room.phase).toBe("in_game");
    expect(room.turnNumber).toBe(1);
    expect(room.activeTurnPlayerId).toBe("p1");
    expect(room.activeTurnStep).toBe("main");
    expect(room.players[0]!.board!.hand).toHaveLength(5);
    expect(room.players[0]!.board!.runeArea).toHaveLength(2);
    expect(room.players[1]!.board!.hand).toHaveLength(4);

    room = apply(room, "p1", {
      type: "end_turn",
      observed: { turnNumber: room.turnNumber, activePlayerId: room.activeTurnPlayerId, activeStep: room.activeTurnStep },
    });
    expect(room.turnNumber).toBe(2);
    expect(room.activeTurnPlayerId).toBe("p2");
    expect(room.players[1]!.board!.hand).toHaveLength(5);
    // The last player in turn order channels 3 runes on their first turn (70094 p).
    expect(room.players[1]!.board!.runeArea).toHaveLength(3);
  });

  it("supports the single-player opponent seat and turn order", () => {
    let room = createInitialGameState({
      roomCode: "SOLO1",
      createdAt: 1_760_000_000_000,
      phase: "battlefield_pick",
      roomMode: "single_player",
      soloSetupPending: true,
      shuffleDecks: false,
      players: [
        {
          id: "p1",
          name: "Alice",
          submittedDeck: { sections: decks!.deckA.sections, raw: decks!.deckA.raw },
          decklistRaw: decks!.deckA.raw,
        },
      ],
    });
    expect(room.players).toHaveLength(1);
    room = apply(room, "p1", { type: "add_solo_opponent", decklist: decks!.deckB.raw });
    expect(room.players).toHaveLength(2);
    room = apply(room, "p1", { type: "confirm_solo_setup" });
    expect(room.soloSetupPending).toBe(false);

    room = lockBattlefields(room);
    expect(room.phase).toBe("first_player_choice");
    room = apply(room, "p1", { type: "choose_single_player_turn_order", turnOrder: "play_second" });
    expect(room.phase).toBe("mulligan");
    expect(room.firstPlayerId).toBe(room.players[1]!.id);
    room = apply(room, "p1", { type: "submit_mulligan", cardIds: [] });
    room = apply(room, room.players[1]!.id, { type: "submit_mulligan", cardIds: [] });
    expect(room.phase).toBe("in_game");
    expect(room.activeTurnPlayerId).toBe(room.players[1]!.id);
  });

  it("routes FFA4 through initiative before battlefields", () => {
    let room = createInitialGameState({
      roomCode: "FFA4SETUP",
      createdAt: 1_760_000_000_000,
      gameVariant: "free_for_all_4",
      shuffleDecks: true,
      rng,
      players: ["p1", "p2", "p3", "p4"].map((id, index) => ({
        id,
        name: `Player ${index + 1}`,
        submittedDeck: {
          sections: index === 0 ? decks!.deckA.sections : decks!.deckB.sections,
          raw: index === 0 ? decks!.deckA.raw : decks!.deckB.raw,
        },
      })),
    });
    expect(room.phase).toBe("initiative_roll");
    for (let round = 0; round < 5 && room.phase === "initiative_roll"; round += 1) {
      for (const candidate of room.players) {
        if (room.initiativeRolls?.[candidate.id] === undefined) {
          room = apply(room, candidate.id, { type: "roll_initiative" });
        }
      }
    }
    expect(room.phase).toBe("first_player_choice");
    room = apply(room, room.firstPlayerChooserId!, { type: "choose_first_player", firstPlayerId: "p2" });
    expect(room.phase).toBe("battlefield_pick");
    const contributors = room.players.filter((candidate) => candidate.id !== "p2").map((candidate) => candidate.id);
    for (const id of contributors) room = apply(room, id, { type: "select_battlefield", random: true });
    expect(room.phase).toBe("mulligan");
    expect(room.players.filter((candidate) => candidate.selectedBattlefield)).toHaveLength(3);
  });

  it("runs the sideboard-skip flow", () => {
    let room = twoPlayerRoom({ phase: "sideboarding" });
    room = apply(room, "p1", { type: "request_sideboard_skip" });
    expect(room.sideboardSkipRequest?.requesterPlayerId).toBe("p1");
    room = apply(room, "p2", { type: "respond_sideboard_skip", response: "accept" });
    expect(room.phase).toBe("battlefield_pick");
    expect(room.sideboardDonePlayerIds).toEqual(["p1", "p2"]);
  });

  it("applies a submitted sideboard", () => {
    let room = twoPlayerRoom({ phase: "sideboarding" });
    const sections = decks!.deckA.sections;
    room = apply(room, "p1", {
      type: "submit_sideboard",
      champion: sections.champion,
      mainDeck: sections.mainDeck,
      sideboard: sections.sideboard,
    });
    expect(room.sideboardDonePlayerIds).toEqual(["p1"]);
    const sectionsB = decks!.deckB.sections;
    room = apply(room, "p2", {
      type: "submit_sideboard",
      champion: sectionsB.champion,
      mainDeck: sectionsB.mainDeck,
      sideboard: sectionsB.sideboard,
    });
    expect(room.phase).toBe("battlefield_pick");
  });
});
