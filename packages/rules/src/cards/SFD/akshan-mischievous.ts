/** Akshan, Mischievous. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Akshan, Mischievous",
  text: "[Weaponmaster]\nYou may pay [Body][Body] as an additional cost to play me.\nWhen you play me, if you paid the additional cost, move an enemy gear to your base. You control it until I leave the board. If it's an Equipment, attach it to me.",
  status: "partial",
  notes:
    "The optional [Body][Body] additional cost is not a payable Cost (357.2), and \"You control it until I leave the board\" (a delayed passive tied to another object's presence, 391.4) is not supported. Weaponmaster is the engine's.",
  abilities: [],
});
