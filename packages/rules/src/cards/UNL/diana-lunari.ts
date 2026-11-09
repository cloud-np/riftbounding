/** Diana, Lunari. */
import { HERE, registerCardScript } from "../sdk";

registerCardScript({
  name: "Diana, Lunari",
  text: "Card Errata Text - From Vendetta Card Errata:\nWhen a showdown begins here, you may pay [1] to [Predict], then reveal the top card of your Main Deck. If it's a spell, draw it. (To Predict, look at the top card of your Main Deck. You may recycle it.)",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "showdown_begin", zone: HERE } },
      effect: {
        op: "cost_then",
        optional: true,
        cost: { energy: 1 },
        effect: {
          op: "seq",
          effects: [
            { op: "predict", amount: 1 },
            { op: "custom", id: "unl:reveal-top-draw-spell" },
          ],
        },
      },
    },
  ],
});
