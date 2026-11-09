/**
 * Decree of Strength (VEN-085) — "Choose an opponent. They reveal their hand and you choose a Mind
 * card from it. They recycle that card."
 *
 * The opponent is chosen on play (355.7; `look` with amount 0 only carries that choice); 425
 * reveal; the card is picked on resolution (355.18) and recycled by its owner (417).
 */
import { custom, registerCardScript } from "../sdk";

const OPPONENT = { kind: "chosen" as const, ref: "opponent" };

registerCardScript({
  name: "Decree of Strength",
  text: "Choose an opponent. They reveal their hand and you choose a Mind ([Mind]) card from it. They recycle that card.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          { op: "look", amount: 0, player: OPPONENT },
          { op: "reveal", target: { zone: "hand", controller: OPPONENT } },
          {
            op: "choose",
            key: "picked",
            selector: {
              zone: "hand",
              controller: OPPONENT,
              where: custom("ven:has-domain", { domain: "Mind" }),
            },
            min: 1,
            max: 1,
            label: "Choose a Mind card",
          },
          { op: "recycle", target: { targetRef: "picked" } },
        ],
      },
    },
  ],
});
