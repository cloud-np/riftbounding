/**
 * Clocktower Guardian (RAD-067) — "When you play me or when I hold, [Predict 3]. [Deathknell]
 * Banish the top card of your Main Deck. You may play it, ignoring its Energy cost."
 */
import { notIntrinsic, registerCardScript, WHEN_I_DIE, WHEN_I_HOLD, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Clocktower Guardian",
  text: "When you play me or when I hold, [Predict 3].\n[Deathknell] Banish the top card of your Main Deck. You may play it, ignoring its Energy cost.",
  status: "partial",
  notes:
    "Deathknell: the top card is banished, but playing it ignoring only its Energy cost (356.1.b) opens the manual window (the play op ignores all or no costs).",
  abilities: [
    ...notIntrinsic("Predict"),
    { kind: "triggered", trigger: WHEN_PLAYED, effect: { op: "predict", amount: 3 } },
    { kind: "triggered", trigger: WHEN_I_HOLD, effect: { op: "predict", amount: 3 } },
    {
      kind: "triggered",
      trigger: WHEN_I_DIE,
      keywords: ["Deathknell"],
      effect: {
        op: "look",
        amount: 1,
        then: {
          op: "seq",
          effects: [
            { op: "banish", target: { targetRef: "looked" } },
            { op: "custom", id: "manual" },
          ],
        },
      },
    },
  ],
});
