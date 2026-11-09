/**
 * Stand United (OGN-053) — "[HIDDEN] [ACTION] Buff a friendly unit. Buffs give an additional +1
 * [Might] to friendly units this turn."
 *
 * [Hidden] (811) is the play layer's. The second sentence is a continuous effect for this turn
 * (391.4 / 475): each friendly unit with a buff (one at most, 702.3) gets +1 more Might; it also
 * covers units buffed later this turn.
 */
import { aUnit, registerCardScript } from "../sdk";

registerCardScript({
  name: "Stand United",
  text: "[HIDDEN] (Hide now for [Rune] to react with later for [0].)\n[ACTION] (Play on your turn or in showdowns.)\nBuff a friendly unit. Buffs give an additional +1 [Might] to friendly units this turn. (To buff a unit, give it a +1 [Might] buff if it doesn't already have one.)",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          { op: "buff", target: aUnit({ controller: "self" }) },
          {
            op: "continuous",
            duration: "this-turn",
            modifier: {
              kind: "might",
              amount: 1,
              target: { cardType: "unit", controller: "self", buffed: true },
            },
          },
        ],
      },
    },
  ],
});
