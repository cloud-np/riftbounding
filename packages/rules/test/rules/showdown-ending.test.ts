import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CardScript } from "@rift/protocol";
import { explainIllegal, turnState } from "../../src";
import { clearCardScripts, registerTestCardScripts } from "../../src/testing";
import { scenario } from "../scenarios/dsl";

function noop(name: string, text: string): CardScript {
  return {
    name,
    text,
    status: "implemented",
    abilities: [{ kind: "spell", effect: { op: "seq", effects: [] } }],
  };
}

beforeAll(() => registerTestCardScripts([noop("Defy", "[REACTION] test")]));
afterAll(() => clearCardScripts());

describe("Showdowns are not Main-Phase-only [R344][R806.1.b][R813.1.c.1]", () => {
  it("[R344][R347.1] the Focus holder may play a Reaction in a Showdown that began during the Ending Phase", () => {
    const s = scenario({
      p1: { hand: ["Defy"] },
      p2: { hand: ["Defy", "Caitlyn, Patrolling"], energy: 1, power: { Calm: 1 } },
    });
    const rules = s.room.rules!;
    // 323.10.a → 323.7/323.11 can begin a Showdown during an Ending-Phase Cleanup (see probe
    // `.orchestrator/scratch/r1-rereview/edge2.test.ts`); build that state directly so the test
    // does not depend on the cleanup call order.
    rules.turn.phase = "ending";
    rules.turn.step = "expiration";
    rules.showdown = { battlefield: "battlefieldA", kind: "non_combat", startedBy: "p2" };
    rules.focus = "p2";
    rules.priority = "p2";
    expect(turnState(s.room)).toBe("showdown_open");

    const defy = s.handCard("p2", "Defy")!;
    const verdict = explainIllegal(s.room, "p2", { type: "rules_play", cardId: defy.id }, s.host);
    expect(verdict.ok).toBe(true);

    // 308.1.a still applies: a card without Action/Reaction is not legally timed.
    const unit = s.handCard("p2", "Caitlyn, Patrolling")!;
    expect(
      explainIllegal(s.room, "p2", { type: "rules_play", cardId: unit.id }, s.host),
    ).toMatchObject({
      ok: false,
      code: "showdown_requires_action",
      rule: "308.1.a",
    });

    // 347.1/312.1: only the Focus holder (who also holds Priority, 313.2) may act.
    const p1Defy = s.handCard("p1", "Defy")!;
    expect(
      explainIllegal(s.room, "p1", { type: "rules_play", cardId: p1Defy.id }, s.host),
    ).toMatchObject({
      ok: false,
      code: "not_your_priority",
      rule: "312.1",
    });
  });

  it("[R310.1.a] the Main-Phase gate still applies to the default Neutral Open path", () => {
    const s = scenario({ p1: { hand: ["Treasure Hunter"], energy: 2 } });
    s.room.rules!.turn.phase = "ending";
    s.room.rules!.turn.step = "expiration";
    const card = s.handCard("p1", "Treasure Hunter")!;
    expect(
      explainIllegal(s.room, "p1", { type: "rules_play", cardId: card.id }, s.host),
    ).toMatchObject({
      ok: false,
      code: "not_main_phase",
      rule: "316",
    });
  });
});
