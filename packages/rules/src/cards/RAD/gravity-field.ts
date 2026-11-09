/**
 * Gravity Field (RAD-062) — "[Deploy] Opponents must pay [1] [Rune] to move one or more units to
 * this battlefield. [Deathknell] Draw 1."
 */
import { registerCardScript, WHEN_I_DIE } from "../sdk";

registerCardScript({
  name: "Gravity Field",
  text: "[Deploy] (Play this only to a battlefield. When an opponent holds here, kill this.)\nOpponents must pay [1] [Rune] to move one or more units to this battlefield.\n[Deathknell] Draw 1. (When I die, get the effect.)",
  status: "partial",
  notes:
    "The move tax (opponents pay [1][Rune] to move units here) needs applied costs on moves (204.4, 449).",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_DIE,
      keywords: ["Deathknell"],
      effect: { op: "draw", amount: 1 },
    },
  ],
});
