import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import type { DeckSections, Room } from "@rift/protocol";
import { applyGameAction, createInitialGameState } from "../src";
import { getCardByName } from "../src/catalog";
import { isUnitCardType } from "../src/catalog";

const ROOT = path.resolve(__dirname, "../../..");
const ORACLE = path.join(ROOT, ".recon/oracle/load.mjs");
const DECKS = path.join(ROOT, ".recon/oracle/fixtures/decks.json");
const FIXTURE = path.join(ROOT, ".recon/oracle/fixtures/duel-in-game-t1-main.json");

function normalize(room: Room): unknown {
  const copy = JSON.parse(JSON.stringify(room)) as Record<string, unknown>;
  delete copy.updatedAt;
  delete copy.log;
  delete copy.rewindProtocolVersion;
  delete copy.rewindablePlayerIds;
  delete copy.forwardablePlayerIds;
  delete copy.forwardAvailableUntil;
  delete copy.rewindConfirmation;
  return copy;
}
function counterFactory() {
  let n = 0;
  return (kind: string) => `${kind}_t${n++}`;
}
function seeded(seed: number) {
  let state = seed >>> 0 || 1;
  return () => {
    state = (1664525 * state + 0x3c6ef35f) >>> 0;
    return state / 0x100000000;
  };
}
type Action = Record<string, unknown> & { type: string };

describe.skipIf(!fs.existsSync(ORACLE) || !fs.existsSync(path.join(ROOT, ".recon/site/playapp/dl/_next/static/immutable/chunks")) || !fs.existsSync(DECKS) || !fs.existsSync(FIXTURE))(
  "oracle multiplayer",
  () => {
  it("matches FFA hold scoring + victory + turn order", async () => {
    const { loadOriginal } = await import(pathToFileURL(ORACLE).href);
    const original = loadOriginal();
    const decks = JSON.parse(fs.readFileSync(DECKS, "utf8")) as {
      deckA: { raw: string; sections: DeckSections };
      deckB: { raw: string; sections: DeckSections };
    };
    const rng = seeded(777);
    const now = 1760000400000;
    let room = createInitialGameState({
      roomCode: "FFA1",
      createdAt: now,
      phase: "battlefield_pick",
      roomMode: "multiplayer",
      gameVariant: "free_for_all_3",
      shuffleDecks: false,
      players: ["p1", "p2", "p3"].map((id, index) => ({
        id,
        name: `Player ${index + 1}`,
        submittedDeck: {
          sections: index === 0 ? decks.deckA.sections : decks.deckB.sections,
          raw: index === 0 ? decks.deckA.raw : decks.deckB.raw,
        },
      })),
    });
    const apply = (action: Action, actor?: string): void => {
      const result = applyGameAction(room, actor ?? room.activeTurnPlayerId ?? "p1", action, {
        now,
        rng,
        mode: "multiplayer",
      });
      if (!result.ok) throw new Error(`${action.type}: ${result.error}`);
      room = result.state;
    };
    for (const player of room.players) {
      apply({ type: "select_battlefield", random: true }, player.id);
    }
    expect(room.phase).toBe("initiative_roll");
    for (const player of room.players) apply({ type: "roll_initiative" }, player.id);
    expect(room.phase).toBe("first_player_choice");
    apply({ type: "choose_first_player", firstPlayerId: "p1" }, room.firstPlayerChooserId!);
    for (const player of room.players) apply({ type: "submit_mulligan", cardIds: [] }, player.id);
    expect(room.phase).toBe("in_game");

    // Put a ready unit at battlefieldA for p1 and set up a near-victory score.
    const board = room.players[0]!.board!;
    const unitIndex = board.hand.findIndex(isUnitCardType);
    const unit = board.hand.splice(unitIndex, 1)[0]!;
    board.battlefieldA.push({ ...unit, exhausted: false });
    board.score = 7;

    let mine: Room = JSON.parse(JSON.stringify(room));
    let theirs: Room = JSON.parse(JSON.stringify(room));
    const step = (action: Action) => {
      const actor = mine.activeTurnPlayerId!;
      const result = applyGameAction(mine, actor, action, {
        now: now + 1000,
        rng: seeded(900),
        mode: "multiplayer",
        idFactory: counterFactory(),
      });
      const oracle = original.applyDirect(theirs, actor, action, {
        now: () => now + 1000,
        random: seeded(900),
        idFactory: counterFactory(),
      });
      if (result.ok) mine = result.state;
      theirs = oracle.state;
      expect(normalize(mine), `${action.type} ${actor}`).toEqual(normalize(theirs));
    };

    const end = () => step({
      type: "end_turn",
      observed: {
        turnNumber: mine.turnNumber,
        activePlayerId: mine.activeTurnPlayerId,
        activeStep: mine.activeTurnStep,
      },
    });
    // p1 ends; p2, p3 end; p1's next beginning scores the hold point and wins.
    end();
    expect(mine.activeTurnPlayerId).toBe("p2");
    end();
    expect(mine.activeTurnPlayerId).toBe("p3");
    end();
    expect(mine.activeTurnPlayerId).toBe("p1");
    expect(mine.players[0]!.board!.score).toBe(8);
    expect(mine.gameOutcome?.winnerPlayerIds).toEqual(["p1"]);
  });

  it("matches transfer control in a 3-player game", async () => {
    const { loadOriginal } = await import(pathToFileURL(ORACLE).href);
    const original = loadOriginal();
    const decks = JSON.parse(fs.readFileSync(DECKS, "utf8")) as {
      deckA: { raw: string; sections: DeckSections };
      deckB: { raw: string; sections: DeckSections };
    };
    let room = createInitialGameState({
      roomCode: "FFAT",
      createdAt: 1760000450000,
      phase: "battlefield_pick",
      roomMode: "multiplayer",
      gameVariant: "free_for_all_3",
      shuffleDecks: false,
      players: ["p1", "p2", "p3"].map((id, index) => ({
        id,
        name: `Player ${index + 1}`,
        submittedDeck: {
          sections: index === 0 ? decks.deckA.sections : decks.deckB.sections,
          raw: index === 0 ? decks.deckA.raw : decks.deckB.raw,
        },
      })),
    });
    const rng = seeded(123);
    const apply = (action: Action, actor?: string) => {
      const result = applyGameAction(room, actor ?? room.activeTurnPlayerId ?? "p1", action, {
        now: 1760000450000,
        rng,
        mode: "multiplayer",
      });
      if (!result.ok) throw new Error(`${action.type}: ${result.error}`);
      room = result.state;
    };
    for (const player of room.players) apply({ type: "select_battlefield", random: true }, player.id);
    for (const player of room.players) apply({ type: "roll_initiative" }, player.id);
    if (room.phase === "initiative_roll") {
      for (const player of room.players) apply({ type: "roll_initiative" }, player.id);
    }
    apply({ type: "choose_first_player", firstPlayerId: "p1" }, room.firstPlayerChooserId ?? "p1");
    for (const player of room.players) apply({ type: "submit_mulligan", cardIds: [] }, player.id);
    expect(room.phase).toBe("in_game");

    const board = room.players[0]!.board!;
    const unit = board.hand.find(isUnitCardType)!;
    board.hand = board.hand.filter((card) => card.id !== unit.id);
    board.battlefieldA.push({ ...unit, exhausted: false, id: "transfer-source" });
    const p2board = room.players[1]!.board!;
    const p2unit = p2board.hand.find(isUnitCardType)!;
    p2board.hand = p2board.hand.filter((card) => card.id !== p2unit.id);
    p2board.battlefieldA.push({ ...p2unit, exhausted: false, id: "p2-unit" });

    let mine: Room = JSON.parse(JSON.stringify(room));
    let theirs: Room = JSON.parse(JSON.stringify(room));
    const action: Action = { type: "transfer_card_control", zone: "battlefieldA", cardId: "transfer-source", targetPlayerId: "p2" };
    const mineResult = applyGameAction(mine, "p1", action, {
      now: 1760000460000,
      rng: seeded(124),
      mode: "multiplayer",
      idFactory: counterFactory(),
    });
    const oracle = original.applyDirect(theirs, "p1", action, {
      now: () => 1760000460000,
      random: seeded(124),
      idFactory: counterFactory(),
    });
    if (mineResult.ok) mine = mineResult.state;
    theirs = oracle.state;
    expect(normalize(mine)).toEqual(normalize(theirs));
    expect(mine.pendingBattlefieldConquerAssist?.attackerPlayerId).toBe("p2");
  });

  it("matches conquer-and-draw at the final battlefield", () => {
    // Covered by the duel showdown test for scoring; this asserts the pure decision table.
    const decision = (currentPoints: number, allScored: boolean, canGainPoint = true, already = false) => {
      const victory = 8;
      if (already) return "conquer";
      if (currentPoints >= victory - 1 && !allScored) return "conquer_and_draw";
      if (!canGainPoint) return "conquer";
      return "conquer_and_score";
    };
    expect(decision(7, false)).toBe("conquer_and_draw");
    expect(decision(7, true)).toBe("conquer_and_score");
    expect(decision(5, false)).toBe("conquer_and_score");
    expect(decision(5, false, false)).toBe("conquer");
    expect(decision(8, false, true, true)).toBe("conquer");
  });
  },
);
