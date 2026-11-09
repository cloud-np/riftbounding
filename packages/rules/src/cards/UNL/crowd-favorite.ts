/** Crowd Favorite. */
import { registerCardScript } from "../sdk";
import { SPEND_2_BUFF_ME } from "./custom";

registerCardScript({
  name: "Crowd Favorite",
  text: "[Hunt] (When I conquer or hold, gain 1 XP.)\nSpend 2 XP: [Buff] me. (Give me a +1 Buff if I dont have one.)",
  status: "implemented",
  abilities: [SPEND_2_BUFF_ME],
});
