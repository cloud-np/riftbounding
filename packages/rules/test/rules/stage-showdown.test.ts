import { describe, expect, it } from "vitest";
import { PROMPT_REASONS, promptHandlerReasons, runCleanup } from "../../src";
import { scenario } from "../scenarios/dsl";
import { putCardAt, stepOf } from "../scenarios/cleanup-helpers";

describe("323.11 staged Showdown choice [R323.11][R345]", () => {
  it("[R323.11][R345] two staged Showdowns prompt the Turn Player; the answer begins the chosen one with Focus to its Contested applier", () => {
    // Direct state setup (the DSL builds a duel at Main); the cleanup stages both battlefields
    // because each is Contested by the single player present there (323.7).
    const s = scenario();
    putCardAt(s, "p1", "Treasure Hunter", "battlefieldA", "stage-sd-a");
    putCardAt(s, "p2", "Caitlyn, Patrolling", "battlefieldB", "stage-sd-b");
    s.room.rules!.contested.battlefieldA = "p1";
    s.room.rules!.contested.battlefieldB = "p2";

    runCleanup(s.room, stepOf(s));

    const prompt = s.room.rules!.prompt;
    expect(prompt?.playerId).toBe("p1");
    // The cleanup emitter and the handler registry share PROMPT_REASONS.stageShowdown; the old
    // "staged_showdown" key must not exist (integration bug fixed in R1-FIX-C).
    expect(prompt?.data?.reason).toBe(PROMPT_REASONS.stageShowdown);
    expect(promptHandlerReasons()).toContain("stage_showdown");
    expect(promptHandlerReasons()).not.toContain("staged_showdown");
    expect(prompt?.options?.map((option) => option.id).sort()).toEqual([
      "battlefieldA",
      "battlefieldB",
    ]);
    expect(s.room.rules?.staged.showdowns.sort()).toEqual(["battlefieldA", "battlefieldB"]);

    s.as("p1").choose({ optionIds: ["battlefieldB"], zone: "battlefieldB" }).expectOk();

    expect(s.room.rules?.prompt).toBe(null);
    expect(s.room.rules?.showdown).toMatchObject({
      battlefield: "battlefieldB",
      kind: "non_combat",
    });
    // 345: the player who applied Contested at the chosen battlefield gains Focus (and 313.2
    // Priority); the Turn Player was only the chooser.
    s.expectFocus("p2").expectPriority("p2");
    expect(s.room.rules?.staged.showdowns).not.toContain("battlefieldB");
    expect(s.room.rules?.staged.showdowns).toContain("battlefieldA");
  });
});
