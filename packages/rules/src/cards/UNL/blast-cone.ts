/** Blast Cone. */
import { aUnit, registerCardScript, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Blast Cone",
  text: "When you play this, you may move an enemy unit. When you move an enemy unit, you may exhaust this to [Stun] it. (It doesn't deal combat damage this turn.)",
  status: "partial",
  notes:
    "'When you move an enemy unit, you may exhaust this to [Stun] it' is not automated: a move event records only the moved unit's controller, not who moved it, so 'you move an enemy unit' cannot be told from the enemy's own moves (412.4, 421). The play trigger's optional move is.",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      optional: true,
      effect: {
        op: "move",
        target: aUnit({ controller: "opponent" }),
        to: { kind: "chosen", ref: "destination" },
      },
    },
  ],
});
