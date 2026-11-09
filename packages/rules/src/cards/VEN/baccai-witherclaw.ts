/**
 * Baccai Witherclaw (VEN-078) — "[Empower][1][Rune][Rune] [Empowered] I have +2 [Might].
 * [Empowered] [Deathknell] Channel 2 runes exhausted."
 *
 * 827.1.c.1 Empower; 828.1.c the Might bonus. The Empowered Deathknell ("when I die while
 * Empowered", 808 / 828.1.c) is not scripted: see notes.
 */
import { registerCardScript } from "../registry";
import { SELF } from "../dsl";
import { empower, whileEmpowered } from "./shared";

registerCardScript({
  name: "Baccai Witherclaw",
  text: "[Empower] [1] [rune] [rune] ([1] [rune] [rune] : Empower me. Use only if not Empowered.)\n[Empowered] I have +2 [might] .\n[Empowered] [deathknell] Channel 2 runes exhausted. (When I die while Empowered, get the effect.)",
  status: "partial",
  notes:
    "[Empowered][Deathknell] is not automated: the kill event carries no last-known Empowered status (the rules object is deleted on kill), so 'when I die while Empowered' cannot be checked (808, 828.1.c, 359.3.e.13).",
  abilities: [
    empower({ energy: 1, power: { any: 2 } }),
    whileEmpowered({ kind: "might", amount: 2, target: SELF }),
  ],
});
