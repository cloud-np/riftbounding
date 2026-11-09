/** Blood Rose. */
import { aUnit, registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Blood Rose",
  text: "When you play a unit, you may pay [1] to gain 1 XP.\nSpend 3 XP, [tap] : Ready a unit.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "unit_played", player: "self" } },
      effect: {
        op: "cost_then",
        optional: true,
        cost: { energy: 1 },
        effect: { op: "gain_xp", amount: 1 },
      },
    },
    {
      kind: "activated",
      cost: { spendXp: 3, exhaust: SELF },
      effect: { op: "ready", target: aUnit() },
    },
  ],
});
