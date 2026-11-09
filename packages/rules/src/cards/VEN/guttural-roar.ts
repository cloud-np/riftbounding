/**
 * Guttural Roar (VEN-072) — "[Action] Give a unit +2 [Might] this turn. If it's [Empowered], give
 * it +4 [Might] this turn instead." (359.3.f.2: checked on resolution)
 */
import { registerCardScript } from "../registry";
import { aUnit } from "../dsl";

const TARGET = aUnit({ targetRef: "target:0" });

registerCardScript({
  name: "Guttural Roar",
  text: "[Action] (Play on your turn or in showdowns.)\nGive a unit +2 [might] this turn. If it's [empowered] , give it +4 [might] this turn instead.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "if",
        condition: { kind: "exists", selector: { targetRef: "target:0", empowered: true } },
        then: { op: "temporary_might", amount: 4, target: TARGET },
        else: { op: "temporary_might", amount: 2, target: TARGET },
      },
    },
  ],
});
