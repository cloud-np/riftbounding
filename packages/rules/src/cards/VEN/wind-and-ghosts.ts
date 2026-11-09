/**
 * Wind and Ghosts (VEN-106) — "[Action] Choose a unit at a battlefield. If it has 3 [Might] or
 * less, banish it. Otherwise, return it to its owner's hand." (359.3.f.2: Might checked on
 * resolution; 428 banish, 056 owner's hand)
 */
import { registerCardScript } from "../registry";
import { aUnit } from "../dsl";

const TARGET = aUnit({ zone: "battlefield", targetRef: "target:0" });

registerCardScript({
  name: "Wind and Ghosts",
  text: "[Action] (Play on your turn or in showdowns.)\nChoose a unit at a battlefield. If it has 3 [Might] or less, banish it. Otherwise, return it to its owner's hand.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "if",
        condition: {
          kind: "exists",
          selector: { targetRef: "target:0", might: { op: "lte", value: 3 } },
        },
        then: { op: "banish", target: TARGET },
        else: { op: "return_to_hand", target: TARGET },
      },
    },
  ],
});
