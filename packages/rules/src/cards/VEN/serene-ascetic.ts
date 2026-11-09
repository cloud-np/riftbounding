/**
 * Serene Ascetic (VEN-030) — "[Empower][3] [Empowered] I have [Deflect] and [Shield 3]."
 *
 * 827.1.c.1 Empower [3]; 828.1.c the Dependent keywords (727.1.b: not intrinsic).
 */
import { registerCardScript } from "../registry";
import { SELF } from "../dsl";
import { DEFLECT_GAP, empower, notIntrinsic, whileEmpowered } from "./shared";

registerCardScript({
  name: "Serene Ascetic",
  text: "[empower][3] ([3]: Empower me. Use only if not Empowered.)\n[empowered] I have [deflect] and [shield 3]. (Opponents must pay [rune] to choose me with a spell or ability. +3[might] while I'm a defender.)",
  status: "partial",
  notes: DEFLECT_GAP,
  abilities: [
    notIntrinsic("Deflect"),
    notIntrinsic("Shield"),
    empower({ energy: 3 }),
    whileEmpowered({ kind: "keyword", keyword: "Deflect", target: SELF }),
    whileEmpowered({ kind: "keyword", keyword: "Shield 3", target: SELF }),
  ],
});
