/**
 * Void Assault (UNL-202) — "Move a friendly unit, then move an enemy unit." Each move has its own
 * destination chosen on play (355.4); the cleanup after the moves stages the combat (455).
 */
import { registerCardScript } from "../registry";
import { aUnit } from "../dsl";

registerCardScript({
  name: "Void Assault",
  text: "Move a friendly unit, then move an enemy unit. (If they both move to a battlefield you don't control, you're the attacker.)",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "move",
            target: aUnit({ controller: "self", targetRef: "target:0" }),
            to: { kind: "chosen", ref: "destination" },
          },
          {
            op: "move",
            target: aUnit({ controller: "opponent", targetRef: "target:1" }),
            to: { kind: "chosen", ref: "destination:1" },
          },
        ],
      },
    },
  ],
});
