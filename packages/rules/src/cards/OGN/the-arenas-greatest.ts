/**
 * The Arena's Greatest (OGN-290, battlefield) — "At the start of each player's first Beginning
 * Phase, that player gains 1 point."
 *
 * Manual: a battlefield's phase trigger is controlled by the player present there (or the Turn
 * Player when nobody is) and only fires on its controller's turn, so "each player's … that player"
 * cannot be expressed; there is also no "first Beginning Phase of this player" condition.
 */
import { registerCardScript } from "../registry";

registerCardScript({
  name: "The Arena's Greatest",
  text: "At the start of each player's first Beginning Phase, that player gains 1 point.",
  status: "manual",
  notes:
    "Battlefield phase triggers for each player ('that player', 315.2.a.1) and a 'player's first Beginning Phase' condition are not supported.",
  abilities: [],
});
