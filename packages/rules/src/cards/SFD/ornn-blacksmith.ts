/** Ornn, Blacksmith. */
import type { Ability, Condition } from "@rift/protocol";
import { not, registerCardScript, WHEN_I_HOLD, WHEN_PLAYED } from "../sdk";

const IN_LOOKED: Condition = { kind: "in-ref", ref: "looked" };

registerCardScript({
  name: "Ornn, Blacksmith",
  text: "When you play me or when I hold, look at the top 4 cards of your Main Deck. You may reveal a gear from among them and draw it. Then recycle the rest.",
  status: "implemented",
  abilities: [
    ...[WHEN_PLAYED, WHEN_I_HOLD].map((trigger): Ability => ({
      kind: "triggered",
      trigger,
      effect: {
        op: "look",
        amount: 4,
        then: {
          op: "seq" as const,
          effects: [
            {
              op: "choose" as const,
              key: "found",
              selector: { zone: "deck" as const, cardType: "gear", where: IN_LOOKED },
              min: 0,
              max: 1,
            },
            { op: "reveal" as const, target: { targetRef: "found" } },
            { op: "custom" as const, id: "core:draw-ref", params: { ref: "found" } },
            {
              op: "recycle" as const,
              target: {
                zone: "deck" as const,
                where: {
                  kind: "and" as const,
                  conditions: [IN_LOOKED, not({ kind: "in-ref", ref: "found" })],
                },
              },
            },
          ],
        },
      },
    })),
  ],
});
