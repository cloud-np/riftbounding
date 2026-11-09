/**
 * Baccai Sandspinner (VEN-001) — "[Empower 5] This ability costs [3] less if you control 4 or
 * fewer runes. [Empowered] I have [Deflect] and [Assault 2]."
 *
 * 827.1.c.3: the reduction applies to this object's activation while it is on the board (not to
 * its play cost from hand, 366.2.a); Empower is its only activated ability.
 */
import {
  whilePassive as conditional,
  empower,
  notIntrinsic,
  registerCardScript,
  runesControlled,
  SELF,
  whileEmpowered,
} from "../sdk";
import { ON_BOARD } from "./custom";

registerCardScript({
  name: "Baccai Sandspinner",
  text: "[Empower 5] THis ability costs [3] less if you control 4 or fewer runes. (Pay the cost: Empower me. Use only if not Empowered.)\n[Empowered]  I have [deflect] and [assault 2]. (Opponents must pay [rune] to choose me with a spell or ability. +2 [might]  if im the attacker.)",
  status: "implemented",
  abilities: [
    ...notIntrinsic("Deflect"),
    ...notIntrinsic("Assault"),
    empower({ energy: 5 }),
    whileEmpowered({ kind: "keyword", keyword: "Deflect", target: SELF }),
    whileEmpowered({ kind: "keyword", keyword: "Assault", value: 2, target: SELF }),
    conditional(
      { kind: "and", conditions: [ON_BOARD, runesControlled("lte", 4)] },
      { kind: "cost", amount: -3, target: SELF },
    ),
  ],
});
