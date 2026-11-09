/** Ocean Drake. */
import { aUnit, custom, not, registerCardScript, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Ocean Drake",
  text: "You may play me to an open battlefield.\nWhen you play me, you may return a non-Dragon unit to its owner's hand.",
  status: "partial",
  notes:
    "'You may play me to an open battlefield' (355.2 Location) is not automated; the return effect is.",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      optional: true,
      effect: {
        op: "return_to_hand",
        target: aUnit({ where: not(custom("ven:has-tag", { tag: "Dragon" })) }),
      },
    },
  ],
});
