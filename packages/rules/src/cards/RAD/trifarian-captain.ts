/** Trifarian Captain. */
import type { Condition } from "@rift/protocol";
import { custom, registerCardScript, WHEN_PLAYED } from "../sdk";
import { drawCard } from "./custom";

/**
 * Trifarian Captain (RAD-129) — "When you play me, look at the top 4 cards of your Main Deck. You
 * may reveal from among them a unit or gear with Energy cost no more than [3] and with Power cost
 * no more than [Rune] and draw it. Recycle the rest."
 */
const LOOKED: Condition = { kind: "in-ref", ref: "looked" };

registerCardScript({
  name: "Trifarian Captain",
  text: "When you play me, look at the top 4 cards of your Main Deck. You may reveal from among them a unit or gear with Energy cost no more than [3] and with Power cost no more than [Rune] and draw it. Recycle the rest.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: {
        op: "look",
        amount: 4,
        then: {
          op: "seq",
          effects: [
            {
              op: "choose",
              key: "picked",
              selector: {
                zone: "deck",
                controller: "self",
                energyCost: { op: "lte", value: 3 },
                powerCost: { op: "lte", value: 1 },
                where: { kind: "and", conditions: [LOOKED, custom("rad:unit-or-gear")] },
              },
              min: 0,
              max: 1,
            },
            { op: "reveal", target: { targetRef: "picked" } },
            drawCard("picked"),
            {
              op: "recycle",
              target: { zone: "deck", controller: "self", where: LOOKED, excludeRefs: ["picked"] },
            },
          ],
        },
      },
    },
  ],
});
