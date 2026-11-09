/**
 * Disposal Order (UNL-103) — [Reaction]. Choose one (355.3): choose up to 3 cards from opponents'
 * trashes (targets, 355.7/355.13), their owners recycle them (417.1.c); or draw 1.
 */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Disposal Order",
  text: "[Reaction] (play any time, even before spells and abilities resolve.)\nChoose one -\n    •Choose up to 3 cards from opponents' trashes.\n     Their owners recycle them.\n    •Draw 1",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "choose_mode",
        modes: [
          {
            id: "recycle",
            label: "Recycle up to 3 cards from opponents' trashes",
            effect: {
              op: "recycle",
              target: { chosen: true, zone: "trash", controller: "opponent", maxCount: 3 },
            },
          },
          { id: "draw", label: "Draw 1", effect: { op: "draw", amount: 1 } },
        ],
      },
    },
  ],
});
