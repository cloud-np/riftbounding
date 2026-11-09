/** Revna the Lorekeeper. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Revna the Lorekeeper",
  text: "[Ganking] (I can move from battlefield to battlefield.)\nWhen you play a spell, if you spent [4] or more, ready me.",
  status: "partial",
  notes:
    "'If you spent [4] or more' is not tracked (Amount `spent`, 357, 166.2): the ready trigger is not automated. [Ganking] is a printed keyword.",
  abilities: [],
});
