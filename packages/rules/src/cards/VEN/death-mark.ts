/** Death Mark. */
import { notIntrinsic, registerCardScript, token } from "../sdk";

registerCardScript({
  name: "Death Mark",
  text: '[Burn 3]. (Put the top 3 cards of your Main Deck into your trash.)\nPlay a 0 [Might] Shadow Clone unit token. (It has "When I attack, you may banish a unit from your trash. If you do, give me [Assault 4] this turn.")\n[Flow][1][Rune][Rune] (You may play this from your trash for its Flow cost. Then banish it.)',
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          { op: "burn", amount: 3, target: {} },
          { op: "create", token: token("Shadow Clone", { might: 0, play: true }) },
        ],
      },
    },
    ...notIntrinsic("Assault"),
  ],
});
