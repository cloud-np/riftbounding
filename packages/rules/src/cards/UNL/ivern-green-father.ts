/** Ivern, Green Father. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Ivern, Green Father",
  text: "When you conquer or hold, you may exhaust me to replace that battlefield with a Brush battlefield token. (Bird, Cat, Dog, Poro, and Ivern units have +1 [might] in Brush. It can be swapped back when scored.)",
  status: "manual",
  notes:
    "Replacing a battlefield with a battlefield token (186) is not implemented; the Brush token's Might passive exists but battlefield replacement does not.",
  abilities: [],
});
