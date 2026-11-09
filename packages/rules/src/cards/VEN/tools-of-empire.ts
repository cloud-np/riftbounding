/**
 * Tools of Empire (VEN-077, gear) — "[Empower][2] [Tap]: Give a unit +2 [Might] this turn. If
 * this is [Empowered], give that unit +4 [Might] this turn instead." (827.1.c.1; 359.3.f.2: the
 * Empowered check is made on resolution)
 */
import { SELF_EMPOWERED, empower } from "./shared";
import { aUnit, registerCardScript, SELF } from "../sdk";

const TARGET = aUnit({ targetRef: "target:0" });

registerCardScript({
  name: "Tools of Empire",
  text: "[Empower][2] ([2]: Empower this. Use only if not Empowered.)\n[Tap]: Give a unit +2 [Might] this turn. If this is [Empowered], give that unit +4 [Might] this turn instead.",
  status: "implemented",
  abilities: [
    empower({ energy: 2 }),
    {
      kind: "activated",
      cost: { exhaust: SELF },
      effect: {
        op: "if",
        condition: SELF_EMPOWERED,
        then: { op: "temporary_might", amount: 4, target: TARGET },
        else: { op: "temporary_might", amount: 2, target: TARGET },
      },
    },
  ],
});
