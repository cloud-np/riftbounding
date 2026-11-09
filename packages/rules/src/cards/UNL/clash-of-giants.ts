/**
 * Clash of Giants (UNL-110) — "Choose two units. They deal damage equal to their Mights to each
 * other." Each chosen unit is the source of its damage (418.6.b.3/.4, as Challenge EX[195]/[196]).
 * Both choices sit in scanned selector fields (`target`, `source`) so they are offered and
 * validated on play (355.7/358.1); each excludes the other ("two units").
 */
import { registerCardScript } from "../registry";
import { aUnit } from "../dsl";

registerCardScript({
  name: "Clash of Giants",
  text: "Choose two units. They deal damage equal to their Mights to each other.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "deal",
            amount: { kind: "might", selector: { targetRef: "target:0" } },
            target: aUnit({ targetRef: "target:1", excludeRefs: ["target:0"] }),
            source: aUnit({ targetRef: "target:0", excludeRefs: ["target:1"] }),
          },
          {
            op: "deal",
            amount: { kind: "might", selector: { targetRef: "target:1" } },
            target: { targetRef: "target:0" },
            source: { targetRef: "target:1" },
          },
        ],
      },
    },
  ],
});
