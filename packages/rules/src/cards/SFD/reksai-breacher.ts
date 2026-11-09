/** Rek'Sai, Breacher. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Rek'Sai, Breacher",
  text: "[ACCELERATE] (You may pay [1] [Fury] as an additional cost to have me enter ready.)\n[ASSAULT] (+1 [Might] while I'm an attacker.)\nFriendly units played from anywhere other than a player's hand have [ACCELERATE]",
  status: "partial",
  notes:
    '"Friendly units played from anywhere other than a player\'s hand have [Accelerate]": the grant applies as a unit is played from the trash/banishment/deck, which no passive can express (366.2, 727.1.b); only the printed Accelerate and Assault are automated.',
  abilities: [],
});
