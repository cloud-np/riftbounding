/**
 * Shared `core:` custom ids (cards/lib/custom.ts) — one test per id merged from the lane copies
 * whose implementations had drifted (maintainability review F5/G9).
 */
import { describe, expect, it } from "vitest";
import type { Condition } from "@rift/protocol";
import { effectiveMight, evaluateCondition, makeEnv } from "../../../src";
import { recordFinalizedCard } from "../../../src/play/keyword-helpers";
import { scenario, type RulesScenario } from "../../scenarios/dsl";
import { boardOf, place, run, zoneOf } from "../../rules/effects/helpers";

function holds(s: RulesScenario, condition: Condition, env: { source?: string; it?: string; controller?: string; choices?: Record<string, string> } = {}): boolean {
  return evaluateCondition(
    {
      room: s.room,
      host: s.host,
      env: makeEnv({
        controller: env.controller ?? "p1",
        ...(env.source ? { sourceObjectId: env.source } : {}),
        ...(env.it ? { it: env.it } : {}),
        choices: env.choices ?? {},
      }),
    },
    condition,
  );
}

const IN_COMBAT: Condition = { kind: "custom", id: "core:in-combat" };

describe("core: custom ids [F5][G9]", () => {
  it("[R740.2.c] core:in-combat needs combat at my battlefield and a combat designation", () => {
    const s = scenario();
    const unit = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    s.room.rules!.objects[unit.id] = { designation: "attacker" };
    // A designation without an ongoing combat at my battlefield is not "in combat".
    expect(holds(s, IN_COMBAT, { source: unit.id })).toBe(false);
    s.room.rules!.combat = { battlefield: "battlefieldA", attacker: "p1", defender: "p2", step: "showdown" };
    expect(holds(s, IN_COMBAT, { source: unit.id })).toBe(true);
    // Present at the combat battlefield without a designation (e.g. before 466.2.c.3.a cleanup).
    s.room.rules!.objects[unit.id] = {};
    expect(holds(s, IN_COMBAT, { source: unit.id })).toBe(false);
    s.room.rules!.objects[unit.id] = { designation: "attacker" };
    expect(holds(s, { kind: "custom", id: "core:in-combat", params: { ref: "it" } }, { it: unit.id })).toBe(true);
    s.room.rules!.combat = { battlefield: "battlefieldB", attacker: "p1", defender: "p2", step: "showdown" };
    expect(holds(s, IN_COMBAT, { source: unit.id })).toBe(false);
  });

  it("[R466.2.c.3] core:attacking reads the Attacker designation of `it` or a choice key", () => {
    const s = scenario();
    const unit = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    s.room.rules!.objects[unit.id] = { designation: "defender" };
    expect(holds(s, { kind: "custom", id: "core:attacking" }, { it: unit.id })).toBe(false);
    s.room.rules!.objects[unit.id] = { designation: "attacker" };
    expect(holds(s, { kind: "custom", id: "core:attacking" }, { it: unit.id })).toBe(true);
    expect(holds(s, { kind: "custom", id: "core:attacking", params: { ref: "target:0" } }, { choices: { "target:0": unit.id } })).toBe(true);
  });

  it("[R812.1.c] core:legion holds once another card was played this turn", () => {
    const s = scenario();
    const source = place(s, "p1", "Caitlyn, Patrolling", "base");
    expect(holds(s, { kind: "custom", id: "core:legion" }, { source: source.id })).toBe(false);
    // 359: only my own Finalized card this turn does not count.
    recordFinalizedCard(s.room, "p1", source.id);
    expect(holds(s, { kind: "custom", id: "core:legion" }, { source: source.id })).toBe(false);
    recordFinalizedCard(s.room, "p1", "another-card");
    expect(holds(s, { kind: "custom", id: "core:legion" }, { source: source.id })).toBe(true);
  });

  it("[R107.3] core:you-have-units-at-it accepts battlefield objects and bare zones", () => {
    const s = scenario();
    place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    const condition: Condition = { kind: "custom", id: "core:you-have-units-at-it" };
    expect(holds(s, condition, { it: "battlefield:battlefieldA" })).toBe(true);
    expect(holds(s, condition, { it: "battlefieldA" })).toBe(true);
    expect(holds(s, condition, { it: "battlefield:battlefieldB" })).toBe(false);
    expect(holds(s, condition, { it: "battlefield:battlefieldA", controller: "p2" })).toBe(false);
  });

  it("[R056][R427] core:take-control gives the ability's controller control of the target", () => {
    const s = scenario();
    const enemy = place(s, "p2", "Treasure Hunter", "battlefieldA");
    const result = run(s, { op: "custom", id: "core:take-control", params: { target: { targetRef: `obj:${enemy.id}` } } });
    expect(result.events.some((event) => event.type === "gain_control" && event.cardId === enemy.id && event.playerId === "p1")).toBe(true);
    expect(s.host.findCard(s.room, enemy.id)?.playerId).toBe("p1");
  });

  it("[R414.1] core:draw-ref draws each bound card still in its owner's deck, one draw event per card", () => {
    const s = scenario();
    const deck = boardOf(s, "p1").deck;
    const [first, second] = [deck[0]!, deck[1]!];
    const result = run(s, { op: "custom", id: "core:draw-ref", params: { ref: "picked" } }, { choices: { picked: [first.id, second.id] } });
    expect(zoneOf(s, first.id)).toBe("hand");
    expect(zoneOf(s, second.id)).toBe("hand");
    expect(result.events.filter((event) => event.type === "draw").map((event) => event.amount)).toEqual([1, 1]);
  });

  it("[R143.2][R479] core:base-might-becomes changes Might by N minus base Might this turn", () => {
    const s = scenario();
    const unit = place(s, "p1", "Caitlyn, Patrolling", "base");
    run(s, { op: "for_each", selector: { targetRef: `obj:${unit.id}` }, effect: { op: "custom", id: "core:base-might-becomes", params: { value: 7 } } });
    expect(effectiveMight(s.room, unit.id, s.host)).toBe(7);
  });
});
