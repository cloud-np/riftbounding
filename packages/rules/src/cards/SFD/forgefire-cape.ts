/** Forgefire Cape. */
import { registerCardScript, WHEN_I_ATTACK_OR_DEFEND } from "../sdk";
import { HERE_ZONE, mightBonus } from "./custom";

registerCardScript({
  name: "Forgefire Cape",
  text: "[Unique] (Your deck can only have 1 card with this name.)\n[Equip][Rune] ([Rune]: Attach this to a unit you control.)\n\nWhen I attack or defend, deal 2 to all enemy units here.\n+3 [Might]",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_ATTACK_OR_DEFEND,
      effect: {
        op: "deal",
        amount: 2,
        target: { cardType: "unit", controller: "opponent", zone: HERE_ZONE },
      },
    },
    mightBonus(3),
  ],
});
