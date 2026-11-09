/** Mel, Soul's Reflection. */
import { aUnit, registerCardScript, SELF } from "../sdk";
import { COST_GAP, disempowerAnd, EMPOWER_ELSE } from "./custom";

registerCardScript({
  name: "Mel, Soul's Reflection",
  text: "When you empower something else, empower me. (I become Empowered if I'm not already.)\nDisempower me, [Tap]: Give a unit at a battlefield -2 [Might] this turn.",
  status: "partial",
  notes: COST_GAP,
  abilities: [
    EMPOWER_ELSE,
    {
      kind: "activated",
      cost: { exhaust: SELF },
      effect: disempowerAnd({
        op: "temporary_might",
        amount: -2,
        target: aUnit({ zone: "battlefield", targetRef: "target:0" }),
      }),
    },
  ],
});
