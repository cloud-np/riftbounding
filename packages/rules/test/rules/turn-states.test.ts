import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CardScript } from "@rift/protocol";
import {
  clearCardScripts,
  nextPlayerInTurnOrder,
  registerCardScripts,
  turnOrderStartingAt,
  turnState,
} from "../../src";
import { scenario } from "../scenarios/dsl";

function noop(name: string, text: string): CardScript {
  return {
    name,
    text,
    status: "implemented",
    abilities: [{ kind: "spell", effect: { op: "seq", effects: [] } }],
  };
}

beforeAll(() =>
  registerCardScripts([noop("Rebuke", "[ACTION] test"), noop("Defy", "[REACTION] test")]),
);
afterAll(() => clearCardScripts());

describe("turn states [R307–R310]", () => {
  it("[R303.2.a] turn order starts with the current Turn Player", () => {
    const s = scenario();
    expect(turnOrderStartingAt(s.room, "p1", s.host)).toEqual(["p1", "p2"]);
    expect(turnOrderStartingAt(s.room, "p2", s.host)).toEqual(["p2", "p1"]);
    expect(nextPlayerInTurnOrder(s.room, "p1", s.host)).toBe("p2");
    expect(nextPlayerInTurnOrder(s.room, "p2", s.host)).toBe("p1");
  });

  it("[R307][R308.2][R309.2][R310.1] starts in Neutral Open", () => {
    const s = scenario();
    expect(turnState(s.room)).toBe("neutral_open");
  });

  it("[R309.1][R310.2] a Chain makes the turn Neutral Closed", () => {
    const s = scenario({ p1: { hand: ["Rebuke"], energy: 2, power: { Chaos: 2 } } });
    s.as("p1").play("Rebuke").expectOk();
    expect(turnState(s.room)).toBe("neutral_closed");
  });

  it("[R308.1][R310.3] a Showdown makes the turn Showdown Open", () => {
    const s = scenario({ p1: { hand: ["Treasure Hunter"], energy: 2 } });
    s.as("p1").play("Treasure Hunter").expectOk();
    const unit = s.findBoardCard("Treasure Hunter")!;
    unit.exhausted = false;
    s.as("p1").move("Treasure Hunter", "battlefieldA").expectOk();
    expect(turnState(s.room)).toBe("showdown_open");
  });

  it("[R310.4] a Chain during a Showdown is Showdown Closed", () => {
    const s = scenario({
      p1: { hand: ["Treasure Hunter", "Defy"], energy: 3, power: { Calm: 1 } },
    });
    s.as("p1").play("Treasure Hunter").expectOk();
    const unit = s.findBoardCard("Treasure Hunter")!;
    unit.exhausted = false;
    s.as("p1").move("Treasure Hunter", "battlefieldA").expectOk();
    // 347.1: the Focus holder may play an Action/Reaction, starting a Chain.
    s.as("p1").play("Defy").expectOk();
    expect(turnState(s.room)).toBe("showdown_closed");
  });

  it("[R313.5] Focus returns to null when a Showdown closes", () => {
    const s = scenario({ p1: { hand: ["Treasure Hunter"], energy: 2 } });
    s.as("p1").play("Treasure Hunter").expectOk();
    const unit = s.findBoardCard("Treasure Hunter")!;
    unit.exhausted = false;
    s.as("p1").move("Treasure Hunter", "battlefieldA").expectOk();
    s.as("p1").pass().expectOk();
    s.as("p2").pass().expectOk();
    expect(turnState(s.room)).toBe("neutral_open");
    expect(s.room.rules?.focus).toBe(null);
  });

  it("[R303.2.a] nextPlayerInTurnOrder handles a player outside the turn order", () => {
    const s = scenario();
    // A player not in the recorded order starts at the top of the order (old code skipped p1).
    expect(nextPlayerInTurnOrder(s.room, "ghost", s.host)).toBe("p1");
    expect(nextPlayerInTurnOrder(s.room, "p1", s.host)).toBe("p2");
    expect(nextPlayerInTurnOrder(s.room, "p2", s.host)).toBe("p1");
  });

  it("[R349][R355] projectRules mirrors the sandbox chain entry shape (entry id vs card id)", () => {
    const s = scenario({ p1: { hand: ["Rebuke"], energy: 2, power: { Chaos: 2 } } });
    s.as("p1").play("Rebuke", { hold: true }).expectOk();
    const item = s.room.rules!.chain[0]!;
    const entry = s.room.chainEntries[0]!;
    // Contract §2: the display entry id equals ChainItem.id. Sandbox `chain_add` stores that
    // same id on the displayed card and keeps the physical card id in `sourceCardId`.
    expect(entry.id).toBe(item.id);
    expect(entry.card.id).toBe(item.id);
    expect(entry.sourceCardId).toBe(item.cardSnapshot!.id);
    expect(entry.byPlayerId).toBe(item.controller);
    expect(entry.byPlayerName).toBe("Alice");
    expect(entry.fromZone).toBe("hand");
    expect(entry.addedAt).toBe(item.addedAt);
  });

  it("[R472] scoredThisTurn starts each turn as per-player empty arrays", () => {
    const s = scenario();
    s.host.markScored(s.room, "p1", "battlefieldA");
    expect(s.room.rules?.scoredThisTurn.p1).toEqual(["battlefieldA"]);

    s.as("p1").endTurn().expectOk();
    expect(s.room.rules?.scoredThisTurn).toEqual({ p1: [], p2: [] });
    expect(s.room.battlefieldScoredThisTurnByPlayer).toBeUndefined();

    s.as("p2").endTurn().expectOk();
    expect(s.room.rules?.scoredThisTurn).toEqual({ p1: [], p2: [] });
  });
});
