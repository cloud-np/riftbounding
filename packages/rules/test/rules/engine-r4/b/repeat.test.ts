/**
 * Lane B R4 proof tests — Repeat (820): parser, execution count and the repeated execution's
 * own play-time choices.
 */
import { describe, expect, it } from "vitest";
import type { ChainItem } from "@rift/protocol";
import { effectiveMight, getCardScript } from "../../../../src";
import { parseRepeatCosts } from "../../../../src/play/cost-text";
import { repeatExecutions } from "../../../../src/play/repeat";
import { repeatRunCount } from "../../../../src/timing/fepr/resolve";
import { addPool, fund, put, settle, withCards } from "../../../cards/sfd/helpers";

function itemFor(cardName: string, optionalCosts: string[]): ChainItem {
  return {
    id: "chain:test",
    kind: "card",
    status: "finalized",
    controller: "p1",
    cardName,
    choices: {},
    optionalCosts,
    origin: "play",
  } as ChainItem;
}

describe("Repeat [R820]", () => {
  it("[R820.1.c] the Repeat cost parser accepts a dash before a non-symbol cost", () => {
    expect(parseRepeatCosts("[Repeat] - Discard 1 (You may pay the additional cost.)")).toEqual([{ discard: 1 }]);
    expect(parseRepeatCosts("[Repeat] — [2]")).toEqual([{ energy: 2 }]);
  });

  it("[R820.1.c.2][R820.3] each paid Repeat instance adds exactly one execution", () => {
    expect(repeatExecutions([])).toBe(0);
    expect(repeatExecutions(["accelerate"])).toBe(0);
    expect(repeatExecutions(["repeat"])).toBe(1);
    expect(repeatExecutions(["repeat", "repeat:1"])).toBe(2);
    expect(repeatExecutions(["repeat:1"])).toBe(1);
  });

  it("[R820.1.d][R820.1.d.1][C:Feral Strength] a paid Repeat executes the instructions a second time", () => {
    const s = withCards(["Feral Strength"]);
    const unit = put(s, "p1", "Caitlyn, Patrolling", "base");
    fund(s, "p1", "Feral Strength");
    addPool(s, "p1", 2);
    const card = s.handCard("p1", "Feral Strength")!;
    const before = effectiveMight(s.room, unit.id, s.host);
    s.as("p1")
      .apply({
        type: "rules_play",
        cardId: card.id,
        optionalCosts: ["repeat"],
        choices: { "target:0": unit.id },
      } as never)
      .expectOk();
    settle(s);
    expect(s.room.rules!.pools.p1!.energy).toBe(0);
    expect(effectiveMight(s.room, unit.id, s.host)).toBe(before + 2 + 2);
  });

  it("[R820.1.c.1][C:Feral Strength] an unpaid Repeat executes the instructions once", () => {
    const s = withCards(["Feral Strength"]);
    const unit = put(s, "p1", "Caitlyn, Patrolling", "base");
    fund(s, "p1", "Feral Strength");
    const card = s.handCard("p1", "Feral Strength")!;
    const before = effectiveMight(s.room, unit.id, s.host);
    s.as("p1")
      .apply({ type: "rules_play", cardId: card.id, choices: { "target:0": unit.id } } as never)
      .expectOk();
    settle(s);
    expect(effectiveMight(s.room, unit.id, s.host)).toBe(before + 2);
  });

  it("[R820.2][R820.2.a][C:Feral Strength] the repeated execution makes its own target choice", () => {
    const s = withCards(["Feral Strength"]);
    const first = put(s, "p1", "Caitlyn, Patrolling", "base");
    const second = put(s, "p1", "Treasure Hunter", "base");
    fund(s, "p1", "Feral Strength");
    addPool(s, "p1", 2);
    const card = s.handCard("p1", "Feral Strength")!;
    const firstBefore = effectiveMight(s.room, first.id, s.host);
    const secondBefore = effectiveMight(s.room, second.id, s.host);
    s.as("p1")
      .apply({
        type: "rules_play",
        cardId: card.id,
        optionalCosts: ["repeat"],
        choices: { "target:0": first.id },
      } as never)
      .expectOk();
    // 820.2: the repeated execution's choice is made at the usual time (Make Relevant Choices).
    expect(s.room.rules?.prompt?.data?.key).toBe("repeat:1:target:0");
    const options = s.room.rules?.prompt?.options?.map((option) => option.id) ?? [];
    expect(options).toEqual(expect.arrayContaining([first.id, second.id]));
    s.as("p1").choose({ optionIds: [second.id] }).expectOk();
    settle(s);
    // 820.2.a: the choices do not have to be the same.
    expect(effectiveMight(s.room, first.id, s.host)).toBe(firstBefore + 2);
    expect(effectiveMight(s.room, second.id, s.host)).toBe(secondBefore + 2);
  });

  it("[R355.9][R820.2] an illegal target supplied for the repeated execution is rejected on play", () => {
    const s = withCards(["Feral Strength"]);
    const first = put(s, "p1", "Caitlyn, Patrolling", "base");
    const second = put(s, "p1", "Treasure Hunter", "base");
    fund(s, "p1", "Feral Strength");
    addPool(s, "p1", 2);
    const card = s.handCard("p1", "Feral Strength")!;
    s.as("p1")
      .apply({
        type: "rules_play",
        cardId: card.id,
        optionalCosts: ["repeat"],
        choices: { "target:0": first.id, "repeat:1:target:0": second.id + ":bogus" },
      } as never)
      .expectError("illegal_target");
  });

  it("[R820.1.d] a script that executes Repeat itself is not executed again by the engine", () => {
    expect(getCardScript("Downstage Dramatics")?.repeatHandled).toBe(true);
    expect(getCardScript("Upstage Comedy")?.repeatHandled).toBe(true);
    expect(getCardScript("Double Trouble")?.repeatHandled).toBe(true);
    expect(getCardScript("Square Up")?.repeatHandled).toBe(true);
    expect(getCardScript("Existential Dread")?.repeatHandled).toBe(true);
    expect(repeatRunCount(itemFor("Downstage Dramatics", ["repeat"]))).toBe(1);
    expect(repeatRunCount(itemFor("Feral Strength", ["repeat"]))).toBe(2);
  });
});
