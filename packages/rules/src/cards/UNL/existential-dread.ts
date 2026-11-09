/** Existential Dread. */
import type { Effect } from "@rift/protocol";
import { aUnit, custom, registerCardScript } from "../sdk";

/** "[Stun] an attacking unit. If it's already stunned, return it to its owner's hand instead." */
function dread(key = "target:0"): Effect {
  return {
    op: "if",
    condition: { kind: "exists", selector: { targetRef: key, stunned: true } },
    then: { op: "return_to_hand", target: { targetRef: key } },
    else: {
      op: "stun",
      target: aUnit({ targetRef: key, where: custom("core:attacking") }),
    },
  };
}

registerCardScript({
  name: "Existential Dread",
  text: "[Action] (Play on your turn or in showdowns.)\n[Repeat][2] (You may pay the additional cost to repeat this spell's effect.)\n[Stun] an attacking unit. If it's already stunned, return it to its owner's hand instead. (A stunned unit doesn't deal combat damage this turn.)",
  status: "implemented",
  abilities: [{ kind: "spell", effect: dread() }],
});
