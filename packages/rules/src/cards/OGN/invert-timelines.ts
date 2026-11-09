/**
 * Invert Timelines (OGN-201) — "Each player discards their hand, then draws 4."
 * 423.4: each player discards as many as possible (their whole hand, no choice); then every
 * player draws 4 (Turn Order, 303.2.a).
 */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Invert Timelines",
  text: "Each player discards their hand, then draws 4.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          // At least every player's hand size: each player discards their whole hand.
          { op: "discard", player: "each", amount: { kind: "cards-in-hand", player: "all" } },
          { op: "draw", player: "each", amount: 4 },
        ],
      },
    },
  ],
});
