/**
 * Ahri, Confident (RAD-SP1) — "[Disarm] When you reduce the Might of an enemy unit here by 1 or
 * more, give me +1 [Might] this turn." Reductions are `might` events whose responsible player is
 * you (412.4) with a negative amount (Disarm's own trigger included).
 */
import { custom, HERE, registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Ahri, Confident",
  text: "[Disarm]\nWhen you reduce the Might of an enemy unit here by 1 or more, give me +1[Might] this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: {
          type: "might",
          player: "self",
          subject: { cardType: "unit", controller: "opponent", zone: HERE },
          condition: custom("rad:event-amount", { op: "lte", value: -1 }),
        },
      },
      effect: { op: "temporary_might", amount: 1, target: SELF },
    },
  ],
});
