/** Stalwart Goatherd (RAD-083) — "[Shield 2] When you play me, you may kill a gear with Energy cost [4] or less." */
import { registerCardScript, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Stalwart Goatherd",
  text: "[Shield 2] (+2 [Might] while I'm a defender.)\nWhen you play me, you may kill a gear with Energy cost [4] or less.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: {
        op: "may",
        effect: {
          op: "kill",
          target: { chosen: true, cardType: "gear", energyCost: { op: "lte", value: 4 } },
        },
      },
    },
  ],
});
