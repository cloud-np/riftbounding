/** Noxian Demolitionist. */
import { registerCardScript, SELF, WHEN_I_CONQUER } from "../sdk";

registerCardScript({
  name: "Noxian Demolitionist",
  text: "When I conquer, you may kill a gear with Energy cost no more than my Might.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_CONQUER,
      optional: true,
      effect: {
        op: "kill",
        target: {
          chosen: true,
          cardType: "gear",
          energyCost: { op: "lte", value: { kind: "might", selector: SELF } },
        },
      },
    },
  ],
});
