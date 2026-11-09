/** Pyke, Returned. */
import { registerCardScript, SELF_AT_BATTLEFIELD, token } from "../sdk";

registerCardScript({
  name: "Pyke, Returned",
  text: '[Hidden] (Hide now for [Rune] to react with later for [0].)\n[Backline] (I must be assigned combat damage last.)\nOnce each turn, when an enemy unit dies while I\'m at a battlefield, play a Gold gear token exhausted. (It has "[Reaction] Kill this, [Tap]: [Add] [Rune].")',
  status: "implemented",
  abilities: [
    { kind: "suppress-printed-keyword", keyword: "Reaction" },
    { kind: "suppress-printed-keyword", keyword: "Add" },
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: { type: "die", subject: { cardType: "unit", controller: "opponent" } },
      },
      condition: SELF_AT_BATTLEFIELD,
      limit: { kind: "once-per-turn" },
      effect: { op: "create", token: token("Gold", { exhausted: true, play: true }) },
    },
  ],
});
