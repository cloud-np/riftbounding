/** Mystic Reversal — gain control of a spell and make new choices (360, 361). */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Mystic Reversal",
  text: "[Reaction] (Play any time, even before spells and abilities resolve.) Gain control of a spell. You may make new choices for it.",
  status: "manual",
  notes:
    "Not automated: changing the controller of a spell on the Chain and re-choosing its targets (no control-change op for chain items).",
  abilities: [],
});
