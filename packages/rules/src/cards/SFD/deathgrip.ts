/** Deathgrip (SFD-163 (Spiritforged errata) — EX[113] (359.3.e.14.b): "if you do" references the kill.) */
import { aUnit, registerCardScript } from "../sdk";

registerCardScript({
  name: "Deathgrip",
  text: "[Reaction] (Play any time, even before spells and abilities resolve.)\nKill a friendly unit. If you do, give +[Might] equal to its Might to another friendly unit this turn.\nDraw 1.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          { op: "kill", target: aUnit({ controller: "self", targetRef: "target:0" }) },
          {
            op: "if",
            condition: { kind: "did" },
            then: {
              op: "temporary_might",
              amount: { kind: "might", selector: { targetRef: "target:0" } },
              target: aUnit({
                controller: "self",
                targetRef: "target:1",
                excludeRefs: ["target:0"],
              }),
            },
          },
          { op: "draw", amount: 1 },
        ],
      },
    },
  ],
});
