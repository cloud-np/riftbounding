/**
 * Elnuk Herd (RAD-081, errata) — "[Hidden] When you play me, give a friendly unit +3 [Might] this
 * turn, then recycle me if I was played from face down."
 *
 * 811.6 / 383.4.a: the `unit_played` event carries `data.playedFromFacedown`, read by the
 * `rad:event-played-from-facedown` condition; "recycle me" (417) puts the card on the bottom of
 * its owner's Main Deck after the +3.
 */
import { aUnit, custom, registerCardScript, SELF, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Elnuk Herd",
  text: "[Hidden] (Hide now for [Rune] to react with later for [0].)\nWhen you play me, give a friendly unit +3 [Might] this turn, then recycle me if I was played from face down.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: {
        op: "seq",
        effects: [
          { op: "temporary_might", amount: 3, target: aUnit({ controller: "self" }) },
          {
            op: "if",
            condition: custom("rad:event-played-from-facedown"),
            then: { op: "recycle", target: SELF },
          },
        ],
      },
    },
  ],
});
