/**
 * Acceptable Losses (OGN-179) — "Each player kills one of their gear."
 *
 * Each player, in Turn Order (303.2.a), chooses one of their own gear on resolution (not a target:
 * the instruction is "each player kills", 355.7); the chosen gear are then killed together (429).
 * `ogn:players-choose` is shared with Cull the Weak and King's Edict.
 */
import { registerCardScript } from "../sdk";
import { eachPlayerKillsOne } from "./custom";

registerCardScript({
  name: "Acceptable Losses",
  text: "[ACTION] (Play on your turn or in showdowns.)\nEach player kills one of their gear.",
  status: "implemented",
  abilities: [{ kind: "spell", effect: eachPlayerKillsOne("gear") }],
});
