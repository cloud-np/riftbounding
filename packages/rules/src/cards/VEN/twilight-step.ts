/** Twilight Step. */
import { aUnit, registerCardScript } from "../sdk";

registerCardScript({
  name: "Twilight Step",
  text: "Move a unit with 3 [Might] or less.\n[Flow][4][Chaos] (You may play this from your trash for its Flow cost. Then banish it.)",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "move",
        target: aUnit({ might: { op: "lte", value: 3 } }),
        to: { kind: "chosen", ref: "destination" },
      },
    },
  ],
});
