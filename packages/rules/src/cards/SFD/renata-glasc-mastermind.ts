/** Renata Glasc, Mastermind. */
import { registerCardScript, SELF, SELF_AT_BATTLEFIELD } from "../sdk";

registerCardScript({
  name: "Renata Glasc, Mastermind",
  text: "[1][Mind]: Draw 1.\n[4][Mind][Mind][Mind][Mind], [Tap]: Score 1 point.\nUse my abilities only while I'm at a battlefield.",
  status: "implemented",
  abilities: [
    {
      kind: "activated",
      cost: { energy: 1, power: { Mind: 1 } },
      effect: {
        op: "requires",
        condition: SELF_AT_BATTLEFIELD,
        rule: "377.2.b",
        effect: { op: "draw", amount: 1 },
      },
    },
    {
      kind: "activated",
      cost: { energy: 4, power: { Mind: 4 }, exhaust: SELF },
      effect: {
        op: "requires",
        condition: SELF_AT_BATTLEFIELD,
        rule: "377.2.b",
        effect: { op: "score_points", amount: 1 },
      },
    },
  ],
});
