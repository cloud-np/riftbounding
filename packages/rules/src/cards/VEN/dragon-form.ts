/**
 * Dragon Form (VEN-116) — "Choose a unit. Its base Might becomes 5 this turn. [Flow][3]"
 *
 * Modelled as a this-turn Might change of (5 − its current base Might): every other modification
 * still applies on top, as with a trait-altering effect (479). See notes for what differs.
 */
import { registerCardScript } from "../registry";
import { aUnit } from "../dsl";


registerCardScript({
  name: "Dragon Form",
  text: "Choose a unit. Its base Might becomes 5 this turn.\n[Flow][3] (You may play this from your trash for its Flow cost. Then banish it.)",
  status: "partial",
  notes:
    '"Base Might becomes 5" is applied as a this-turn change of (5 − base Might): effects that read base Might, or change it later this turn, do not see the trait-altering value (479 layers, no "becomes" effects).',
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "for_each",
        selector: aUnit({ targetRef: "target:0" }),
        effect: { op: "custom", id: "ven:base-might-becomes", params: { value: 5 } },
      },
    },
  ],
});
