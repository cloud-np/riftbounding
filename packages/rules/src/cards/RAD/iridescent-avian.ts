/** Iridescent Avian (RAD-027) — "[Tap]: [Buff] a unit. If it's already buffed, give it +2 [Might] this turn instead." */
import { aUnit, notIntrinsic, registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Iridescent Avian",
  text: "[Tap]: [Buff] a unit. If it's already buffed, give it +2[Might] this turn instead. (To buff a unit, give it a +1[Might] buff if it doesn't have one.)",
  status: "implemented",
  abilities: [
    ...notIntrinsic("Buff"),
    {
      kind: "activated",
      cost: { exhaust: SELF },
      effect: {
        op: "if",
        condition: { kind: "exists", selector: { targetRef: "target:0", buffed: true } },
        then: { op: "temporary_might", amount: 2, target: aUnit({ targetRef: "target:0" }) },
        else: { op: "buff", target: aUnit({ targetRef: "target:0" }) },
      },
    },
  ],
});
