/**
 * Malzahar, Fanatic (OGN-113) — "Kill a friendly unit or gear, [tap]: [action] - [add] [rune]
 * [rune]." An Add ability (430.2) with Action timing; the kill cost is a cost object (357.2).
 */
import { registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Malzahar, Fanatic",
  text: "Kill a friendly unit or gear, [tap] : [action] - [add] [rune] [rune]. (Use on your turn or in showdowns. Abilities that add resources can't be reacted to.)",
  status: "implemented",
  abilities: [
    {
      kind: "activated",
      cost: { kill: { controller: "self" }, exhaust: SELF },
      keywords: ["action"],
      addsResources: true,
      effect: { op: "add", resources: { power: { any: 2 } } },
    },
  ],
});
