/**
 * Standard Move source zones — NEW-1 (rule 144.1/144.4/449.2).
 *
 * A Standard Move is performed by a Unit already on the Board. Hand, deck, trash, champion and
 * banished sources are card-play/effect territory (349–359, 429), not 449. Every case checks
 * that `explainIllegal` and `applyRulesIntent` share the verdict and that nothing moved.
 */
import { describe, expect, it } from "vitest";
import type { CardInstance, Room, RulesIntent, RulesMoveIntent } from "@rift/protocol";
import { applyRulesIntent, explainIllegal } from "../../src";
import { scenario, type RulesScenario } from "../scenarios/dsl";
import { boardOf, putCardAt } from "../scenarios/cleanup-helpers";

function boardZone(room: Room, playerId: string, zone: string): CardInstance[] {
  const board = room.players.find((player) => player.id === playerId)?.board;
  if (!board) throw new Error(`no board for ${playerId}`);
  return (board as unknown as Record<string, CardInstance[]>)[zone]!;
}

/** Take a named card from a board pile and put it into another board zone. */
function moveWithinBoard(
  s: RulesScenario,
  playerId: string,
  name: string,
  to: string,
): CardInstance {
  const board = boardOf(s, playerId);
  for (const zone of ["hand", "deck", "trash"] as const) {
    const list = boardZone(s.room, playerId, zone);
    const index = list.findIndex((card) => card.name === name);
    if (index < 0) continue;
    const [card] = list.splice(index, 1);
    if (!card) break;
    boardZone(s.room, playerId, to).push({ ...card, exhausted: false });
    return card;
  }
  throw new Error(`${name} is not in ${playerId}'s hand/deck/trash`);
}

function intentFor(unitIds: string[], to: string): RulesIntent {
  return { type: "rules_move", unitIds, to: to as RulesMoveIntent["to"] };
}

/** NEW-1: explain and apply must produce the same Verdict. */
function expectAgreement(s: RulesScenario, actorId: string, intent: RulesIntent) {
  const explained = explainIllegal(s.room, actorId, intent, s.host);
  const applied = applyRulesIntent(s.room, actorId, intent, s.ctx, s.host);
  expect(applied.ok).toBe(explained.ok);
  if (!explained.ok) {
    expect(applied.ok).toBe(false);
    if (!applied.ok) {
      expect(applied.code).toBe(explained.code);
      expect(applied.rule).toBe(explained.rule);
    }
  }
  return explained;
}

describe("Standard Move source restriction [R144][R144.1][R449.2]", () => {
  it("[R144][R449.2] a Unit in hand cannot be moved onto the Board", () => {
    const s = scenario({ p1: { hand: ["Treasure Hunter"], energy: 2 } });
    const unit = s.handCard("p1", "Treasure Hunter")!;
    const verdict = expectAgreement(s, "p1", intentFor([unit.id], "battlefieldA"));
    expect(verdict).toMatchObject({ ok: false, code: "unit_not_found", rule: "144" });
    expect(s.room.players[0]?.board?.hand.some((card) => card.id === unit.id)).toBe(true);
    expect(s.room.players[0]?.board?.battlefieldA.some((card) => card.id === unit.id)).toBe(false);
    expect(s.room.rules?.contested.battlefieldA).toBeUndefined();
  });

  it("[R144][R429] a Unit in the Trash cannot be moved onto the Board", () => {
    const s = scenario();
    const unit = moveWithinBoard(s, "p1", "Treasure Hunter", "trash");
    const verdict = expectAgreement(s, "p1", intentFor([unit.id], "battlefieldA"));
    expect(verdict).toMatchObject({ ok: false, code: "unit_not_found" });
    expect(boardOf(s, "p1").trash.some((card) => card.id === unit.id)).toBe(true);
  });

  it("[R144][R349] a Unit in the Deck cannot be moved onto the Board", () => {
    const s = scenario();
    const unit = boardOf(s, "p1").deck.find((card) => card.name === "Treasure Hunter")!;
    const verdict = expectAgreement(s, "p1", intentFor([unit.id], "battlefieldA"));
    expect(verdict).toMatchObject({ ok: false, code: "unit_not_found" });
    expect(boardOf(s, "p1").deck.some((card) => card.id === unit.id)).toBe(true);
  });

  it("[R144] a Unit in the Champion zone cannot be moved onto the Board", () => {
    const s = scenario();
    const unit = moveWithinBoard(s, "p1", "Treasure Hunter", "champion");
    const verdict = expectAgreement(s, "p1", intentFor([unit.id], "base"));
    expect(verdict).toMatchObject({ ok: false, code: "unit_not_found" });
    expect(boardOf(s, "p1").champion.some((card) => card.id === unit.id)).toBe(true);
  });

  it("[R144][R429] a Banished Unit cannot be moved onto the Board", () => {
    const s = scenario();
    const unit = moveWithinBoard(s, "p1", "Treasure Hunter", "banished");
    const verdict = expectAgreement(s, "p1", intentFor([unit.id], "battlefieldA"));
    expect(verdict).toMatchObject({ ok: false, code: "unit_not_found" });
    expect(boardOf(s, "p1").banished.some((card) => card.id === unit.id)).toBe(true);
  });

  it("[R144.4][R449.2] moving a Unit to its current location is rejected without exhausting it", () => {
    const s = scenario({ p1: { hand: ["Treasure Hunter"], energy: 2 } });
    s.as("p1").play("Treasure Hunter").expectOk();
    const unit = s.findBoardCard("Treasure Hunter")!;
    unit.exhausted = false;
    const verdict = expectAgreement(s, "p1", intentFor([unit.id], "base"));
    expect(verdict).toMatchObject({ ok: false, code: "invalid_location" });
    expect(s.room.players[0]?.board?.base.find((card) => card.id === unit.id)?.exhausted).toBe(
      false,
    );
  });

  it("[R144] duplicate Unit ids are rejected before any Unit is exhausted or moved", () => {
    const s = scenario({ p1: { hand: ["Treasure Hunter"], energy: 2 } });
    s.as("p1").play("Treasure Hunter").expectOk();
    const unit = s.findBoardCard("Treasure Hunter")!;
    unit.exhausted = false;
    const verdict = expectAgreement(s, "p1", intentFor([unit.id, unit.id], "battlefieldA"));
    expect(verdict).toMatchObject({ ok: false, code: "illegal_action", rule: "144" });
    expect(s.room.players[0]?.board?.base.find((card) => card.id === unit.id)?.exhausted).toBe(
      false,
    );
  });

  it("[R144.2] a Standard Move still requires a ready Unit and exhausts it as the cost; an effect Move does not", () => {
    const s = scenario();
    const unit = putCardAt(s, "p1", "Treasure Hunter", "base", "std-move");
    unit.exhausted = true;
    const verdict = expectAgreement(s, "p1", intentFor([unit.id], "battlefieldA"));
    expect(verdict).toMatchObject({ ok: false, code: "unit_exhausted", rule: "144.2" });
    expect(boardOf(s, "p1").base.find((card) => card.id === unit.id)?.exhausted).toBe(true);
    unit.exhausted = false;
    s.as("p1").apply(intentFor([unit.id], "battlefieldA")).expectOk();
    const moved = s.host.findCard(s.room, unit.id)!.card;
    expect(s.host.findCard(s.room, unit.id)?.zone).toBe("battlefieldA");
    expect(moved.exhausted).toBe(true);
  });

  it("[R144.4] a Unit the actor does not control cannot be moved", () => {
    const s = scenario();
    const unit = putCardAt(s, "p2", "Caitlyn, Patrolling", "base", "move-control");
    unit.exhausted = false;
    // P1 is the Turn Player, but the Unit is on P2's board.
    const verdict = expectAgreement(s, "p1", intentFor([unit.id], "base"));
    expect(verdict).toMatchObject({ ok: false, code: "illegal_target", rule: "144.4" });
    expect(s.room.players[1]?.board?.base.some((card) => card.id === unit.id)).toBe(true);
  });
});
