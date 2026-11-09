/**
 * Lane C (R4-engine) — 718.3 / 719.1: an attached card's Effect Text is appended to its Top-Most
 * card, so its replacement abilities stay active (`replacements/interceptor.ts` must not skip
 * attached cards). (File name: the harness blocks rm/mv; the lead may rename this file to
 * `attached-replacements.test.ts`.)
 */
import { describe, expect, it } from "vitest";
import { getCardScript } from "../../../../src";
import { boardOf, place, run, zoneOf } from "../../effects/helpers";
import { withCards as unlCards } from "../../../cards/unl/helpers";
import { registerTestCardScript } from "../../../../src/testing";

describe("attached replacement sources [R718.3][R719.1]", () => {
  it("[R718.3][R719.1] a replacement ability of an attached card applies", () => {
    const original = getCardScript("Doran's Blade");
    registerTestCardScript({
      name: "Doran's Blade",
      text: "test: If a friendly unit would die, recall it instead.",
      status: "implemented",
      abilities: [
        {
          kind: "replacement",
          matches: { type: "kill", subject: { cardType: "unit", controller: "self" } },
          replace: { op: "recall", target: { targetRef: "event" } },
        },
      ],
    });
    try {
      const s = unlCards(["Doran's Blade"]);
      const unit = place(s, "p1", "Treasure Hunter", "base");
      const gear = place(s, "p1", "Doran's Blade", "base");
      run(s, {
        op: "attach",
        gear: { targetRef: `obj:${gear.id}` },
        to: { targetRef: `obj:${unit.id}` },
      });
      const attached = boardOf(s, "p1").base.find((card) => card.id === gear.id);
      expect(attached?.attachedToCardId).toBe(unit.id);
      run(s, { op: "kill", target: { targetRef: `obj:${unit.id}` } });
      expect(zoneOf(s, unit.id)).toBe("base");
    } finally {
      if (original) registerTestCardScript(original);
    }
  });
});
