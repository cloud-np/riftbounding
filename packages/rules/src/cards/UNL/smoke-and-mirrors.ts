/** Smoke and Mirrors. */
import { aUnit, custom, registerCardScript } from "../sdk";

registerCardScript({
  name: "Smoke and Mirrors",
  text: "[Hidden] (Hide now for [Rune] to react with later for [0].)\n[Action] (Play on your turn or in showdowns.)\nChoose a unit you control and another unit you control at a different location. If at least one of them has [Temporary], move each to the other's location. Draw 1.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "if",
            condition: {
              kind: "or",
              conditions: [
                { kind: "has-keyword", selector: { targetRef: "target:0" }, keyword: "Temporary" },
                { kind: "has-keyword", selector: { targetRef: "target:1" }, keyword: "Temporary" },
              ],
            },
            then: {
              op: "swap",
              a: aUnit({ controller: "self", targetRef: "target:0" }),
              b: aUnit({
                controller: "self",
                targetRef: "target:1",
                excludeRefs: ["target:0"],
                where: custom("unl:at-different-location", { ref: "target:0" }),
              }),
              property: "zone",
            },
          },
          { op: "draw", amount: 1 },
        ],
      },
    },
  ],
});
