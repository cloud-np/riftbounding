/** Rumble, Scrapper. */
import { registerCardScript, WHEN_I_HOLD } from "../sdk";
import { mech, MECHS } from "./custom";

registerCardScript({
  name: "Rumble, Scrapper",
  text: "Your Mechs have +1 [Might] (including me).\nWhen I hold, play a 3 [Might] Mech unit token to your base.",
  status: "implemented",
  abilities: [
    { kind: "passive", modifier: { kind: "might", amount: 1, target: MECHS } },
    { kind: "triggered", trigger: WHEN_I_HOLD, effect: mech() },
  ],
});
