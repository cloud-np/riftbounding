/** Renekton, Rage Fueled. */
import { HERE, registerCardScript, runesControlled, WHEN_I_ATTACK } from "../sdk";

registerCardScript({
  name: "Renekton, Rage Fueled",
  text: "[Accelerate] (You may pay [1][Fury] as an additional cost to have me enter ready.)\nWhen I attack, if you control 4 or fewer runes, deal 2 to all enemy units here.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_ATTACK,
      condition: runesControlled("lte", 4),
      effect: {
        op: "deal",
        amount: 2,
        target: { cardType: "unit", controller: "opponent", zone: HERE },
      },
    },
  ],
});
