/** Orb of Regret (OGN-090) — "[Tap]: Give a unit -1 [Might] this turn, to a minimum of 1 [Might]." (376; 479.4.b snapshot) */
import { registerCardScript } from "../registry";
import { SELF, aUnit } from "../dsl";

registerCardScript({
  name: "Orb of Regret",
  text: "[Tap]: Give a unit -1 [Might] this turn, to a minimum of 1 [Might].",
  status: "implemented",
  abilities: [
    {
      kind: "activated",
      cost: { exhaust: SELF },
      effect: { op: "give_might", amount: -1, min: 1, target: aUnit() },
    },
  ],
});
