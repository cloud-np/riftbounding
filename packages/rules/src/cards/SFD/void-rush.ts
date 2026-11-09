/** Void Rush. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Void Rush",
  text: "Reveal the top 2 cards of your Main Deck. You may banish one, then play it, reducing its cost by [2]. Draw any you didn't banish.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "custom",
        id: "sfd:reveal-banish-play",
        params: { reveal: 2, reduce: 2, rest: "draw" },
      },
    },
  ],
});
