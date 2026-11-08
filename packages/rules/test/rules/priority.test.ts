import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CardScript } from "@rift/protocol";
import { clearCardScripts, registerCardScripts } from "../../src";
import { scenario } from "../scenarios/dsl";

function noopScript(name: string, text: string): CardScript {
  return {
    name,
    text,
    status: "implemented",
    abilities: [{ kind: "spell", effect: { op: "seq", effects: [] } }],
  };
}

beforeAll(() => {
  registerCardScripts([
    noopScript("Rebuke", "[ACTION] Test no-op."),
    noopScript("Defy", "[REACTION] Test no-op."),
    noopScript("Gust", "[REACTION] Test no-op."),
  ]);
});

afterAll(() => {
  clearCardScripts();
});

describe("priority and the chain [R312][R338][R339]", () => {
  it("[R312.2.d][R339.1] owner's example: P1 Action → only Reactions legal → P2 passes → resolves → P1 priority", () => {
    const s = scenario({
      p1: { hand: ["Rebuke"], energy: 2, power: { Chaos: 2 } },
      p2: { hand: ["Defy"], energy: 1, power: { Calm: 1 } },
    });
    s.as("p1").play("Rebuke").expectOk();

    // Owner decision 3: auto-pass gives P2 the response window immediately.
    expect(s.room.rules?.priority).toBe("p2");
    s.expectState("neutral_closed");
    const p2 = s.expectLegal("p2");
    const defy = s.handCard("p2", "Defy");
    expect(defy && p2.playableCardIds.includes(defy.id)).toBe(true);

    s.as("p2").pass().expectOk();
    s.expectState("neutral_open").expectPriority("p1").expectWho("priority", "p1");
    expect(s.room.rules?.chain.length).toBe(0);
    // 351.2/340.1: the spell resolved and went to the trash.
    s.expectZone("p1", "Rebuke", "trash");
  });

  it("[R337.4] hold keeps Priority after finalizing; the actor may then pass", () => {
    const s = scenario({ p1: { hand: ["Rebuke"], energy: 2, power: { Chaos: 2 } } });
    s.as("p1").play("Rebuke", { hold: true }).expectOk();
    expect(s.room.rules?.priority).toBe("p1");
    expect(s.room.rules?.chain.length).toBe(1);

    s.as("p1").pass().expectOk();
    expect(s.room.rules?.priority).toBe("p2");
  });

  it("[R340.1][R340.4] a Reaction chain resolves newest-first, Priority returning to the newest remaining item's controller", () => {
    const s = scenario({
      p1: { hand: ["Rebuke", "Gust"], energy: 3, power: { Chaos: 2 } },
      p2: { hand: ["Defy"], energy: 1, power: { Calm: 1 } },
    });
    s.as("p1").play("Rebuke").expectOk();
    expect(s.room.rules?.priority).toBe("p2");

    s.as("p2").play("Defy").expectOk();
    expect(s.room.rules?.priority).toBe("p1");
    expect(s.room.rules?.chain.map((item) => item.cardName)).toEqual(["Rebuke", "Defy"]);

    s.as("p1").play("Gust").expectOk();
    expect(s.room.rules?.priority).toBe("p2");
    expect(s.room.rules?.chain.map((item) => item.cardName)).toEqual(["Rebuke", "Defy", "Gust"]);
    // Display projection is newest-first for the existing board UI.
    expect(s.room.chainEntries[0]?.card.name).toBe("Gust");

    // P1's auto-pass already counts as the first pass for Gust; P2's pass completes the
    // sequence (339.1) and Gust (newest) resolves (340.1).
    s.as("p2").pass().expectOk();
    expect(s.room.rules?.chain.map((item) => item.cardName)).toEqual(["Rebuke", "Defy"]);
    // 340.4: controller of the newest remaining item (Defy → P2).
    expect(s.room.rules?.priority).toBe("p2");
    s.expectZone("p1", "Gust", "trash");

    s.as("p2").pass().expectOk();
    s.as("p1").pass().expectOk();
    expect(s.room.rules?.chain.map((item) => item.cardName)).toEqual(["Rebuke"]);
    expect(s.room.rules?.priority).toBe("p1");

    s.as("p1").pass().expectOk();
    s.as("p2").pass().expectOk();
    expect(s.room.rules?.chain.length).toBe(0);
    s.expectPriority("p1").expectState("neutral_open");
  });

  it("[R337.2][R143.4] a Unit resolves immediately to Base and the chain stays empty", () => {
    const s = scenario({ p1: { hand: ["Astral Heron"], energy: 7 } });
    s.as("p1").play("Astral Heron").expectOk();
    expect(s.room.rules?.chain.length).toBe(0);
    s.expectZone("p1", "Astral Heron", "base");
    // 143.4: Units enter exhausted.
    const heron = s.findBoardCard("Astral Heron");
    expect(heron?.exhausted).toBe(true);
    s.expectPriority("p1");
  });

  it("[R338.1.b] passing in a Neutral Open state with no chain is rejected", () => {
    const s = scenario();
    s.as("p1").pass().expectError("nothing_to_pass");
  });

  it("[R312.1] a non-priority player cannot play a Reaction in a Closed State out of turn order", () => {
    const s = scenario({
      p1: { hand: ["Rebuke", "Defy"], energy: 5, power: { Chaos: 2, Calm: 1 } },
      p2: { hand: ["Defy"], energy: 1, power: { Calm: 1 } },
    });
    s.as("p1").play("Rebuke").expectOk();
    // P1 auto-passed, P2 holds priority; P1 cannot immediately play again.
    s.as("p1").play("Defy").expectError("not_your_priority");
  });
});
