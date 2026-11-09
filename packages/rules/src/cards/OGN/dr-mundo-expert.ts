/** Dr. Mundo, Expert (OGN-109 — EX[191] (417.6)) */
import { registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Dr. Mundo, Expert",
  text: "My Might is increased by the number of cards on your trash.\nAt the start of your Beginning Phase, recycle 3 from your trash.",
  status: "implemented",
  abilities: [
    {
      kind: "passive",
      modifier: { kind: "might", amount: { kind: "cards-in-zone", zone: "trash" }, target: SELF },
    },
    {
      kind: "triggered",
      trigger: { kind: "phase", phase: "beginning" },
      effect: { op: "recycle", target: { all: true }, amount: 3, from: "trash" },
    },
  ],
});
