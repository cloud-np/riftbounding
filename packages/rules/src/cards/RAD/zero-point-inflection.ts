/**
 * Zero Point Inflection (RAD-069) — "When you play a card, draw 2. When you draw 1 or more cards
 * with 9 or more other cards in your hand, discard your hand, kill this, and choose an opponent.
 * They score 1 point." (420.4.a; tokens are not cards, 185)
 */
import { custom, registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Zero Point Inflection",
  text: "When you play a card, draw 2.\nWhen you draw 1 or more cards with 9 or more other cards in your hand, discard your hand, kill this, and choose an opponent. They score 1 point.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: { type: "played", player: "self", condition: custom("rad:event-not-token") },
      },
      effect: { op: "draw", amount: 2 },
    },
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: {
          type: "draw",
          player: "self",
          condition: custom("rad:other-cards-in-hand-gte", { n: 9 }),
        },
      },
      effect: {
        op: "seq",
        effects: [
          { op: "discard", amount: { kind: "cards-in-hand" } },
          { op: "kill", target: SELF },
          { op: "score_points", amount: 1, player: { kind: "chosen", ref: "opponent" } },
        ],
      },
    },
  ],
});
