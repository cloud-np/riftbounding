/** Kinkou Lifeblade (VEN-093) — "[Empower][2] [Empowered] I have +1 [Might] and [Ganking]." (827.1.c.1, 828.1.c) */
import { empower, notIntrinsic, registerCardScript, SELF, whileEmpowered } from "../sdk";

registerCardScript({
  name: "Kinkou Lifeblade",
  text: "[Empower][2] ([2]: Empower me. Use only if not Empowered.)\n[Empowered] I have +1 [Might] and [Ganking]. (I can move from battlefield to battlefield.)",
  status: "implemented",
  abilities: [
    ...notIntrinsic("Ganking"),
    empower({ energy: 2 }),
    whileEmpowered({ kind: "might", amount: 1, target: SELF }),
    whileEmpowered({ kind: "keyword", keyword: "Ganking", target: SELF }),
  ],
});
