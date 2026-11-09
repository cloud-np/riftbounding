/** Death from Below. */
import { aUnit, registerCardScript } from "../sdk";

registerCardScript({
  name: "Death from Below",
  text: "Card Errata Text - From Unleashed Card Errata:\nKill a unit at a battlefield. Then, if it had 3 [Might] or less, do this: You may play this from your trash for [Rune].",
  status: "partial",
  notes:
    "'You may play this from your trash for [Rune]' is not automated: there is no permission to play a spell from the Trash for a stated cost (420.3, 354); only the kill is.",
  abilities: [{ kind: "spell", effect: { op: "kill", target: aUnit({ zone: "battlefield" }) } }],
});
