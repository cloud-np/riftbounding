/** Pyke, Bloodharbor Ripper. */
import { aUnit, registerCardScript, SELF, token } from "../sdk";

registerCardScript({
  name: "Pyke, Bloodharbor Ripper",
  text: '[1], [Tap]: Return a friendly unit at a battlefield to its owner\'s hand. Play a Gold gear token exhausted. (It has "[Reaction] Kill this, [Tap]: [Add] [Rune].")',
  status: "implemented",
  abilities: [
    { kind: "suppress-printed-keyword", keyword: "Reaction" },
    { kind: "suppress-printed-keyword", keyword: "Add" },
    {
      kind: "activated",
      cost: { energy: 1, exhaust: SELF },
      effect: {
        op: "seq",
        effects: [
          { op: "return_to_hand", target: aUnit({ controller: "self", zone: "battlefield" }) },
          { op: "create", token: token("Gold", { exhausted: true, play: true }) },
        ],
      },
    },
  ],
});
