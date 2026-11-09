/** Twilight Reveler. */
import { aUnit, registerCardScript, WHEN_I_ATTACK } from "../sdk";

registerCardScript({
  name: "Twilight Reveler",
  text: "When I attack, ready another friendly unit.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_ATTACK,
      effect: { op: "ready", target: aUnit({ controller: "self", excludeSource: true }) },
    },
  ],
});
