import { describe, expect, it } from "vitest";
import { conquer, type RulesStepContext } from "../../src";
import { scenario } from "../scenarios/dsl";

describe("game event accounting [R348.2.a][R468.5.d]", () => {
  it("[R348.2.a][R468.5.d] a Showdown Conquer emits establish_control exactly once", () => {
    const s = scenario({ p1: { hand: ["Treasure Hunter"], energy: 2 } });
    s.as("p1").play("Treasure Hunter").expectOk();
    const unit = s.findBoardCard("Treasure Hunter")!;
    unit.exhausted = false;
    s.as("p1").move("Treasure Hunter", "battlefieldA").expectOk();
    s.as("p1").pass().expectOk();
    s.as("p2").pass().expectOk();

    const types = s.events().map((event) => event.type);
    expect(types).toContain("establish_control");
    expect(types).toContain("conquer_result");
    expect(s.events().filter((event) => event.type === "establish_control")).toHaveLength(1);
    expect(s.events().filter((event) => event.type === "conquer_result")).toHaveLength(1);
  });

  it("[R348.2.a] the conquer primitive itself establishes control once and scores once", () => {
    const s = scenario();
    s.host.putCard(s.room, "p1", "battlefieldA", {
      id: "conquer-unit",
      name: "Conquer Unit",
      source: "token",
      exhausted: false,
      createdAt: s.ctx.now,
      ownerPlayerId: "p1",
      type: "Unit",
    });
    const step: RulesStepContext = { ctx: s.ctx, host: s.host, events: [] };
    expect(conquer(s.room, "p1", "battlefieldA", step)).toBe(true);
    expect(step.events.filter((event) => event.type === "establish_control")).toHaveLength(1);
    expect(step.events.filter((event) => event.type === "conquer_result")).toHaveLength(1);
  });
});
