/** Ferrous Forerunner. */
import { registerCardScript, WHEN_I_DIE } from "../sdk";
import { mech } from "./custom";

registerCardScript({
  name: "Ferrous Forerunner",
  text: "[DEATHKNELL] — Play two 3 [Might] Mech unit tokens to your base. (When I die, get the effect.)",
  status: "implemented",
  abilities: [{ kind: "triggered", trigger: WHEN_I_DIE, effect: mech(2) }],
});
