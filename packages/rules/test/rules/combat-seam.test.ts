import { describe, expect, it } from "vitest";
import { runCleanup } from "../../src";
import { scenario } from "../scenarios/dsl";
import { boardOf, putCardAt, readyUnit, stepOf } from "../scenarios/cleanup-helpers";

describe("combat seams [R323.13][R466.2.c.1.b][R468.7]", () => {
  it("[R323.13][R466.2.c.1.b] upgrading a non-combat Showdown keeps the current Focus holder", () => {
    // Probe Q: p1 opens a non-combat showdown and passes Focus to p2; an effect then puts a p2
    // Unit at the battlefield. The cleanup upgrades to a Combat Showdown, but 466.2.c.1.b says
    // the player who already has Focus maintains it.
    const s = scenario({
      p1: { hand: ["Treasure Hunter"], energy: 2 },
      p2: { hand: ["Caitlyn, Patrolling"], energy: 3, power: { Calm: 1 } },
    });
    s.as("p1").play("Treasure Hunter").expectOk();
    readyUnit(s, "Treasure Hunter");
    s.as("p1").move("Treasure Hunter", "battlefieldA").expectOk();
    expect(s.room.rules?.focus).toBe("p1");
    s.as("p1").pass().expectOk();
    expect(s.room.rules?.focus).toBe("p2");

    putCardAt(s, "p2", "Caitlyn, Patrolling", "battlefieldA", "probe-caitlyn-upgrade");
    runCleanup(s.room, stepOf(s));

    expect(s.room.rules?.combat?.battlefield).toBe("battlefieldA");
    expect(s.room.rules?.showdown?.kind).toBe("combat");
    expect(s.room.rules?.focus).toBe("p2");
    expect(s.room.rules?.priority).toBe("p2");
  });

  it("[R468.7.a][R323.2.c] combat end and cleanup remove Attacker/Defender designations", () => {
    const s = scenario({
      p1: { hand: ["Treasure Hunter"], energy: 2 },
      p2: { hand: ["Caitlyn, Patrolling"], energy: 3, power: { Calm: 1 } },
    });
    s.as("p1").play("Treasure Hunter").expectOk();
    readyUnit(s, "Treasure Hunter");
    s.as("p1").move("Treasure Hunter", "battlefieldA").expectOk();
    s.as("p1").pass().expectOk();
    s.as("p2").pass().expectOk();
    // p1 conquered the battlefield; p2 now attacks it.
    s.as("p1").endTurn().expectOk();
    // 167: P2's Rune Pool emptied at the start of their Main Phase; 357: fund Caitlyn's cost.
    s.room.rules!.pools.p2 = { energy: 3, power: { Calm: 1 } };
    s.as("p2").play("Caitlyn, Patrolling").expectOk();
    readyUnit(s, "Caitlyn, Patrolling");
    s.as("p2").move("Caitlyn, Patrolling", "battlefieldA").expectOk();

    const hunter = boardOf(s, "p1").battlefieldA.find((card) => card.name === "Treasure Hunter")!;
    const caitlyn = boardOf(s, "p2").battlefieldA.find(
      (card) => card.name === "Caitlyn, Patrolling",
    )!;
    expect(s.room.rules?.objects[hunter.id]?.designation).toBe("defender");
    expect(s.room.rules?.objects[caitlyn.id]?.designation).toBe("attacker");

    // 323.2.c: a Unit elsewhere with a stale designation loses it in the cleanup.
    putCardAt(s, "p1", "Astral Heron", "base", "probe-elsewhere");
    s.room.rules!.objects["probe-elsewhere"] = { designation: "attacker" };
    runCleanup(s.room, stepOf(s));
    expect(s.room.rules?.objects["probe-elsewhere"]?.designation).toBeUndefined();

    // Close the Combat Showdown: 468.7.a removes every designation at combat end.
    s.as("p2").pass().expectOk();
    s.as("p1").pass().expectOk();
    expect(s.room.rules?.combat).toBe(null);
    expect(s.room.rules?.showdown).toBe(null);
    for (const object of Object.values(s.room.rules?.objects ?? {})) {
      expect(object.designation).toBeUndefined();
    }
  });

  it("[R323.12] multiple staged Combats prompt the Turn Player instead of auto-picking", () => {
    const s = scenario({
      p1: { hand: ["Treasure Hunter", "Treasure Hunter"] },
      p2: { hand: ["Caitlyn, Patrolling", "Caitlyn, Patrolling"] },
    });
    putCardAt(s, "p1", "Treasure Hunter", "battlefieldA", "stage-p1-a");
    putCardAt(s, "p1", "Treasure Hunter", "battlefieldB", "stage-p1-b");
    putCardAt(s, "p2", "Caitlyn, Patrolling", "battlefieldA", "stage-p2-a");
    putCardAt(s, "p2", "Caitlyn, Patrolling", "battlefieldB", "stage-p2-b");
    s.room.rules!.staged.combats = ["battlefieldA", "battlefieldB"];

    runCleanup(s.room, stepOf(s));

    expect(s.room.rules?.combat).toBe(null);
    const prompt = s.room.rules?.prompt;
    expect(prompt?.kind).toBe("choose-battlefield");
    expect(prompt?.playerId).toBe(s.room.rules?.turn.player);
    expect(prompt?.rule).toBe("323.12");
    expect(prompt?.data?.reason).toBe("stage_combat");
    expect(prompt?.options?.map((option) => option.id).sort()).toEqual([
      "battlefieldA",
      "battlefieldB",
    ]);

    // 411.2: while the prompt is pending the cleanup must not begin anything else.
    runCleanup(s.room, stepOf(s));
    expect(s.room.rules?.combat).toBe(null);
    expect(s.room.rules?.showdown).toBe(null);
    expect(s.room.rules?.prompt?.id).toBe(prompt?.id);
  });

  it("[R323.11] multiple staged Showdowns prompt the Turn Player with reason stage_showdown", () => {
    const s = scenario({
      p1: { hand: ["Treasure Hunter", "Treasure Hunter"] },
      p2: { hand: ["Caitlyn, Patrolling"] },
    });
    putCardAt(s, "p1", "Treasure Hunter", "battlefieldA", "showdown-p1-a");
    putCardAt(s, "p1", "Treasure Hunter", "battlefieldB", "showdown-p1-b");
    s.room.rules!.contested.battlefieldA = "p1";
    s.room.rules!.contested.battlefieldB = "p1";
    s.room.rules!.staged.showdowns = ["battlefieldA", "battlefieldB"];

    runCleanup(s.room, stepOf(s));

    const prompt = s.room.rules?.prompt;
    expect(prompt?.kind).toBe("choose-battlefield");
    expect(prompt?.rule).toBe("323.11");
    // The prompt-handler registry dispatches on this exact reason (FIX-A registers it).
    expect(prompt?.data?.reason).toBe("stage_showdown");
    expect(s.room.rules?.showdown).toBe(null);
  });

  it("[R323.12] a single staged Combat begins automatically", () => {
    const s = scenario({
      p1: { hand: ["Treasure Hunter"], energy: 2 },
      p2: { hand: ["Caitlyn, Patrolling"], energy: 3, power: { Calm: 1 } },
    });
    putCardAt(s, "p1", "Treasure Hunter", "battlefieldA", "single-p1-a");
    putCardAt(s, "p2", "Caitlyn, Patrolling", "battlefieldA", "single-p2-a");
    s.room.rules!.staged.combats = ["battlefieldA"];

    runCleanup(s.room, stepOf(s));

    expect(s.room.rules?.combat?.battlefield).toBe("battlefieldA");
    expect(s.room.rules?.showdown?.kind).toBe("combat");
    expect(s.room.rules?.prompt).toBe(null);
    // 345: a fresh Combat Showdown grants Focus to the Contested applier (p1 applied it above).
    expect(s.room.rules?.focus).toBe(s.room.rules?.contested.battlefieldA);
  });
});
