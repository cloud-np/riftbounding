/**
 * Poppy, Paragon (UNL-116) — [Deflect] (809, engine keyword). Play Effect whose "if" is part of
 * the trigger condition (383.2.a.1): an opponent is within 3 points of the Victory Score
 * (battlefield adjustments included).
 */
import { registerCardScript } from "../registry";
import { SELF, WHEN_PLAYED, custom } from "../dsl";

registerCardScript({
  name: "Poppy, Paragon",
  text: "[Deflect] (Opponents must pay [Rune] to choose me with a spell or ability.)\nWhen you play me, if an opponent's score is within 3 points of the Victory Score, ready me and gain 3 XP.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      condition: custom("unl:opponent-within", { points: 3 }),
      effect: {
        op: "seq",
        effects: [
          { op: "ready", target: SELF },
          { op: "gain_xp", amount: 3 },
        ],
      },
    },
  ],
});
