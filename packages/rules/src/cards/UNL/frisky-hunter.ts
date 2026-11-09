/**
 * Frisky Hunter (UNL-033) — Play Effect: play a 1 [Might] Bird token with [Deflect] here (440.2.c,
 * 179–187). The catalog's [Deflect] is the token's, not mine (135.2.d.3).
 */
import { HERE, registerCardScript, token, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Frisky Hunter",
  text: "When you play me, play a 1 [Might] Bird unit token with [Deflect] here. (Opponents must pay [Rune] to choose it with a spell or ability.)",
  status: "implemented",
  abilities: [
    { kind: "suppress-printed-keyword", keyword: "Deflect" },
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: {
        op: "create",
        token: token("Bird", { might: 1, play: true }),
        zone: HERE,
      },
    },
  ],
});
