/**
 * R2-int: `rules_concede` routing, Verdict forwarding through `applyGameAction`, and the
 * client read-side strict view (`strictLegalIntents` / `strictWhoMayAct` / `strictExplainIllegal`).
 *
 * Self-contained: uses the strict-rules suite's committed deck fixture
 * (`packages/rules/test/fixtures/decks.json`), not the uncommitted `.recon/oracle` dumps.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import type { DeckSections, Room } from "@rift/protocol";
import {
  applyGameAction,
  createInitialGameState,
  strictExplainIllegal,
  strictLegalIntents,
  strictTurnState,
  strictWhoMayAct,
} from "../src";

const DECKS = path.resolve(__dirname, "../../rules/test/fixtures/decks.json");

interface DecksFile {
  deckA: { raw: string; sections: DeckSections };
  deckB: { raw: string; sections: DeckSections };
}

const decks = JSON.parse(fs.readFileSync(DECKS, "utf8")) as DecksFile;

let seed = 424242;
function ctx(mode: "multiplayer" | "solo_lab" = "multiplayer") {
  return {
    now: 1_760_000_000_000,
    rng: () => {
      seed = (1664525 * seed + 0x3c6ef35f) >>> 0;
      return seed / 0x100000000;
    },
    mode,
  };
}

function strictMulligan(rulesMode: "strict" | "sandbox" = "strict"): Room {
  const room = createInitialGameState({
    roomCode: "CONCEDE1",
    createdAt: 1,
    phase: "mulligan",
    shuffleDecks: false,
    hostPlayerId: "p1",
    players: [
      { id: "p1", name: "Alice", submittedDeck: decks.deckA, decklistRaw: decks.deckA.raw },
      { id: "p2", name: "Bob", submittedDeck: decks.deckB, decklistRaw: decks.deckB.raw },
    ],
  });
  room.firstPlayerId = "p1";
  if (rulesMode === "strict") room.rulesMode = "strict";
  for (const player of room.players) player.selectedBattlefield = "Bandle Tree";
  return room;
}

function strictInGame(): Room {
  let room = strictMulligan();
  for (const actor of ["p1", "p2"]) {
    const result = applyGameAction(room, actor, { type: "submit_mulligan", cardIds: [] }, ctx());
    if (!result.ok) throw new Error(result.error);
    room = result.state;
  }
  expect(room.phase).toBe("in_game");
  expect(room.rules).toBeTruthy();
  return room;
}

describe("strict rules_concede routing [R650][R651.1]", () => {
  it("[R650][R651.1] routes rules_concede to @rift/rules: the opponent wins by concession", () => {
    const room = strictInGame();
    const result = applyGameAction(room, "p2", { type: "rules_concede" }, ctx());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.gameOutcome).toMatchObject({
      winnerPlayerIds: ["p1"],
      reason: "concession",
    });
  });

  it("[R474] a rejected strict intent carries code, rule and detail separately", () => {
    const room = strictInGame();
    const conceded = applyGameAction(room, "p2", { type: "rules_concede" }, ctx());
    if (!conceded.ok) throw new Error(conceded.error);
    const result = applyGameAction(conceded.state, "p1", { type: "rules_pass" }, ctx());
    expect(result).toMatchObject({ ok: false, errorCode: "game_over", rule: "474" });
  });

  it("[R410] a strict intent from a player without Priority is rejected with its rule", () => {
    const room = strictInGame();
    const result = applyGameAction(room, "p2", { type: "rules_pass" }, ctx());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(typeof result.errorCode).toBe("string");
    expect(typeof result.rule).toBe("string");
    expect(result.error).toContain(`rule ${result.rule}`);
  });

  it("sandbox rooms reject rules_concede and keep the room untouched", () => {
    let room = strictMulligan("sandbox");
    for (const actor of ["p1", "p2"]) {
      const result = applyGameAction(room, actor, { type: "submit_mulligan", cardIds: [] }, ctx());
      if (!result.ok) throw new Error(result.error);
      room = result.state;
    }
    const result = applyGameAction(room, "p2", { type: "rules_concede" }, ctx());
    expect(result).toMatchObject({ ok: false, errorCode: "strict_mode_action" });
    expect(room.gameOutcome).toBeUndefined();
  });
});

describe("client strict read view [R312][R410][§5]", () => {
  it("[R312] enumerates the priority holder's legal intents and who may act", () => {
    const room = strictInGame();
    expect(strictWhoMayAct(room)).toMatchObject({ kind: "priority", player: "p1" });
    expect(strictTurnState(room)).toBe("neutral_open");
    const legal = strictLegalIntents(room, "p1");
    expect(legal).toMatchObject({ playerId: "p1", canEndTurn: true });
    expect(strictLegalIntents(room, "p2")).toMatchObject({ canEndTurn: false, canPass: false });
  });

  it("[R410] explains a rejection with the same Verdict as the write path", () => {
    const room = strictInGame();
    const verdict = strictExplainIllegal(room, "p2", { type: "rules_end_turn" });
    const write = applyGameAction(room, "p2", { type: "rules_end_turn" }, ctx());
    expect(verdict.ok).toBe(false);
    if (verdict.ok || write.ok) return;
    expect(write.errorCode).toBe(verdict.code);
    expect(write.rule).toBe(verdict.rule);
    expect(strictExplainIllegal(room, "p1", { type: "rules_end_turn" })).toEqual({ ok: true });
  });

  it("is null outside strict in-game rooms", () => {
    const sandbox = strictMulligan("sandbox");
    expect(strictLegalIntents(sandbox, "p1")).toBeNull();
    expect(strictWhoMayAct(sandbox)).toBeNull();
    expect(strictLegalIntents(strictMulligan("strict"), "p1")).toBeNull();
  });
});
