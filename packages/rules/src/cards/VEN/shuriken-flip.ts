/** Shuriken Flip. */
import { aUnit, registerCardScript } from "../sdk";

registerCardScript({
  name: "Shuriken Flip",
  text: "Deal 2 to up to one enemy unit at a battlefield, then move a friendly unit.\n[Flow][3][Rune] (You may play this from your trash for its Flow cost. Then banish it.)",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "deal",
            amount: 2,
            target: aUnit({ controller: "opponent", zone: "battlefield", maxCount: 1 }),
          },
          {
            op: "move",
            target: aUnit({ controller: "self" }),
            to: { kind: "chosen", ref: "destination" },
          },
        ],
      },
    },
  ],
});
