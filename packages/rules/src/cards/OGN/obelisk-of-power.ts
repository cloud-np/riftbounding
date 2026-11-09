/**
 * Obelisk of Power (OGN-284, battlefield) — "At the start of each Player's first Beginning Phase,
 * that player channels 1 rune."
 *
 * Manual: a battlefield's phase trigger is controlled by the player present there (or the Turn
 * Player when nobody is) and only fires on its controller's turn, so "each player's … that player"
 * cannot be expressed; there is also no "first Beginning Phase of this player" condition.
 */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Obelisk of Power",
  text: "At the start of each Player's first Beginning Phase, that player channels 1 rune.",
  status: "manual",
  notes:
    "Battlefield phase triggers for each player ('that player', 315.2.a.1) and a 'player's first Beginning Phase' condition are not supported.",
  abilities: [],
});
