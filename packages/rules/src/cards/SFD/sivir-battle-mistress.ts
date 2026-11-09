/** Sivir, Battle Mistress. */
import { custom, registerCardScript, SELF } from "../sdk";
import { gold } from "./custom";

registerCardScript({
  name: "Sivir, Battle Mistress",
  text: "When you recycle a rune, you may exhaust me to play a Gold gear token exhausted.\nWhen one or more enemy units die, ready me.",
  status: "partial",
  notes:
    '"When one or more enemy units die" triggers once per dying unit (simultaneous deaths are not batched into one trigger event, 383.1).',
  abilities: [
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: {
          type: "recycle",
          player: "self",
          condition: custom("sfd:event-card-type", { type: "rune" }),
        },
      },
      effect: { op: "cost_then", optional: true, cost: { exhaust: SELF }, effect: gold() },
    },
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: { type: "die", subject: { cardType: "unit", controller: "opponent" } },
      },
      effect: { op: "ready", target: SELF },
    },
  ],
});
