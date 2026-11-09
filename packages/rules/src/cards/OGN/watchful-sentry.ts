/** Watchful Sentry (OGN-096) — "[DEATHKNELL] - Draw 1." (808 Deathknell, 414) */
import { registerCardScript, WHEN_I_DIE } from "../sdk";

registerCardScript({
  name: "Watchful Sentry",
  text: "[DEATHKNELL] - Draw 1. (When I die, get the effect.)",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_DIE,
      keywords: ["Deathknell"],
      effect: { op: "draw", amount: 1 },
    },
  ],
});
