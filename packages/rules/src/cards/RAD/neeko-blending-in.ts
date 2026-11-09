/** Neeko, Blending In (RAD-167, errata) — deck-building extra legends; not modelled. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Neeko, Blending In",
  text: "(Neutral cards can go in decks of any Domain.)\nIf Neeko is in your deck, choose up to 3 different legends in addition to your starting legend. (Different means none match names.)\nWhen you play me, choose one of those Legends and add it to your Legend Zone while I'm on the board.",
  status: "manual",
  notes:
    "The card needs deck-building selections (up to 3 extra legends) and adding a chosen legend to the Legend Zone while Neeko is on the board; neither is stored by the engine.",
  abilities: [],
});
