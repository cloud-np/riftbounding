import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CardScript } from "@rift/protocol";
import {
  explainIllegal,
  kill,
  legalIntents,
  turnState,
  whoMayAct,
  type RulesStepContext,
} from "../../src";
import { clearCardScripts, registerTestCardScripts } from "../../src/testing";
import { scenario } from "./dsl";

function noop(name: string, text: string): CardScript {
  return {
    name,
    text,
    status: "implemented",
    abilities: [{ kind: "spell", effect: { op: "seq", effects: [] } }],
  };
}

beforeAll(() => {
  registerTestCardScripts([
    noop("Rebuke", "[ACTION] test no-op"),
    noop("Defy", "[REACTION] test no-op"),
  ]);
});
afterAll(() => clearCardScripts());

describe("golden strict scenarios", () => {
  it("[R309.1.a][R312.2.d][R339.1] owner's example: P1 Action → only Reactions legal → P2 passes → resolves → P1 priority", () => {
    const s = scenario({
      p1: { hand: ["Rebuke"], energy: 2, power: { Chaos: 2 } },
      p2: { hand: ["Defy", "Caitlyn, Patrolling"], energy: 1, power: { Calm: 1 } },
    })
      .as("p1")
      .play("Rebuke")
      .expectOk()
      .expectState("neutral_closed")
      .expectPriority("p2")
      .expectWho("priority", "p2");

    // 309.1.a: while P2 holds Priority on the closed chain, every non-Reaction card is excluded.
    const who = whoMayAct(s.room);
    expect(who).toMatchObject({ kind: "priority", player: "p2", window: "chain" });
    const p2Legal = legalIntents(s.room, "p2", s.host);
    const caitlyn = s.handCard("p2", "Caitlyn, Patrolling")!;
    const defy = s.handCard("p2", "Defy")!;
    expect(p2Legal.playableCardIds).not.toContain(caitlyn.id);
    expect(p2Legal.playableCardIds).toContain(defy.id);
    expect(
      explainIllegal(s.room, "p2", { type: "rules_play", cardId: caitlyn.id }, s.host),
    ).toMatchObject({
      ok: false,
      code: "closed_state_requires_reaction",
    });
    if (!explainIllegal(s.room, "p2", { type: "rules_play", cardId: caitlyn.id }, s.host).ok) {
      expect(
        (
          explainIllegal(s.room, "p2", { type: "rules_play", cardId: caitlyn.id }, s.host) as {
            rule: string;
          }
        ).rule,
      ).toBe("309.1.a");
    }

    s.as("p2").pass().expectOk().expectState("neutral_open").expectPriority("p1");
    s.expectZone("p1", "Rebuke", "trash");
  });

  it("[R321][§6.4] unscripted variant: P2 passes → manual window for P1 → manual done → P1 priority in Neutral Open", () => {
    const s = scenario({ p1: { hand: ["Meditation"], energy: 2 } }); // deliberately unscripted
    s.as("p1").play("Meditation").expectOk();
    s.expectState("neutral_closed").expectPriority("p2");

    s.as("p2").pass().expectOk();
    expect(s.room.rules?.manual).toMatchObject({ player: "p1", cardName: "Meditation" });
    expect(turnState(s.room)).toBe("neutral_closed");
    expect(s.room.chainEntries[0]?.card.name).toBe("Meditation");

    s.as("p1").manualDone().expectOk();
    expect(s.room.rules?.manual).toBe(null);
    s.expectZone("p1", "Meditation", "trash");
    s.expectState("neutral_open").expectPriority("p1");
  });

  it("[R337.4] auto-pass vs hold: the same play gives the opponent the window only when not holding", () => {
    const auto = scenario({ p1: { hand: ["Rebuke"], energy: 2, power: { Chaos: 2 } } });
    auto.as("p1").play("Rebuke").expectOk().expectPriority("p2");

    const held = scenario({ p1: { hand: ["Rebuke"], energy: 2, power: { Chaos: 2 } } });
    held.as("p1").play("Rebuke", { hold: true }).expectOk().expectPriority("p1");
  });

  it("[R315][R317.3] a full turn cycle returns to P1 with a fresh Start of Turn", () => {
    const s = scenario();
    const firstNumber = s.room.rules!.turn.number;
    s.as("p1").endTurn().expectOk();
    expect(s.room.rules?.turn.player).toBe("p2");
    s.as("p2").endTurn().expectOk();
    expect(s.room.rules?.turn.player).toBe("p1");
    expect(s.room.rules?.turn.number).toBe(firstNumber + 2);
    s.expectPhase("main").expectPriority("p1");
  });

  it("[R432.2] burn out recycles the trash, gives an opponent 1 point, then completes the draw", () => {
    const s = scenario({ p1: { hand: ["Treasure Hunter"], energy: 2 } });
    s.as("p1").play("Treasure Hunter").expectOk();
    const unit = s.findBoardCard("Treasure Hunter")!;
    const step: RulesStepContext = { ctx: s.ctx, host: s.host, events: [] };
    kill(s.room, unit.id, step);
    s.room.players[0]!.board!.deck = [];

    s.as("p1").endTurn().expectOk();
    s.as("p2").endTurn().expectOk();
    expect(s.room.players[1]?.board?.score).toBe(1);
    expect(s.handCard("p1", "Treasure Hunter")).toBeTruthy();
  });
});
