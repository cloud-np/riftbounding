/** The Empyrean (RAD-060) — [Show Off] a card; if you did, Predict its Power cost, then draw 2. */
import { registerCardScript, SHOWED_OFF, showOff, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "The Empyrean",
  text: "[Show Off] a card. (As you play me, you may reveal a card from your hand or pick another friendly one.)\nWhen you play me, if you showed off a card, [Predict] equal to its Power cost, then draw 2. (Look at that many cards from your Main Deck. Recycle any of them and put the rest back in any order.)",
  status: "implemented",
  abilities: [
    showOff({}),
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      condition: SHOWED_OFF,
      effect: {
        op: "seq",
        effects: [
          { op: "predict", amount: { kind: "shown-off", property: "power-cost" } },
          { op: "draw", amount: 2 },
        ],
      },
    },
  ],
});
