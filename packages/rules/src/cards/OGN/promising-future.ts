/**
 * Promising Future (OGN-115, Origins errata) — "Each player looks at the top 5 cards of their Main
 * Deck, banishes one of them, then recycles the rest. Starting with the next player, each player
 * plays those cards, ignoring Energy costs. (They must still pay Power costs.)"
 *
 * Manual: it needs private looks and picks for every player (355.18 by other players), and then
 * Limited Plays made by other players (420.3) in Turn Order — the `play` op only plays for the
 * ability's controller, and each played card's own choices are not asked during an effect play.
 */
import { registerCardScript } from "../registry";

registerCardScript({
  name: "Promising Future",
  text: "Each player looks at the top 5 cards of their Main Deck, banishes one of them, then recycles the rest. Starting with the next player, each player plays those cards, ignoring Energy costs. (They must still pay Power costs.)",
  status: "manual",
  notes:
    "Effect-driven plays by other players (420.3, no player parameter on the play op) and per-player private look/banish picks are not supported.",
  abilities: [],
});
