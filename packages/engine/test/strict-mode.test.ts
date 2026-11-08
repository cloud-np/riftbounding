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

let seed = 987654321;
function rng(): number {
  seed = (1664525 * seed + 0x3c6ef35f) >>> 0;
  return seed / 0x100000000;
}

function ctx() {
  return { now: 1_760_000_000_000, rng, mode: "multiplayer" as const };
}

function apply(room: Room, actor: string, action: Record<string, unknown> & { type: string }): Room {
  const result = applyGameAction(room, actor, action, ctx());
  if (!result.ok) throw new Error(`${action.type}: ${result.error}`);
  return result.state;
}

function baseRoom(phase: Room["phase"], rulesMode: "strict" | "sandbox" | undefined): Room {
  if (!decks) throw new Error("fixtures missing");
  const room = createInitialGameState({
    roomCode: "STRICT1",
    createdAt: 1,
    phase,
    shuffleDecks: false,
    hostPlayerId: "p1",
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
  });
  room.firstPlayerId = "p1";
  if (phase === "in_game") {
    room.activeTurnPlayerId = "p1";
    room.activeTurnStep = "main";
    room.turnNumber = 1;
  }
  if (rulesMode) room.rulesMode = rulesMode;
  return room;
}

/** mulligan phase → in_game through the real engine setup path. */
function strictInGame(): Room {
  let room = baseRoom("mulligan", "strict");
  room = apply(room, "p1", { type: "submit_mulligan", cardIds: [] });
  room = apply(room, "p2", { type: "submit_mulligan", cardIds: [] });
  return room;
}

describe.skipIf(!decks)("strict-mode engine hook", () => {
  it("only the host can set the lobby rules mode", () => {
    let room = baseRoom("lobby", undefined);
    const denied = applyGameAction(room, "p2", { type: "set_lobby_rules_mode", mode: "strict" }, ctx());
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.errorCode).toBe("host_only");

    room = apply(room, "p1", { type: "set_lobby_rules_mode", mode: "strict" });
    expect(room.rulesMode).toBe("strict");
    room = apply(room, "p1", { type: "set_lobby_rules_mode", mode: "sandbox" });
    expect(room.rulesMode).toBe("sandbox");
  });

  it("initialises Room.rules on entering in_game and runs the strict Start of Turn", () => {
    const room = strictInGame();
    expect(room.phase).toBe("in_game");
    expect(room.rules?.version).toBe(1);
    expect(room.rules?.turn.player).toBe("p1");
    expect(room.rules?.turn.number).toBe(1);
    expect(room.rules?.turn.phase).toBe("main");
    expect(room.rules?.priority).toBe("p1");
    expect(room.rules?.chain).toEqual([]);
    expect(room.rules?.tasks).toEqual([]);
    expect(room.activeTurnPlayerId).toBe("p1");
    expect(room.activeTurnStep).toBe("main");
    // 315.3.b.1 + 315.4.b: two runes channelled and one card drawn by the strict tasks.
    expect(room.players[0]?.board?.runeArea.length).toBeGreaterThanOrEqual(2);
    expect(room.players[0]?.board?.hand.length).toBeGreaterThanOrEqual(1);
    expect(room.players[0]?.board?.deck.length).toBeGreaterThan(0);
  });

  it("routes rules_* to @rift/rules and rejects them in sandbox rooms", () => {
    const strict = strictInGame();
    const denied = applyGameAction(strict, "p1", { type: "rules_pass" }, ctx());
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.errorCode).toBe("nothing_to_pass");

    const next = apply(strict, "p1", { type: "rules_end_turn" });
    expect(next.rules?.turn.player).toBe("p2");
    expect(next.activeTurnPlayerId).toBe("p2");

    const sandbox = baseRoom("in_game", undefined);
    const sandboxDenied = applyGameAction(sandbox, "p1", { type: "rules_end_turn" }, ctx());
    expect(sandboxDenied.ok).toBe(false);
    if (!sandboxDenied.ok) expect(sandboxDenied.errorCode).toBe("strict_mode_action");
  });

  it("gates sandbox gameplay actions in strict rooms but allows cosmetic actions", () => {
    const strict = strictInGame();
    const denied = applyGameAction(
      strict,
      "p1",
      { type: "draw_cards", count: 1 },
      ctx(),
    );
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.errorCode).toBe("strict_mode_action");

    const dice = apply(strict, "p1", { type: "roll_die", sides: 20 });
    expect(dice.log.length).toBeGreaterThan(0);
  });

  it("still behaves exactly like the sandbox when rulesMode is absent", () => {
    const room = baseRoom("in_game", undefined);
    expect(room.rules).toBeUndefined();
    const drawn = apply(room, "p1", { type: "draw_cards", count: 1 });
    expect(drawn.players[0]?.board?.hand.length).toBe(1);
    expect(drawn.activeTurnStep).toBe("main");
  });

  it("opens the manual window for an unscripted spell and allows its controller board actions", () => {
    let room = strictInGame();
    const board = room.players[0]!.board!;
    const spell = board.deck.find((card) => card.name === "Rebuke");
    expect(spell).toBeTruthy();
    board.deck = board.deck.filter((card) => card.id !== spell!.id);
    board.hand.push(spell!);
    const cardId = spell!.id;

    room = apply(room, "p1", { type: "rules_play", cardId });
    // Auto-pass → P2 holds the response priority.
    expect(room.rules?.priority).toBe("p2");
    room = apply(room, "p2", { type: "rules_pass" });
    expect(room.rules?.manual?.player).toBe("p1");

    // §4: while manual is open its player may use manual board actions.
    room = apply(room, "p1", { type: "draw_cards", count: 1 });
    room = apply(room, "p1", { type: "rules_manual_done" });
    expect(room.rules?.manual).toBe(null);
    expect(room.rules?.chain).toEqual([]);
    expect(room.rules?.priority).toBe("p1");
  });
});
