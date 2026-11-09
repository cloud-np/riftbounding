/**
 * Graves, Blasting Through (RAD-085) — "When I attack or defend, deal damage equal to my Might to
 * all enemy units here. I don't deal combat damage." (the second line is read by combat, 424.1.b)
 */
import { HERE, registerCardScript, SELF, WHEN_I_ATTACK_OR_DEFEND } from "../sdk";

registerCardScript({
  name: "Graves, Blasting Through",
  text: "When I attack or defend, deal damage equal to my Might to all enemy units here.\nI don't deal combat damage.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_ATTACK_OR_DEFEND,
      effect: {
        op: "deal",
        amount: { kind: "might", selector: SELF },
        target: { cardType: "unit", controller: "opponent", zone: HERE },
        source: SELF,
      },
    },
  ],
});
