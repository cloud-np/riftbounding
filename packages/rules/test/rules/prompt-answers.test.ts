/**
 * Prompt answers — NEW-11 (rule 411.2 Limited Actions).
 *
 * Answers must choose offered options, satisfy `min`/`max`, and handlers derive the chosen
 * battlefield from the option — never from a free-form `answer.zone` that was not offered.
 */
import { describe, expect, it } from "vitest";
import type { Prompt } from "@rift/protocol";
import { promptAnswerVerdict } from "../../src";
import { scenario } from "../scenarios/dsl";
import { putCardAt } from "../scenarios/cleanup-helpers";

function battlefieldPrompt(overrides: Partial<Prompt> = {}): Prompt {
  return {
    id: "prompt_new11",
    kind: "choose-battlefield",
    playerId: "p1",
    rule: "411.2",
    options: [
      { id: "battlefieldA", zone: "battlefieldA" },
      { id: "battlefieldB", zone: "battlefieldB" },
    ],
    min: 2,
    max: 2,
    ...overrides,
  };
}

describe("prompt answers [R411.2]", () => {
  it("[R411.2] min/max are enforced and only offered options count", () => {
    const prompt = battlefieldPrompt();
    expect(promptAnswerVerdict(prompt, { optionIds: ["battlefieldA"] })).toMatchObject({
      ok: false,
      code: "invalid_choice",
      rule: "411.2",
    });
    expect(
      promptAnswerVerdict(prompt, { optionIds: ["battlefieldA", "battlefieldC"] }),
    ).toMatchObject({ ok: false, code: "invalid_choice" });
    expect(
      promptAnswerVerdict(prompt, { optionIds: ["battlefieldA", "battlefieldB"] }),
    ).toEqual({ ok: true });

    // max:2 is enforced too.
    const single = battlefieldPrompt({ min: 1, max: 1 });
    expect(
      promptAnswerVerdict(single, { optionIds: ["battlefieldA", "battlefieldB"] }),
    ).toMatchObject({ ok: false, code: "invalid_choice" });
    // A free-form zone only counts when it matches an offered option.
    expect(promptAnswerVerdict(single, { zone: "battlefieldC" })).toMatchObject({
      ok: false,
      code: "invalid_choice",
    });
    expect(promptAnswerVerdict(single, { zone: "battlefieldA" })).toEqual({ ok: true });
  });

  it("[R411.2] rules_choose rejects a min/max violation and keeps the prompt pending", () => {
    const s = scenario();
    s.room.rules!.prompt = battlefieldPrompt({ id: "prompt_min" });
    s.as("p1").choose({ optionIds: ["battlefieldA"] }).expectError("invalid_choice");
    expect(s.room.rules?.prompt?.id).toBe("prompt_min");
    expect(s.room.rules?.history.promptAnswers ?? []).toHaveLength(0);
  });

  it("[R323.11][R411.2] stage_showdown derives the battlefield from the chosen option, not answer.zone", () => {
    const s = scenario();
    putCardAt(s, "p1", "Treasure Hunter", "battlefieldA", "new11-showdown-a");
    putCardAt(s, "p1", "Treasure Hunter", "battlefieldB", "new11-showdown-b");
    s.room.rules!.staged.showdowns = ["battlefieldA", "battlefieldB"];
    s.room.rules!.prompt = {
      id: "prompt_stage_showdown_new11",
      kind: "choose-battlefield",
      playerId: "p1",
      rule: "323.11",
      options: [{ id: "battlefieldA", zone: "battlefieldA" }],
      min: 1,
      max: 1,
      data: { reason: "stage_showdown" },
    };

    // battlefieldB is staged but was not offered; the offered option A must win.
    s.as("p1").choose({ optionIds: ["battlefieldA"], zone: "battlefieldB" }).expectOk();
    expect(s.room.rules?.showdown).toMatchObject({ battlefield: "battlefieldA", kind: "non_combat" });
    expect(s.room.rules?.staged.showdowns).toEqual(["battlefieldB"]);
  });

  it("[R323.12][R411.2] stage_combat derives the battlefield from the chosen option, not answer.zone", () => {
    const s = scenario();
    putCardAt(s, "p1", "Treasure Hunter", "battlefieldA", "new11-combat-p1");
    putCardAt(s, "p2", "Caitlyn, Patrolling", "battlefieldA", "new11-combat-p2");
    s.room.rules!.staged.combats = ["battlefieldA"];
    s.room.rules!.prompt = {
      id: "prompt_stage_combat_new11",
      kind: "choose-battlefield",
      playerId: "p1",
      rule: "323.12",
      options: [{ id: "battlefieldA", zone: "battlefieldA" }],
      min: 1,
      max: 1,
      data: { reason: "stage_combat" },
    };

    s.as("p1").choose({ optionIds: ["battlefieldA"], zone: "battlefieldB" }).expectOk();
    expect(s.room.rules?.combat?.battlefield).toBe("battlefieldA");
  });
});
