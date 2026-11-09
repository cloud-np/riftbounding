/** Gust (OGN-169) — "[REACTION] Return a unit at a battlefield with 3 [Might] or less to its owner's hand." */
import { registerCardScript } from "../registry";
import { aUnit } from "../dsl";

registerCardScript({
  name: "Gust",
  text: "[REACTION] Return a unit at a battlefield with 3 [Might] or less to its owner's hand.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: { op: "return_to_hand", target: aUnit({ zone: "battlefield", might: { op: "lte", value: 3 } }) },
    },
  ],
});
