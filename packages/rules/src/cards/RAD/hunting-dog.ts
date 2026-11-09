/**
 * Hunting Dog (RAD-119) — "[Deathknell] Play a 1 [Might] Bird unit token with [Deflect] to your
 * base." (808, 440.2.c) The Bird token has Deflect from the token catalog (187); the Dog does not.
 */
import { notIntrinsic, registerCardScript, token, WHEN_I_DIE } from "../sdk";

registerCardScript({
  name: "Hunting Dog",
  text: "[Deathknell] Play a 1 [Might] Bird unit token with [Deflect] to your base. (When I die, get the effect. Opponents must pay [Rune] to choose a [Deflect] unit with a spell or ability.)",
  status: "implemented",
  abilities: [
    ...notIntrinsic("Deflect"),
    {
      kind: "triggered",
      trigger: WHEN_I_DIE,
      keywords: ["Deathknell"],
      effect: { op: "create", token: token("Bird", { might: 1, play: true }), zone: "base" },
    },
  ],
});
