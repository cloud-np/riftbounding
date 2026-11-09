/** Svellsongur. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Svellsongur",
  text: "[Equip][1][Calm]  ([1][Calm]: Attach this to a unit you control.)\nAs this is attached to a unit, copy that unit's text to this Equipment's effect text for as long as this is attached to it.",
  status: "manual",
  notes: `"Copy that unit's text to this Equipment's effect text": copying text (446) is not implemented, and copied effect text would also need effect-text abilities of attached cards (718.3).`,
  abilities: [],
});
