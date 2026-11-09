/** Ravenbloom Prefect. */
import { registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Ravenbloom Prefect",
  text: "When an opponent plays a gear, you may banish me to banish it.",
  status: "partial",
  notes:
    "'Banish me' is a cost within the instructions (740.4.a.2) with no Cost part for banish; it is paid on resolution, so declining to banish me still banishes the gear.",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "gear_played", player: "opponent" } },
      effect: {
        op: "may",
        label: "Banish me to banish that gear?",
        effect: {
          op: "seq",
          effects: [
            { op: "banish", target: SELF },
            { op: "banish", target: { targetRef: "event" } },
          ],
        },
      },
    },
  ],
});
