/** Endless Riches. */
import { registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Endless Riches",
  text: "When you play this, banish your hand and trash, then [Burn 7]\nSkip your draw phase.\nYou may play cards from your trash.\nIf a card would go to your trash from anywhere other than your Main Deck, banish it instead.",
  status: "partial",
  notes:
    "The play trigger is automated. 'Skip your draw phase' is a permanent repeated skip (the skip op is one-shot); 'you may play cards from your trash' is a general play permission the play layer does not grant; and the trash→banish replacement applies to every zone change without an action hook (444/422).",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "gear_played", subject: SELF } },
      effect: {
        op: "seq",
        effects: [
          { op: "custom", id: "ven:banish-hand-and-trash" },
          { op: "burn", amount: 7, target: {} },
        ],
      },
    },
  ],
});
