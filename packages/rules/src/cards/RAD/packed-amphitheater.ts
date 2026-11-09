/** Packed Amphitheater (RAD-164/184) — "Champion units here have +1 [Might]." */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Packed Amphitheater",
  text: "Champion units here have +1 [Might].",
  status: "manual",
  notes:
    "The catalog does not mark Champion units on the board (133.8.b), so 'Champion units here' cannot be distinguished from other units; no passive is scripted.",
  abilities: [],
});
