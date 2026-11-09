/** Kinkou Temple. */
import { HERE, registerCardScript } from "../sdk";

registerCardScript({
  name: "Kinkou Temple",
  text: "Units here with [tank] have +1[might].",
  status: "implemented",
  abilities: [
    {
      kind: "passive",
      modifier: {
        kind: "might",
        amount: 1,
        target: { cardType: "unit", keyword: "Tank", zone: HERE },
      },
    },
  ],
});
