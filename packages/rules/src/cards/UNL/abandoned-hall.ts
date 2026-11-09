/** Abandoned Hall. */
import { aUnit, HERE, registerCardScript } from "../sdk";

registerCardScript({
  name: "Abandoned Hall",
  text: "When a player plays a spell, they may give a unit they control here +1 [Might] this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "spell_resolved" } },
      optional: true,
      effect: {
        op: "temporary_might",
        amount: 1,
        target: aUnit({ controller: "self", zone: HERE }),
      },
    },
  ],
});
