/** Gust (OGN-169) — "[REACTION] Return a unit at a battlefield with 3 [Might] or less to its owner's hand." */
import { aUnit, registerCardScript } from "../sdk";

registerCardScript({
  name: "Gust",
  text: "[REACTION] Return a unit at a battlefield with 3 [Might] or less to its owner's hand.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "return_to_hand",
        target: aUnit({ zone: "battlefield", might: { op: "lte", value: 3 } }),
      },
    },
  ],
});
