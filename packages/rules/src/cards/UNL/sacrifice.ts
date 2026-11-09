/** Sacrifice. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Sacrifice",
  text: "[Reaction] (Play any time, even before spells and abilities resolve.)\nAs an additional cost to play this, kill a friendly [Mighty] unit. (A unit is Mighty while it has 5+[Might].)\nDraw 2 and channel 1 rune exhausted.",
  status: "partial",
  notes:
    "The kill cost is offered for any friendly unit: cost-object selectors (play/cost-objects.ts) do not filter by [Mighty] (Might 5+), so a non-Mighty unit can be killed to pay it (356.2.a.1, 357.2, 706).",
  // "kill a friendly [Mighty] unit" is not understood by the text parser (356.2.a.1).
  additionalCosts: [
    {
      id: "mandatory:0",
      optional: false,
      cost: { kill: { cardType: "unit", controller: "self", mighty: true } },
      rule: "356.2.a.1",
      label: "kill a friendly Mighty unit",
    },
  ],
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          { op: "draw", amount: 2 },
          { op: "channel", amount: 1, exhausted: true },
        ],
      },
    },
  ],
});
