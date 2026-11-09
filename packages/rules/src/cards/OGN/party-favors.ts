/**
 * Party Favors (OGN-071) — "Each other player chooses Cards or Runes. For each player that chooses
 * Cards, you and that player each draw 1. For each player that chooses Runes, you and that player
 * each channel 1 rune exhausted."
 *
 * Registers `ogn:party-favors`. Every other player chooses in Turn Order (decisions made on
 * resolution by other players, 355.18); once all have chosen, each choice is carried out in that
 * order: Cards → the controller and that player each draw 1 (414); Runes → each channels 1 rune
 * exhausted (431.2.a).
 */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Party Favors",
  text: "Each other player chooses Cards or Runes.\nFor each player that chooses Cards, you and that player each draw 1.\nFor each player that chooses Runes, you and that player each channel 1 rune exhausted.",
  status: "implemented",
  abilities: [{ kind: "spell", effect: { op: "custom", id: "ogn:party-favors" } }],
});
