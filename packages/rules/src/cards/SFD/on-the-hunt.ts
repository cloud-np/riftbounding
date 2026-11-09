/** On the Hunt. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "On the Hunt",
  text: "Ready your units.",
  status: "implemented",
  abilities: [
    { kind: "spell", effect: { op: "ready", target: { cardType: "unit", controller: "self" } } },
  ],
});
