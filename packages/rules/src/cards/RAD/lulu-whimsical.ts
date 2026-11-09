/** Lulu, Whimsical (RAD-110) — when I move, may have another unit's base Might become 4 this turn. */
import { aUnit, registerCardScript, WHEN_I_MOVE } from "../sdk";

registerCardScript({
  name: "Lulu, Whimsical",
  text: "When I move, you may have another unit's base Might become 4 this turn.",
  status: "partial",
  notes:
    'Modelled as a this-turn Might change of (4 − base Might); trait-altering "base Might becomes" is not a layer (479).',
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_MOVE,
      effect: {
        op: "may",
        effect: {
          op: "for_each",
          selector: aUnit({ excludeSource: true, targetRef: "target:0" }),
          effect: { op: "custom", id: "core:base-might-becomes", params: { value: 4 } },
        },
      },
    },
  ],
});
