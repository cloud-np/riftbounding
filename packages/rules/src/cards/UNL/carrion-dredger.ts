/**
 * Carrion Dredger (UNL-153) — [Deathknell] (808): play a 1 [Might] Bird token with [Deflect] to
 * your base (440.2.c). The catalog's [Deflect] is the token's (reminder text), not mine (135.2.d.3).
 */
import { registerCardScript, token, WHEN_I_DIE } from "../sdk";

registerCardScript({
  name: "Carrion Dredger",
  text: "[Deathknell] Play a 1 [Might] Bird token with [Deflect] to your base. (When I die, get the effect. Opponents must pay [Rune] to choose a [Deflect] unit with a spell or ability.)",
  status: "implemented",
  abilities: [
    { kind: "suppress-printed-keyword", keyword: "Deflect" },
    {
      kind: "triggered",
      trigger: WHEN_I_DIE,
      keywords: ["Deathknell"],
      effect: {
        op: "create",
        token: token("Bird", { might: 1, play: true }),
        zone: "base",
      },
    },
  ],
});
