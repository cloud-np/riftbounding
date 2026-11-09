import { describe, expect, it } from "vitest";
import { WIRE_VALIDATORS, validateRulesIntent } from "../../../src";

describe("R2-play wire fields [R355][R357][R811.1.b][R204.1.b] (contract §3, F10)", () => {
  it("[R357] a payment plan must be an object of known fields with integer amounts and id lists", () => {
    const ok = { cardId: "c", plan: { poolEnergy: 1, poolPower: { Calm: 1, any: 0 }, exhaustRunes: ["r"], recycleRunes: [], kill: ["u"] } };
    expect(WIRE_VALIDATORS.rules_play(ok)).toBeNull();
    for (const plan of [[], "x", { poolEnergy: -1 }, { poolEnergy: 1.5 }, { poolPower: { Calm: "1" } }, { exhaustRunes: "r" }, { spare: 1 }]) {
      expect(WIRE_VALIDATORS.rules_play({ cardId: "c", plan }), JSON.stringify(plan)).toMatchObject({ ok: false, code: "illegal_action", rule: "357" });
    }
    expect(WIRE_VALIDATORS.rules_activate({ objectId: "o", plan: { discard: [1] } })).toMatchObject({ ok: false, rule: "357" });
  });

  it("[R355] targets/modes/optionalCosts are string arrays and X a non-negative integer", () => {
    expect(WIRE_VALIDATORS.rules_play({ cardId: "c", targets: ["a"], modes: ["m"], optionalCosts: ["accelerate"], x: 2 })).toBeNull();
    expect(WIRE_VALIDATORS.rules_play({ cardId: "c", targets: "a" })).toMatchObject({ ok: false, rule: "355" });
    expect(WIRE_VALIDATORS.rules_play({ cardId: "c", modes: [1] })).toMatchObject({ ok: false, rule: "355" });
    expect(WIRE_VALIDATORS.rules_play({ cardId: "c", optionalCosts: {} })).toMatchObject({ ok: false, rule: "355" });
    expect(WIRE_VALIDATORS.rules_play({ cardId: "c", x: -1 })).toMatchObject({ ok: false, rule: "355" });
    expect(WIRE_VALIDATORS.rules_activate({ objectId: "o", targets: [null] })).toMatchObject({ ok: false, rule: "403.2" });
  });

  it("[R204.1.b][R811.1.b] baseCost is a non-negative integer and hide a boolean", () => {
    expect(WIRE_VALIDATORS.rules_activate({ objectId: "o", baseCost: 1 })).toBeNull();
    expect(WIRE_VALIDATORS.rules_activate({ objectId: "o", baseCost: "1" })).toMatchObject({ ok: false, rule: "204.1.b" });
    expect(WIRE_VALIDATORS.rules_play({ cardId: "c", hide: true, location: "battlefieldA" })).toBeNull();
    expect(WIRE_VALIDATORS.rules_play({ cardId: "c", hide: "yes" })).toMatchObject({ ok: false, rule: "811.1.b" });
  });

  it("[R349] validateRulesIntent never throws for any JSON value in the new fields", () => {
    const values: unknown[] = [null, 0, -3, 1.5, "", "x", true, [], [1, "a"], {}, { a: { b: 1 } }];
    for (const field of ["plan", "targets", "modes", "optionalCosts", "x", "baseCost", "hide"]) {
      for (const value of values) {
        expect(() => validateRulesIntent({ type: "rules_play", cardId: "c", [field]: value })).not.toThrow();
        expect(() => validateRulesIntent({ type: "rules_activate", objectId: "o", [field]: value })).not.toThrow();
      }
    }
  });
});
