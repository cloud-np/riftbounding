/** Royal Entourage. */
import { registerCardScript, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Royal Entourage",
  text: "When you play me, ready or exhaust a legend.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: {
        op: "choose_mode",
        modes: [
          {
            id: "ready",
            label: "Ready a legend",
            effect: {
              op: "ready",
              target: { chosen: true, cardType: "legend", targetRef: "target:0" },
            },
          },
          {
            id: "exhaust",
            label: "Exhaust a legend",
            effect: {
              op: "exhaust",
              target: { chosen: true, cardType: "legend", targetRef: "target:1" },
            },
          },
        ],
      },
    },
  ],
});
