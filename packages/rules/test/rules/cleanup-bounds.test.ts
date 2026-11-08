/**
 * Cleanup bounds and 321 queueing — NEW-4 / NEW-10 (rules 321, 322).
 */
import { describe, expect, it } from "vitest";
import { dealDamage, runCleanup } from "../../src";
import { scenario } from "../scenarios/dsl";
import { boardOf, putCardAt, stepOf } from "../scenarios/cleanup-helpers";

describe("cleanup bounds and 321 queueing [R321][R321.1][R322]", () => {
  it("[R322] a two-pass cleanup honours {maxPasses:2} instead of silently raising the bound", () => {
    const s = scenario();
    putCardAt(s, "p1", "Treasure Hunter", "battlefieldA", "bounds-p1");
    putCardAt(s, "p2", "Caitlyn, Patrolling", "battlefieldA", "bounds-p2");
    // P2 is the Turn Player, so 303.2.a picks P2 when Contested is applied (pass 1, step 8).
    s.room.rules!.turn.player = "p2";

    const step = stepOf(s);
    expect(runCleanup(s.room, step, { maxPasses: 2 })).toBe(true);

    // Pass 1 applies Contested (an observable change); pass 2 stages + begins the Combat.
    expect(step.events.some((event) => event.type === "contested")).toBe(true);
    expect(s.room.rules?.combat?.battlefield).toBe("battlefieldA");
    // With maxPasses propagated, the second changing pass hits the 322 bound; before the fix the
    // recursion reset to 12 and finished silently.
    expect(step.events.some((event) => event.type === "loop_guard")).toBe(true);
    expect(step.loopGuard).toEqual({ rule: "322" });
  });

  it("[R321][R321.1] runCleanup queues itself while the manual window is open", () => {
    const s = scenario({ p1: { hand: ["Treasure Hunter"], energy: 2 } });
    s.as("p1").play("Treasure Hunter").expectOk();
    const unit = s.findBoardCard("Treasure Hunter")!;
    dealDamage(s.room, unit.id, 1, stepOf(s));
    s.room.rules!.manual = { itemId: "manual-bounds", player: "p1", cardName: "Meditation" };

    const step = stepOf(s);
    expect(runCleanup(s.room, step)).toBe(false);
    // 321: no cleanup occurred mid-resolution.
    expect(boardOf(s, "p1").trash.some((card) => card.id === unit.id)).toBe(false);
    expect(s.room.rules?.objects[unit.id]?.damage).toBe(1);
    // 321.1: it became an Outstanding Task (and is not queued twice).
    expect(s.room.rules?.tasks.filter((task) => task.kind === "cleanup")).toHaveLength(1);
    runCleanup(s.room, stepOf(s));
    expect(s.room.rules?.tasks.filter((task) => task.kind === "cleanup")).toHaveLength(1);
  });

  it("[R321][R321.1] runCleanup queues itself while a resolution prompt is open", () => {
    const s = scenario({ p1: { hand: ["Treasure Hunter"], energy: 2 } });
    s.as("p1").play("Treasure Hunter").expectOk();
    const unit = s.findBoardCard("Treasure Hunter")!;
    dealDamage(s.room, unit.id, 1, stepOf(s));
    s.room.rules!.prompt = {
      id: "prompt_resolution_guard",
      kind: "choose-battlefield",
      playerId: "p1",
      rule: "411.2",
      options: [{ id: "battlefieldA", zone: "battlefieldA" }],
      data: { reason: "future_effect_prompt" },
    };

    expect(runCleanup(s.room, stepOf(s))).toBe(false);
    expect(s.room.rules?.objects[unit.id]?.damage).toBe(1);
    expect(s.room.rules?.tasks.filter((task) => task.kind === "cleanup")).toHaveLength(1);
  });
});
