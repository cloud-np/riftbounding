/** Piltovan Guidebot (RAD-057) — when you play a card, may set my base Might to its Energy cost. */
import { registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Piltovan Guidebot",
  text: "When you play a card, you may have my base Might become equal to that card's Energy cost this turn.",
  status: "partial",
  notes:
    'Modelled as a this-turn Might change of (Energy cost − base Might); trait-altering "base Might becomes" is not a layer (479).',
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "played", player: "self" } },
      effect: {
        op: "may",
        effect: {
          op: "custom",
          id: "core:base-might-becomes",
          params: { selector: SELF, energyCostOf: { targetRef: "event" } },
        },
      },
    },
  ],
});
