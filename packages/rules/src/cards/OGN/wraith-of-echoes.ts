/** Wraith of Echoes (OGN-118 (FAQ errata) — EX[157] (383.1.b). "The first time … each turn" is a once-per-turn trigger.) */
import { registerCardScript } from "../registry";

registerCardScript({
  name: "Wraith of Echoes",
  text: "The first time another friendly unit dies each turn, draw 1",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "die", subject: { cardType: "unit", controller: "self", excludeSource: true } } },
      limit: { kind: "once-per-turn" },
      effect: { op: "draw", amount: 1 },
    },
  ],
});
