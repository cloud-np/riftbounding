/** Curtain Call. */
import type { Effect } from "@rift/protocol";
import { aUnit, registerCardScript } from "../sdk";

const CURTAIN_CALL_MODES: Array<{ id: string; effect: Effect }> = [
  { id: "draw", effect: { op: "draw", amount: 1 } },
  { id: "deal2", effect: { op: "deal", amount: 2, target: aUnit({ zone: "battlefield" }) } },
  { id: "deal3", effect: { op: "deal", amount: 3, target: aUnit({ zone: "base" }) } },
  {
    id: "might",
    effect: { op: "temporary_might", amount: -4, target: aUnit({ zone: "battlefield" }) },
  },
];

registerCardScript({
  name: "Curtain Call",
  text: "[Repeat] -[1] / [rune] / [1] [rune] (You may pay each additional cost to repeat this spell's effect.)\n\nChoose one you haven't already chosen -\n    ᛫ Draw 1\n    ᛫ Deal 2 to a unit at a battlefield.\n    ᛫ Deal 3 to a unit at a base.\n    ᛫ Give a unit at a Battlefield -4 [might] this turn.",
  status: "implemented",
  additionalCosts: [
    { id: "repeat", optional: true, cost: { energy: 1 }, rule: "820.1.c", label: "Repeat" },
    {
      id: "repeat:1",
      optional: true,
      cost: { power: { any: 1 } },
      rule: "820.1.c",
      label: "Repeat",
    },
    {
      id: "repeat:2",
      optional: true,
      cost: { energy: 1, power: { any: 1 } },
      rule: "820.1.c",
      label: "Repeat",
    },
  ],
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          // 820.2 / 355.3: each execution picks a mode not chosen by an earlier execution.
          {
            op: "custom",
            id: "unl:curtain-call-mode",
            params: { modes: CURTAIN_CALL_MODES.map((mode) => mode.id) },
          },
          {
            op: "choose_mode",
            modes: CURTAIN_CALL_MODES.map((mode) => ({
              id: mode.id,
              label: mode.id,
              effect: mode.effect,
            })),
          },
        ],
      },
    },
  ],
});
