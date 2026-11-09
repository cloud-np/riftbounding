/** Morgana, Vindictive. */
import { aUnit, notIntrinsic, registerCardScript, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Morgana, Vindictive",
  text: "[Ambush] (You may play me as a [Reaction] to a battlefield where you have units.)\nWhen you play me, deal damage to a unit equal to the damage marked on it.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      // 418 / 142: the amount is the damage marked on the chosen unit when this resolves.
      effect: {
        op: "deal",
        amount: { kind: "damage", selector: { targetRef: "target:0" } },
        target: aUnit({ targetRef: "target:0" }),
      },
    },
    ...notIntrinsic("Reaction"),
  ],
});
