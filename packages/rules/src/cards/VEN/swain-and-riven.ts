/**
 * Swain, Visionary (VEN-065) and Riven, Shattered (VEN-041).
 */
import { WHEN_I_ATTACK, WHEN_I_CONQUER } from "./shared";
import { aUnit, custom, HERE, registerCardScript } from "../sdk";

registerCardScript({
  name: "Swain, Visionary",
  text: "[Vision] (When you play me, look at the top card of your Main Deck. You may recycle it.)\nWhen I conquer, if you've played a non-token unit, a non-token gear, and a spell this turn, you score 1 point.",
  status: "implemented",
  abilities: [
    {
      // Vision (817) is a keyword trigger; 383.2.a.1 the "if" is part of the conquer condition.
      kind: "triggered",
      trigger: WHEN_I_CONQUER,
      condition: custom("ven:played-unit-gear-spell"),
      effect: { op: "score_points", amount: 1 },
    },
  ],
});

registerCardScript({
  name: "Riven, Shattered",
  text: "[Weaponmaster] (When you play me, you may [Equip] one of your Equipment to me for [Rune] less, even if it's already attached.)\nWhen I attack, choose an enemy unit here. Deal 2 to it for each Equipment attached to me.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_ATTACK,
      effect: {
        op: "deal",
        amount: {
          kind: "count",
          selector: { tag: "Equipment", where: custom("ven:attached-to-self") },
          per: 2,
        },
        target: aUnit({ controller: "opponent", zone: HERE }),
      },
    },
  ],
});
