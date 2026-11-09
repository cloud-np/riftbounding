/** Herald of the Emperor (RAD-118) — choose a friendly unit; its base Might becomes 5 this turn. */
import { aUnit, registerCardScript, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Herald of the Emperor",
  text: "When you play me, choose a friendly unit. Its base Might becomes 5 this turn.",
  status: "partial",
  notes:
    'Modelled as a this-turn Might change of (5 − base Might); trait-altering "base Might becomes" is not a layer (479).',
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: {
        op: "for_each",
        selector: aUnit({ controller: "self", targetRef: "target:0" }),
        effect: { op: "custom", id: "core:base-might-becomes", params: { value: 5 } },
      },
    },
  ],
});
