/**
 * Platewyrm Egg (VEN-075, gear) — "This enters exhausted. [Empower] - [1], [Tap] [Reaction]
 * [Tap]: [Add] [1]. If this is [Empowered], [Add] [2] instead."
 *
 * 827.1.c.2 Empower cost; 430.2 Add ability (resolves immediately; checked when it resolves).
 */
import { registerCardScript } from "../registry";
import { SELF } from "../dsl";
import { ENTERS_EXHAUSTED_GAP, SELF_EMPOWERED, empower } from "./shared";

registerCardScript({
  name: "Platewyrm Egg",
  text: "This enters exhausted.\n[Empower] - [1] , [tap] (Pay the cost: Empower this. Use only if not Empowered.)\n[Reaction] [tap] : [add] [1] .  If this is [Empowered] , [add] [2] instead.",
  status: "partial",
  notes: ENTERS_EXHAUSTED_GAP,
  abilities: [
    empower({ energy: 1, exhaust: SELF }),
    {
      kind: "activated",
      cost: { exhaust: SELF },
      keywords: ["reaction"],
      addsResources: true,
      effect: {
        op: "if",
        condition: SELF_EMPOWERED,
        then: { op: "add", resources: { energy: 2 } },
        else: { op: "add", resources: { energy: 1 } },
      },
    },
  ],
});
