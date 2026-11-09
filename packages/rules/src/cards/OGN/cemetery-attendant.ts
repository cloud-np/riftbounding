/** Cemetery Attendant (OGN-165) — "When you play me, return a unit from your trash to your hand." (355.7, 403.4) */
import { aUnit, registerCardScript, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Cemetery Attendant",
  text: "When you play me, return a unit from your trash to your hand.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: { op: "return_to_hand", target: aUnit({ zone: "trash", owner: "self" }) },
    },
  ],
});
