/** Sky Cruiser. */
import { aUnit, registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Sky Cruiser",
  text: "Discard a gear, [1], [Tap]: Deal 4 to a unit at a battlefield.",
  status: "partial",
  notes:
    "The discard cost is paid with any card: `Cost.discard` has no card-type filter (423.1.a), so 'a gear' is not enforced.",
  abilities: [
    {
      kind: "activated",
      cost: { discard: 1, energy: 1, exhaust: SELF },
      effect: { op: "deal", amount: 4, target: aUnit({ zone: "battlefield" }) },
    },
  ],
});
