/** Hungry Wolf. */
import { registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Hungry Wolf",
  text: "[Calm]: Ready me and give me +1 [Might] this turn. Use only if you've chosen an enemy unit this turn and only once each turn.",
  status: "partial",
  notes:
    "'Use only if you've chosen an enemy unit this turn' needs a per-turn record of choices that the engine does not keep; the once-per-turn limit and the effect are automated.",
  abilities: [
    {
      kind: "activated",
      cost: { power: { Calm: 1 } },
      limit: { kind: "once-per-turn" },
      effect: {
        op: "seq",
        effects: [
          { op: "ready", target: SELF },
          { op: "temporary_might", amount: 1, target: SELF },
        ],
      },
    },
  ],
});
