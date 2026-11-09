/** Trifarian War Camp (OGN-294, battlefield) — "Units here have +1 [Might]." (365.1 passive; "here" = this battlefield, 053.3) */
import { registerCardScript } from "../registry";
import { HERE } from "../dsl";

registerCardScript({
  name: "Trifarian War Camp",
  text: "Units here have +1 [Might]. (This includes attackers.)",
  status: "implemented",
  abilities: [
    {
      kind: "passive",
      modifier: { kind: "might", amount: 1, target: { cardType: "unit", zone: HERE } },
    },
  ],
});
