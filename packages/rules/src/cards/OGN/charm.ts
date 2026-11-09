/** Charm (OGN-043) — "Move an enemy unit." (421; the destination is chosen on play, 355.4 / 355.4.a) */
import { registerCardScript } from "../registry";
import { aUnit } from "../dsl";

registerCardScript({
  name: "Charm",
  text: "Move an enemy unit.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "move",
        target: aUnit({ controller: "opponent" }),
        to: { kind: "chosen", ref: "destination" },
      },
    },
  ],
});
