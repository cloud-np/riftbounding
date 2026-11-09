/** Forbidding Waste. */
import { custom, HERE, registerCardScript } from "../sdk";

registerCardScript({
  name: "Forbidding Waste",
  text: "While a unit here is defending alone, it has -2 [Might] . (It's alone if there are no other friendly units here.)",
  status: "implemented",
  abilities: [
    {
      kind: "passive",
      modifier: {
        kind: "might",
        amount: -2,
        target: { cardType: "unit", zone: HERE, where: custom("unl:defending-alone") },
      },
    },
  ],
});
