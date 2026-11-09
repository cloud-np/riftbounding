/** Undercover Agent (OGN-178 — EX[206] (423.4): [Deathknell] (808)) */
import { registerCardScript, WHEN_I_DIE } from "../sdk";

registerCardScript({
  name: "Undercover Agent",
  text: "[DEATHKNELL] - Discard 2, then draw 2. (When I die, get the effect.)",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_DIE,
      keywords: ["Deathknell"],
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
