/**
 * Renekton, Brute (VEN-092) — "[1]: Give me +1 [Might] this turn. When my Might becomes 10 or
 * more, empower me. [Empower] I have [Deflect] and [Ganking]."
 *
 * The last line is printed with the [Empower] icon but has no cost; it is read as the
 * [Empowered] Dependent ability (828.1.b/c), the only reading with a game function.
 */
import { registerCardScript } from "../registry";
import { SELF } from "../dsl";
import { notIntrinsic, whileEmpowered } from "./shared";

registerCardScript({
  name: "Renekton, Brute",
  text: "[1]: Give me +1 [Might] this turn.\nWhen my Might becomes 10 or more, empower me.\n[Empower] I have [Deflect] and [Ganking].",
  status: "partial",
  notes: `"When my Might becomes 10 or more" is not automated: only the 5-Might threshold (become_mighty, 709) is synthesized as an event (383.1).`,
  abilities: [
    ...notIntrinsic("Deflect"),
    ...notIntrinsic("Ganking"),
    {
      kind: "activated",
      cost: { energy: 1 },
      effect: { op: "temporary_might", amount: 1, target: SELF },
    },
    whileEmpowered({ kind: "keyword", keyword: "Deflect", target: SELF }),
    whileEmpowered({ kind: "keyword", keyword: "Ganking", target: SELF }),
  ],
});
