/** Called Shot. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Called Shot",
  text: "[ACTION] (Play on your turn or in showdowns.)\n[REPEAT] [CHAOS] (You may pay the additional cost to repeat this spell's effect.)\nLook at the top 2 cards of your Main Deck. Draw one and recycle the other.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "look",
        amount: 2,
        then: {
          op: "seq",
          effects: [
            {
              op: "choose",
              key: "drawn",
              selector: { zone: "deck", where: { kind: "in-ref", ref: "looked" } },
              min: 1,
              max: 1,
            },
            { op: "custom", id: "core:draw-ref", params: { ref: "drawn" } },
            {
              op: "recycle",
              target: {
                zone: "deck",
                where: {
                  kind: "and",
                  conditions: [
                    { kind: "in-ref", ref: "looked" },
                    { kind: "not", condition: { kind: "in-ref", ref: "drawn" } },
                  ],
                },
              },
            },
          ],
        },
      },
    },
  ],
});
