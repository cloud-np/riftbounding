/**
 * The Waters' Wage (RAD-100) — "[Hidden] Play a Gold gear token exhausted. If it's your turn and
 * you played this from face down, play three ready Gold gear tokens instead." (811.6, 184.1)
 */
import { custom, notIntrinsic, registerCardScript, token } from "../sdk";

registerCardScript({
  name: "The Waters' Wage",
  text: '[Hidden] (Hide now for [Rune] to react with later for [0].)\nPlay a Gold gear token exhausted. If it\'s your turn and you played this from face down, play three ready Gold gear tokens instead. (Gold tokens have "[Reaction] Kill this, [Tap]: [Add] [Rune].")',
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "if",
        condition: {
          kind: "and",
          conditions: [{ kind: "is-turn-player" }, custom("rad:played-from-facedown")],
        },
        then: { op: "create", token: token("Gold", { count: 3, exhausted: false, play: true }) },
        else: { op: "create", token: token("Gold", { exhausted: true, play: true }) },
      },
    },
    ...notIntrinsic("Reaction", "Add"),
  ],
});
