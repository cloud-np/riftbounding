/**
 * Aurok General (VEN-130) — "[Empower][3][Order] [Empowered] Your units that are [Empowered]
 * have +2 [Might] (including me)." (827.1.c.1, 828.1.c)
 */
import { empower, registerCardScript, whileEmpowered } from "../sdk";

registerCardScript({
  name: "Aurok General",
  text: "[empower][3][order] ([3][order]: Empower me. Use only if not Empowered.)\n[empowered] Your units that are [empowered] have +2[might] (including me).",
  status: "implemented",
  abilities: [
    empower({ energy: 3, power: { Order: 1 } }),
    whileEmpowered({
      kind: "might",
      amount: 2,
      target: { cardType: "unit", controller: "self", empowered: true },
    }),
  ],
});
