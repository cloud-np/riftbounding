/** Rally the Troops. */
import { EVENT_SUBJECT, registerCardScript } from "../sdk";

registerCardScript({
  name: "Rally the Troops",
  text: "[Action] (Play on your turn or in showdowns.)\nWhen a friendly unit is played this turn, buff it. (If it doesn't have a buff, it gets a +1 [Might] buff.)\nDraw 1.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "delayed",
            trigger: { kind: "event", event: { type: "unit_played", player: "self" } },
            effect: { op: "buff", target: EVENT_SUBJECT },
            duration: "this-turn",
          },
          { op: "draw", amount: 1 },
        ],
      },
    },
  ],
});
