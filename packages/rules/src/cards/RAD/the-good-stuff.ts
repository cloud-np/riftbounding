/** The Good Stuff (RAD-106) — "[Deploy] When you play this, discard 1, then draw 3. When you hold here, return this to its owner's hand." */
import { registerCardScript, SELF, WHEN_PLAYED, WHEN_YOU_HOLD_HERE } from "../sdk";

registerCardScript({
  name: "The Good Stuff",
  text: "[Deploy] (Play this only to a battlefield. When an opponent holds here, kill this.)\nWhen you play this, discard 1, then draw 3.\nWhen you hold here, return this to its owner's hand.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: {
        op: "seq",
        effects: [
          { op: "discard", amount: 1 },
          { op: "draw", amount: 3 },
        ],
      },
    },
    {
      kind: "triggered",
      trigger: WHEN_YOU_HOLD_HERE,
      effect: { op: "return_to_hand", target: SELF },
    },
  ],
});
