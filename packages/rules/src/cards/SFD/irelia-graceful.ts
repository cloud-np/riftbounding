/** Irelia, Graceful. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Irelia, Graceful",
  text: "Your spells that choose me cost [1] or [Rune] less.",
  status: "manual",
  notes:
    '"Your spells that choose me cost [1] or [Rune] less": a cost passive cannot see the chosen targets of the spell being played (356.4, 355.7), and the component discount is not expressible (356.4.c).',
  abilities: [],
});
