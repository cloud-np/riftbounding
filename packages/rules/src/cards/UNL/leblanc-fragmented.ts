/**
 * LeBlanc, Fragmented (UNL-172) — [Assault] (807, engine keyword). [Deathknell] (808): draw 1, or
 * draw 2 instead if it's your Beginning Phase (checked on resolution, 359.3.f.2).
 */
import { registerCardScript, WHEN_I_DIE } from "../sdk";

registerCardScript({
  name: "LeBlanc, Fragmented",
  text: "[Assault] (+1 [Might] while I'm an attacker.)\n[Deathknell] Draw 1. If it's your Beginning Phase, draw 2 instead. (When I die, get the effect.)",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_DIE,
      keywords: ["Deathknell"],
      effect: {
        op: "if",
        condition: {
          kind: "and",
          conditions: [{ kind: "is-turn-player" }, { kind: "is-phase", phase: "beginning" }],
        },
        then: { op: "draw", amount: 2 },
        else: { op: "draw", amount: 1 },
      },
    },
  ],
});
