/** Scrapyard Champion (OGN-020) — "[LEGION] When you play me, discard 2, then draw 2." (812, 423, 414) */
import { LEGION } from "./trifarian-gloryseeker";
import { registerCardScript, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Scrapyard Champion",
  text: "[LEGION] When you play me, discard 2, then draw 2. (Get the effect if you've played another card this turn.)",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      condition: LEGION,
      keywords: ["Legion"],
      effect: {
        op: "seq",
        effects: [
          { op: "discard", amount: 2 },
          { op: "draw", amount: 2 },
        ],
      },
    },
  ],
});
