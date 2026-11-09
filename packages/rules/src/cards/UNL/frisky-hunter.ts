/**
 * Frisky Hunter (UNL-033) — Play Effect: play a 1 [Might] Bird token with [Deflect] here (440.2.c,
 * 179–187). The catalog's [Deflect] is the token's, not mine (135.2.d.3).
 */
import { registerCardScript } from "../registry";
import { HERE, WHEN_PLAYED, token } from "../dsl";

registerCardScript({
  name: "Frisky Hunter",
  text: "When you play me, play a 1 [Might] Bird unit token with [Deflect] here. (Opponents must pay [Rune] to choose it with a spell or ability.)",
  status: "implemented",
  abilities: [
    { kind: "keyword", keyword: "Deflect", value: 0 },
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: {
        op: "create",
        token: token("Bird", { might: 1, keywords: ["Deflect"], play: true }),
        zone: HERE,
      },
    },
  ],
});
