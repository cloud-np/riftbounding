/** Rengar, Pouncing. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Rengar, Pouncing",
  text: "[REACTION] (Play any time, even before spells and abilities resolve, including to a battlefield you control.)\n[ASSAULT 2] (+2 [Might] while I'm an attacker)\nI can be played to a battlefield you're attacking.",
  status: "partial",
  notes:
    '"I can be played to a battlefield you\'re attacking": per-card play locations are not supported (355.2.b, 355.17); only the printed Reaction and Assault 2 are automated.',
  abilities: [],
});
