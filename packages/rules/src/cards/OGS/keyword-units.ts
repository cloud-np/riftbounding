/**
 * Proving Grounds units whose text is keywords only (printed keywords are read by the layers and
 * by R2-combat: Shield 814, Assault 807).
 */
import { registerCardScript } from "../registry";

registerCardScript({
  name: "Zephyr Sage",
  text: "[SHIELD] (+1 [Might] while I'm a defender.)",
  status: "implemented",
  abilities: [],
});

registerCardScript({
  name: "Garen, Rugged",
  text: "[Assault 2], [Shield 2] (+2 [Might] while I'm an attacker or defender.)",
  status: "implemented",
  abilities: [],
});
