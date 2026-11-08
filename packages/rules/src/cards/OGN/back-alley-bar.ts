/** Back-Alley Bar (OGN-277, battlefield) — "When a unit moves from here, give it +1 [Might] this turn." */
import { registerCardScript } from "../registry";
import { EVENT_SUBJECT, WHEN_A_UNIT_MOVES_FROM_HERE } from "../dsl";

registerCardScript({
  name: "Back-Alley Bar",
  text: "When a unit moves from here, give it +1 [Might] this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_A_UNIT_MOVES_FROM_HERE,
      effect: { op: "temporary_might", amount: 1, target: EVENT_SUBJECT },
    },
  ],
});
