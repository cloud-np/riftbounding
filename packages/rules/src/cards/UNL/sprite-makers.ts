/**
 * Unleashed Sprite makers (440.2.c "play a token"; the Sprite token's 3 [Might] and [Temporary]
 * come from the catalog token, 187; "ready" = 184.1):
 *
 * - Sprite Queen (UNL-084): when you play me or at the start of your Beginning Phase (315.2.a.1),
 *   play a ready Sprite to your base. The catalog's [Temporary] on the Queen is the Sprite's
 *   (suppressed).
 * - Sprite Fountain (UNL-078): [Temporary] (816, engine keyword); play effect: a ready Sprite to
 *   your base; [Deathknell] (808): repeat that play effect.
 */
import type { Effect } from "@rift/protocol";
import { registerCardScript } from "../registry";
import { WHEN_I_DIE, WHEN_PLAYED, token } from "../dsl";

const READY_SPRITE_TO_BASE: Effect = {
  op: "create",
  token: token("Sprite", { might: 3, exhausted: false, play: true }),
  zone: "base",
};

registerCardScript({
  name: "Sprite Queen",
  text: "When you play me or at the start of your Beginning Phase, play a ready 3 [Might] Sprite unit token with [Temporary] to your base. (Kill them at the start of their controller's next Beginning Phase, before scoring.)",
  status: "implemented",
  abilities: [
    { kind: "keyword", keyword: "Temporary", value: 0 },
    { kind: "triggered", trigger: WHEN_PLAYED, effect: READY_SPRITE_TO_BASE },
    {
      kind: "triggered",
      trigger: { kind: "phase", phase: "beginning" },
      effect: READY_SPRITE_TO_BASE,
    },
  ],
});

registerCardScript({
  name: "Sprite Fountain",
  text: "[Temporary] (Kill this at the start of its controller's Beginning Phase, before scoring.)\nWhen you play this, play a ready 3 [Might] Sprite unit token with [Temporary] to your base.\n[Deathknell] Repeat this gear's play effect. (When this dies, get the effect.)",
  status: "implemented",
  abilities: [
    { kind: "triggered", trigger: WHEN_PLAYED, effect: READY_SPRITE_TO_BASE },
    {
      kind: "triggered",
      trigger: WHEN_I_DIE,
      keywords: ["Deathknell"],
      effect: READY_SPRITE_TO_BASE,
    },
  ],
});
