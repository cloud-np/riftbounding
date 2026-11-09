/** Mobilize (OGN-134) — "Channel 1 rune exhausted. If you can't, draw 1." (431.2.a, 431.3) */
import { registerCardScript } from "../registry";
import { custom, not } from "../dsl";

registerCardScript({
  name: "Mobilize",
  text: "Channel 1 rune exhausted. If you can't, draw 1.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          { op: "channel", amount: 1, exhausted: true },
          { op: "if", condition: not({ kind: "did" }), then: { op: "draw", amount: 1 } },
        ],
      },
    },
  ],
});
