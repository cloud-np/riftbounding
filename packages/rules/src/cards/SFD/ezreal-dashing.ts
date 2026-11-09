/** Ezreal, Dashing. */
import { notIntrinsic, registerCardScript, SELF, WHEN_I_ATTACK_OR_DEFEND } from "../sdk";
import { HERE_ZONE, target } from "./custom";

registerCardScript({
  name: "Ezreal, Dashing",
  text: "When I attack or defend, deal damage equal to my Might to an enemy unit here.\nI don't deal combat damage.\n[Mind]: [ACTION] — Move me to your base.",
  status: "partial",
  notes:
    "\"I don't deal combat damage\": no modifier removes a unit's combat damage (467.2.b) other than Stun.",
  abilities: [
    ...notIntrinsic("Action"),
    {
      kind: "triggered",
      trigger: WHEN_I_ATTACK_OR_DEFEND,
      effect: {
        op: "deal",
        amount: { kind: "might", selector: SELF },
        target: target({ controller: "opponent", zone: HERE_ZONE }),
        source: SELF,
      },
    },
    {
      kind: "activated",
      cost: { power: { Mind: 1 } },
      keywords: ["action"],
      effect: { op: "move", target: SELF, to: "base" },
    },
  ],
});
