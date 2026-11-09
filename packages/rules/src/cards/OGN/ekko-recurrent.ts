/**
 * Ekko, Recurrent (OGN-110) — "[ACCELERATE] [DEATHKNELL] - Recycle me to ready your runes."
 *
 * "Recycle me to ready your runes" is a cost within the instruction (740.4.a) in the first part of
 * the trigger, so 740.4.a.2 pays it on finalization (405.2: or the trigger is removed). `Cost` has
 * no "recycle this from the trash" component (`recycle:self` is a rune's Rune Area cost), so the
 * decision is the trigger's "may" (403.1) and the recycle is done on resolution; the runes are
 * readied only if Ekko was recycled.
 */
import { registerCardScript } from "../registry";
import { SELF, WHEN_I_DIE, custom } from "../dsl";

registerCardScript({
  name: "Ekko, Recurrent",
  text: "[ACCELERATE] (You may pay [1] [Mind] as an additional cost to have me enter ready.)\n[DEATHKNELL] - Recycle me to ready your runes. (When I die, get the effect.)",
  status: "partial",
  notes:
    "The recycle-me cost is paid on resolution instead of when the trigger finalizes (740.4.a.2): Cost has no recycle-from-trash component.",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_DIE,
      keywords: ["Deathknell"],
      optional: true,
      effect: {
        op: "seq",
        effects: [
          { op: "recycle", target: SELF },
          {
            op: "if",
            condition: { kind: "did" },
            then: { op: "ready", target: { cardType: "rune", controller: "self" } },
          },
        ],
      },
    },
  ],
});
