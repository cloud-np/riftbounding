/** Masa, Crashing Thunder. */
import { aUnit, PAID_ADDITIONAL, registerCardScript, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Masa, Crashing Thunder",
  text: "You may pay [Order] as an additional cost to play me.\nWhen you play me, if you paid the additional cost, [Stun] an enemy unit at a battlefield. (It doesn't deal combat damage this turn.)",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      condition: PAID_ADDITIONAL,
      effect: { op: "stun", target: aUnit({ controller: "opponent", zone: "battlefield" }) },
    },
  ],
});
