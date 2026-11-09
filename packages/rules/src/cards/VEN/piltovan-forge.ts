/** Piltovan Forge. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Piltovan Forge",
  text: "While you control this battlefield, the first friendly gear activated ability played each turn costs [1] less.",
  status: "partial",
  notes:
    "The one-shot discount is consumed on the next card play, not on an activated ability (layers/costs.ts `consumeOnceCostEffects`), and battlefield control is only a presence proxy (190); no modifier is registered.",
  abilities: [],
});
