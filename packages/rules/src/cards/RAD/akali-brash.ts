/** Akali, Brash (RAD-015) — first move Adds [1][Rune]; second banishes the top card and may play it. */
import { custom, notIntrinsic, registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Akali, Brash",
  text: "The first time I move each turn, [Add] [1] [Rune].\nThe second time I move each turn, banish the top card of your Main Deck. Until your next Ending Phase, you may play that card. (You still pay its costs.)",
  status: "implemented",
  abilities: [
    ...notIntrinsic("Add"),
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: { type: "move", subject: SELF, condition: custom("rad:move-count-lt", { n: 2 }) },
      },
      effect: { op: "custom", id: "rad:akali-move" },
    },
  ],
});
