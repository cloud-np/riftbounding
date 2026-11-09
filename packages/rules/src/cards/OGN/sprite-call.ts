/**
 * Sprite Call (OGN-094) — "[HIDDEN] [ACTION] Play a ready 3 [Might] Sprite unit token with
 * [TEMPORARY]."
 *
 * [Hidden] (811) is the play layer's. The token enters ready (184.1) and is played (440.2.c) to its
 * controller's base. The catalog's [Temporary] belongs to the token, not to this spell (`value: 0`).
 */
import { registerCardScript } from "../registry";
import { token } from "../dsl";

registerCardScript({
  name: "Sprite Call",
  text: "[HIDDEN] (Hide now for [Rune] to react with later for [0].)\n[ACTION] (Play on your turn or in showdowns.)\nPlay a ready 3 [Might] Sprite unit token with [TEMPORARY]. (Kill it at the start of its controller's Beginning Phase, before scoring.)",
  status: "implemented",
  abilities: [
    { kind: "keyword", keyword: "Temporary", value: 0 },
    {
      kind: "spell",
      effect: {
        op: "create",
        token: token("Sprite", { might: 3, exhausted: false, keywords: ["Temporary"], play: true }),
        zone: "base",
      },
    },
  ],
});
