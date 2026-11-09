/**
 * Unit + property tests for the pure strict bot picker (`pickRandomAction` / `pickPromptAnswer`).
 *
 * These tests are deliberately engine-agnostic where possible: synthetic prompts prove the
 * answerer covers every `PromptKind` and every prompt reason, while the sequence property drives
 * real rooms through `applyRulesIntent`.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Prompt, PromptAnswer, PromptKind, Room, RulesIntent } from "@rift/protocol";
import {
  applyRulesIntent,
  COMBAT_PROMPT_REASONS,
  EFFECTS_PROMPT_REASONS,
  legalIntents,
  mulberry32,
  pickPromptAnswer,
  pickRandomAction,
  PLAY_PROMPT_REASONS,
  PROMPT_REASONS as CORE_PROMPT_REASONS,
  promptAnswerVerdict,
  validateAssignment,
  whoMayAct,
} from "../../src";
import { splitAnswerVerdict } from "../../src/effects/split";
import { isOneOfSubsets } from "../../src/effects/group";
import {
  buildScenario,
  clearPropertyScripts,
  registerPropertyScripts,
} from "../property/generators";
import { scenario } from "../scenarios/dsl";

const PROMPT_KINDS: PromptKind[] = [
  "choose-opponent",
  "choose-player",
  "choose-card",
  "choose-target",
  "choose-mode",
  "choose-battlefield",
  "choose-number",
  "yes-no",
  "order",
  "manual",
  "choose-cost",
  "damage-assignment",
];

const PROMPT_REASONS = [
  "burn_out",
  "stage_showdown",
  "stage_combat",
  "play.choice",
  "play.optional_cost",
  "play.cost",
  "play.trigger",
  "combat.damage_assignment",
  "effects.resume",
  "effects.order_triggers",
  "effects.replacement",
];

/** Every reason constant the engine actually registers (guards against drift). */
const ENGINE_PROMPT_REASONS = [
  ...Object.values(CORE_PROMPT_REASONS),
  ...Object.values(PLAY_PROMPT_REASONS),
  ...Object.values(COMBAT_PROMPT_REASONS),
  ...Object.values(EFFECTS_PROMPT_REASONS),
];

function prompt(overrides: Partial<Prompt> & { kind: PromptKind }): Prompt {
  return { id: "prompt_test", playerId: "p1", ...overrides };
}

function answerFor(promptValue: Prompt, room: Room, seed = 7): PromptAnswer | null {
  return pickPromptAnswer(promptValue, room, mulberry32(seed));
}

/** A two-option prompt whose shape is legal for the given kind. */
function kindPrompt(kind: PromptKind): Prompt {
  if (kind === "choose-opponent") {
    return prompt({
      kind,
      options: [
        { id: "p2", playerId: "p2" },
        { id: "p3", playerId: "p3" },
      ],
      min: 1,
      max: 1,
    });
  }
  if (kind === "yes-no") {
    return prompt({
      kind,
      options: [
        { id: "yes", label: "Yes" },
        { id: "no", label: "No" },
      ],
      min: 1,
      max: 1,
    });
  }
  if (kind === "order") {
    return prompt({
      kind,
      options: [{ id: "a" }, { id: "b" }],
      min: 0,
      max: 2,
    });
  }
  return prompt({
    kind,
    options: [{ id: "a" }, { id: "b" }],
    min: 1,
    max: 1,
  });
}

function reasonPrompt(reason: string): Prompt {
  switch (reason) {
    case "burn_out":
      return prompt({
        kind: "choose-opponent",
        rule: "432.2.c",
        options: [
          { id: "p2", playerId: "p2" },
          { id: "p3", playerId: "p3" },
        ],
        min: 1,
        max: 1,
        data: { reason },
      });
    case "stage_showdown":
      return prompt({
        kind: "choose-battlefield",
        rule: "323.11",
        options: [{ id: "battlefieldA", zone: "battlefieldA" }, { id: "battlefieldB", zone: "battlefieldB" }],
        min: 1,
        max: 1,
        data: { reason },
      });
    case "stage_combat":
      return prompt({
        kind: "choose-battlefield",
        rule: "323.12",
        options: [{ id: "battlefieldA", zone: "battlefieldA" }, { id: "battlefieldB", zone: "battlefieldB" }],
        min: 1,
        max: 1,
        data: { reason },
      });
    case "play.choice":
      return prompt({
        kind: "choose-mode",
        rule: "355.3",
        options: [{ id: "mode-a" }, { id: "mode-b" }],
        min: 1,
        max: 1,
        data: { reason, key: "mode", targeted: false, choiceMax: 1 },
      });
    case "play.optional_cost":
      return prompt({
        kind: "yes-no",
        rule: "355.1.a",
        promptKey: "rules.prompt.playOptionalCostEnterReady",
        options: [{ id: "yes" }, { id: "no" }],
        min: 1,
        max: 1,
        data: { reason, optionalCostId: "accelerate", params: { cost: "Accelerate [1][Order]", card: "Azir, Sovereign" } },
      });
    case "play.cost":
      return prompt({
        kind: "choose-cost",
        rule: "357.2",
        options: [{ id: "c1" }, { id: "c2" }],
        min: 1,
        max: 1,
        data: { reason, category: "discard" },
      });
    case "play.trigger":
      return prompt({
        kind: "yes-no",
        rule: "403.1",
        options: [{ id: "yes" }, { id: "no" }],
        min: 1,
        max: 1,
        data: { reason, stage: "may" },
      });
    case "combat.damage_assignment":
      return prompt({
        kind: "damage-assignment",
        rule: "467.2.c",
        options: [{ id: "u1", objectId: "u1" }, { id: "u2", objectId: "u2" }],
        min: 0,
        max: 2,
        data: {
          reason,
          battlefield: "battlefieldA",
          assignerId: "p1",
          total: 3,
          targets: [
            { objectId: "u1", lethal: 2, tier: 1 },
            { objectId: "u2", lethal: null, tier: 2 },
          ],
        },
      });
    case "effects.resume":
      return prompt({
        kind: "yes-no",
        rule: "383.3.a.3",
        options: [{ id: "yes" }, { id: "no" }],
        min: 1,
        max: 1,
        data: { reason, ask: { answer: "boolean" } },
      });
    case "effects.order_triggers":
      return prompt({
        kind: "order",
        rule: "383.3.d",
        options: [{ id: "t1" }, { id: "t2" }],
        min: 0,
        max: 2,
        data: { reason, order: ["t1", "t2"] },
      });
    case "effects.replacement":
      return prompt({
        kind: "choose-mode",
        rule: "372",
        options: [{ id: "replacement-1" }, { id: "$none" }],
        min: 1,
        max: 1,
        data: { reason, queue: [] },
      });
    default:
      throw new Error(`unhandled reason ${reason}`);
  }
}

let room: Room;

beforeAll(() => {
  registerPropertyScripts();
  room = scenario().room;
});

afterAll(() => clearPropertyScripts());

describe("mulberry32 [seeded bot randomness]", () => {
  it("is deterministic per seed and stays in [0, 1)", () => {
    const first = mulberry32(12345);
    const second = mulberry32(12345);
    const other = mulberry32(12346);
    const firstValues = Array.from({ length: 8 }, () => first());
    const secondValues = Array.from({ length: 8 }, () => second());
    const otherValues = Array.from({ length: 8 }, () => other());
    expect(secondValues).toEqual(firstValues);
    expect(otherValues).not.toEqual(firstValues);
    for (const value of firstValues) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe("pickPromptAnswer [411.2]", () => {
  it("answers every PromptKind with an answer the verdict accepts", () => {
    for (const kind of PROMPT_KINDS) {
      const value = kindPrompt(kind);
      const answer = answerFor(value, room);
      expect(answer, `${kind} has no answer`).not.toBeNull();
      expect(promptAnswerVerdict(value, answer!), `${kind} answer rejected`).toEqual({ ok: true });
    }
  });

  it("covers every prompt reason constant the engine registers", () => {
    expect([...new Set(ENGINE_PROMPT_REASONS)].sort()).toEqual([...PROMPT_REASONS].sort());
  });

  it("answers every prompt reason with an answer the verdict accepts", () => {
    for (const reason of PROMPT_REASONS) {
      const value = reasonPrompt(reason);
      const answer = answerFor(value, room);
      expect(answer, `${reason} has no answer`).not.toBeNull();
      expect(promptAnswerVerdict(value, answer!), `${reason} answer rejected`).toEqual({ ok: true });
      if (reason === "combat.damage_assignment") {
        const data = value.data as { targets: Array<{ objectId: string; lethal: number | null; tier: number }>; total: number };
        expect(validateAssignment(data.targets, data.total, answer!.assignments).ok).toBe(true);
      }
      if (reason === "effects.resume") {
        const ask = value.data?.ask as { answer: string };
        expect(ask.answer).toBe("boolean");
      }
    }
  });

  it("[R355.1.a] answers the optional additional cost prompt with yes (Accelerate)", () => {
    const value = reasonPrompt("play.optional_cost");
    const answer = answerFor(value, room, 3);
    expect(answer).toEqual({ optionIds: ["yes"] });
    expect(promptAnswerVerdict(value, answer!)).toEqual({ ok: true });
  });

  it("answers objects decisions: exact counts, known subsets and split shares", () => {
    const exactPrompt = prompt({
      kind: "choose-target",
      options: [{ id: "u1", objectId: "u1" }, { id: "u2", objectId: "u2" }, { id: "u3", objectId: "u3" }],
      min: 2,
      max: 2,
      data: { reason: "effects.resume", ask: { answer: "objects", exact: 2 } },
    });
    const exact = answerFor(exactPrompt, room)!;
    expect(exact.optionIds).toHaveLength(2);
    expect(promptAnswerVerdict(exactPrompt, exact)).toEqual({ ok: true });

    const subsets = [
      ["u1", "u2"],
      ["u3"],
    ];
    const subsetPrompt = prompt({
      kind: "choose-target",
      options: [{ id: "u1", objectId: "u1" }, { id: "u2", objectId: "u2" }, { id: "u3", objectId: "u3" }],
      min: 1,
      max: 2,
      data: { reason: "effects.resume", ask: { answer: "objects", subsets } },
    });
    const subset = answerFor(subsetPrompt, room)!;
    const chosenObjects = (subset.optionIds ?? []).map(
      (id) => subsetPrompt.options!.find((option) => option.id === id)!.objectId!,
    );
    expect(isOneOfSubsets(subsets, chosenObjects)).toBe(true);

    const splitAsk = { answer: "split" as const, total: 5, targets: ["u1", "u2"], minEach: 1 };
    const splitPrompt = prompt({
      kind: "damage-assignment",
      options: [{ id: "u1", objectId: "u1" }, { id: "u2", objectId: "u2" }],
      min: 0,
      max: 2,
      data: { reason: "effects.resume", ask: splitAsk },
    });
    const split = answerFor(splitPrompt, room)!;
    expect(splitAnswerVerdict(splitAsk, split).ok).toBe(true);
  });

  it("prefers applying a replacement over declining all", () => {
    const value = reasonPrompt("effects.replacement");
    for (let seed = 0; seed < 20; seed += 1) {
      const answer = answerFor(value, room, seed);
      expect(answer?.optionIds).toEqual(["replacement-1"]);
    }
  });

  it("returns {} for a legacy prompt with no options and null for a malformed offer", () => {
    const legacy = prompt({ kind: "manual" });
    expect(answerFor(legacy, room)).toEqual({});
    const malformed = prompt({
      kind: "choose-card",
      options: [{ id: "a" }, { id: "b" }],
      min: 3,
      max: 3,
    });
    expect(answerFor(malformed, room)).toBeNull();
  });
});

describe("pickRandomAction [312][411.2][§6.4]", () => {
  it("returns null for a player who does not have the acting window", () => {
    const value = scenario({ seed: 11 });
    expect(whoMayAct(value.room)).toMatchObject({ kind: "priority", player: "p1" });
    expect(pickRandomAction(value.room, "p2", value.host, mulberry32(1))).toBeNull();
    expect(pickRandomAction(value.room, "nobody", value.host, mulberry32(1))).toBeNull();
  });

  it("returns null once the game is over", () => {
    const value = scenario();
    value.room.gameOutcome = { winnerPlayerIds: ["p1"], reason: "score", decidedAtTurnNumber: 1 };
    expect(pickRandomAction(value.room, "p1", value.host, mulberry32(1))).toBeNull();
  });

  it("closes the §6.4 manual window before doing anything else", () => {
    const value = scenario();
    value.room.rules!.manual = { itemId: "item_x", player: "p1", cardName: "Unscripted" };
    value.room.rules!.priority = null;
    expect(pickRandomAction(value.room, "p1", value.host, mulberry32(5))).toEqual({
      type: "rules_manual_done",
    });
  });

  it("ends the turn rather than passing when no progress action is legal", () => {
    const value = scenario();
    // An opening hand may hold a playable card; empty the hand and pools so only the turn
    // action remains (the bot must prefer end-turn over a hypothetical pass).
    const board = value.room.players.find((player) => player.id === "p1")!.board!;
    board.hand = [];
    board.runeArea = [];
    value.room.rules!.pools.p1 = { energy: 0, power: {} };
    const legal = legalIntents(value.room, "p1", value.host);
    expect(legal.canEndTurn).toBe(true);
    expect(legal.playableCardIds).toEqual([]);
    expect(pickRandomAction(value.room, "p1", value.host, mulberry32(3))).toEqual({
      type: "rules_end_turn",
    });
  });

  it("passes only when no progress action or end-turn is legal", () => {
    const value = scenario({ p1: { hand: ["Rebuke"], energy: 1 } });
    value.as("p1").play("Rebuke", { hold: true }).expectOk();
    const legal = legalIntents(value.room, "p1", value.host);
    expect(legal.canPass).toBe(true);
    expect(legal.canEndTurn).toBe(false);
    expect(legal.playableCardIds).toEqual([]);
    expect(legal.activatable).toEqual([]);
    expect(legal.moves).toEqual([]);
    expect(pickRandomAction(value.room, "p1", value.host, mulberry32(4))).toEqual({
      type: "rules_pass",
    });
  });

  it("is deterministic for the same seed and room", () => {
    const value = scenario({ p1: { hand: ["Rebuke", "Gust", "Defy"], energy: 9 } });
    const first = pickRandomAction(value.room, "p1", value.host, mulberry32(99));
    const second = pickRandomAction(value.room, "p1", value.host, mulberry32(99));
    expect(second).toEqual(first);
  });

  it("never returns an intent that applyRulesIntent rejects (seeded property)", () => {
    for (let seed = 1; seed <= 25; seed += 1) {
      const value = buildScenario(seed);
      const random = mulberry32(seed);
      for (let step = 0; step < 80; step += 1) {
        if (value.room.gameOutcome) break;
        const who = whoMayAct(value.room);
        if (who.kind === "none") break;
        const actor = who.player;
        const view = value.room;
        const intent = pickRandomAction(view, actor, value.host, random);
        expect(intent, `seed ${seed} step ${step}: no intent for ${actor}`).not.toBeNull();
        const result = applyRulesIntent(value.room, actor, intent as RulesIntent, value.ctx, value.host);
        expect(
          result.ok,
          `seed ${seed} step ${step}: ${intent!.type} rejected ` +
            (result.ok ? "" : `${result.code} (${result.rule}) ${result.detail ?? ""}`),
        ).toBe(true);
        if (!result.ok) break;
        value.room = result.room;
      }
    }
  }, 20_000);
});
