/** Temptation. */
import { registerCardScript } from "../sdk";
import { target } from "./custom";

registerCardScript({
  name: "Temptation",
  text: "[Repeat][2] (You may pay the additional cost to repeat this spell's effect.)\nMove an enemy unit to a location where there's a unit with the same controller.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "for_each",
            selector: target({ controller: "opponent", targetRef: "target:0" }),
            effect: { op: "custom", id: "sfd:move-to-ally-location", params: { ref: "target:0" } },
          },
        ],
      },
    },
  ],
});
