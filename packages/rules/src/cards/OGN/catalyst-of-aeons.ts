/**
 * Catalyst of Aeons (OGN-138) — "Channel 2 runes exhausted. If you couldn't channel 2 runes this
 * way, draw 1." (431.2.a, 431.3: as many as possible; the channel op records how many.)
 */
import type { Condition } from "@rift/protocol";
import { registerCardScript } from "../registry";
import { registerCustomCondition } from "../../effects/evaluate";

/** The preceding channel instruction channelled fewer than `n` runes (431.3). */
registerCustomCondition("ogn-an:channelled-fewer-than", (ctx, params) => {
  const n = typeof params.n === "number" ? params.n : 1;
  const channelled = typeof ctx.env.vars.$channelled === "number" ? ctx.env.vars.$channelled : 0;
  return channelled < n;
});

export const CHANNELLED_FEWER_THAN_2: Condition = {
  kind: "custom",
  id: "ogn-an:channelled-fewer-than",
  params: { n: 2 },
};

registerCardScript({
  name: "Catalyst of Aeons",
  text: "Channel 2 runes exhausted. If you couldn't channel 2 runes this way, draw 1.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          { op: "channel", amount: 2, exhausted: true },
          { op: "if", condition: CHANNELLED_FEWER_THAN_2, then: { op: "draw", amount: 1 } },
        ],
      },
    },
  ],
});
