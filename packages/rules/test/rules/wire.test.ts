import { describe, expect, it } from "vitest";
import { validateRulesIntent, WIRE_VALIDATORS } from "../../src";

describe("per-intent wire validators [R349][R399][R144][R411.2]", () => {
  it("[R349] registers one validator for every rules_* intent type", () => {
    expect(Object.keys(WIRE_VALIDATORS).sort()).toEqual([
      "rules_activate",
      "rules_choose",
      "rules_concede",
      "rules_end_turn",
      "rules_manual_done",
      "rules_move",
      "rules_pass",
      "rules_play",
      "rules_set_auto_pass",
    ]);
  });

  it("[R349] rules_play delegates cardId/choices/payment/location checks", () => {
    expect(validateRulesIntent({ type: "rules_play", cardId: "card-1" })).toEqual({
      ok: true,
      intent: { type: "rules_play", cardId: "card-1" },
    });
    expect(WIRE_VALIDATORS.rules_play({ cardId: "card-1", choices: {}, payment: {} })).toBeNull();
    for (const value of [
      { choices: 1 },
      { payment: [] },
      { location: 5 },
    ]) {
      expect(WIRE_VALIDATORS.rules_play({ cardId: "card-1", ...value })).toMatchObject({
        ok: false,
        code: "illegal_action",
      });
    }
    expect(validateRulesIntent({ type: "rules_play", cardId: "" })).toMatchObject({
      ok: false,
      code: "illegal_action",
      rule: "349",
      detail: "cardId must be a non-empty string",
    });
  });

  it("[R399] rules_activate delegates objectId/ability/choices/payment checks", () => {
    expect(validateRulesIntent({ type: "rules_activate", objectId: "obj-1" }).ok).toBe(true);
    expect(WIRE_VALIDATORS.rules_activate({ objectId: "obj-1", ability: "activated:0" })).toBeNull();
    expect(validateRulesIntent({ type: "rules_activate", objectId: "obj-1", ability: 1 })).toMatchObject({
      ok: false,
      code: "illegal_action",
      rule: "399",
      detail: "ability must be a string",
    });
    expect(validateRulesIntent({ type: "rules_activate", objectId: "" })).toMatchObject({
      ok: false,
      detail: "objectId must be a non-empty string",
    });
  });

  it("[R144][R449.2] rules_move delegates unitIds/to checks", () => {
    expect(validateRulesIntent({ type: "rules_move", unitIds: ["u1"], to: "base" }).ok).toBe(true);
    expect(WIRE_VALIDATORS.rules_move({ unitIds: [], to: "battlefieldA" })).toBeNull();
    expect(validateRulesIntent({ type: "rules_move", unitIds: "u1", to: "base" })).toMatchObject({
      ok: false,
      rule: "144",
      detail: "unitIds must be an array of strings",
    });
    expect(validateRulesIntent({ type: "rules_move", unitIds: [], to: "" })).toMatchObject({
      ok: false,
      rule: "449.2",
      detail: "to must be a non-empty string",
    });
  });

  it("[R411.2] rules_choose delegates promptId/answer field checks", () => {
    expect(validateRulesIntent({ type: "rules_choose", promptId: "p1", answer: { optionIds: ["a"] } }).ok).toBe(
      true,
    );
    expect(WIRE_VALIDATORS.rules_choose({ promptId: "p1", answer: {} })).toBeNull();
    expect(validateRulesIntent({ type: "rules_choose", promptId: "", answer: {} })).toMatchObject({
      ok: false,
      rule: "411.2",
      detail: "promptId must be a non-empty string",
    });
    expect(validateRulesIntent({ type: "rules_choose", promptId: "p1", answer: { order: [1] } })).toMatchObject({
      ok: false,
      detail: "answer.order must be an array of strings",
    });
    expect(validateRulesIntent({ type: "rules_choose", promptId: "p1", answer: { number: "x" } })).toMatchObject({
      ok: false,
      detail: "answer.number must be a number",
    });
  });

  it("payload-free intents accept any extra fields (the dispatcher only knows their types)", () => {
    expect(WIRE_VALIDATORS.rules_pass({})).toBeNull();
    expect(WIRE_VALIDATORS.rules_end_turn({})).toBeNull();
    expect(WIRE_VALIDATORS.rules_manual_done({})).toBeNull();
    expect(validateRulesIntent({ type: "rules_pass", ignored: true }).ok).toBe(true);
  });

  it("[R349] shared checks stay in the dispatcher (object, known type, hold boolean)", () => {
    for (const value of [null, [], "rules_play", 1, true]) {
      expect(validateRulesIntent(value)).toMatchObject({ ok: false, code: "illegal_action", rule: "contract:§3" });
    }
    expect(validateRulesIntent({ type: "rules_fly" })).toMatchObject({
      ok: false,
      code: "unknown_intent",
      rule: "contract:§5",
    });
    expect(validateRulesIntent({ type: "rules_play", cardId: "c", hold: "yes" })).toMatchObject({
      ok: false,
      code: "illegal_action",
      rule: "349",
      detail: "hold must be a boolean",
    });
    expect(validateRulesIntent({ type: "rules_choose", promptId: "p", answer: {}, hold: 1 })).toMatchObject({
      ok: false,
      rule: "411.2",
    });
  });
});
