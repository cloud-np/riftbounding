/**
 * Legion Marauder (VEN-074) — "[Empower] — [1] or [Body] [Empowered] I have +1 [Might]."
 *
 * 204.1.b: alternative costs; scripted as two Empower abilities (827.3: multiple Empower
 * instances are separate activated abilities), one per cost.
 */
import { empower, whileEmpowered } from "./shared";
import { registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Legion Marauder",
  text: "[empower] — [1] or [body] (Pay either cost: Empower me. Use only if not Empowered.)\n[empowered] I have +1[might].",
  status: "implemented",
  abilities: [
    empower({ energy: 1 }),
    empower({ power: { Body: 1 } }),
    whileEmpowered({ kind: "might", amount: 1, target: SELF }),
  ],
});
