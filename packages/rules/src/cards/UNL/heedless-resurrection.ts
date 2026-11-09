/** Heedless Resurrection. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Heedless Resurrection",
  text: "[Reaction] (Play at any time, even before spells and abilities resolve.)\nAs an additional cost to play this, kill a friendly unit.\nPlay a unit from the trash that costs no more Energy and no more Power that the killed unit, ignoring its cost.",
  status: "manual",
  notes:
    "Playing a card from the Trash for an effect (420.3, 354) and comparing the killed unit's printed cost are not implemented; [Reaction] is a printed keyword.",
  abilities: [],
});
