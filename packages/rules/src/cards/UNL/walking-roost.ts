/**
 * Walking Roost (UNL-130) — [Deflect] (809, engine keyword). Play Effect: the chosen opponent plays
 * a 1 [Might] Bird token with [Deflect]; they own and control it (182/183/440.4), in their base
 * (440.2.b.1).
 */
import { registerCardScript } from "../registry";
import { WHEN_PLAYED, token } from "../dsl";

registerCardScript({
  name: "Walking Roost",
  text: "[Deflect] (Opponents must pay [Rune] to choose me with a spell or ability.)\nWhen you play me, choose an opponent. They play a 1 [Might] Bird unit token with [Deflect].",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: {
        op: "create",
        token: token("Bird", { might: 1, play: true }),
        player: { kind: "chosen", ref: "opponent" },
      },
    },
  ],
});
