/** Draven, Audacious. */
import { custom, registerCardScript, SELF } from "../sdk";
import { WHEN_I_WIN_A_COMBAT } from "./custom";

registerCardScript({
  name: "Draven, Audacious",
  text: "[Deflect] (Opponents must pay [Rune] to choose me with a spell or ability.)\nThe first time I win a combat each turn, you score 1 point.\nWhen I die in combat, choose an opponent. They score 1 point.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_WIN_A_COMBAT,
      limit: { kind: "once-per-turn" },
      effect: { op: "score_points", amount: 1 },
    },
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: { type: "die", subject: SELF, condition: custom("sfd:died-in-combat") },
      },
      effect: { op: "score_points", amount: 1, player: { kind: "chosen", ref: "opponent" } },
    },
  ],
});
