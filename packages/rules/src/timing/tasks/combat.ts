/** Combat task — rules 467–468. Queued by `timing/showdown.ts` when a Combat Showdown closes. */
import { runCombatDamage, runCombatResolution } from "../../combat";
import { registerTaskHandler } from "./registry";

registerTaskHandler("combat", ({ room, step }) => {
  // 468: resolve damage (467), then the combat cleanup/result (468).
  runCombatDamage(room, step);
  runCombatResolution(room, step);
  return "continue";
});
