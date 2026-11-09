/** Watchful Sentry (OGN-096) — "[DEATHKNELL] - Draw 1." (808 Deathknell, 414) */
import { registerCardScript } from "../registry";
import { WHEN_I_DIE } from "../dsl";

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
