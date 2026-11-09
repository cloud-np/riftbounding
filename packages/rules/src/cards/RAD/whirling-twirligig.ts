/**
 * Whirling Twirligig (RAD-022) — "[Tap]: Play a Gold gear token exhausted. / Kill a friendly gear,
 * [Tap]: Play a 1 [Might] Recruit unit token. / Kill a friendly unit, [Tap]: Play a 3 [Might] Mech
 * unit token." (357.2: the kill cost chooses among candidates)
 */
import { notIntrinsic, registerCardScript, SELF, token } from "../sdk";

registerCardScript({
  name: "Whirling Twirligig",
  text: '[Tap]: Play a Gold gear token exhausted. (It has "[Reaction] Kill this, [Tap]: [Add] [Rune].")\nKill a friendly gear, [Tap]: Play a 1 [Might] Recruit unit token.\nKill a friendly unit, [Tap]: Play a 3 [Might] Mech unit token.',
  status: "implemented",
  abilities: [
    ...notIntrinsic("Reaction", "Add"),
    {
      kind: "activated",
      cost: { exhaust: SELF },
      effect: { op: "create", token: token("Gold", { exhausted: true, play: true }) },
    },
    {
      kind: "activated",
      cost: { exhaust: SELF, kill: { cardType: "gear", controller: "self" } },
      effect: { op: "create", token: token("Recruit", { might: 1, play: true }) },
    },
    {
      kind: "activated",
      cost: { exhaust: SELF, kill: { cardType: "unit", controller: "self" } },
      effect: { op: "create", token: token("Mech", { might: 3, play: true }) },
    },
  ],
});
