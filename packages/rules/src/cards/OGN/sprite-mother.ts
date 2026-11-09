/**
 * Sprite Mother (OGN-106) — "When you play me, play a ready 3 [Might] Sprite unit token with
 * [Temporary] here."
 *
 * The catalog lists [Temporary] for this card because of the token text; Sprite Mother itself
 * does not have it (727.1.b convention: `value: 0` marks a non-intrinsic catalog keyword).
 * 184.1: the effect says the token enters ready; 440.2.c: it is played.
 */
import { registerCardScript } from "../registry";
import { HERE, WHEN_PLAYED, token } from "../dsl";

registerCardScript({
  name: "Sprite Mother",
  text: "When you play me, play a ready 3 [Might] Sprite unit token with [Temporary] here. (Kill it at the start of its controller's Beginning Phase, before scoring.)",
  status: "implemented",
  abilities: [
    { kind: "keyword", keyword: "Temporary", value: 0 },
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: {
        op: "create",
        token: token("Sprite", { might: 3, exhausted: false, keywords: ["Temporary"], play: true }),
        zone: HERE,
      },
    },
  ],
});
