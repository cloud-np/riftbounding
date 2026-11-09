/**
 * Applied Researchers (VEN-055) — "[Empower][3] [Empowered] Your spells cost [1][Rune] less, to a
 * minimum of [1]."
 *
 * 828.1.c Dependent cost passive (356.4). The [Rune] discount always applies; the [1] discount is
 * only applied to spells whose printed Energy cost is 2 or more, which keeps the Energy cost at a
 * minimum of [1] when no other cost modification applies.
 */
import { registerCardScript } from "../registry";
import { empower, whileEmpowered } from "./shared";

registerCardScript({
  name: "Applied Researchers",
  text: "[Empower][3] ([3]: Empower me. Use only if not Empowered.)\n[Empowered] Your spells cost [1][Rune] less, to a minimum of [1].",
  status: "partial",
  notes:
    "The per-discount minimum of [1] is approximated by the printed Energy cost (>= 2): the cost layer has no per-discount minimum, so other increases/discounts are not taken into account (356.4.c RULES-QUESTION).",
  abilities: [
    empower({ energy: 3 }),
    whileEmpowered({
      kind: "custom",
      id: "cost-adjust",
      params: { power: { any: -1 }, target: { cardType: "spell", controller: "self" } },
    }),
    whileEmpowered({
      kind: "custom",
      id: "cost-adjust",
      params: {
        energy: -1,
        target: { cardType: "spell", controller: "self", energyCost: { op: "gte", value: 2 } },
      },
    }),
  ],
});
