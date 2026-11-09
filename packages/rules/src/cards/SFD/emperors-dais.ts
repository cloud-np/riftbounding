/** Emperor's Dais. */
import { registerCardScript, WHEN_YOU_CONQUER_HERE } from "../sdk";
import { HERE_ZONE, sandSoldier } from "./custom";

registerCardScript({
  name: "Emperor's Dais",
  text: "When you conquer here, you may pay [1] and return a unit you control here to its owner's hand to play a 2 [Might] Sand Soldier unit token here.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_YOU_CONQUER_HERE,
      // 740.4.a: both parts of the cost ("pay [1] and return a unit you control here") must be
      // payable; they are paid on resolution, then the Sand Soldier is played.
      condition: {
        kind: "exists",
        selector: { cardType: "unit", controller: "self", zone: HERE_ZONE },
      },
      effect: {
        op: "cost_then",
        optional: true,
        cost: { energy: 1 },
        effect: {
          op: "seq",
          effects: [
            {
              op: "choose",
              key: "returned",
              selector: { cardType: "unit", controller: "self", zone: HERE_ZONE },
              min: 1,
              max: 1,
            },
            { op: "return_to_hand", target: { targetRef: "returned" } },
            { op: "if", condition: { kind: "did" }, then: sandSoldier(HERE_ZONE) },
          ],
        },
      },
    },
  ],
});
