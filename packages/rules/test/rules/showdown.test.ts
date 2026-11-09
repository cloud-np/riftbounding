import { beforeAll, describe, expect, it } from "vitest";
import type { ChainItem } from "@rift/protocol";
import { clearCardScripts, registerCardScript } from "../../src";
import { appendChainItem, finalizeChainItem, resolveNewest } from "../../src/timing/fepr";
import { scenario } from "../scenarios/dsl";

// R2-effects: Treasure Hunter's printed "When I move, play a Gold gear token exhausted" now
// triggers (383 / 402.1) and keeps the state Closed until it resolves. This suite uses it as a
// vanilla unit for timing/showdown mechanics, so it overrides the production script (the trigger
// itself is covered by test/cards/fixture-deck.test.ts).
beforeAll(() => registerCardScript({ name: "Treasure Hunter", text: "vanilla (test)", status: "implemented", abilities: [] }));

function readyUnit(s: ReturnType<typeof scenario>, name: string): void {
  const unit = s.findBoardCard(name);
  if (!unit) throw new Error(`unit ${name} not on board`);
  unit.exhausted = false;
}

describe("showdowns [R341–R348]", () => {
  it("[R345][R347.2.a][R348.2] a move to an empty battlefield opens a showdown with focus to the Contested applier; all pass → conquer", () => {
    const s = scenario({ p1: { hand: ["Treasure Hunter"], energy: 2 } });
    s.as("p1").play("Treasure Hunter").expectOk();
    readyUnit(s, "Treasure Hunter");

    s.as("p1").move("Treasure Hunter", "battlefieldA").expectOk();
    expect(s.room.rules?.contested.battlefieldA).toBe("p1");
    expect(s.room.rules?.showdown?.battlefield).toBe("battlefieldA");
    expect(s.room.rules?.showdown?.kind).toBe("non_combat");
    s.expectFocus("p1").expectPriority("p1").expectState("showdown_open");
    expect(s.room.rules?.scoredThisTurn.p1).toEqual([]);

    // 347.2: Focus passes to the next player in turn order.
    s.as("p1").pass().expectOk();
    s.expectFocus("p2").expectPriority("p2");

    // 347.2.a / 348: all players passed once in sequence → the showdown closes.
    s.as("p2").pass().expectOk();
    expect(s.room.rules?.showdown).toBe(null);
    expect(s.room.rules?.focus).toBe(null);
    expect(s.room.rules?.contested.battlefieldA).toBeUndefined();
    expect(s.room.rules?.scoredThisTurn.p1).toContain("battlefieldA");
    // 348.2.a.1: establishing control from Contested results in a Conquer.
    expect(s.room.players[0]?.board?.score).toBe(1);
    s.expectState("neutral_open").expectPriority("p1");
  });

  it("[R344.1][R461][R466] moving into an occupied battlefield opens a Combat Showdown", () => {
    const s = scenario({
      p1: { hand: ["Treasure Hunter"], energy: 2 },
      p2: { hand: ["Caitlyn, Patrolling"], energy: 3, power: { Calm: 1 } },
    });
    s.as("p1").play("Treasure Hunter").expectOk();
    readyUnit(s, "Treasure Hunter");
    s.as("p1").move("Treasure Hunter", "battlefieldA").expectOk();
    s.as("p1").pass().expectOk();
    s.as("p2").pass().expectOk();
    expect(s.room.rules?.showdown).toBe(null);

    // P2's turn: attack the battlefield P1 just conquered.
    s.as("p1").endTurn().expectOk();
    // 167: P2's Rune Pool emptied at the start of their Main Phase; 357: fund Caitlyn's cost.
    s.room.rules!.pools.p2 = { energy: 3, power: { Calm: 1 } };
    s.as("p2").play("Caitlyn, Patrolling").expectOk();
    readyUnit(s, "Caitlyn, Patrolling");
    s.as("p2").move("Caitlyn, Patrolling", "battlefieldA").expectOk();
    expect(s.room.rules?.combat?.battlefield).toBe("battlefieldA");
    expect(s.room.rules?.showdown?.kind).toBe("combat");
    s.expectFocus("p2");

    s.as("p2").pass().expectOk();
    s.as("p1").pass().expectOk();
    expect(s.room.rules?.combat).toBe(null);
    expect(s.room.rules?.showdown).toBe(null);
    // 468.7.a: Attacker/Defender designations are removed when Combat ends.
    for (const object of Object.values(s.room.rules?.objects ?? {})) {
      expect(object.designation).toBeUndefined();
    }
    // Minimal R1 combat: the 1-Might Treasure Hunter dies to Caitlyn's 3 Might.
    s.expectZone("p1", "Treasure Hunter", "trash");
    s.expectState("neutral_open");
  });

  it("[R346.1] Focus does not pass when the chain opened from a triggered ability", () => {
    registerCardScript({
      name: "Test Trigger",
      text: "Test-only triggered ability.",
      status: "implemented",
      abilities: [
        {
          kind: "triggered",
          trigger: { kind: "event", event: { type: "test_trigger" } },
          effect: { op: "seq", effects: [] },
        },
      ],
    });
    try {
      const s = scenario({ p1: { hand: ["Treasure Hunter"], energy: 2 } });
      s.as("p1").play("Treasure Hunter").expectOk();
      readyUnit(s, "Treasure Hunter");
      s.as("p1").move("Treasure Hunter", "battlefieldA").expectOk();
      s.expectFocus("p1");

      const item: ChainItem = {
        id: "chain_test_trigger",
        kind: "triggered",
        status: "pending",
        controller: "p1",
        cardName: "Test Trigger",
        abilityRef: "triggered:event",
        choices: {},
        origin: "trigger",
      };
      const step = { ctx: s.ctx, host: s.host, events: [] };
      appendChainItem(s.room, item, step);
      finalizeChainItem(s.room, item, step);
      resolveNewest(s.room, step);

      expect(s.room.rules?.chain.length).toBe(0);
      // 346.1: Focus stays with the current holder instead of passing.
      s.expectFocus("p1").expectPriority("p1").expectState("showdown_open");
    } finally {
      clearCardScripts();
    }
  });
});
