/**
 * Cannon Barrage (OGN-127) — "Deal 2 to all enemy units in combat."
 * 740.2.c: a unit is in combat if it occupies the battlefield where combat is ongoing and has a
 * combat designation.
 */
import type { Condition } from "@rift/protocol";
import { registerCardScript } from "../registry";
import { registerCustomCondition } from "../../effects/evaluate";
import { locationOf } from "../../effects/objects";

/** 740.2.c: `it` is in combat. */
registerCustomCondition("ogn-an:in-combat", (ctx) => {
  const id = ctx.env.it;
  const combat = ctx.room.rules?.combat;
  if (!id || !combat) return false;
  if (locationOf(ctx.room, ctx.host, id) !== combat.battlefield) return false;
  return !!ctx.room.rules?.objects[id]?.designation;
});

export const IN_COMBAT: Condition = { kind: "custom", id: "ogn-an:in-combat" };

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
