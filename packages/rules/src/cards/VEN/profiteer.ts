/** Profiteer. */
import { registerCardScript, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Profiteer",
  text: "When you play me, you may disempower something you control to empower a legend, unit, or gear.",
  status: "partial",
  notes:
    "'Disempower something you control' is a cost within the instructions (740.4.a.2); the Cost shape has no disempower part, so it is paid on resolution after the may decision. Choices cover board units/gear; a legend can be neither the disempowered object nor the empowerment target (selector zones do not combine the legend zone with board zones).",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: {
        op: "may",
        label: "Disempower something you control to empower a legend, unit, or gear?",
        effect: {
          op: "seq",
          effects: [
            {
              op: "choose",
              key: "source",
              selector: { empowered: true, controller: "self" },
              min: 1,
              max: 1,
              label: "Choose something you control to disempower",
            },
            { op: "disempower", target: { targetRef: "source" } },
            {
              op: "choose",
              key: "target",
              selector: { cardType: "permanent", controller: "self" },
              min: 1,
              max: 1,
              label: "Choose a legend, unit, or gear to empower",
            },
            { op: "empower", target: { targetRef: "target" } },
          ],
        },
      },
    },
  ],
});
