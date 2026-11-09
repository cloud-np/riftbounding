/** Spirit Wheel. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Spirit Wheel",
  text: "When you choose a friendly unit, you may pay [1] and exhaust this to draw 1.",
  status: "manual",
  notes:
    '"When you choose a friendly unit": choosing objects with spells/abilities (355.7) emits no event the trigger layer can match.',
  abilities: [],
});
