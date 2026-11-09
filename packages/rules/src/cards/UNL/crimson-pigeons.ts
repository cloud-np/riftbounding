/** Crimson Pigeons. */
import { custom, registerCardScript, SELF, whilePassive as whenever } from "../sdk";

registerCardScript({
  name: "Crimson Pigeons",
  text: "I have +2 [Might] while I'm attacking with another unit.",
  status: "implemented",
  abilities: [
    whenever(custom("unl:attacking-with-another"), { kind: "might", amount: 2, target: SELF }),
  ],
});
