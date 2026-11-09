/**
 * King's Edict (OGN-237) — "Starting with the next player, each other player chooses a unit you
 * don't control that hasn't been chosen for this spell. Kill those units." (picks 355.18; 429)
 */
import { registerCardScript } from "../registry";
import "./acceptable-losses";

registerCardScript({
  name: "King's Edict",
  text: "Starting with the next player, each other player chooses a unit you don't control that hasn't been chosen for this spell. Kill those units.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "custom",
            id: "ogn-an:players-choose",
            params: {
              key: "doomed",
              selector: { cardType: "unit", controller: "opponent" },
              players: "others-from-next",
              distinct: true,
              count: 1,
            },
          },
          { op: "kill", target: { targetRef: "doomed" } },
        ],
      },
    },
  ],
});
