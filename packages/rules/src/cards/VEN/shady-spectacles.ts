/** Shady Spectacles. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Shady Spectacles",
  text: "[Equip][1][Order] ([1][Order]: Attach this to a unit you control.)\nAs this is attached to a unit, choose another friendly unit. The equipped unit becomes a copy of that unit for as long as this is attached to it.\n(I am a copy of the chosen unit.)\n+0 [Might]",
  status: "partial",
  notes:
    "Copy effects (446) are not implemented, so the equipped unit does not become a copy of the chosen friendly unit. The built-in Equip ability now attaches (818.1.c.2).",
  abilities: [],
});
