/**
 * Solari Chief (OGN-225) — "When you play me, choose an enemy unit. If it is stunned, kill it.
 * Otherwise, stun it." (424, 429; the stunned check is made on execution, 359.3.f.2)
 */
import { aUnit, registerCardScript, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Solari Chief",
  text: "When you play me, choose an enemy unit. If it is stunned, kill it. Otherwise, stun it. (it doesn't deal combat damage this turn.)",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: {
        op: "if",
        condition: { kind: "exists", selector: { targetRef: "target:0", stunned: true } },
        then: { op: "kill", target: aUnit({ controller: "opponent", targetRef: "target:0" }) },
        else: { op: "stun", target: aUnit({ controller: "opponent", targetRef: "target:0" }) },
      },
    },
  ],
});
