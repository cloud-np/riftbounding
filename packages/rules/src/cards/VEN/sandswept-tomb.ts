/** Sandswept Tomb. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Sandswept Tomb",
  text: "Each spell that chooses one or more units here that are friendly to it costs [Rune] less.",
  status: "partial",
  notes:
    "The discount depends on the spell's chosen targets, but the cost is planned before 355 choices are bound; a cost modifier cannot read the pending choices (`layers/costs.ts`).",
  abilities: [],
});
