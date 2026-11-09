/** Xerath, Freed (UNL-026) — "[Fury], [Tap]: Deal 3 to a unit. Use this ability only while I'm at a battlefield." (377.2.b) */
import { aUnit, registerCardScript, SELF, SELF_AT_BATTLEFIELD } from "../sdk";

registerCardScript({
  name: "Xerath, Freed",
  text: "[Fury], [Tap]: Deal 3 to a unit. Use this ability only while I'm at a battlefield.",
  status: "implemented",
  abilities: [
    {
      kind: "activated",
      cost: { power: { Fury: 1 }, exhaust: SELF },
      effect: {
        op: "requires",
        condition: SELF_AT_BATTLEFIELD,
        effect: { op: "deal", amount: 3, target: aUnit() },
      },
    },
  ],
});
