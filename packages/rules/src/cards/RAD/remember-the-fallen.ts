/**
 * Remember the Fallen (RAD-135) — "Play up to 3 units and/or gear from your trash, each with
 * Energy cost no more than [3] and Power cost no more than [Rune], ignoring their costs."
 */
import { custom, registerCardScript } from "../sdk";

registerCardScript({
  name: "Remember the Fallen",
  text: "Play up to 3 units and/or gear from your trash, each with Energy cost no more than [3] and Power cost no more than [Rune], ignoring their costs.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "choose",
            key: "cards",
            selector: {
              zone: "trash",
              controller: "self",
              where: custom("rad:unit-or-gear"),
              energyCost: { op: "lte", value: 3 },
              powerCost: { op: "lte", value: 1 },
            },
            min: 0,
            max: 3,
          },
          {
            op: "for_each",
            selector: { targetRef: "cards" },
            effect: { op: "play", target: { targetRef: "it" }, cost: "ignored" },
          },
        ],
      },
    },
  ],
});
