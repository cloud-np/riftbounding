/** Shadows of the Past (VEN-103) — "Return up to 2 units from trashes to their owners' hands." (056; any player's trash) */
import { registerCardScript } from "../registry";

registerCardScript({
  name: "Shadows of the Past",
  text: "Return up to 2 units from trashes to their owners' hands.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "return_to_hand",
        target: { chosen: true, cardType: "unit", zone: "trash", maxCount: 2 },
      },
    },
  ],
});
