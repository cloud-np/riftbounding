/**
 * Reinforce (OGN-062, Spiritforged errata) — "Look at the top 5 cards of your Main Deck. You may
 * banish a unit from among them, then play it, reducing its cost by [5]. Recycle the remaining
 * cards."
 *
 * Look (425) → pick up to one unit among them (355.18; zero is the "may") → banish it (428) → pay
 * its printed cost minus [5] Energy, Power unchanged (`ogn-oz:pay-printed-cost`, see The Harrowing)
 * and play it (420.3) → recycle the rest (417). Partial: the "[5] less" is applied to the printed
 * Energy cost only; other cost modifiers of the played unit (356.3/356.4 passives, optional
 * additional costs such as Accelerate) are not part of that total cost.
 */
import { playPickedUnit } from "./the-harrowing";
import { custom, not, registerCardScript } from "../sdk";

registerCardScript({
  name: "Reinforce",
  text: "Look at the top 5 cards of your Main Deck. You may banish a unit from among them, then play it, reducing its cost by [5]. Recycle the remaining cards.",
  status: "partial",
  notes:
    "The played unit's total cost is its printed cost minus [5]; other cost modifiers and optional additional costs (356) are not applied to that effect play.",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "look",
        amount: 5,
        then: {
          op: "seq",
          effects: [
            {
              op: "choose",
              key: "reinforcement",
              selector: {
                cardType: "unit",
                zone: "deck",
                owner: "self",
                where: { kind: "in-ref", ref: "looked" },
              },
              min: 0,
              max: 1,
            },
            { op: "banish", target: { targetRef: "reinforcement" } },
            playPickedUnit("reinforcement", { energyReduction: 5 }),
            {
              op: "recycle",
              target: {
                targetRef: "looked",
                where: not({ kind: "in-ref", ref: "reinforcement" }),
              },
            },
          ],
        },
      },
    },
  ],
});
