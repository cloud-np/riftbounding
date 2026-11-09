/** Zaun Punk. */
import { PAID_ADDITIONAL, registerCardScript, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Zaun Punk",
  text: "You may kill a friendly gear as an additional cost to play me.\nWhen you play me, if you paid the additional cost, kill a gear.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      condition: PAID_ADDITIONAL,
      effect: { op: "kill", target: { chosen: true, cardType: "gear" } },
    },
  ],
});
