/** Garen, Commander (OGS-013) — "Other friendly units have +1 [Might] here." (365.1 passive; "here" = my location) */
import { HERE, registerCardScript } from "../sdk";

registerCardScript({
  name: "Garen, Commander",
  text: "Other friendly units have +1 [Might] here.",
  status: "implemented",
  abilities: [
    {
      kind: "passive",
      modifier: {
        kind: "might",
        amount: 1,
        target: { cardType: "unit", controller: "self", excludeSource: true, zone: HERE },
      },
    },
  ],
});
