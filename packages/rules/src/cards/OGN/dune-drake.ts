/**
 * Dune Drake (OGN-131, Origins errata) — "When I attack, give me +2 [Might] this turn if there is
 * a ready enemy unit here." The "if" is not right after the trigger condition, so it is checked on
 * resolution (383.2.a.1 does not apply; 359.3.f.2).
 */
import { registerCardScript } from "../registry";
import { HERE, SELF } from "../dsl";

registerCardScript({
  name: "Dune Drake",
  text: "When I attack, give me +2 [Might] this turn if there is a ready\nenemy unit here.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "attack", subject: SELF } },
      effect: {
        op: "if",
        condition: {
          kind: "exists",
          selector: { cardType: "unit", controller: "opponent", zone: HERE, exhausted: false },
        },
        then: { op: "temporary_might", amount: 2, target: SELF },
      },
    },
  ],
});
