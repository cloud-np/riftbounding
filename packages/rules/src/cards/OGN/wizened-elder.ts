/** Wizened Elder (OGN-065) — "While I'm buffed, I have an additional +1 [Might]." (364.3.a conditional passive, 703) */
import { registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Wizened Elder",
  text: "While I'm buffed, I have an additional +1 [Might].",
  status: "implemented",
  abilities: [
    {
      kind: "passive",
      modifier: {
        kind: "while",
        condition: { kind: "self-state", state: "buffed" },
        modifier: { kind: "might", amount: 1, target: SELF },
      },
    },
  ],
});
