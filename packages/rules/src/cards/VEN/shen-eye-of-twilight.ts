/** Shen, Eye of Twilight. */
import { aUnit, registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Shen, Eye of Twilight",
  text: "[Action] [Tap]: Give a friendly unit [Tank] this turn. (It must be assigned combat damage first.)",
  status: "implemented",
  abilities: [
    {
      kind: "activated",
      cost: { exhaust: SELF },
      keywords: ["action"],
      effect: {
        op: "grant_keyword",
        keyword: "Tank",
        target: aUnit({ controller: "self" }),
        duration: "this-turn",
      },
    },
  ],
});
