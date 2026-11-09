/** Irelia, Blade Dancer. */
import { registerCardScript, SELF, WHEN_YOU_CONQUER } from "../sdk";
import { CHOOSE_TRIGGER } from "./custom";

registerCardScript({
  name: "Irelia, Blade Dancer",
  text: "When you choose a friendly unit, you may exhaust me and pay [Rune] to ready it.\nWhen you conquer, you may pay [1] to ready me.",
  status: "partial",
  notes: `${CHOOSE_TRIGGER} The conquer trigger is automated.`,
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_YOU_CONQUER,
      effect: {
        op: "cost_then",
        optional: true,
        cost: { energy: 1 },
        effect: { op: "ready", target: SELF },
      },
    },
  ],
});
