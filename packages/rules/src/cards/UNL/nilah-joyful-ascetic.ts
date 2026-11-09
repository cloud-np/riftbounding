/** Nilah, Joyful Ascetic. */
import { registerCardScript, WHEN_I_MOVE } from "../sdk";

registerCardScript({
  name: "Nilah, Joyful Ascetic",
  text: "[Accelerate] (You may pay [1][Body] as an additional cost to have me enter ready.)\n[Ganking] (I can move from battlefield to battlefield.)\nWhen I move, gain 1 XP.",
  status: "implemented",
  abilities: [{ kind: "triggered", trigger: WHEN_I_MOVE, effect: { op: "gain_xp", amount: 1 } }],
});
