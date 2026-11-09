/** Command: Attack. */
import type { Condition } from "@rift/protocol";
import { custom, registerCardScript } from "../sdk";
import { drawCard, zoneRef } from "./custom";

/**
 * Command: Attack (RAD-033) — "Choose one — • Move a friendly gear with [Deploy] to a battlefield.
 * • Look at the top 5 cards of your Main Deck. You may reveal a gear from among them and draw it.
 * Recycle the rest."
 */
const LOOKED: Condition = { kind: "in-ref", ref: "looked" };

registerCardScript({
  name: "Command: Attack",
  text: "Choose one —\n• Move a friendly gear with [Deploy] to a battlefield.\n• Look at the top 5 cards of your Main Deck. You may reveal a gear from among them and draw it. Recycle the rest.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "choose_mode",
        modes: [
          {
            id: "move",
            label: "Move a friendly gear with [Deploy] to a battlefield",
            effect: {
              op: "seq",
              effects: [
                {
                  op: "requires",
                  condition: custom("rad:zone-is-battlefield", { ref: "destination" }),
                  rule: "355.4",
                  effect: {
                    op: "move",
                    target: {
                      chosen: true,
                      cardType: "gear",
                      controller: "self",
                      keyword: "Deploy",
                    },
                    to: zoneRef("destination"),
                  },
                },
              ],
            },
          },
          {
            id: "look",
            label: "Look at the top 5 cards; draw a gear",
            effect: {
              op: "look",
              amount: 5,
              then: {
                op: "seq",
                effects: [
                  {
                    op: "choose",
                    key: "picked",
                    selector: { zone: "deck", controller: "self", cardType: "gear", where: LOOKED },
                    min: 0,
                    max: 1,
                  },
                  { op: "reveal", target: { targetRef: "picked" } },
                  drawCard("picked"),
                  {
                    op: "recycle",
                    target: {
                      zone: "deck",
                      controller: "self",
                      where: LOOKED,
                      excludeRefs: ["picked"],
                    },
                  },
                ],
              },
            },
          },
        ],
      },
    },
  ],
});
