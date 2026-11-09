/** Downwell. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Downwell",
  text: "Return all units and gear to their owners' hands.",
  status: "implemented",
  // One instruction: units and gear return simultaneously (056; attached gear detach, 719.5).
  abilities: [
    { kind: "spell", effect: { op: "return_to_hand", target: { cardType: "permanent" } } },
  ],
});
