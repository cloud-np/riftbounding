import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChainItem } from "@rift/protocol";
import { prepareTriggeredItem } from "../../../src";
import { clearCardScripts, registerTestCardScript } from "../../../src/testing";
import { appendChainItem } from "../../../src/timing/fepr";
import * as fake from "./fake-effects";
import { bareScenario, place, pool, stepOf } from "./helpers";
import type { RulesScenario } from "../../scenarios/dsl";

vi.mock("../../../src/effects/choices", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/effects/choices")>();
  const f = await import("./fake-effects");
  return { ...actual, requiredChoices: f.requiredChoices, validateChoices: f.validateChoices };
});

beforeEach(() => fake.resetFakes());
afterEach(() => clearCardScripts());

/** A Pending triggered item of `sourceName` (script ability 0 = triggered, choices from SPECS). */
function pendingTrigger(s: RulesScenario, sourceId: string, sourceName: string): ChainItem {
  registerTestCardScript({
    name: sourceName,
    text: "test",
    status: "implemented",
    abilities: [{ kind: "triggered", trigger: { kind: "custom", id: "test" }, effect: { op: "custom", id: `fake:${sourceName}` } }],
  });
  const item: ChainItem = {
    id: `trigger-${sourceId}`,
    kind: "triggered",
    status: "pending",
    controller: "p1",
    sourceObjectId: sourceId,
    cardName: sourceName,
    abilityRef: "triggered:custom",
    choices: {},
    origin: "trigger",
  };
  appendChainItem(s.room, item, stepOf(s));
  s.room.rules!.priority = "p1";
  return s.room.rules!.chain.find((entry) => entry.id === item.id)!;
}

describe("triggered abilities through 402–407 [R403][R404][R405]", () => {
  it("[R403.4][R403.4.a] a trigger with no legal choice is removed from the chain (not countered)", () => {
    const s = bareScenario();
    const source = place(s, "p1", "Stellacorn Herder", "base");
    fake.setSpecs("Stellacorn Herder", (room, host) => [fake.unitAtBattlefieldSpec(room, host)]);
    const item = pendingTrigger(s, source.id, "Stellacorn Herder");
    const step = stepOf(s);
    expect(prepareTriggeredItem(s.room, step, item)).toBe("removed");
    expect(s.room.rules?.chain).toEqual([]);
    expect(step.events.find((event) => event.type === "trigger_removed")?.data).toMatchObject({ rule: "403.4" });
  });

  it("[R403.1][R403.1.a] an optional trigger its controller declines leaves the chain", () => {
    const s = bareScenario();
    const source = place(s, "p1", "Stellacorn Herder", "base");
    const item = pendingTrigger(s, source.id, "Stellacorn Herder");
    expect(prepareTriggeredItem(s.room, stepOf(s), item, { decline: true })).toBe("removed");
    expect(s.room.rules?.chain).toEqual([]);
  });

  it("[R404.1.b.1][R405.2] a cost within instructions is the base cost; unpayable, the trigger is removed", () => {
    const s = bareScenario({ p1: { energy: 1 } });
    const source = place(s, "p1", "Stellacorn Herder", "base");
    const item = pendingTrigger(s, source.id, "Stellacorn Herder");
    expect(prepareTriggeredItem(s.room, stepOf(s), item, { cost: { energy: 2 } })).toBe("removed");
    const again = pendingTrigger(s, source.id, "Stellacorn Herder");
    // 405.2: its controller may decline to pay — a real choice, so it is prompted (411.2).
    expect(prepareTriggeredItem(s.room, stepOf(s), again, { cost: { energy: 1 } })).toBe("pending");
    expect(s.room.rules?.prompt).toMatchObject({ kind: "yes-no", rule: "405.2", data: { reason: "play.trigger", stage: "cost" } });
    s.as("p1").choose({ optionIds: ["yes"] }).expectOk();
    expect(s.room.rules?.chain[0]).toMatchObject({ status: "finalized", totalCost: { energy: 1, power: 0 } });
    expect(pool(s, "p1").energy).toBe(0);
  });

  it("[R403.2][R403.4.b][R411.2] a forced target is bound; several legal targets are prompted and must be chosen", () => {
    const s = bareScenario();
    const source = place(s, "p1", "Stellacorn Herder", "base");
    const a = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    fake.setSpecs("Stellacorn Herder", (room, host) => [fake.unitAtBattlefieldSpec(room, host)]);
    const forced = pendingTrigger(s, source.id, "Stellacorn Herder");
    expect(prepareTriggeredItem(s.room, stepOf(s), forced)).toBe("finalized");
    expect(s.room.rules?.chain[0]?.choices["target:0"]).toBe(a.id);
    s.room.rules!.chain = [];
    const b = place(s, "p2", "Treasure Hunter", "battlefieldB");
    const prompted = pendingTrigger(s, source.id, "Stellacorn Herder");
    expect(prepareTriggeredItem(s.room, stepOf(s), prompted)).toBe("pending");
    expect(s.room.rules?.prompt).toMatchObject({ kind: "choose-target", data: { reason: "play.choice" } });
    s.as("p1").choose({ optionIds: [b.id] }).expectOk();
    expect(s.room.rules?.chain[0]).toMatchObject({ status: "finalized", choices: { "target:0": b.id } });
  });
});
