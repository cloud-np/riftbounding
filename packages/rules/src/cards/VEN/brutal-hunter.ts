/** Brutal Hunter (VEN-070) — "[Empower][3] [Empowered] I have +2 [Might] and [Ganking]." (827.1.c.1, 828.1.c) */
import { registerCardScript } from "../registry";
import { SELF } from "../dsl";
import { empower, notIntrinsic, whileEmpowered } from "./shared";

registerCardScript({
  name: "Brutal Hunter",
  text: "[Empower] [3] ([3]: Empower me. Use only if not Empowered.)\n[Empowered] I have +2 [Might] and [Ganking]. (I can move from battlefield to battlefield.)",
  status: "implemented",
  abilities: [
    notIntrinsic("Ganking"),
    empower({ energy: 3 }),
    whileEmpowered({ kind: "might", amount: 2, target: SELF }),
    whileEmpowered({ kind: "keyword", keyword: "Ganking", target: SELF }),
  ],
});
