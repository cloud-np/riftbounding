/** Machine Evangel (OGN-239) — "[DEATHKNELL] - Play three 1 [Might] Recruit unit tokens into your base." (808.1.c; 440.2.c) */
import { registerCardScript } from "../registry";
import { WHEN_I_DIE, token } from "../dsl";

registerCardScript({
  name: "Machine Evangel",
  text: "[DEATHKNELL] - Play three 1 [Might] Recruit unit tokens into your base. (When I die, get the effect.)",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_DIE,
      keywords: ["Deathknell"],
      effect: {
        op: "create",
        token: token("Recruit", { count: 3, might: 1, play: true }),
        zone: "base",
      },
    },
  ],
});
