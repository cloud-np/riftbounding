/**
 * Baccai Witherclaw (VEN-078) — "[Empower][1][Rune][Rune] [Empowered] I have +2 [Might].
 * [Empowered] [Deathknell] Channel 2 runes exhausted."
 *
 * 827.1.c.1 Empower; 828.1.c the Might bonus. The Empowered Deathknell ("when I die while
 * Empowered", 808 / 828.1.c) reads the kill event's last-known Empowered status
 * (383.2.c.3.b / 424).
 */
import { empower, registerCardScript, SELF, WHEN_I_DIE_EMPOWERED, whileEmpowered } from "../sdk";

registerCardScript({
  name: "Baccai Witherclaw",
  text: "[Empower] [1] [rune] [rune] ([1] [rune] [rune] : Empower me. Use only if not Empowered.)\n[Empowered] I have +2 [might] .\n[Empowered] [deathknell] Channel 2 runes exhausted. (When I die while Empowered, get the effect.)",
  status: "implemented",
  abilities: [
    empower({ energy: 1, power: { any: 2 } }),
    whileEmpowered({ kind: "might", amount: 2, target: SELF }),
    {
      kind: "triggered",
      trigger: WHEN_I_DIE_EMPOWERED,
      keywords: ["Deathknell"],
      effect: { op: "channel", amount: 2, exhausted: true },
    },
  ],
});
