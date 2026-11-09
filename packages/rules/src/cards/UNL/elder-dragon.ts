/** Elder Dragon. */
import { aUnit, registerCardScript, WHEN_PLAYED } from "../sdk";

const LOCATIONS = ["base", "battlefieldA", "battlefieldB", "battlefieldC"] as const;

registerCardScript({
  name: "Elder Dragon",
  text: "Any amount of your damage is enough to kill enemy units.\nWhen you play me, choose up to one enemy unit at each location. Deal 1 to them.",
  status: "partial",
  notes:
    "'Any amount of your damage is enough to kill enemy units' is not automated: lethal damage is always Might (142.4.b, 418.1) and there is no modifier lowering it; only the play trigger is.",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: {
        op: "seq",
        effects: LOCATIONS.map((zone) => ({
          op: "deal" as const,
          amount: 1,
          target: aUnit({ controller: "opponent", zone, maxCount: 1 }),
        })),
      },
    },
  ],
});
