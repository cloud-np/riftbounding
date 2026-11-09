/** Punching Poro (VEN-007) — "[Empower] - Discard 1 [Empowered] I have +1 [Might]." (827.1.c.2 non-resource cost) */
import { empower, registerCardScript, SELF, whileEmpowered } from "../sdk";

registerCardScript({
  name: "Punching Poro",
  text: "[Empower] - Discard 1 (Pay the cost: Empower me. Use only if not Empowered.)\n[Empowered] I have +1 [Might].",
  status: "implemented",
  abilities: [empower({ discard: 1 }), whileEmpowered({ kind: "might", amount: 1, target: SELF })],
});
