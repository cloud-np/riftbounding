/** An Offer You Can't Refuse (RAD-101) — "Kill a gear. Its controller plays a Gold gear token exhausted." */
import { notIntrinsic, registerCardScript, token } from "../sdk";

registerCardScript({
  name: "An Offer You Can't Refuse",
  text: '[Action] (Play on your turn or in showdowns.)\nKill a gear. Its controller plays a Gold gear token exhausted. (Gold has "[Reaction] Kill this, [Tap]: [Add] [Rune].")',
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          { op: "kill", target: { chosen: true, cardType: "gear", targetRef: "target:0" } },
          // 359.3.e.13: "its controller" is read from last-known information after the kill.
          {
            op: "create",
            token: token("Gold", { exhausted: true, play: true }),
            player: { kind: "controller", of: { targetRef: "target:0" } },
          },
        ],
      },
    },
    ...notIntrinsic("Reaction", "Add"),
  ],
});
