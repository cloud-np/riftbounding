/** Soaring Scout (OGN-216) — "[DEATHKNELL] - Channel 1 rune exhausted." (808 Deathknell, 431.2.a) */
import { registerCardScript } from "../registry";
import { WHEN_I_DIE } from "../dsl";

registerCardScript({
  name: "Soaring Scout",
  text: "[DEATHKNELL] - Channel 1 rune exhausted. (When I die, get the effect.)",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_DIE,
      keywords: ["Deathknell"],
      effect: { op: "channel", amount: 1, exhausted: true },
    },
  ],
});
