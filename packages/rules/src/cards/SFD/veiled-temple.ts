/** Veiled Temple. */
import { registerCardScript, WHEN_YOU_CONQUER_HERE } from "../sdk";

registerCardScript({
  name: "Veiled Temple",
  text: "When you conquer here, you may ready a friendly gear. If it's an equipment, you may detach it.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_YOU_CONQUER_HERE,
      effect: {
        op: "may",
        label: "Ready a friendly gear?",
        effect: {
          op: "seq",
          effects: [
            {
              op: "ready",
              target: { chosen: true, cardType: "gear", controller: "self", targetRef: "target:0" },
            },
            {
              op: "if",
              condition: { kind: "exists", selector: { targetRef: "target:0", tag: "Equipment" } },
              then: {
                op: "may",
                label: "Detach it?",
                effect: { op: "detach", target: { targetRef: "target:0" } },
              },
            },
          ],
        },
      },
    },
  ],
});
