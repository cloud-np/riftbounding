/** Questionable Tome. */
import { empower, registerCardScript, SELF, SELF_EMPOWERED } from "../sdk";
import { DISEMPOWER_COST_GAP } from "./custom";

registerCardScript({
  name: "Questionable Tome",
  text: "[Empower] - [Tap] (Pay the cost: Empower me. Use only if not Empowered.)\nDisempower this, [1], [Tap]: Draw 1.",
  status: "partial",
  notes: DISEMPOWER_COST_GAP,
  abilities: [
    empower({ exhaust: SELF }),
    {
      kind: "activated",
      cost: { energy: 1, exhaust: SELF },
      effect: {
        op: "requires",
        condition: SELF_EMPOWERED,
        rule: "357.2",
        effect: {
          op: "seq",
          effects: [
            { op: "disempower", target: SELF },
            { op: "draw", amount: 1 },
          ],
        },
      },
    },
  ],
});
