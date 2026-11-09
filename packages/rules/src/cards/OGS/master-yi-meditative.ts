/** Master Yi, Meditative (OGS-004) — "While you have 8+ runes, I have +4 [Might]." (364.3.a conditional passive) */
import { registerCardScript } from "../registry";
import { SELF } from "../dsl";
import { conditional, runesControlled } from "../VEN/shared";

registerCardScript({
  name: "Master Yi, Meditative",
  text: "While you have 8+ runes, I have +4 [Might].",
  status: "implemented",
  abilities: [conditional(runesControlled("gte", 8), { kind: "might", amount: 4, target: SELF })],
});
