/** Ambessa, Matriarch of War. */
import { aUnit, registerCardScript, SELF } from "../sdk";
import { COST_GAP, disempowerAnd, EMPOWER_ELSE } from "./custom";

registerCardScript({
  name: "Ambessa, Matriarch of War",
  text: "When you empower something else, empower me. (I become Empowered if I'm not already.)\nDisempower me, [Rune], [Tap]: Ready a unit.",
  status: "partial",
  notes: COST_GAP,
  abilities: [
    EMPOWER_ELSE,
    {
      kind: "activated",
      cost: { power: { any: 1 }, exhaust: SELF },
      effect: disempowerAnd({ op: "ready", target: aUnit({ targetRef: "target:0" }) }),
    },
  ],
});
