/**
 * Grumpy Rockbear (VEN-050) — "[Empower][12]. This ability costs [1] less for each rune you
 * control. [Empowered] I have [Deflect] and [Shield 3]."
 *
 * 827.1.c.3: text altering the Empower cost. The cost layer sums fixed amounts (356.4), so the
 * reduction is one -1 entry per rune controlled, applied to this object's activation while it is
 * on the board (not to its play cost from hand, 366.2.a). Empower is its only activated ability.
 */
import { registerCardScript } from "../registry";
import { SELF } from "../dsl";
import {
  DEFLECT_GAP,
  ON_BOARD,
  empower,
  notIntrinsic,
  perCountCostReduction,
  whileEmpowered,
} from "./shared";

registerCardScript({
  name: "Grumpy Rockbear",
  text: "[Empower] [12] . this ability costs [1] less for each rune you control. (Pay the cost: Empower me. Use only if not Empowered.)\n[Empowered] I have [deflect] and [shield 3]",
  status: "partial",
  notes: DEFLECT_GAP,
  abilities: [
    notIntrinsic("Deflect"),
    notIntrinsic("Shield"),
    empower({ energy: 12 }),
    whileEmpowered({ kind: "keyword", keyword: "Deflect", target: SELF }),
    whileEmpowered({ kind: "keyword", keyword: "Shield 3", target: SELF }),
    ...perCountCostReduction({ cardType: "rune", controller: "self" }, 12, SELF, [ON_BOARD]),
  ],
});
