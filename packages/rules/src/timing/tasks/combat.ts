/**
 * Combat task — rules 465–468. Queued by `timing/showdown.ts` when a Combat Showdown closes
 * (348.1) and by `combat/progress.ts` when a waiting Resolution-Step Task becomes Outstanding
 * (468.2 / 468.4 / 468.6).
 */
import { continueCombat } from "../../combat";
import { registerTaskHandler } from "./registry";

registerTaskHandler("combat", ({ room, step }) => {
  // 467 → 468: runs until a damage-assignment prompt (411.2), chain work, or the combat ends.
  continueCombat(room, step);
  return "continue";
});
