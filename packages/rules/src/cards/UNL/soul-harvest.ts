/** Soul Harvest. */
import { aUnit, registerCardScript } from "../sdk";

registerCardScript({
  name: "Soul Harvest",
  text: "Kill a unit at a battlefield with 3 [Might] or less.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "kill",
        target: aUnit({ zone: "battlefield", might: { op: "lte", value: 3 } }),
      },
    },
  ],
});
