/** Emperor's Divide. */
import { registerCardScript } from "../sdk";
import { target } from "./custom";

registerCardScript({
  name: "Emperor's Divide",
  text: "[Hidden] (Hide now for [Rune] to react with later for [0].)\n[Action] (Play on your turn or in showdowns.)\nMove any number of friendly units at a battlefield to their base.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "move",
        target: target({ controller: "self", zone: "battlefield", maxCount: 99 }),
        to: "base",
      },
    },
  ],
});
