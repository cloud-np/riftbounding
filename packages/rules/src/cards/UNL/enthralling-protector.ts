/** Enthralling Protector. */
import { registerCardScript } from "../sdk";
import { SPEND_2_BUFF_ME } from "./custom";

registerCardScript({
  name: "Enthralling Protector",
  text: "[Hunt] (When i conquer or hold, gain 1 XP.)\nSpend 2 XP: [Buff] me. (Give me a +1 buff if i dont have one.)",
  status: "implemented",
  abilities: [SPEND_2_BUFF_ME],
});
