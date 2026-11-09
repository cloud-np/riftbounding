/** The Ruination. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "The Ruination",
  text: "Kill all units.",
  status: "implemented",
  abilities: [{ kind: "spell", effect: { op: "kill", target: { cardType: "unit", all: true } } }],
});
