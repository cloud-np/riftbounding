/** Flurry of Feathers. */
import { registerCardScript, token } from "../sdk";
import { A_SPELL } from "./custom";

registerCardScript({
  name: "Flurry of Feathers",
  text: "[Reaction] (Play any time, even before spells and abilities resolve.)\nChoose one —\n• Counter a spell.\n• Play four 1 [Might] Bird unit tokens with [Deflect]. (Opponents must pay [Rune] to choose them with a spell or ability.)",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "choose_mode",
        modes: [
          {
            id: "counter",
            label: "Counter a spell",
            effect: { op: "counter", target: { ...A_SPELL } },
          },
          {
            id: "birds",
            label: "Play four Birds",
            effect: { op: "create", token: token("Bird", { count: 4, might: 1, play: true }) },
          },
        ],
      },
    },
  ],
});
