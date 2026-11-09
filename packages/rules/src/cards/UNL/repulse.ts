/** Repulse. */
import { aUnit, custom, registerCardScript } from "../sdk";

registerCardScript({
  name: "Repulse",
  text: "[Reaction] (Play any time, even before spells and abilities resolve.)\nChoose a friendly unit at a battlefield. Counter an enemy spell or ability that chooses it and no other friendly unit.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "for_each",
            selector: aUnit({ targetRef: "target:0", zone: "battlefield", controller: "self" }),
            effect: {
              op: "counter",
              target: {
                chosen: true,
                targetRef: "target:1",
                zone: "chain",
                controller: "opponent",
                where: custom("unl:item-chooses-only", { ref: "target:0" }),
              },
            },
          },
        ],
      },
    },
  ],
});
