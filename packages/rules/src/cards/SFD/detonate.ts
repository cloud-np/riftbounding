/** Detonate. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Detonate",
  text: "Kill a gear. Its controller draws 2.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          { op: "kill", target: { chosen: true, cardType: "gear", targetRef: "target:0" } },
          // 359.3.e.13: "its controller" is read through last-known information after the kill.
          { op: "draw", amount: 2, player: { kind: "controller", of: { targetRef: "target:0" } } },
        ],
      },
    },
  ],
});
