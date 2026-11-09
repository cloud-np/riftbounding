/**
 * Albus Ferros (OGN-230) — "When you play me, spend any number of buffs. For each buff spent,
 * channel 1 rune exhausted." Buffs are chosen when spent (742.1) from units you control
 * (702.2.b.2); 431.2.a exhausted.
 */
import { registerCardScript, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Albus Ferros",
  text: "When you play me, spend any number of buffs.\nFor each buff spent, channel 1 rune exhausted.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: {
        op: "seq",
        effects: [
          {
            op: "choose",
            key: "spent",
            selector: { cardType: "unit", controller: "self", buffed: true },
            min: 0,
            max: 99,
          },
          { op: "spend_buff", target: { targetRef: "spent" } },
          {
            op: "channel",
            amount: { kind: "count", selector: { targetRef: "spent" } },
            exhausted: true,
          },
        ],
      },
    },
  ],
});
