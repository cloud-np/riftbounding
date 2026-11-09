/** Acceleration Gate. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Acceleration Gate",
  text: "Ready up to 4 units, gear and/or runes.",
  status: "implemented",
  abilities: [
    { kind: "spell", effect: { op: "custom", id: "ven:ready-up-to", params: { count: 4 } } },
  ],
});
