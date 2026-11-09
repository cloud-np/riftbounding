/**
 * Resource Extractor (RAD-052) — "[Deploy] At the end of your turn, if you control this
 * battlefield, play a Gold gear token exhausted." (383.2.a.1: the "if" is part of the trigger)
 */
import { custom, notIntrinsic, registerCardScript, token } from "../sdk";

registerCardScript({
  name: "Resource Extractor",
  text: '[Deploy] (Play this only to a battlefield. When an opponent holds here, kill this.)\nAt the end of your turn, if you control this battlefield, play a Gold gear token exhausted. (It has "[Reaction] Kill this, [Tap]: [Add] [Rune].")',
  status: "implemented",
  abilities: [
    ...notIntrinsic("Reaction", "Add"),
    {
      kind: "triggered",
      trigger: { kind: "turn-end" },
      condition: custom("rad:control-here"),
      effect: {
        op: "if",
        condition: custom("rad:control-here"),
        then: { op: "create", token: token("Gold", { exhausted: true, play: true }) },
      },
    },
  ],
});
