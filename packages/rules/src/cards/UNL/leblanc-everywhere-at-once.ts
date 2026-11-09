/** LeBlanc, Everywhere at Once. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "LeBlanc, Everywhere at Once",
  text: "[Backline] (I must be assigned combat damage last.)\nYour [Temporary] effects at battlefields don't trigger.",
  status: "partial",
  notes:
    "'Your [Temporary] effects at battlefields don't trigger' is not automated: the engine has no way to stop a keyword trigger (Temporary, 816) from triggering (383.2, 054.1). The catalog's [Temporary] on this card is reminder text (suppressed).",
  abilities: [{ kind: "suppress-printed-keyword", keyword: "Temporary" }],
});
