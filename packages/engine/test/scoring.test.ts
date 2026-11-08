import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import type { CardInstance, Room } from "@rift/protocol";
import { scoreHolds } from "../src/rules/turn";
import { tiannaBlocksPointGain, victoryScoreForRoom } from "../src/rules/victory";
import { getCardByCode } from "../src/catalog";
import { applyGameAction } from "../src";

const FIXTURE = path.resolve(__dirname, "../../..", ".recon/oracle/fixtures/duel-in-game-t1-main.json");
const HAS_FIXTURE = fs.existsSync(FIXTURE);

function fixture(): Room {
  return JSON.parse(fs.readFileSync(FIXTURE, "utf8")) as Room;
}

function unit(room: Room, id: string, code = "RAD-105"): CardInstance {
  const card = getCardByCode(code);
  return {
    id,
    name: card?.name ?? "Unit",
    source: "mainDeck",
    exhausted: false,
    createdAt: room.createdAt,
    ownerPlayerId: "p1",
    cardCode: card?.id,
    type: card?.type ?? "Unit",
    domains: card?.domains,
    text: card?.text,
    energyCost: card?.energyCost,
    might: card?.might,
    keywords: card?.keywords,
    isPlaceholder: !card,
  };
}

describe.skipIf(!HAS_FIXTURE)("hold scoring", () => {
  it("scores once per battlefield per turn", () => {
    const room = fixture();
    room.players[0]!.board!.base = [];
    room.players[0]!.board!.battlefieldA.push({ ...unit(room, "p1-unit"), exhausted: false });
    room.players[0]!.board!.score = 5;
    const points = scoreHolds(room, 0, true);
    expect(points).toBe(1);
    expect(room.players[0]!.board!.score).toBe(6);
    expect(room.battlefieldScoredThisTurnByPlayer?.p1?.battlefieldA).toBe(true);
    // A new turn resets the per-turn snapshot, so the hold can score again.
    room.turnNumber = 2;
    expect(scoreHolds(room, 0, true)).toBe(1);
  });

  it("marks the battlefield without awarding when autoScoreFromHold is off", () => {
    const room = fixture();
    room.players[0]!.board!.battlefieldA = [{ ...unit(room, "p1-unit"), exhausted: false }];
    expect(scoreHolds(room, 0, false)).toBe(0);
    expect(room.players[0]!.board!.score).toBe(0);
    expect(room.battlefieldScoredThisTurnByPlayer?.p1?.battlefieldA).toBe(true);
  });

  it("is blocked by an opponent's Tianna Crownguard", () => {
    const room = fixture();
    room.players[0]!.board!.battlefieldA = [{ ...unit(room, "p1-unit"), exhausted: false }];
    room.players[1]!.board!.battlefieldA = [
      { ...unit(room, "tianna", "SFD-060"), ownerPlayerId: "p2", exhausted: false },
    ];
    expect(tiannaBlocksPointGain(room, "p1")).toBe(true);
    expect(scoreHolds(room, 0, true)).toBe(0);
  });
});

describe.skipIf(!HAS_FIXTURE)("victory detection", () => {
  it("sets gameOutcome for duel (server-side rule; the client mirror skips this)", () => {
    const room = fixture();
    room.players[0]!.board!.score = 7;
    const result = applyGameAction(room, "p1", { type: "adjust_score", delta: 1 }, {
      now: 1_760_000_000_000,
      rng: () => 0.5,
      mode: "multiplayer",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.gameOutcome?.winnerPlayerIds).toEqual(["p1"]);
    expect(result.state.gameOutcome?.reason).toBe("score");
  });
});

describe.skipIf(!HAS_FIXTURE)("victory score", () => {
  it("adds Aspirant's Climb to the threshold", () => {
    const room = fixture();
    room.players[0]!.selectedBattlefield = "Aspirant's Climb";
    room.players[1]!.selectedBattlefield = "Back-Alley Bar";
    expect(victoryScoreForRoom(room)).toBe(9);
    room.battlefieldBrushByZone = { battlefieldA: true };
    expect(victoryScoreForRoom(room)).toBe(8);
  });
});
