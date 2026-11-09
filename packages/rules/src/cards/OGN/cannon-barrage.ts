/**
 * Cannon Barrage (OGN-127) — "Deal 2 to all enemy units in combat."
 * 740.2.c: a unit is in combat if it occupies the battlefield where combat is ongoing and has a
 * combat designation.
 */
import type { Condition } from "@rift/protocol";
import { registerCardScript } from "../sdk";

export const IN_COMBAT: Condition = { kind: "custom", id: "core:in-combat", params: { ref: "it" } };

registerCardScript({
  name: "Cannon Barrage",
  text: "[Reaction] (Play any time, even before spells and abilities resolve.)\n\nDeal 2 to all enemy units in combat.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "deal",
        amount: 2,
        target: { cardType: "unit", controller: "opponent", where: IN_COMBAT },
      },
    },
  ],
});
