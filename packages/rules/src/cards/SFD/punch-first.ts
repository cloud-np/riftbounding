/** Punch First. */
import { registerCardScript } from "../sdk";
import { target } from "./custom";

registerCardScript({
  name: "Punch First",
  text: "[ACTION] (Play on your turn or in showdowns.)\nGive a unit +5 [Might] this turn.",
  status: "implemented",
  abilities: [{ kind: "spell", effect: { op: "temporary_might", amount: 5, target: target() } }],
});
