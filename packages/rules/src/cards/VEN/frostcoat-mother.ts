/**
 * Frostcoat Mother (VEN-032) — "[Empower][12]. This ability costs [1] less for each rune you
 * control. [Empowered] I have +3 [Might]."
 *
 * 827.1.c.3: one -1 cost entry per rune controlled, applied to this object's activation while it
 * is on the board (not to its play cost from hand, 366.2.a). Empower is its only activated ability.
 */
import { ON_BOARD, empower, perCountCostReduction, whileEmpowered } from "./shared";
import { registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Frostcoat Mother",
  text: "[Empower] [12] . This ability costs [1] less for each rune you control. (Pay the cost: Empower me. Use only if not Empowered.)\n[Empowered] I have +3 [might] .",
  status: "implemented",
  abilities: [
    empower({ energy: 12 }),
    whileEmpowered({ kind: "might", amount: 3, target: SELF }),
    ...perCountCostReduction({ cardType: "rune", controller: "self" }, 12, SELF, [ON_BOARD]),
  ],
});
