/** Orianna, Lady of Clockwork (RAD-145/171, legend) — gear becomes a unit gear (trait-altering, 479–481). */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Orianna, Lady of Clockwork",
  text: "At the start of your Main Phase, you may pay [1] to choose a friendly gear. It becomes a unit gear with Might equal to its Energy cost until you choose another gear with me.",
  status: "manual",
  notes:
    "Needs trait-altering 'becomes a unit gear' (card type change) and a last-chosen link between the two abilities; layers only do numeric Might/keyword changes (479–481).",
  abilities: [],
});
