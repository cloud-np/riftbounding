/**
 * Salvage (OGN-224, Origins errata) — "[Action] You may kill up to one gear. Draw 1."
 *
 * "Up to one" gear is chosen when playing (355.13: zero is allowed, which is the "may"); then draw
 * 1 (414).
 */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Salvage",
  text: "[Action] (Play on your turn or in showdowns.)\nYou may kill up to one gear. Draw 1.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          { op: "kill", target: { chosen: true, cardType: "gear", maxCount: 1 } },
          { op: "draw", amount: 1 },
        ],
      },
    },
  ],
});
