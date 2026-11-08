import { describe, expect, it } from "vitest";
import type { Prompt } from "@rift/protocol";
import { dealDamage, turnState, type RulesStepContext } from "../../src";
import { scenario } from "../scenarios/dsl";

function step(s: ReturnType<typeof scenario>): RulesStepContext {
  return { ctx: s.ctx, host: s.host, events: [] };
}

function forcePrompt(s: ReturnType<typeof scenario>, prompt: Prompt): void {
  s.room.rules!.prompt = prompt;
}

describe("manual window and cleanups [R321][R321.1][§6.4]", () => {
  it("[R321][R321.1] a cleanup due while an unscripted spell resolves is deferred until rules_manual_done", () => {
    const s = scenario({ p1: { hand: ["Treasure Hunter", "Meditation"], energy: 4 } });
    s.as("p1").play("Treasure Hunter").expectOk();
    const unit = s.findBoardCard("Treasure Hunter")!;

    // The spell is unscripted: after P1 auto-passes, P2's pass resolves it into the §6.4 window.
    s.as("p1").play("Meditation").expectOk();
    expect(s.room.rules?.chain.length).toBe(1);

    // Mark lethal damage *after* the play's own cleanup, so the only due cleanup is the one that
    // would run while the Chain Item is resolving (321).
    dealDamage(s.room, unit.id, 3, step(s));
    s.as("p2").pass().expectOk();

    expect(s.room.rules?.manual?.player).toBe("p1");
    expect(s.room.rules?.manual?.cardName).toBe("Meditation");
    // 321: the unit is still on the Board while the item is resolving.
    expect(s.room.players[0]!.board!.trash.some((card) => card.id === unit.id)).toBe(false);
    // 321.1: the cleanup became an Outstanding Task instead of running mid-resolution.
    expect(s.room.rules?.tasks.some((task) => task.kind === "cleanup")).toBe(true);

    s.as("p1").manualDone().expectOk();
    // 323.4: the deferred cleanup now kills the lethally damaged Unit; the spell goes to trash.
    expect(s.room.players[0]!.board!.trash.some((card) => card.id === unit.id)).toBe(true);
    expect(s.room.players[0]!.board!.trash.some((card) => card.name === "Meditation")).toBe(true);
    expect(s.room.rules?.manual).toBe(null);
    expect(turnState(s.room)).toBe("neutral_open");
  });
});

describe("prompt handlers dispatch on data.reason [R411.2]", () => {
  it("[R432.2.c] a burn_out choose-opponent prompt awards the chosen opponent one point", () => {
    const s = scenario();
    forcePrompt(s, {
      id: "prompt_burn",
      kind: "choose-opponent",
      playerId: "p1",
      rule: "432.2.c",
      options: [{ id: "p2", playerId: "p2" }],
      min: 1,
      max: 1,
      data: { reason: "burn_out" },
    });
    s.as("p1").choose({ playerId: "p2" }).expectOk();
    expect(s.room.rules?.prompt).toBe(null);
    expect(s.room.players[1]?.board?.score).toBe(1);
    expect(s.room.rules?.history.promptAnswers?.length).toBe(1);
  });

  it("[R323.11] a stage_showdown choose-battlefield prompt begins a non-combat Showdown", () => {
    const s = scenario();
    s.room.rules!.staged.showdowns = ["battlefieldA"];
    forcePrompt(s, {
      id: "prompt_showdown",
      kind: "choose-battlefield",
      playerId: "p1",
      rule: "323.11",
      options: [{ id: "battlefieldA", zone: "battlefieldA" }],
      data: { reason: "stage_showdown" },
    });
    s.as("p1")
      .choose({ optionIds: ["battlefieldA"], zone: "battlefieldA" })
      .expectOk();
    expect(s.room.rules?.showdown).toMatchObject({
      battlefield: "battlefieldA",
      kind: "non_combat",
    });
    expect(s.room.rules?.staged.showdowns).toEqual([]);
  });

  it("[R323.12] a stage_combat choose-battlefield prompt begins Combat at that battlefield", () => {
    const s = scenario();
    s.placeFromDeck("p1", "Treasure Hunter", "battlefieldA");
    s.placeFromDeck("p2", "Caitlyn, Patrolling", "battlefieldA");
    s.room.rules!.staged.combats = ["battlefieldA"];
    forcePrompt(s, {
      id: "prompt_combat",
      kind: "choose-battlefield",
      playerId: "p1",
      rule: "323.12",
      options: [{ id: "battlefieldA", zone: "battlefieldA" }],
      data: { reason: "stage_combat" },
    });
    s.as("p1")
      .choose({ optionIds: ["battlefieldA"], zone: "battlefieldA" })
      .expectOk();
    expect(s.room.rules?.combat?.battlefield).toBe("battlefieldA");
    expect(s.room.rules?.showdown?.kind).toBe("combat");
  });

  it("[R411.2] an unregistered reason does not fall back to burn-out/staged-showdown side effects", () => {
    const s = scenario();
    forcePrompt(s, {
      id: "prompt_future",
      kind: "choose-opponent",
      playerId: "p1",
      options: [{ id: "p2", playerId: "p2" }],
      data: { reason: "future_effect_prompt" },
    });
    s.as("p1").choose({ playerId: "p2" }).expectOk();
    expect(s.room.rules?.prompt).toBe(null);
    expect(s.room.players[1]?.board?.score).toBe(0);
    expect(s.room.rules?.showdown).toBe(null);
  });

  it("[R411.2] a prompt without a reason keeps R1 kind-based behaviour (merge-order compatibility)", () => {
    const s = scenario();
    forcePrompt(s, {
      id: "prompt_legacy",
      kind: "choose-opponent",
      playerId: "p1",
      options: [{ id: "p2", playerId: "p2" }],
    });
    s.as("p1").choose({ playerId: "p2" }).expectOk();
    expect(s.room.rules?.prompt).toBe(null);
    expect(s.room.players[1]?.board?.score).toBe(1);
  });

  it("[R411.2] a non-owner cannot answer a prompt", () => {
    const s = scenario();
    forcePrompt(s, {
      id: "prompt_owner",
      kind: "choose-opponent",
      playerId: "p1",
      options: [{ id: "p2", playerId: "p2" }],
      data: { reason: "burn_out" },
    });
    s.as("p2").apply({
      type: "rules_choose",
      promptId: "prompt_owner",
      answer: { playerId: "p2" },
    });
    expect(s.lastError()?.code).toBe("not_your_priority");
    expect(s.lastError()?.rule).toBe("411.2");
    expect(s.room.rules?.prompt?.id).toBe("prompt_owner");
  });
});
