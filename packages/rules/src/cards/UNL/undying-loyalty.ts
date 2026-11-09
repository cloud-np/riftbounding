/** Undying Loyalty. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Undying Loyalty",
  text: "This costs [2] less if you choose a Bird, Cat, Dog or Poro.\nPlay a unit with cost no more than [2] and no more than [Rune] from your trash, ignoring its cost.",
  status: "manual",
  notes:
    "Playing a unit from the Trash for an effect (420.3, 354) is not implemented; the discount also reads a choice (356.2.b.1).",
  abilities: [],
});
