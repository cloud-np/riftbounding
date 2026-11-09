/**
 * Ekko, Ingenious (RAD-061) — mandatory "return a friendly unit to its owner's hand" additional
 * cost; the Cost shape has no return-to-hand part, so the card stays in the manual window.
 */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Ekko, Ingenious",
  text: "As an additional cost to play me, return a friendly unit to its owner's hand.\n[Ganking] (I can move from battlefield to battlefield.)",
  status: "manual",
  notes:
    "The mandatory additional cost 'return a friendly unit to its owner's hand' is not a payable Cost part (357.2); [Ganking] is the printed keyword.",
  abilities: [],
});
