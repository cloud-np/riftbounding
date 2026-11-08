import { describe, expect, it } from "vitest";
import { conquer, dealDamage, runCleanup } from "../../src";
import { MAX_CLEANUP_PASSES } from "../../src/cleanup/cleanup";
import { scenario } from "../scenarios/dsl";
import { putCardAt, stepOf } from "../scenarios/cleanup-helpers";

describe("cleanup step order and Contested re-application [R318–R324]", () => {
  it("[R323.4][R317.2.b][EX:324.1] a Unit with lethal damage dies at 3a before the Expiration Step heals", () => {
    // Probe D: 1-Might Treasure Hunter with 3 marked damage must be in the Trash after end of
    // turn. 317.2.b inserts "3c. Heal all Units" after 3a, not before it (324.1).
    const s = scenario({ p1: { hand: ["Treasure Hunter"], energy: 2 } });
    s.as("p1").play("Treasure Hunter").expectOk();
    const unit = s.findBoardCard("Treasure Hunter")!;
    dealDamage(s.room, unit.id, 3, stepOf(s));
    expect(s.room.rules?.objects[unit.id]?.damage).toBe(3);

    s.as("p1").endTurn().expectOk();

    expect(s.room.players[0]?.board?.trash.some((card) => card.id === unit.id)).toBe(true);
    expect(s.room.rules?.objects[unit.id]).toBeUndefined();
    expect(s.room.rules?.turn.player).toBe("p2");
  });

  it("[R323.10.a] removing Contested re-applies it for units left at an uncontested battlefield", () => {
    // Probe M: p1 applied Contested, then its units left; p2's Units remain at a battlefield p2
    // does NOT control. The removal at 323.10 is followed by p2 applying Contested (323.10.a),
    // which stages 323.7/323.11.
    const s = scenario({
      p1: { hand: ["Treasure Hunter"], energy: 2 },
      p2: { hand: ["Caitlyn, Patrolling"], energy: 3, power: { Calm: 1 } },
    });
    putCardAt(s, "p2", "Caitlyn, Patrolling", "battlefieldA", "probe-caitlyn");
    s.room.rules!.contested.battlefieldA = "p1";
    // 190.2.a: battlefieldA is explicitly Uncontrolled.
    s.room.rules!.objects.battlefieldA = { controller: null };

    runCleanup(s.room, stepOf(s));

    expect(s.room.rules?.contested.battlefieldA).toBe("p2");
    expect(s.room.rules?.showdown?.battlefield).toBe("battlefieldA");
    expect(s.room.rules?.focus).toBe("p2");
  });

  it("[R323.10.a][R190.4.a] no re-application when the remaining units' controller controls the battlefield", () => {
    // p1 attacked p2's battlefield, then p1's units left before combat. 323.10 removes Contested;
    // p2 controls the battlefield, so 323.10.a does not apply and no Showdown starts (p2 must not
    // "conquer" its own battlefield).
    const s = scenario({ p2: { hand: ["Caitlyn, Patrolling"] } });
    putCardAt(s, "p2", "Caitlyn, Patrolling", "battlefieldA", "probe-caitlyn-owner");
    s.room.rules!.contested.battlefieldA = "p1";
    s.room.rules!.objects.battlefieldA = { controller: "p2" };

    const step = stepOf(s);
    runCleanup(s.room, step);

    expect(s.room.rules?.contested.battlefieldA).toBeUndefined();
    expect(s.room.rules?.showdown).toBe(null);
    expect(step.events.some((event) => event.type === "contested_reapplied")).toBe(false);
  });

  it("[R322] hitting the cleanup recursion bound emits loop_guard instead of silently stopping", () => {
    const s = scenario({ p1: { hand: ["Treasure Hunter"], energy: 2 } });
    s.as("p1").play("Treasure Hunter").expectOk();
    const unit = s.findBoardCard("Treasure Hunter")!;
    dealDamage(s.room, unit.id, 1, stepOf(s));

    const step = stepOf(s);
    runCleanup(s.room, step, { maxPasses: 1 });
    expect(step.events.some((event) => event.type === "loop_guard")).toBe(true);
    const guard = step.events.find((event) => event.type === "loop_guard");
    expect(guard?.data?.rule).toBe("322");
    // N6: the guard is surfaced as a Verdict through `applyRulesIntent`, not just an event.
    expect(step.loopGuard).toEqual({ rule: "322" });

    // The default bound is far above this state; it must not fire spuriously.
    const s2 = scenario({ p1: { hand: ["Treasure Hunter"], energy: 2 } });
    s2.as("p1").play("Treasure Hunter").expectOk();
    const unit2 = s2.findBoardCard("Treasure Hunter")!;
    dealDamage(s2.room, unit2.id, 1, stepOf(s2));
    const step2 = stepOf(s2);
    runCleanup(s2.room, step2);
    expect(step2.events.some((event) => event.type === "loop_guard")).toBe(false);
    expect(MAX_CLEANUP_PASSES).toBeGreaterThan(1);
  });

  it("[R348.2.a][R190.4] conquer aborts and does not score when Control cannot be established", () => {
    const s = scenario({
      p1: { hand: ["Treasure Hunter"], energy: 2 },
      p2: { hand: ["Caitlyn, Patrolling"], energy: 3, power: { Calm: 1 } },
    });
    putCardAt(s, "p1", "Treasure Hunter", "battlefieldA", "probe-p1-unit");
    putCardAt(s, "p2", "Caitlyn, Patrolling", "battlefieldA", "probe-p2-unit");
    s.room.rules!.contested.battlefieldA = "p1";

    expect(conquer(s.room, "p1", "battlefieldA", stepOf(s))).toBe(false);
    expect(s.room.rules?.scoredThisTurn.p1 ?? []).not.toContain("battlefieldA");
    expect(s.room.players[0]?.board?.score ?? 0).toBe(0);
    // 190.3.b: Contested is not cleared because p1 could not establish Control.
    expect(s.room.rules?.contested.battlefieldA).toBe("p1");
  });

  it("[R322][N6] applyRulesIntent returns a loop_guard Verdict when a queued cleanup hits the bound", () => {
    // A queued Cleanup task can carry `maxPasses` (test/extension bound). Answering the forced
    // prompt lets `advance` run that task; the kill is a change, so the bound fires immediately.
    const s = scenario({ p1: { hand: ["Treasure Hunter"], energy: 2 } });
    s.as("p1").play("Treasure Hunter").expectOk();
    const unit = s.findBoardCard("Treasure Hunter")!;
    dealDamage(s.room, unit.id, 3, stepOf(s));

    s.room.rules!.tasks.push({
      id: "task_cleanup_guard",
      kind: "cleanup",
      data: { maxPasses: 1 },
    });
    s.room.rules!.prompt = {
      id: "prompt_cleanup_guard",
      kind: "yes-no",
      playerId: "p1",
      options: [{ id: "yes" }],
      data: { reason: "future_effect_prompt" },
    };

    s.as("p1").choose({ optionIds: ["yes"] });
    expect(s.lastError()).toEqual({ code: "loop_guard", rule: "322" });
  });

  it("[R323.8][R303.2.a] an invented Contested applier follows turn order and the next pass stages the Combat", () => {
    // NEW-8: none applied Contested, two contestants are present. 303.2.a orders simultaneous
    // actions from the Turn Player; the application is an observable change, so 322 repeats the
    // cleanup and 323.7/323.8 stage (and then begin) the Combat.
    const s = scenario();
    putCardAt(s, "p1", "Treasure Hunter", "battlefieldA", "new8-p1");
    putCardAt(s, "p2", "Caitlyn, Patrolling", "battlefieldA", "new8-p2");
    s.room.rules!.turn.player = "p2";

    const step = stepOf(s);
    expect(runCleanup(s.room, step)).toBe(true);

    // Turn order starts at P2, even though the seating/active order starts at P1.
    expect(s.room.rules?.contested.battlefieldA).toBe("p2");
    const contested = step.events.find((event) => event.type === "contested");
    expect(contested?.playerId).toBe("p2");
    expect(contested?.data?.rule).toBe("323.8");
    // The repeat staged and began the Combat with P2 as the Contested applier (323.8).
    expect(s.room.rules?.combat?.battlefield).toBe("battlefieldA");
    expect(s.room.rules?.combat?.attacker).toBe("p2");
  });
});
