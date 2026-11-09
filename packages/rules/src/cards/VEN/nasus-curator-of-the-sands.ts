/** Nasus, Curator of the Sands. */
import { custom, registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Nasus, Curator of the Sands",
  text: "When you play a unit, gear or activated ability with Energy cost [7] or more, you may exhaust me to ready up to 2 runes.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: {
          type: ["unit_played", "gear_played"],
          player: "self",
          subject: { energyCost: { op: "gte", value: 7 } },
        },
      },
      // 740.4.a.2: the leading cost is paid when the trigger finalizes.
      effect: {
        op: "cost_then",
        optional: true,
        cost: { exhaust: SELF },
        effect: { op: "ready", target: { cardType: "rune", controller: "self", maxCount: 2 } },
      },
    },
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "ability_activated", player: "self" } },
      condition: custom("ven:activated-energy-7"),
      effect: {
        op: "cost_then",
        optional: true,
        cost: { exhaust: SELF },
        effect: { op: "ready", target: { cardType: "rune", controller: "self", maxCount: 2 } },
      },
    },
  ],
});
