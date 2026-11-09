/** One-Two Punch (RAD-121) — "[Buff] a friendly unit and [Stun] an enemy unit." (427, 424) */
import { aUnit, registerCardScript } from "../sdk";

registerCardScript({
  name: "One-Two Punch",
  text: "[Action] (Play on your turn or in showdowns.)\n[Buff] a friendly unit and [Stun] an enemy unit. (Give the friendly unit a +1 [Might] buff if it doesn't have one. The enemy unit doesn't deal combat damage this turn.)",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          { op: "buff", target: aUnit({ controller: "self" }) },
          { op: "stun", target: aUnit({ controller: "opponent" }) },
        ],
      },
    },
  ],
});
