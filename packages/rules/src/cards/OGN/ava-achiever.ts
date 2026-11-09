/** Ava Achiever — when I attack, may pay Mind to play a Hidden card from hand ignoring cost; units enter here (383.4.e, 420). */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Ava Achiever",
  text: "When I attack, you may pay [Mind] to play a card with [Hidden] from your hand, ignoring its cost. If it's a unit, play it here.",
  status: "manual",
  notes:
    "Not automated: playing a chosen card from hand ignoring its cost with a conditional play location (the play op has no keyword-filtered hand choice with unit-only location).",
  abilities: [],
});
