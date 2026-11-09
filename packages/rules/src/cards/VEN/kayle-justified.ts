/**
 * Kayle, Justified (VEN-134) — "[Empower][3] ([3]: Empower me.) I can be [Empowered] up to three
 * times. I have +2 [Might] for each time I'm [Empowered]. While I'm [Empowered] three times, I
 * have [Deflect 3] and [Ganking]."
 *
 * 442.1.c.1: the permission makes Empowered a stacking status (up to three); this Empower has
 * no "only if not Empowered" restriction. 443.1.b: disempowering removes one status.
 */
import { registerCardScript } from "../registry";
import { SELF, custom } from "../dsl";
import { conditional, notIntrinsic } from "./shared";

const atLeast = (n: number) => custom("ven:self-empowered-at-least", { n });

registerCardScript({
  name: "Kayle, Justified",
  text: "[Empower] [3] ([3]: Empower me.)\nI can be [Empowered] up to three times.\nI have +2 [Might] for each time I'm [Empowered].\nWhile I'm [Empowered] three times, I have [Deflect 3] and [Ganking].",
  status: "partial",
  notes:
    "Only my own Empower stacks: other effects that empower me use the binary empower op, which does not read the 442.1.c.1 permission.",
  abilities: [
    notIntrinsic("Deflect"),
    notIntrinsic("Ganking"),
    {
      kind: "activated",
      cost: { energy: 3 },
      effect: { op: "custom", id: "ven:empower-stacking", params: { max: 3 } },
    },
    conditional(atLeast(1), { kind: "might", amount: 2, target: SELF }),
    conditional(atLeast(2), { kind: "might", amount: 2, target: SELF }),
    conditional(atLeast(3), { kind: "might", amount: 2, target: SELF }),
    conditional(atLeast(3), { kind: "keyword", keyword: "Deflect 3", target: SELF }),
    conditional(atLeast(3), { kind: "keyword", keyword: "Ganking", target: SELF }),
  ],
});
