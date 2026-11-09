/** Rabadon's Deathcrown. */
import { custom, registerCardScript, whilePassive } from "../sdk";
import { mightBonus } from "./custom";

registerCardScript({
  name: "Rabadon's Deathcrown",
  text: "[Unique] (Your deck can have only 1 card with this name.)\n\n[Equip] [Power] ([Power]: Attach this to a unit you control.)\n\n\nYour spells and abilities deal 3 Bonus Damage (while this is attached). \n+3 Might",
  status: "implemented",
  abilities: [
    // 712–715 / 724: a player-level Effect Text passive, active only while attached.
    whilePassive(custom("sfd:self-attached"), { kind: "bonus-damage", amount: 3 }),
    mightBonus(3),
  ],
});
