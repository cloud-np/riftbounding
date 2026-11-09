/** Arachnoid Horror. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Arachnoid Horror",
  text: "[Hunt 2] (When I conquer or hold, gain 2 XP.)\nI can be played to an occupied battlefield if an enemy unit is alone there.\nFriendly unit can be played to an occupied battlefield if an enemy unit is alone there.",
  status: "partial",
  notes:
    "The play-location permission to an occupied battlefield (355.2.b) cannot be registered by a card script; [Hunt 2] is a printed keyword.",
  abilities: [],
});
