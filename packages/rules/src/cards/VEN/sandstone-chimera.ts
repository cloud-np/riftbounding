/** Sandstone Chimera. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Sandstone Chimera",
  text: "While I'm at a battlefield, players only channel 1 rune at the start of their Channel Phase.",
  status: "implemented",
  abilities: [
    {
      kind: "replacement",
      matches: {
        type: "channel",
        condition: {
          kind: "and",
          conditions: [
            { kind: "self-state", state: "at-battlefield" },
            { kind: "is-phase", phase: "channel" },
          ],
        },
      },
      replace: { op: "custom", id: "ven:channel-one" },
    },
  ],
});
