/**
 * Darius, Executioner (OGN-243) — "[LEGION] - When you play me, ready me. Other friendly units have
 * +1 [Might] here." Legion (812.1.c) is checked when the play event happens (383.2.a.1).
 */
import type { Condition } from "@rift/protocol";
import { HERE, legionActive, registerCardScript, registerCustomCondition, SELF, WHEN_PLAYED } from "../sdk";

export const LEGION: Condition = { kind: "custom", id: "core:legion" };

registerCardScript({
  name: "Darius, Executioner",
  text: "[LEGION] - When you play me, ready me. (Get the effect if you've played another card this turn)\n\nOther friendly units have +1 [Might] here.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      condition: LEGION,
      keywords: ["Legion"],
      effect: { op: "ready", target: SELF },
    },
    {
      kind: "passive",
      modifier: {
        kind: "might",
        amount: 1,
        target: { cardType: "unit", controller: "self", excludeSource: true, zone: HERE },
      },
    },
  ],
});
