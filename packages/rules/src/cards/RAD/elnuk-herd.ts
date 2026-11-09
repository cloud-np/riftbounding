/** Elnuk Herd (RAD-081, errata) — "[Hidden] When you play me, give a friendly unit +3 [Might] this turn, then recycle me if I was played from face down." */
import { aUnit, registerCardScript, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Elnuk Herd",
  text: "[Hidden] (Hide now for [Rune] to react with later for [0].)\nWhen you play me, give a friendly unit +3 [Might] this turn, then recycle me if I was played from face down.",
  status: "partial",
  notes:
    '"Recycle me if I was played from face down": a unit\'s play effect cannot tell a facedown play (811.6; not recorded on unit_played).',
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: { op: "temporary_might", amount: 3, target: aUnit({ controller: "self" }) },
    },
  ],
});
