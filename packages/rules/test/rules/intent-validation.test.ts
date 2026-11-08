import { describe, expect, it } from "vitest";
import fc from "fast-check";
import type { RulesIntent } from "@rift/protocol";
import { applyRulesIntent } from "../../src";
import { scenario } from "../scenarios/dsl";

function applyRaw(s: ReturnType<typeof scenario>, value: unknown) {
  return applyRulesIntent(s.room, "p1", value as RulesIntent, s.ctx, s.host);
}

describe("rules_* wire-shape validation [R349][R403.3][R411.2]", () => {
  it("[R144] a rules_move without unitIds is a Verdict, not a thrown TypeError", () => {
    const s = scenario();
    const before = JSON.stringify(s.room);
    const result = applyRaw(s, { type: "rules_move", to: "base" });
    expect(result).toMatchObject({ ok: false, code: "illegal_action" });
    if (!result.ok) expect(result.rule).toBe("144");
    expect(JSON.stringify(s.room)).toBe(before);
  });

  it("[R144] rules_move with a non-array unitIds or non-string entries is rejected", () => {
    const s = scenario();
    expect(applyRaw(s, { type: "rules_move", unitIds: "unit-1", to: "base" })).toMatchObject({
      ok: false,
      code: "illegal_action",
    });
    expect(applyRaw(s, { type: "rules_move", unitIds: [42], to: "base" })).toMatchObject({
      ok: false,
      code: "illegal_action",
    });
    expect(applyRaw(s, { type: "rules_move", unitIds: [], to: 7 })).toMatchObject({
      ok: false,
      code: "illegal_action",
    });
  });

  it("[R411.2] rules_choose without an answer object is rejected and the prompt stays pending", () => {
    const s = scenario();
    s.room.rules!.prompt = {
      id: "prompt_shape",
      kind: "choose-battlefield",
      playerId: "p1",
      options: [{ id: "battlefieldA", zone: "battlefieldA" }],
    };
    expect(applyRaw(s, { type: "rules_choose", promptId: "prompt_shape" })).toMatchObject({
      ok: false,
      code: "illegal_action",
    });
    expect(applyRaw(s, { type: "rules_choose", promptId: "prompt_shape", answer: 5 })).toMatchObject({
      ok: false,
      code: "illegal_action",
    });
    expect(applyRaw(s, { type: "rules_choose", promptId: "prompt_shape", answer: { optionIds: "x" } })).toMatchObject({
      ok: false,
      code: "illegal_action",
    });
    expect(s.room.rules?.prompt?.id).toBe("prompt_shape");
  });

  it("[R349] rules_play requires a non-empty string cardId", () => {
    const s = scenario();
    expect(applyRaw(s, { type: "rules_play" })).toMatchObject({ ok: false, code: "illegal_action" });
    expect(applyRaw(s, { type: "rules_play", cardId: 42 })).toMatchObject({ ok: false, code: "illegal_action" });
    expect(applyRaw(s, { type: "rules_play", cardId: "" })).toMatchObject({ ok: false, code: "illegal_action" });
  });

  it("[R399] rules_activate requires a non-empty string objectId and a string ability", () => {
    const s = scenario();
    expect(applyRaw(s, { type: "rules_activate" })).toMatchObject({ ok: false, code: "illegal_action" });
    expect(applyRaw(s, { type: "rules_activate", objectId: 7 })).toMatchObject({
      ok: false,
      code: "illegal_action",
    });
    expect(applyRaw(s, { type: "rules_activate", objectId: "x", ability: 1 })).toMatchObject({
      ok: false,
      code: "illegal_action",
    });
  });

  it("[R349] hold must be a boolean when present", () => {
    const s = scenario({ p1: { hand: ["Rebuke"] } });
    const card = s.handCard("p1", "Rebuke")!;
    expect(applyRaw(s, { type: "rules_play", cardId: card.id, hold: "yes" })).toMatchObject({
      ok: false,
      code: "illegal_action",
    });
  });

  it("[R349] unknown intent types and non-object values are Verdicts", () => {
    const s = scenario();
    expect(applyRaw(s, { type: "rules_fly" })).toMatchObject({ ok: false, code: "unknown_intent" });
    for (const value of [null, [], "rules_pass", 1, true]) {
      expect(applyRaw(s, value)).toMatchObject({ ok: false, code: "illegal_action" });
    }
  });

  it("[R315][R335] a strict in-game room without rules is advanced to Main before its first intent is judged", () => {
    const s = scenario();
    delete s.room.rules;
    const result = applyRulesIntent(s.room, "p1", { type: "rules_end_turn" }, s.ctx, s.host);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The first intent was accepted in the Main Phase, and the Ending Step handed the turn on.
    expect(result.room.rules?.turn.player).toBe("p2");
    expect(result.room.rules?.turn.phase).toBe("main");
  });

  it("[R349] arbitrary JSON payloads never throw and always return a Verdict", () => {
    const s = scenario({ p1: { hand: ["Rebuke"] }, p2: { hand: ["Defy"] } });
    fc.assert(
      fc.property(fc.jsonValue(), (value) => {
        let result;
        try {
          result = applyRaw(s, value);
        } catch (error) {
          expect.fail(`applyRulesIntent threw for ${JSON.stringify(value)}: ${(error as Error).message}`);
        }
        expect(typeof result.ok).toBe("boolean");
        if (!result.ok) {
          expect(typeof result.code).toBe("string");
          expect(typeof result.rule).toBe("string");
        }
      }),
      { numRuns: 150 },
    );
  });

  it("[R349] arbitrary structured intent payloads never throw", () => {
    const s = scenario();
    const intents = fc.record(
      {
        type: fc.constantFrom(
          "rules_play",
          "rules_activate",
          "rules_move",
          "rules_pass",
          "rules_end_turn",
          "rules_choose",
          "rules_manual_done",
          "rules_unknown",
        ),
        cardId: fc.oneof(fc.string(), fc.integer(), fc.constant(null)),
        objectId: fc.oneof(fc.string(), fc.integer(), fc.constant(undefined)),
        ability: fc.oneof(fc.string(), fc.integer(), fc.constant(undefined)),
        unitIds: fc.oneof(fc.array(fc.string()), fc.string(), fc.constant(undefined)),
        to: fc.oneof(fc.string(), fc.integer(), fc.constant(undefined)),
        promptId: fc.oneof(fc.string(), fc.integer(), fc.constant(undefined)),
        answer: fc.oneof(fc.record({ optionIds: fc.array(fc.string()) }), fc.integer(), fc.constant(undefined)),
        hold: fc.oneof(fc.boolean(), fc.string(), fc.constant(undefined)),
        location: fc.oneof(fc.string(), fc.integer(), fc.constant(undefined)),
      },
      { requiredKeys: ["type"] },
    );
    fc.assert(
      fc.property(intents, (value) => {
        expect(() => applyRaw(s, value)).not.toThrow();
      }),
      { numRuns: 100 },
    );
  });
});
