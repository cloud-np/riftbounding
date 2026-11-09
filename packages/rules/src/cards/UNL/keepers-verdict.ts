/**
 * Keeper's Verdict (UNL-204) — [Action]. "Choose an enemy unit at a battlefield. Its owner places
 * it on the top or bottom of their Main Deck." The owner decides on resolution (`unl:owner-top-or-
 * bottom`); leaving the board drops its rules state (705).
 */
import { aUnit, registerCardScript } from "../sdk";

registerCardScript({
  name: "Keeper's Verdict",
  text: "[Action] (Play on your turn or in showdowns.)\nChoose an enemy unit at a battlefield. Its owner places it on the top or bottom of their Main Deck",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "for_each",
        selector: aUnit({ controller: "opponent", zone: "battlefield" }),
        effect: { op: "custom", id: "unl:owner-top-or-bottom" },
      },
    },
  ],
});
