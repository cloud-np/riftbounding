/** Bottled Constellation. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Bottled Constellation",
  text: "At the start of your Main Phase, you may kill 3 other friendly units and/or gear to score 1 point.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "phase", phase: "main" },
      // 740.4.a.2 / 383.3.b: "kill … to score" is a leading cost within instructions, paid when
      // the trigger finalizes (405.2: declined or unpayable → removed).
      effect: {
        op: "cost_then",
        optional: true,
        cost: { kill: { controller: "self", excludeSource: true, count: 3 } },
        effect: { op: "score_points", amount: 1 },
      },
    },
  ],
});
