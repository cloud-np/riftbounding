/**
 * Isolate (UNL-124) — "Move an enemy unit from a battlefield to its base. Then, if there's an
 * enemy unit alone at that battlefield, draw 1." (421 move; 740.2.a alone; "that battlefield" is
 * the chosen unit's battlefield, 359.3.f.)
 */
import { aUnit, custom, registerCardScript } from "../sdk";

registerCardScript({
  name: "Isolate",
  text: "Move an enemy unit from a battlefield to its base. Then, if there's an enemy unit alone at that battlefield, draw 1.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "move",
            target: aUnit({ controller: "opponent", zone: "battlefield", targetRef: "target:0" }),
            to: "base",
          },
          {
            op: "if",
            condition: custom("unl:enemy-alone-at-chosen", { ref: "target:0" }),
            then: { op: "draw", amount: 1 },
          },
        ],
      },
    },
  ],
});
