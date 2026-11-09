/** Mageseeker Investigator. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Mageseeker Investigator",
  text: "Opponents must pay [Rune] for each unit beyond the first to move multiple units to my battlefield at the same time.",
  status: "manual",
  notes:
    "Movement taxes / player-scoped move restrictions are not implemented (451, 054.1); moving several units at once is not a Standard Move.",
  abilities: [],
});
