/**
 * Solari Sunhawk (VEN-122) — "[Empower 2] [Empowered] I have +1 [Might] and [Deflect 2]."
 *
 * 827.1.c.1 Empower [2]; 828.1.c the Dependent passive. The catalog's Deflect is only granted by
 * the Empowered ability (727.1.b).
 */
import { registerCardScript } from "../registry";
import { SELF } from "../dsl";
import { empower, notIntrinsic, whileEmpowered } from "./shared";

registerCardScript({
  name: "Solari Sunhawk",
  text: "[Empower 2] ( [2] : Empower me. Use only if not Empowered.)\n[Empowered] I have + 1 [might] and [deflect 2] . (Opponents must pay [rune] [rune] to choose me with a spell or ability.)",
  status: "implemented",
  abilities: [
    ...notIntrinsic("Deflect"),
    empower({ energy: 2 }),
    whileEmpowered({ kind: "might", amount: 1, target: SELF }),
    whileEmpowered({ kind: "keyword", keyword: "Deflect", value: 2, target: SELF }),
  ],
});
