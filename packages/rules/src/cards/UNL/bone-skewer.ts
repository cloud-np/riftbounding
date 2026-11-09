/** Bone Skewer. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Bone Skewer",
  text: "[Hidden] (Hide now for [A] to react with later for [0].)\nChoose a battlefield. An opponent reveals their hand. You may choose a unit from it. They play that unit to that battlefield, ignoring any and all costs. If they do, then do this: [Stun] it. (It doesn't deal combat damage this turn.)",
  status: "manual",
  notes:
    "Revealing a hand, choosing a unit among it and making that opponent play it ignoring costs needs effect-driven plays by another player (355.7, 420.3, 425); [Hidden] is a printed keyword.",
  abilities: [],
});
