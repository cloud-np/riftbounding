/**
 * Lane C (R4-engine) — 359.3.f.3.a / 391.3 / 375: a delayed replacement refers to the choices of
 * the ability that created it. `effects/ops/delayed.ts` stores them; `replacements/interceptor.ts`
 * must pass them into the `EventMatcher` evaluation.
 */
import { describe, expect, it } from "vitest";
import { getCardScript, registerCardScript } from "../../../../src";
import { fund, place, run, spell, zoneOf } from "../../effects/helpers";
import {
  fund as sfdFund,
  put as sfdPut,
  settle as sfdSettle,
  withCards as sfdCards,
} from "../../../cards/sfd/helpers";
import { withCards as unlCards } from "../../../cards/unl/helpers";
import { withCards as venCards } from "../../../cards/ven-ogs/helpers";

describe("delayed replacements read the creator's choices [R359.3.f.3.a][R391.3]", () => {
  it("[R359.3.f.3.a][R391.3] a delayed replacement's matcher sees the creating ability's chosen object", () => {
    const s = unlCards([]);
    const unit = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    run(
      s,
      {
        op: "replace",
        matches: { type: "kill", subject: { targetRef: "target:0" } },
        replace: { op: "recall", target: { targetRef: "event" } },
      },
      { choices: { "target:0": unit.id } },
    );
    run(s, { op: "kill", target: { targetRef: `obj:${unit.id}` } });
    expect(zoneOf(s, unit.id)).toBe("base");
  });

  it("[R375][R359.3.f.3.a] a delayed prevention replacement's matcher sees the creating ability's chosen object", () => {
    const s = sfdCards(["Hextech Ray"]);
    const unit = sfdPut(s, "p2", "Astral Heron", "battlefieldA");
    run(
      s,
      {
        op: "replace",
        matches: { type: "damage", subject: { targetRef: "target:0" } },
        replace: { prevent: 9999 },
      },
      { choices: { "target:0": unit.id } },
    );
    sfdFund(s, "p1", "Hextech Ray");
    s.as("p1")
      .play("Hextech Ray", { choices: { "target:0": unit.id } })
      .expectOk();
    sfdSettle(s);
    expect(s.room.rules!.objects[unit.id]?.damage ?? 0).toBe(0);
  });

  it("[C:Highlander][R359.3.f.3.a][R391.3] a delayed replacement created by a played spell sees its chosen unit", () => {
    // The card text: "Choose a friendly unit. The next time it dies this turn, heal it, exhaust
    // it, and recall it instead." The heal is required: a recalled unit keeps its marked damage
    // and would be killed again by cleanup 3a (323.4).
    const original = getCardScript("Highlander")!;
    registerCardScript(
      spell("Highlander", {
        op: "for_each",
        selector: { chosen: true, cardType: "unit", controller: "self", targetRef: "target:0" },
        effect: {
          op: "replace",
          matches: { type: "kill", subject: { targetRef: "target:0" } },
          replace: {
            op: "seq",
            effects: [
              { op: "heal", amount: 99, target: { targetRef: "event" } },
              { op: "exhaust", target: { targetRef: "event" } },
              { op: "recall", target: { targetRef: "event" } },
            ],
          },
        },
      }),
    );
    try {
      const s = venCards(["Highlander", "Hextech Ray"]);
      const unit = place(s, "p1", "Treasure Hunter", "battlefieldA");
      fund(s, "p1", "Highlander");
      s.as("p1")
        .play("Highlander", { choices: { "target:0": unit.id } })
        .expectOk();
      s.as("p2").pass().expectOk();
      fund(s, "p1", "Hextech Ray");
      s.as("p1")
        .play("Hextech Ray", { choices: { "target:0": unit.id } })
        .expectOk();
      s.as("p2").pass().expectOk();
      expect(zoneOf(s, unit.id)).toBe("base");
      expect(s.room.rules!.objects[unit.id]?.damage ?? 0).toBe(0);
    } finally {
      registerCardScript(original);
    }
  });
});
