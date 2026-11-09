/**
 * Akali, Deadly Weapon (VEN-021) — "[Empower][2][Fury] When I move, you may deal 1 to a unit at a
 * battlefield I moved to or from. If I'm [Empowered], deal 2 instead. [Empowered] I have +1
 * [Might]."
 *
 * 421 / 383: the move event carries the destination and origin; the target is chosen when the
 * trigger is put on the chain (403.2) and "you may" is decided then (403.1). "If I'm Empowered"
 * is checked on resolution (359.3.f.2).
 */
import { registerCardScript } from "../registry";
import { SELF, WHEN_I_MOVE, aUnit, custom } from "../dsl";
import { SELF_EMPOWERED, empower, whileEmpowered } from "./shared";

const TARGET = aUnit({ targetRef: "target:0", where: custom("ven:at-move-endpoint-battlefield") });

registerCardScript({
  name: "Akali, Deadly Weapon",
  text: "[Empower][2][Fury] ([2][Fury] : Empower me. Use only if not Empowered.)\nWhen I move, you may deal 1 to a unit at a battlefield I moved to or from. If I'm [Empowered], deal 2 instead.\n[Empowered] I have +1 [Might]",
  status: "implemented",
  abilities: [
    empower({ energy: 2, power: { Fury: 1 } }),
    {
      kind: "triggered",
      trigger: WHEN_I_MOVE,
      optional: true,
      effect: {
        op: "if",
        condition: SELF_EMPOWERED,
        then: { op: "deal", amount: 2, target: TARGET },
        else: { op: "deal", amount: 1, target: TARGET },
      },
    },
    whileEmpowered({ kind: "might", amount: 1, target: SELF }),
  ],
});
