/** Bandle Scouts' Academy (RAD-157) — "When you hide a card here, play a Gold gear token exhausted." (422, 811.1.b) */
import { HERE, notIntrinsic, registerCardScript, token } from "../sdk";

registerCardScript({
  name: "Bandle Scouts' Academy",
  text: 'When you hide a card here, play a Gold gear token exhausted. (It has "[Reaction] Kill this, [Tap]: [Add] [Rune].")',
  status: "implemented",
  abilities: [
    ...notIntrinsic("Reaction", "Add"),
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "hide", zone: HERE, player: "self" } },
      effect: { op: "create", token: token("Gold", { exhausted: true, play: true }) },
    },
  ],
});
