/**
 * Steel Paws (VEN-043) — "[Deflect] [Empower][7] [Empowered] I have +7 [Might]."
 *
 * Deflect (809) is printed and read by R2-play. 827.1.c.1: Empower is an activated ability;
 * 828.1.c: the Empowered Might bonus applies while I'm Empowered.
 */
import { registerCardScript } from "../registry";
import { SELF } from "../dsl";
import { empower, whileEmpowered } from "./shared";

registerCardScript({
  name: "Steel Paws",
  text: "[Deflect] (Opponents must pay [Rune] to choose me with a spell or ability.)\n[Empower][7] ([7]: Empower me. Use only if not Empowered.)\n[Empowered] I have +7 [Might].",
  status: "implemented",
  abilities: [empower({ energy: 7 }), whileEmpowered({ kind: "might", amount: 7, target: SELF })],
});
