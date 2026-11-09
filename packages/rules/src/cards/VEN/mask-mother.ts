/** Mask Mother. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Mask Mother",
  text: "When you discard me, you may pay [1] to give a friendly unit +2 [Might] this turn.",
  status: "partial",
  notes:
    "A trigger of a card in a non-board zone is not detected (385/383.1): discarding Mask Mother never queues the ability.",
  abilities: [],
});
