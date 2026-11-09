/** Zilean, Time Mage. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Zilean, Time Mage",
  text: "Once each turn, if you would play a token unit while I'm at a battlefield, you may play that token and an additional copy of it instead.",
  status: "manual",
  notes:
    "Replacing a token play with two token plays (a replacement of the play event, 375/186) is not implemented.",
  abilities: [],
});
