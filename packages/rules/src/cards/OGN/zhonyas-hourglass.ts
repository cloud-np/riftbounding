/** Zhonya's Hourglass (OGN-077 (Origins errata) — EX[130]/EX[138] (369.1, 370.1.a.1). [Hidden] is R2-play's.) */
import { registerCardScript } from "../registry";
import { EVENT_SUBJECT, SELF } from "../dsl";

registerCardScript({
  name: "Zhonya's Hourglass",
  text: "[Hidden] (Hide now for [Rune] to react with later for [0].)\nIf a friendly unit would die, kill this instead. Heal that unit,\nexhaust it, and recall it. (Send it to base. This isn't a move.)",
  status: "partial",
  notes: "Hidden (811) is R2-play's keyword.",
  abilities: [
    {
      kind: "replacement",
      matches: { type: "kill", subject: { cardType: "unit", controller: "self" } },
      replace: {
        op: "seq",
        effects: [
          { op: "kill", target: SELF },
          { op: "heal", amount: 99, target: EVENT_SUBJECT },
          { op: "exhaust", target: EVENT_SUBJECT },
          { op: "recall", target: EVENT_SUBJECT },
        ],
      },
    },
  ],
});
