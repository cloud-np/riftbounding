/** Honest Broker. */
import { registerCardScript, WHEN_I_DIE } from "../sdk";
import { gold } from "./custom";

registerCardScript({
  name: "Honest Broker",
  text: "[DEATHKNELL] — Play a Gold gear token exhausted. (When I die, get the effect.)",
  status: "implemented",
  abilities: [{ kind: "triggered", trigger: WHEN_I_DIE, effect: gold() }],
});
