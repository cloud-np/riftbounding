/**
 * Riven, Deserter (RAD-114) — "When another friendly unit becomes exhausted, give me +1 [Might]
 * this turn. Exhaust a friendly unit: Ready a unit. Use this ability only once each turn."
 */
import { aUnit, registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Riven, Deserter",
  text: "When another friendly unit becomes exhausted, give me +1 [might] this turn.\nExhaust a friendly unit: Ready a unit. Use this ability only once each turn.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: {
          type: "exhaust",
          subject: { cardType: "unit", controller: "self", excludeSource: true },
        },
      },
      effect: { op: "temporary_might", amount: 1, target: SELF },
    },
    {
      kind: "activated",
      cost: { exhaust: { cardType: "unit", controller: "self" } },
      limit: { kind: "once-per-turn" },
      effect: { op: "ready", target: aUnit() },
    },
  ],
});
