/** Bushwhack. */
import { registerCardScript } from "../sdk";
import { gold } from "./custom";

registerCardScript({
  name: "Bushwhack",
  text: "[Hidden] (Hide now for [Rune] to react with later for [0].)\nFriendly units enter ready this turn. Play a Gold gear token exhausted.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "continuous",
            modifier: { kind: "enter-ready", target: { cardType: "unit", controller: "self" } },
            duration: "this-turn",
          },
          gold(),
        ],
      },
    },
  ],
});
