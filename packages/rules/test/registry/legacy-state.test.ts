/**
 * Rooms saved before the generic `custom` ids became typed DSL members (F2/G8) still carry the
 * old JSON in `rules.effects` / delayed effects; the layers read it as the typed form.
 */
import { describe, expect, it } from "vitest";
import type { Condition, Modifier } from "@rift/protocol";
import { upgradeLegacyCondition, upgradeLegacyModifier } from "../../src/layers/legacy";

const legacy = (id: string, params?: Record<string, unknown>) => ({ kind: "custom", id, ...(params ? { params } : {}) }) as never;

describe("legacy custom ids in persisted state [F2]", () => {
  it("[R364.3.a] a stored conditional cost-adjust becomes while + cost-adjust", () => {
    const stored: Modifier = legacy("conditional", {
      condition: legacy("self-empowered"),
      modifier: legacy("cost-adjust", { energy: -1, once: true }),
    });
    expect(upgradeLegacyModifier(stored)).toEqual({
      kind: "while",
      condition: { kind: "custom", id: "self-empowered" },
      modifier: { kind: "cost-adjust", energy: -1, once: true },
    });
  });

  it("[R824.1.b.1] stored generic conditions become their typed members", () => {
    const cases: Array<[Condition, Condition]> = [
      [legacy("did"), { kind: "did" }],
      [legacy("self-mighty"), { kind: "self-state", state: "mighty" }],
      [legacy("xp-at-least", { n: 6 }), { kind: "xp-at-least", amount: 6 }],
      [legacy("in-ids", { ids: ["a"] }), { kind: "in-ids", ids: ["a"] }],
      [legacy("event-zone-is", { battlefield: true }), { kind: "event-zone-is", battlefield: true }],
    ];
    for (const [stored, typed] of cases) expect(upgradeLegacyCondition(stored)).toEqual(typed);
  });

  it("leaves typed members and prefixed custom ids untouched", () => {
    const typed: Modifier = { kind: "victory-score", amount: 1 };
    const lane: Modifier = { kind: "custom", id: "rad:link", params: { key: "x" } };
    expect(upgradeLegacyModifier(typed)).toBe(typed);
    expect(upgradeLegacyModifier(lane)).toBe(lane);
  });
});
